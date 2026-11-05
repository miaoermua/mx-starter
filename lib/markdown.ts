/**
 * Markdown 渲染管线
 *
 * 语法能力见 lib/markdown-extensions.ts（mx 标准扩展 + 通用渲染器覆盖）。
 * 本文件只负责：调用渲染实例、链接卡片分段（脚手架自带，可整组移除）。
 */

import { createMarked } from './markdown-extensions'
import { extractFootnoteCards, type LinkCardRef } from './link-cards'
import { extractHeadings, firstLevel, type TocHeading } from './toc'

// TOC 纯函数已拆到 ./toc（客户端 ArticleTree 直接用，避免把本模块的
// marked / link-preview 链打进浏览器）。这里 re-export 保持既有引用可用。
export { extractHeadings, firstLevel }
export type { TocHeading }

/** 渲染 Markdown 为 HTML（每次调用独立实例，标题序号从 1 开始） */
export function renderMarkdown(text: string): string {
  if (!text) return ''
  const html = createMarked().parse(text)
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
 * [^N]: URL 定义 + 正文 [^N] 引用（语法见 lib/link-cards.ts）。
 * 实现：extractFootnoteCards 把引用替换为占位注释（独占段落，marked 按 html block
 * 原样透传），渲染后按注释 split 成段。无卡片时单段 html，输出与 renderMarkdown 一致。
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
