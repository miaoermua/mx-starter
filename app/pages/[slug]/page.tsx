import { fetchPage } from '@/lib/api'
import { notFound } from 'next/navigation'
import { renderMarkdown } from '@/lib/markdown'

/**
 * 独立页面（page.php → PagePage）
 *
 * DOM 契约：section.page-title > h2；article.page-content（特殊页加 .is-special）
 */
export default async function PagePage({
  params,
}: {
  params: { slug: string }
}) {
  const page = await fetchPage(params.slug)
  if (!page) notFound()

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
      </div>
    </main>
  )
}
