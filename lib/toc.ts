/**
 * 目录树标题提取（供 ArticleTree 使用）
 *
 * 从 lib/markdown.ts 拆出：这些是纯字符串函数，客户端组件 ArticleTree
 * 也要用。若直接从 markdown.ts 引入，会把 marked / link-cards /
 * link-preview 整条链（含 node:net）打进浏览器 bundle，导致
 * webpack UnhandledSchemeError。
 *
 * 本文件必须保持零依赖，不要 import 任何 Node 内建模块或第三方包。
 */

export interface TocHeading {
  level: number
  id: string
  text: string
}

/**
 * 从 Markdown 提取标题列表，生成 TOC（FRONTEND_PLAN 第 7 节）。
 * 统计各级标题数得出 firstLevel。
 * id 与 renderMarkdown 注入的 `title-{index}` 一一对应。
 */
export function extractHeadings(text: string): TocHeading[] {
  const lines = text.split('\n')
  const headings: TocHeading[] = []
  let idx = 0
  let inCodeBlock = false
  for (const line of lines) {
    // 跳过代码围栏内的内容
    if (/^```/.test(line.trim())) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue
    const m = /^(#{1,6})\s+(.+)$/.exec(line)
    if (m) {
      idx += 1
      headings.push({
        level: m[1].length,
        id: `title-${idx}`,
        text: m[2].trim(),
      })
    }
  }
  return headings
}

/**
 * 计算 TOC 的 firstLevel（最小标题级别），用于 level = tagLevel - firstLevel + 1。
 */
export function firstLevel(headings: TocHeading[]): number {
  if (!headings.length) return 1
  return Math.min(...headings.map((h) => h.level))
}
