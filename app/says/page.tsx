import { fetchSays } from '@/lib/api'

/**
 * 说说 / 一言（mx 特性，M4）
 *
 * 复用 home-posts 列表版式。
 */
export default async function SaysPage() {
  const says = await fetchSays()

  return (
    <main>
      <div className="wrap min">
        <section className="home-title">
          <h1>说说</h1>
        </section>
        <section className="home-posts">
          {says.map((s) => (
            <div className="post-item" key={s.id}>
              <p>{s.content}</p>
              <div className="post-meta">
                <time className="date">
                  {new Date(s.created).toLocaleDateString('zh-CN')}
                </time>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}
