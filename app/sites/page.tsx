import type { Metadata } from 'next'
import Link from 'next/link'
import { fetchPages } from '@/lib/api'

export const metadata: Metadata = {
  title: '站点',
}

/**
 * 站点页（独立页面聚合）。【脚手架自带：kami 扩展移植，可整组移除】
 *
 * 版式是日记列表页（app/notes/page.tsx）的副本，只保留标题，
 * 不输出摘要——独立页面正文动辄整篇 Markdown，截前 100 字没有意义。
 *
 * 数据源：GET /pages?size=50（aggregate 在 v12.x 不返回 pageMeta）
 * 详见 docs/EXTRA_FEATURES.md 第 5 节
 */
export default async function SitesPage() {
  const pages = await fetchPages()

  return (
    <main>
      <div className="wrap min">
        <section className="home-title">
          <h1>站点</h1>
          <span>本站的独立页面</span>
        </section>
        <section className="home-posts">
          {pages.length === 0 && (
            <div className="post-item">
              <h2>暂无页面</h2>
            </div>
          )}
          {pages.map((p) => (
            <div className="post-item" key={p.slug}>
              <h2>
                <Link href={`/pages/${p.slug}`}>{p.title}</Link>
              </h2>
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}
