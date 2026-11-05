/**
 * mx 标准 Markdown 扩展（按 core 的语法契约实现，独立编写）
 *
 * 语法与产物（与 core 服务端渲染同构）：
 * - ||剧透||                    → <span class="spoiler">
 * - $行内公式$                  → <span class="katex-render">（公式渲染交给主题，通常接 KaTeX）
 * - {GH@user} {TW@user} {TG@user} → <a class="mention">
 * - ::: gallery ... :::         → <div class="container">（图片组）
 * - ::: banner {params} ... ::: → <div class="container banner {params}">
 * - ![!图注](src)               → <figure><img><figcaption>
 * - ```mermaid                  → <pre class="mermaid">
 *
 * 同时提供通用渲染器覆盖：标题锚点 id、站外链接、代码语言 class。
 * 本文件只依赖 marked，可单独测试。
 */

import { Marked, type TokenizerAndRendererExtension } from 'marked'

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const escapeAttr = (s: string) => escapeHtml(s).replace(/"/g, '&quot;')

/** 站内链接判定（/ 开头、hash、mailto/tel、同源） */
export function isInternal(href: string): boolean {
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

/** ||spoiler|| */
const spoiler: TokenizerAndRendererExtension = {
  name: 'spoiler',
  level: 'inline',
  start(src: string) {
    return src.indexOf('||')
  },
  tokenizer(src: string) {
    const match = /^\|\|([\S\s]+?)\|\|(?!\|)/.exec(src)
    if (!match) return undefined
    return {
      type: 'spoiler',
      raw: match[0],
      tokens: this.lexer.inlineTokens(match[1].trim()),
    }
  },
  renderer(token: any) {
    return `<span class="spoiler">${this.parser.parseInline(token.tokens)}</span>`
  },
}

/** $行内公式$ */
const inlineMath: TokenizerAndRendererExtension = {
  name: 'katex',
  level: 'inline',
  start(src: string) {
    return src.indexOf('$')
  },
  tokenizer(src: string) {
    const match = /^\$([\S\s]+?)\$(?!\$)/.exec(src)
    if (!match) return undefined
    return { type: 'katex', raw: match[0], text: match[1].trim() }
  },
  renderer(token: any) {
    return `<span class="katex-render">${escapeHtml(token.text)}</span>`
  },
}

/** {GH@user} / {TW@user} / {TG@user} */
const MENTION_HOSTS: Record<string, string> = {
  GH: 'https://github.com/',
  TW: 'https://twitter.com/',
  TG: 'https://t.me/',
}

const mention: TokenizerAndRendererExtension = {
  name: 'mention',
  level: 'inline',
  start(src: string) {
    return src.indexOf('{')
  },
  tokenizer(src: string) {
    const match = /^{((?<prefix>GH|TW|TG)@(?<name>\w+\b))}\s?/.exec(src)
    if (!match) return undefined
    const { prefix, name } = match.groups as { prefix: string; name: string }
    return { type: 'mention', raw: match[0], prefix, text: name }
  },
  renderer(token: any) {
    const href = `${MENTION_HOSTS[token.prefix]}${escapeAttr(token.text)}`
    return `<a class="mention" href="${href}" target="_blank" rel="noreferrer nofollow">${escapeHtml(token.text)}</a>`
  },
}

/** ::: gallery / ::: banner {params} */
const container: TokenizerAndRendererExtension = {
  name: 'container',
  level: 'block',
  start(src: string) {
    return src.indexOf(':::')
  },
  tokenizer(src: string) {
    const match = new RegExp(
      // 结尾换行可省略（文档末尾直接闭合 ::: 也能解析）
      '^\\s*::: *(?<name>(gallery|banner)) *({(?<params>(.*?))})? *\n(?<content>[\\s\\S]+?)\\s*::: *(?:\\n *)*\\n?',
    ).exec(src)
    if (!match) return undefined
    const { name, params, content } = match.groups as {
      name: string
      params?: string
      content: string
    }
    return {
      type: 'container',
      raw: match[0],
      name,
      params: params || '',
      images: this.lexer.inlineTokens(content),
      blocks: this.lexer.blockTokens(content),
    }
  },
  renderer(token: any) {
    if (token.name === 'gallery') {
      return `<div class="container">${this.parser.parseInline(token.images)}</div>`
    }
    if (token.name === 'banner') {
      const cls = ['container', 'banner', token.params].filter(Boolean).join(' ')
      return `<div class="${cls}">${this.parser.parse(token.blocks)}</div>`
    }
    return ''
  },
}

/** 创建一次渲染用的实例（标题序号每次从 1 开始，避免模块级状态） */
export function createMarked() {
  let headingIndex = 0

  const instance = new Marked({
    gfm: true,
    breaks: false,
    extensions: [spoiler, inlineMath, mention, container],
  })

  instance.use({
    renderer: {
      heading(text: string, level: number) {
        headingIndex += 1
        return `<h${level} id="title-${headingIndex}">${text}</h${level}>`
      },
      link(href: string, title: string | null | undefined, text: string) {
        const safe = escapeAttr(href)
        const titleAttr = title ? ` title="${escapeAttr(title)}"` : ''
        if (isInternal(href)) return `<a href="${safe}"${titleAttr}>${text}</a>`
        return `<a href="${safe}"${titleAttr} target="_blank" rel="noreferrer">${text}</a>`
      },
      image(src: string, title: string | null, alt: string | null) {
        if (typeof src !== 'string') return ''
        const rawAlt = alt || ''
        // alt 以 ! 或 ¡ 开头 → 输出 figure + figcaption
        const isCaption = /^[!¡]/.test(rawAlt)
        const caption = rawAlt.replace(/^[!¡]/, '')
        const safeSrc = escapeAttr(src)
        if (!isCaption) return `<img src="${safeSrc}" alt="${escapeAttr(rawAlt)}">`
        return `<figure><img src="${safeSrc}" alt="${escapeAttr(caption)}"><figcaption>${escapeHtml(title || caption)}</figcaption></figure>`
      },
      code(code: string, language: string | undefined) {
        if (language === 'mermaid') return `<pre class="mermaid">${escapeHtml(code)}</pre>`
        const lang = language ? ` language-${escapeAttr(language)}` : ''
        return `<pre><code class="${lang.trim()}">${escapeHtml(code)}</code></pre>`
      },
    },
  })

  return instance
}
