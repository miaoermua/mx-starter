import { fetchNote } from '@/lib/api'
import { notFound } from 'next/navigation'
import { renderMarkdown } from '@/lib/markdown'
import { ArticleTree } from '@/components/content/ArticleTree'
import { LikeButton } from '@/components/post/LikeButton'

/**
 * 日记详情（mx 特性 → NotePage，M3）
 *
 * 复用 post.php 版式，与文章页展示一致。
 * GET /notes/nid/:nid → core v12.x 返回 { data: {...} }
 */
export default async function NotePage({
  params,
}: {
  params: { nid: string }
}) {
  const note = await fetchNote(params.nid)
  if (!note) notFound()

  const html = renderMarkdown(note.content)

  return (
    <main>
      <div className="wrap min">
        <section className="post-title">
          <h2>{note.title || `日记 #${note.nid}`}</h2>
          <div className="post-meta">
            <time className="date">
              {new Date(note.created).toLocaleDateString('zh-CN')}
            </time>
            {note.mood && <span className="category">心情：{note.mood}</span>}
            {note.weather && (
              <span className="category">天气：{note.weather}</span>
            )}
            {typeof note.readCount === 'number' && (
              <span className="view">{note.readCount}</span>
            )}
          </div>
        </section>

        <article className="post-content">
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </article>

        {/* 目录树 */}
        <ArticleTree markdownText={note.content} />

        {/* 点赞按钮 */}
        <LikeButton postId={note.id} initialLikes={note.likeCount ?? 0} />
      </div>
    </main>
  )
}
