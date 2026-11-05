import Link from 'next/link'
import { fetchCategories, fetchPosts } from '@/lib/api'

/**
 * 归档页（线上完整版 → ArchiveIndexPage）
 *
 * DOM 契约：section.page-title + article.page-content；
 * .archives-head > a*（分类计数胶囊）；分组 h1 + ul.archives-list > li > a + span.date
 */
export default async function ArchivePage() {
  const [categories, { items: posts }] = await Promise.all([
    fetchCategories(),
    fetchPosts(1, 50),
  ])

  return (
    <main>
      <div className="wrap min">
        <section className="page-title">
          <h2>归档</h2>
        </section>
        <article className="page-content">
          {/* 分类计数胶囊 */}
          <div className="archives-head">
            {categories.map((c) => (
              <Link key={c.id} href={`/category/${c.slug}`}>
                {c.name} ({c.count})
              </Link>
            ))}
          </div>
          {/* 按分类分组 */}
          {categories.map((cat) => {
            const groupPosts = posts.filter((p) => p.categorySlug === cat.slug)
            if (groupPosts.length === 0) return null
            return (
              <div key={cat.id}>
                <h1>{cat.name}</h1>
                <ul className="archives-list">
                  {groupPosts.map((post) => (
                    <li key={post.id}>
                      <Link
                        href={`/posts/${post.categorySlug || cat.slug}/${post.slug}`}
                      >
                        {post.title}
                      </Link>
                      <span className="date">
                        {new Date(post.created)
                          .toLocaleDateString('zh-CN', {
                            year: '2-digit',
                            month: '2-digit',
                            day: '2-digit',
                          })
                          .replace(/\//g, '-')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </article>
      </div>
    </main>
  )
}
