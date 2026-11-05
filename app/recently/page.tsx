import { fetchRecently } from '@/lib/api'

/**
 * 动态（mx 特性，M4）
 *
 * 复用 home-posts 列表版式。
 */
export default async function RecentlyPage() {
  const recently = await fetchRecently()

  return (
    <main>
      <div className="wrap min">
        <section className="home-title">
          <h1>动态</h1>
        </section>
        <section className="home-posts">
          {recently.map((r) => (
            <div className="post-item" key={r.id}>
              <p>{r.content}</p>
              <div className="post-meta">
                <time className="date">
                  {new Date(r.created).toLocaleDateString('zh-CN')}
                </time>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}
