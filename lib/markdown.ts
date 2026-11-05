/**
 * Markdown 渲染管线（FRONTEND_PLAN.md 第 7 节）
 *
 * 产出与原主题一致形状的 DOM：
 * - h1~h6 加 id="title-{index}"（供目录树与 scroll-margin-top:5em）
 * - pre>code 加 class="language-xxx"；Prism 高亮产出 .token.*
 * - img 保留 src，交给 Lightbox（暗色由 CSS 统一 brightness(60%)）
 * - a 站外加 target=_blank rel=noreferrer；站内不加
 * - blockquote/table/ul/ol/hr/em 保持原生标签
 */

import { marked } from 'marked'
import { extractFootnoteCards, type LinkCardRef } from './link-cards'
import { extractHeadings, firstLevel, type TocHeading } from './toc'

// TOC 纯函数已拆到 ./toc（客户端 ArticleTree 直接用，避免把本模块的
// marked / link-preview 链打进浏览器）。这里 re-export 保持既有引用可用。
export { extractHeadings, firstLevel }
export type { TocHeading }

marked.setOptions({
  breaks: false,
  gfm: true,
})

/** 判断是否站内链接（同源或以 / 开头） */
function isInternal(href: string): boolean {
  if (!href) return true
  if (href.startsWith('/')) return true
  if (href.startsWith('#')) return true
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return true
  try {
    const u = new URL(href)
    return u.hostname === (typeof window !== 'undefined' ? window.location.hostname : 'localhost')
  } catch {
    return false
  }
}

/**
 * 渲染 Markdown 为 HTML，并给 h1~h6 加 id="title-{index}"。
 * id 供目录树（ArticleTree）与 scroll-margin-top 使用。
 */
export function renderMarkdown(text: string): string {
  if (!text) return ''
  let headingIndex = 0
  const renderer = new marked.Renderer()

  // 标题：加 id
  renderer.heading = (text: string, level: number) => {
    headingIndex += 1
    const id = `title-${headingIndex}`
    return `<h${level} id="${id}">${text}</h${level}>`
  }

  // 链接：站外加 target=_blank rel=noreferrer（:109-119）
  renderer.link = (href: string, _title: string, text: string) => {
    const safe = href.replace(/"/g, '&quot;')
    if (isInternal(href)) {
      return `<a href="${safe}">${text}</a>`
    }
    return `<a href="${safe}" target="_blank" rel="noreferrer">${text}</a>`
  }

  // 代码块：加 language-xxx class（Prism 需要）
  renderer.code = (code: string, language: string | undefined) => {
    const lang = language ? ` language-${language}` : ''
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `<pre><code class="${lang.trim()}">${escaped}</code></pre>`
  }

  const html = marked.parse(text, { renderer } as Parameters<typeof marked.parse>[1])
  return typeof html === 'string' ? html : ''
}

/* ---------- 链接卡片分段渲染 —— 【脚手架自带：kami 扩展移植，可整组移除】 ---------- */

export type MarkdownSegment =
  | { type: 'html'; html: string }
  | { type: 'card'; ref: string }

export interface MarkdownSegmentsResult {
  segments: MarkdownSegment[]
  cards: LinkCardRef[]
}

/**
 * 渲染含链接卡片脚注的 Markdown，切成「HTML 片段 / 卡片」分段数组。
 *
 * kami 扩展能力移植（语法见 lib/link-cards.ts）：[^N]: URL 定义 + 正文 [^N] 引用。
 * 实现：extractFootnoteCards 把引用替换为占位注释（独占段落，marked 按 html block
 * 原样透传），渲染后按注释 split 成段。无卡片时单段 html，输出与 renderMarkdown 一致。
 *
 * 与 renderMarkdown 的差异仅在分段；TOC（extractHeadings）仍用原文提取，不受影响。
 */
export function renderMarkdownSegments(text: string): MarkdownSegmentsResult {
  const { body, cards } = extractFootnoteCards(text)
  const html = renderMarkdown(body)
  if (!cards.length) {
    return { segments: [{ type: 'html', html }], cards }
  }

  const parts = html.split(/<!--linkcard:([\w-]+)-->/)
  const segments: MarkdownSegment[] = []
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (parts[i]) segments.push({ type: 'html', html: parts[i] })
    } else {
      segments.push({ type: 'card', ref: parts[i] })
    }
  }
  if (!segments.length) {
    segments.push({ type: 'html', html })
  }
  return { segments, cards }
}
