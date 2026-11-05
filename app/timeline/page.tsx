import Link from 'next/link'
import { fetchTimeline } from '@/lib/api'

/**
 * 时间轴（mx 特性，M5）
 *
 * 复用 home-posts 列表版式。GET /aggregate/timeline 不传 type 时同时返回
 * 文章与日记（core 的 type 是数字枚举，不能传 'post'）。
 */
export default async function TimelinePage() {
  const items = await fetchTimeline(undefined, { sort: -1 })

  // 按年分组
  const groups: Record<string, typeof items> = {}
  for (const item of items) {
    const year = new Date(item.created).getFullYear().toString()
    if (!groups[year]) groups[year] = []
    groups[year].push(item)
  }

  return (
    <main>
      <div className="wrap min">
        <section className="home-title">
          <h1>时间轴</h1>
        </section>
        {Object.entries(groups)
          .sort(([a], [b]) => Number(b) - Number(a))
          .map(([year, list]) => (
            <div key={year}>
              <h1>{year}</h1>
              <section className="home-posts">
                {list.map((item) => (
                  <div className="post-item" key={`${item.type}-${item.id}`}>
                    <h2>
                      <Link
                        href={
                          item.type === 'note'
                            ? `/notes/${item.nid ?? item.slug}`
                            : `/posts/${item.categorySlug || 'uncategorized'}/${item.slug}`
                        }
                      >
                        {item.title || '无标题'}
                      </Link>
                    </h2>
                    <div className="post-meta">
                      <time className="date">
                        {new Date(item.created).toLocaleDateString('zh-CN')}
                      </time>
                      {item.type === 'note' ? (
                        <span className="category">手记</span>
                      ) : (
                        item.category && <span className="category">{item.category}</span>
                      )}
                    </div>
                  </div>
                ))}
              </section>
            </div>
          ))}
        {items.length === 0 && <p>没有找到结果 (QWQ)</p>}
      </div>
    </main>
  )
}
