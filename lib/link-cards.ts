/**
 * 链接卡片（LinkCard）脚注解析与 SSR 预取 —— 【脚手架自带：kami 扩展移植，可整组移除】
 *
 * kami 扩展能力移植：把 markdown 脚注引用渲染成链接卡片。
 * 语法与 kami 对齐（KamiMarkdown）：
 *   定义：[^N]: <url>     同站 notes/{nid}、posts/{分类}/{slug} 走 self；其他 http/https 走 external
 *   引用：正文中的 [^N]   渲染成卡片（gh 源仅支持 <LinkCard source="gh"> 手动用法，脚注不自动识别）
 *
 * 脚手架默认正文链接是普通 <a>，此能力为可选扩展。
 */

import { fetchNote, fetchPostDetail } from './api'
import { fetchLinkMetadata } from './link-preview'

/* ---------- 类型 ---------- */

export type LinkCardSource = 'gh' | 'self' | 'external'

/** 脚注解析出的卡片引用（渲染前） */
export interface LinkCardRef {
  /** 脚注号，即 [^N] 的 N */
  ref: string
  source: LinkCardSource
  /** self: 站内路径（notes/111、posts/cat/slug）；external: 目标 URL；gh: owner/repo */
  id: string
  url?: string
}

/** SSR 预取后的卡片数据；null 表示预取失败，组件降级为朴素链接卡 */
export interface LinkCardData {
  title: string
  desc?: string
  image?: string
  href: string
}

/* ---------- markdown 剥离（desc 摘要用，替代 remove-markdown 依赖） ---------- */

function stripMarkdown(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/* ---------- 脚注定义识别 ---------- */

const FOOTNOTE_DEF = /^\[\^([^\]]+)\]:\s*(\S+)\s*$/
const SELF_NOTES = /^notes\/\d+$/
const SELF_POSTS = /^posts\/[^/]+\/[^/]+$/

function classifyCardTarget(ref: string, target: string): LinkCardRef | null {
  if (SELF_NOTES.test(target) || SELF_POSTS.test(target)) {
    return { ref, source: 'self', id: target }
  }
  if (/^https?:\/\//.test(target)) {
    return { ref, source: 'external', id: target, url: target }
  }
  // 未识别的定义按普通正文保留（不抽成卡片）
  return null
}

export interface ExtractResult {
  /** 已替换引用占位、删除卡片定义行后的正文（交给 marked 渲染） */
  body: string
  /** 按引用顺序排列的卡片列表 */
  cards: LinkCardRef[]
}

/**
 * 从 markdown 中抽取脚注卡片定义，并把正文里的 [^N] 引用替换为占位注释。
 * 代码围栏内的定义与引用不处理（与 extractHeadings 的围栏跳过逻辑一致）。
 */
export function extractFootnoteCards(text: string): ExtractResult {
  const lines = text.split('\n')
  const cards: LinkCardRef[] = []
  const cardMap = new Map<string, LinkCardRef>()
  const bodyLines: string[] = []
  let inCodeBlock = false

  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      inCodeBlock = !inCodeBlock
      bodyLines.push(line)
      continue
    }
    if (!inCodeBlock) {
      const def = FOOTNOTE_DEF.exec(line.trim())
      if (def) {
        const card = classifyCardTarget(def[1], def[2])
        if (card) {
          cards.push(card)
          cardMap.set(card.ref, card)
          continue // 定义行不进正文
        }
      }
    }
    bodyLines.push(line)
  }

  // 正文引用替换：只替换已定义卡片的 [^N]，其余原文保留
  inCodeBlock = false
  const replaced = bodyLines
    .map((line) => {
      if (/^```/.test(line.trim())) {
        inCodeBlock = !inCodeBlock
        return line
      }
      if (inCodeBlock) return line
      return line.replace(/\[\^([^\]]+)\]/g, (m, ref: string) =>
        cardMap.has(ref) ? `\n\n<!--linkcard:${ref}-->\n\n` : m,
      )
    })
    .join('\n')

  return { body: replaced, cards }
}

/* ---------- SSR 预取 ---------- */

const CARD_FETCH_TIMEOUT_MS = 6000

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('link card fetch timeout')), ms),
    ),
  ])
}

async function resolveSelf(card: LinkCardRef): Promise<LinkCardData> {
  const notesMatch = /^notes\/(\d+)$/.exec(card.id)
  if (notesMatch) {
    const note = await fetchNote(notesMatch[1])
    if (!note) throw new Error('note not found')
    const plain = stripMarkdown(note.content || '')
    return {
      title: note.title || plain.slice(0, 20) || `日记 #${note.nid}`,
      desc: plain.slice(0, 50),
      image: undefined,
      href: `/${card.id}`,
    }
  }

  const postsMatch = /^posts\/([^/]+)\/([^/]+)$/.exec(card.id)
  if (postsMatch) {
    const post = await fetchPostDetail(postsMatch[1], postsMatch[2])
    if (!post) throw new Error('post not found')
    const plain = stripMarkdown(post.text || '')
    return {
      title: post.title,
      desc: post.summary || plain.slice(0, 50),
      image: post.cover || post.images?.[0],
      href: `/${card.id}`,
    }
  }

  throw new Error(`unknown self card path: ${card.id}`)
}

interface GhRepoResponse {
  full_name?: string
  description?: string | null
  html_url?: string
  owner?: { avatar_url?: string }
}

async function resolveGh(card: LinkCardRef): Promise<LinkCardData> {
  const [namespace, repo, ...rest] = card.id.split('/')
  if (!namespace || !repo || rest.length > 0) {
    throw new Error(`invalid gh card id: ${card.id}`)
  }
  const res = await fetch(`https://api.github.com/repos/${namespace}/${repo}`, {
    signal: AbortSignal.timeout(CARD_FETCH_TIMEOUT_MS),
    headers: {
      // GitHub API 要求非空 UA
      'user-agent': 'mx-starter-linkcard',
      accept: 'application/vnd.github+json',
    },
  })
  if (!res.ok) throw new Error(`github api ${res.status}`)
  const data = (await res.json()) as GhRepoResponse
  return {
    title: data.full_name || card.id,
    desc: data.description || undefined,
    image: data.owner?.avatar_url,
    href: data.html_url || `https://github.com/${card.id}`,
  }
}

async function resolveExternal(card: LinkCardRef): Promise<LinkCardData> {
  const target = card.url || card.id
  const meta = await fetchLinkMetadata(target)
  return {
    title: meta.title || new URL(target).hostname,
    desc: meta.description || target,
    image: meta.image || undefined,
    href: meta.url || target,
  }
}

async function resolveOne(card: LinkCardRef): Promise<LinkCardData | null> {
  try {
    const data = await withTimeout(
      card.source === 'self'
        ? resolveSelf(card)
        : card.source === 'gh'
          ? resolveGh(card)
          : resolveExternal(card),
      CARD_FETCH_TIMEOUT_MS,
    )
    return data
  } catch {
    // 预取失败统一降级：组件收到 null，渲染朴素链接卡
    return null
  }
}

/**
 * 并发预取全部卡片数据。单卡失败/超时返回 null，不影响其他卡片与整页 SSR。
 */
export async function resolveLinkCards(
  cards: LinkCardRef[],
): Promise<Map<string, LinkCardData | null>> {
  const result = new Map<string, LinkCardData | null>()
  const settled = await Promise.all(cards.map((c) => resolveOne(c)))
  cards.forEach((c, i) => result.set(c.ref, settled[i]))
  return result
}
