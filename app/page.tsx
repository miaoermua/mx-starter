import Link from 'next/link'
import { fetchPosts } from '@/lib/api'
import { getAggregate } from '@/lib/api/server'

/**
 * 首页（index.php → HomePage）
 *
 * DOM 契约：
 * main > .wrap.min > section.home-title > h1 + span + .home-social；
 * section.home-posts > .post-item*（h2>a、p、.post-meta > time.date / span.category / span.tags / span.comments）；
 * section.page-navigator > span
 *
 * 分页：GET /?page=N，SSR 渲染 div.page-navigator > span（current 高亮）
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const agg = await getAggregate()
  const page = Math.max(1, Number(searchParams.page || '1'))
  const { items: posts, pagination } = await fetchPosts(page, 10)

  const siteName = agg.seo?.title || agg.user?.name || 'mx-starter'
  const siteDesc = agg.seo?.description || agg.user?.description || ''

  const totalPages = pagination?.totalPages ?? 1
  const currentPage = pagination?.page ?? page

  // 生成分页页码列表（首页、末页、当前页前后 2 页，用 null 表示省略号）
  const pageNumbers: (number | null)[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i)
  } else {
    pageNumbers.push(1)
    const start = Math.max(2, currentPage - 1)
    const end = Math.min(totalPages - 1, currentPage + 1)
    if (start > 2) pageNumbers.push(null)
    for (let i = start; i <= end; i++) pageNumbers.push(i)
    if (end < totalPages - 1) pageNumbers.push(null)
    pageNumbers.push(totalPages)
  }

  return (
    <main>
      <div className="wrap min">
        <section className="home-title">
          <h1>{siteName}</h1>
          <span>{siteDesc}</span>
        </section>

        <section className="home-posts">
          {posts.map((post) => (
            <div className="post-item" key={post.id}>
              <h2>
                {/* core 列表默认把置顶文章排在前面，pinAt 供主题打「置顶」角标 */}
                {post.pinAt && <span className="pin">置顶 </span>}
                <Link
                  href={`/posts/${post.categorySlug || 'uncategorized'}/${post.slug}`}
                >
                  {post.title}
                </Link>
              </h2>
              <p>{post.summary}</p>
              <div className="post-meta">
                <time className="date">
                  {new Date(post.created).toLocaleDateString('zh-CN')}
                </time>
                {post.category && (
                  <span className="category">{post.category}</span>
                )}
                {post.tags && post.tags.length > 0 && (
                  <span className="tags">{post.tags.join('，')}</span>
                )}
                <span className="comments">
                  {post.count?.read ?? 0} °C
                </span>
              </div>
            </div>
          ))}
        </section>

        {totalPages > 1 && (
          <section className="page-navigator">
            {currentPage > 1 && (
              <span>
                <Link href={currentPage === 2 ? '/' : `/?page=${currentPage - 1}`}>
                  «
                </Link>
              </span>
            )}
            {pageNumbers.map((n, i) =>
              n === null ? (
                <span key={`gap-${i}`}>…</span>
              ) : (
                <span key={n} className={n === currentPage ? 'current' : ''}>
                  <Link href={n === 1 ? '/' : `/?page=${n}`}>{n}</Link>
                </span>
              ),
            )}
            {currentPage < totalPages && (
              <span>
                <Link href={`/?page=${currentPage + 1}`}>»</Link>
              </span>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
