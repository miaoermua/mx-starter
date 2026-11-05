import { fetchComments, fetchPage } from '@/lib/api'
import { getAggregate } from '@/lib/api/server'
import { notFound } from 'next/navigation'
import { renderMarkdown } from '@/lib/markdown'
import { ReadAck } from '@/components/post/ReadAck'
import { CommentSection } from '@/components/comment/CommentSection'

/**
 * 独立页面（page.php → PagePage）
 *
 * DOM 契约：section.page-title > h2；article.page-content（特殊页加 .is-special）
 * 独立页面同样支持阅读上报与评论（core 的 ack type 可为 page）。
 */
export default async function PagePage({
  params,
}: {
  params: { slug: string }
}) {
  const page = await fetchPage(params.slug)
  if (!page) notFound()

  const [comments, aggregate] = await Promise.all([
    fetchComments(page.id, 1, 10),
    getAggregate(),
  ])
  const commentTotal = comments.pagination?.total ?? comments.items.length
  const html = renderMarkdown(page.text)

  return (
    <main>
      <div className="wrap min">
        <section className="page-title">
          <h2>{page.title}</h2>
        </section>
        <article className="page-content">
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </article>

        <ReadAck postId={page.id} type="page" />

        <CommentSection
          postId={page.id}
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
