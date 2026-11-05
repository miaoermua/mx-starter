import Link from 'next/link'
import { fetchTags } from '@/lib/api'

/**
 * 标签云（tags.php → TagsPage）
 *
 * core v12.x 的 GET /categories?type=tag 只返回 { name, count }，
 * 标签路由按 name 取数，因此这里用 name 而不是 slug 拼链接。
 *
 * DOM 契约：section.page-title + section.page-content > .tags-list > a*
 */
export default async function TagsPage() {
  const tags = await fetchTags()

  return (
    <main>
      <div className="wrap min">
        <section className="page-title">
          <h2>标签</h2>
        </section>
        <section className="page-content">
          <div className="tags-list">
            {tags.map((t) => (
              <Link key={t.name} href={`/tag/${encodeURIComponent(t.name)}`}>
                {t.name} ({t.count})
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
