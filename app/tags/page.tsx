import Link from 'next/link'
import { fetchCategories } from '@/lib/api'

/**
 * 标签云（tags.php → TagsPage）
 *
 * DOM 契约：section.page-title + section.page-content > .tags-list > a*
 */
export default async function TagsPage() {
  const tags = await fetchCategories('tag')

  return (
    <main>
      <div className="wrap min">
        <section className="page-title">
          <h2>标签</h2>
        </section>
        <section className="page-content">
          <div className="tags-list">
            {tags.map((t) => (
              <Link key={t.id} href={`/tag/${t.slug}`}>
                {t.name} ({t.count})
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
