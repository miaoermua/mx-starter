import Link from 'next/link'
import type { AggregateData, Note, PostSummary } from '@/lib/api'
import { fetchRecentPosts, fetchNotes, fetchPages } from '@/lib/api'
import { RouteLoader } from './RouteLoader'

/**
 * 页脚
 *
 * 裸 DOM 结构（className 为约定钩子，样式由主题作者实现）：
 * footer > .buttons > button.to-top（滚动过半屏出现，ThemeRuntime 绑定）；
 * .wrap.min > section.widget > .row > .col-m-4*3（最新文章 / 日记 / 独立页面三栏）；
 * section.sub-footer > p
 */
export async function Footer({ aggregate }: { aggregate: AggregateData }) {
  const siteName = aggregate.seo?.title || 'mx-starter'
  const siteUrl = aggregate.url?.siteUrl || '/'

  const [recentPosts, recentNotes, pages]: [
    PostSummary[],
    Note[],
    { title: string; slug: string }[],
  ] = await Promise.all([fetchRecentPosts(6), fetchNotes(6), fetchPages()])

  return (
    <footer>
      <div className="buttons">
        <button className="to-top" />
        <RouteLoader />
      </div>
      <div className="wrap min">
        <section className="widget">
          <div className="row">
            <div className="col-m-4">
              <h3 className="title-recent">最新文章：</h3>
              <ul>
                {recentPosts.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/posts/${p.categorySlug || 'uncategorized'}/${p.slug}`}
                      target="_blank"
                    >
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="col-m-4">
              <h3 className="title-notes">日记：</h3>
              <ul>
                {recentNotes.map((n) => (
                  <li key={n.id}>
                    <Link href={`/notes/${n.nid}`} target="_blank">
                      {n.title || plainText(n.content).slice(0, 18) || `日记 #${n.nid}`}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="col-m-4">
              <h3 className="title-pages">站点：</h3>
              <ul>
                {pages.map((p) => (
                  <li key={p.slug}>
                    <Link href={`/pages/${p.slug}`} target="_blank">
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
        <section className="sub-footer">
          <p>
            © {new Date().getFullYear()}{' '}
            <Link href={siteUrl}>{siteName}</Link>. All Rights Reserved. Theme By{' '}
            <a
              href="https://github.com/miaoermua/mx-starter"
              target="_blank"
              rel="nofollow"
            >
              mx-starter
            </a>
            .
          </p>
        </section>
      </div>
    </footer>
  )
}

/** 日记正文是 Markdown，列表里只取纯文本前若干字 */
function plainText(content: string): string {
  return (content || '')
    .replace(/<[^>]+>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/`{1,3}/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
