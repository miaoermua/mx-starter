import Link from 'next/link'
import { fetchNotes } from '@/lib/api'

/**
 * 日记列表（mx 特性 → NotesListPage，M3）
 *
 * 复用首页 .home-posts 版式。GET /notes?size=50
 */
export default async function NotesListPage() {
  const notes = await fetchNotes(50)

  return (
    <main>
      <div className="wrap min">
        <section className="home-title">
          <h1>日记</h1>
          <span>记录生活中的点滴</span>
        </section>
        <section className="home-posts">
          {notes.map((n) => (
            <div className="post-item" key={n.id}>
              <h2>
                <Link href={`/notes/${n.nid}`}>
                  {n.title || `日记 #${n.nid}`}
                </Link>
              </h2>
              <p>
                {(n.content || '')
                  .replace(/<[^>]+>/g, '')
                  .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
                  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
                  .replace(/^#{1,6}\s+/gm, '')
                  .replace(/`{1,3}/g, '')
                  .replace(/\n+/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim()
                  .slice(0, 100)}
              </p>
              <div className="post-meta">
                <time className="date">
                  {new Date(n.created).toLocaleDateString('zh-CN')}
                </time>
                {n.mood && <span className="category">心情：{n.mood}</span>}
                {n.weather && (
                  <span className="category">天气：{n.weather}</span>
                )}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}
