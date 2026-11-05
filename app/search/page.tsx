import Link from 'next/link'
import { fetchSearch } from '@/lib/api'

/**
 * 搜索结果页（archive.php 列表版式 → SearchPage）
 *
 * 原 PHP 是 POST 表单，这里改 GET /search?s=keyword（第 4.1 节）。
 * 调用 core GET /search/post?keyword=
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: { s?: string }
}) {
  const keyword = searchParams.s || ''
  const items = await fetchSearch(keyword)

  return (
    <main>
      <div className="wrap min">
        <section className="home-title">
          <h1>含关键词 {keyword} 的文章</h1>
        </section>
        {items.length > 0 ? (
          <section className="home-posts">
            {items.map((post) => (
              <div className="post-item" key={post.id}>
                <h2>
                  <Link
                    href={`/posts/${post.categorySlug || 'uncategorized'}/${post.slug}`}
                  >
                    {post.title}
                  </Link>
                </h2>
                <p>{post.summary}</p>
              </div>
            ))}
          </section>
        ) : (
          <p>没有找到结果 (QWQ)</p>
        )}
      </div>
    </main>
  )
}
