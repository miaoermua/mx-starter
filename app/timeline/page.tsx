import Link from 'next/link'
import { fetchTimeline } from '@/lib/api'

/**
 * 时间轴（mx 特性，M5）
 *
 * 复用 home-posts 列表版式。GET /aggregate/timeline?type=post
 */
export default async function TimelinePage() {
  const items = await fetchTimeline('post')

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
                  <div className="post-item" key={item.id}>
                    <h2>
                      <Link
                        href={`/posts/${item.category || 'uncategorized'}/${item.slug}`}
                      >
                        {item.title}
                      </Link>
                    </h2>
                    <div className="post-meta">
                      <time className="date">
                        {new Date(item.created).toLocaleDateString('zh-CN')}
                      </time>
                      {item.category && (
                        <span className="category">{item.category}</span>
                      )}
                    </div>
                  </div>
                ))}
              </section>
            </div>
          ))}
      </div>
    </main>
  )
}
