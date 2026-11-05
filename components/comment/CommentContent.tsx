/**
 * 评论正文：实体解码 + Markdown 转义还原 + URL 自动转链接
 *
 * Typecho 后端输出的是渲染后的 HTML（实体已解码、裸 URL 已转 <a>）。
 * core 返回的 text 是原始文本（可能带 &gt; 等实体和 \( 转义），
 * 这里在前端做等价还原，但只用 React 节点渲染，不注入 HTML。
 */
const URL_SPLIT = /(https?:\/\/[^\s<>"']+)/g

/** 单层 HTML 实体解码；&amp; 放最后避免二次解码 */
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

/** Markdown 反斜杠转义：\( \* \_ 等还原成字面字符 */
function unescapeMarkdown(s: string): string {
  return s.replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, '$1')
}

export function CommentContent({ text }: { text: string }) {
  const normalized = unescapeMarkdown(decodeEntities(text))
  const parts = normalized.split(URL_SPLIT)

  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null
        if (/^https?:\/\//.test(part)) {
          return (
            <a key={i} href={part} target="_blank" rel="external nofollow noopener">
              {part}
            </a>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}
