import Link from 'next/link'
import { fetchCategories, fetchTimeline } from '@/lib/api'

/**
 * 归档页（线上完整版 → ArchiveIndexPage）
 *
 * 数据来自 core GET /aggregate/timeline（一次返回全部已发布的文章与日记，
 * 不分页；旧实现只取 /posts 前 50 篇，归档会缺内容）。
 *
 * DOM 契约：section.page-title + article.page-content；
 * .archives-head > a*（分类计数胶囊）；分组 h1 + ul.archives-list > li > a + span.date
 */
export default async function ArchivePage() {
  const [categories, items] = await Promise.all([
    fetchCategories(),
    fetchTimeline(undefined, { sort: -1 }),
  ])

  const years = [...new Set(items.map((i) => new Date(i.created).getFullYear()))].sort(
    (a, b) => b - a,
  )

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
                {c.name}
                {c.count ? ` (${c.count})` : ''}
              </Link>
            ))}
          </div>
          {/* 按年份分组，文章与日记混排 */}
          {years.map((year) => (
            <div key={year}>
              <h1>{year}</h1>
              <ul className="archives-list">
                {items
                  .filter((i) => new Date(i.created).getFullYear() === year)
                  .map((item) => (
                    <li key={`${item.type}-${item.id}`}>
                      <Link
                        href={
                          item.type === 'note'
                            ? `/notes/${item.nid ?? item.slug}`
                            : `/posts/${item.categorySlug || 'uncategorized'}/${item.slug}`
                        }
                      >
                        {item.type === 'note' && <span className="note-badge">手记 </span>}
                        {item.title || '无标题'}
                      </Link>
                      <span className="date">
                        {new Date(item.created)
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
          ))}
          {items.length === 0 && <p>没有找到结果 (QWQ)</p>}
        </article>
      </div>
    </main>
  )
}
