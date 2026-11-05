import Link from 'next/link'
import type { AggregateData, PageSummary } from '@/lib/api'

/**
 * 顶栏
 *
 * 裸 DOM 结构（className 为约定钩子，样式由主题作者实现）：
 * <header> > .head-title>h4、.head-action>(.toggle-btn,.light-btn,.search-btn)、
 * form.head-search>input[name=s]、
 * nav.head-menu > a 与 .has-child > a + .sub-menu > a
 */
export function Header({
  aggregate,
  pages = [],
}: {
  aggregate: AggregateData
  /** 独立页面列表，供「站点」下拉菜单用（layout 注入） */
  pages?: PageSummary[]
}) {
  const title = aggregate.seo?.title || aggregate.user?.name || 'mx-starter'

  return (
    <header>
      <div className="head-title">
        <h4>{title}</h4>
      </div>
      <div className="head-action">
        {/* 菜单折叠按钮（移动端展开），ThemeRuntime 绑定 .head-menu.active */}
        <div className="toggle-btn" />
        {/* 明暗切换，ThemeRuntime 绑定 body.dark + cookie */}
        <div className="light-btn" />
        {/* 搜索框展开，ThemeRuntime 绑定 .head-search.active */}
        <div className="search-btn" />
      </div>
      {/* 搜索表单：提交走 /search */}
      <form className="head-search" method="get" action="/search">
        <input type="text" name="s" placeholder="搜索什么？" />
      </form>
      <nav className="head-menu">
        <Link href="/">首页</Link>
        <Link href="/archive">归档</Link>
        <Link href="/notes">日记</Link>
        <Link href="/timeline">时间轴</Link>
        <Link href="/friends">朋友们</Link>
        {/* 站点：独立页面聚合入口 + 下拉菜单 */}
        <div className="has-child">
          <Link href="/sites">站点</Link>
          {pages.length > 0 && (
            <div className="sub-menu">
              {pages.map((p) => (
                <Link key={p.slug} href={`/pages/${p.slug}`}>
                  {p.title}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>
    </header>
  )
}
