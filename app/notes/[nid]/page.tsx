import { fetchComments, fetchNoteWithAccess } from '@/lib/api'
import { resolveNotePageAction } from '@/lib/api/note-access'
import { getAggregate } from '@/lib/api/server'
import { notFound } from 'next/navigation'
import { renderMarkdown } from '@/lib/markdown'
import { ArticleTree } from '@/components/content/ArticleTree'
import { LikeButton } from '@/components/post/LikeButton'
import { ReadAck } from '@/components/post/ReadAck'
import { CommentSection } from '@/components/comment/CommentSection'

/**
 * 日记详情（mx 特性 → NotePage，M3）
 *
 * 复用 post.php 版式，与文章页展示一致。
 * GET /notes/nid/:nid → core v12.x 返回 { data: {...} }
 */
export default async function NotePage({
  params,
  searchParams,
}: {
  params: { nid: string }
  searchParams?: { password?: string }
}) {
  const password = searchParams?.password
  const access = await fetchNoteWithAccess(params.nid, password)
  const action = resolveNotePageAction(access)

  // 基础设施故障（core 5xx / 429 / 网络错误 / WAF 403）交给 error.tsx（HTTP 500 + 重试），
  // 绝不降级成 404：那会让「Core 挂了」看起来像「这篇日记不存在」。
  if (action === 'error') {
    throw new Error('日记服务暂时不可用')
  }

  // 只有 403 + 业务码 14000（NoteForbidden）才算密码错误
  if (action === 'password') {
    return (
      <main>
        <div className="wrap min">
          <section className="post-title">
            <h2>日记已加密</h2>
          </section>
          <form className="post-password" method="get">
            <input
              type="password"
              name="password"
              placeholder="输入访问密码"
              required
            />
            <button type="submit">查看</button>
          </form>
        </div>
      </main>
    )
  }

  if (!access.note) notFound()
  const note = access.note

  const [comments, aggregate] = await Promise.all([
    fetchComments(note.id, 1, 10),
    getAggregate(),
  ])
  const commentTotal = comments.pagination?.total ?? comments.items.length
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
            <span className="comments">{commentTotal}</span>
          </div>
        </section>

        <article className="post-content">
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </article>

        {/* 目录树 */}
        <ArticleTree markdownText={note.content} />

        {/* 阅读数上报：core 的 type 是 post / note */}
        <ReadAck postId={note.id} type="note" />

        {/* 点赞按钮 */}
        <LikeButton
          postId={note.id}
          type="note"
          initialLikes={note.likeCount ?? 0}
          initialLiked={note.liked}
        />

        {/* 评论区：core 按 refId 查询，不区分 ref 类型 */}
        <CommentSection
          postId={note.id}
          allowComment={!aggregate.commentOptions?.disableComment}
          initialItems={comments.items}
          initialTotal={commentTotal}
          initialPage={comments.pagination?.page ?? 1}
          initialTotalPages={comments.pagination?.totalPages ?? 1}
        />
      </div>
    </main>
  )
}
