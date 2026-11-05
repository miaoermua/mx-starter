import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import './globals.css'

import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ThemeRuntime } from '@/components/layout/ThemeRuntime'
import { Lightbox } from '@/components/content/Lightbox'
import { fetchPages, fetchSnippet, THEME_NAME } from '@/lib/api'
import { getAggregate } from '@/lib/api/server'
import { mergeThemeConfig, type ThemeConfig } from '@/lib/theme-config'

/**
 * 从 cookie 读取明暗偏好，SSR 直接输出 body.dark，避免首屏闪白。
 * 无 cookie 时按亮色渲染，客户端点击再切换。
 */
function readThemeCookie(): boolean {
  const h = headers()
  const cookie = h.get('cookie') || ''
  const m = /(?:^|;\s*)theme=(\w+)/.exec(cookie)
  if (!m) return false
  return m[1] === '1' || m[1] === 'true'
}

export async function generateMetadata(): Promise<Metadata> {
  const agg = await getAggregate()
  const seo = agg.seo || {}
  return {
    title: {
      default: seo.title || 'mx-starter',
      template: `%s - ${seo.title || 'mx-starter'}`,
    },
    description: seo.description || '',
    keywords: seo.keywords,
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const isDark = readThemeCookie()
  const bodyClass = isDark ? 'dark' : undefined

  const agg = await getAggregate()
  // 主题配置：Snippet（reference=theme, name=THEME_NAME）与 aggregate.theme 合并
  const snippet = await fetchSnippet('theme', THEME_NAME)
  const themeFromAggregate = agg.theme as Partial<ThemeConfig> | undefined
  const mergedRaw = themeFromAggregate && snippet
    ? { ...themeFromAggregate, ...snippet }
    : themeFromAggregate || (snippet as Partial<ThemeConfig> | undefined)
  const theme = mergeThemeConfig(mergedRaw)
  // 顶栏「站点」下拉菜单用（与 Footer 的 fetchPages 在同一渲染周期内自动去重）
  const pages = await fetchPages()

  return (
    <html lang="zh">
      <head>
        {/* 背景图：SSR 只输出 URL，不发起图片请求 */}
        {theme.background && (
          <style dangerouslySetInnerHTML={{ __html: `body:before{content:'';background-image:url(${theme.background})}` }} />
        )}
        {/* custom_css：注入在自带样式之后 */}
        {theme.custom_css && (
          <style dangerouslySetInnerHTML={{ __html: theme.custom_css }} />
        )}
      </head>
      <body className={bodyClass}>
        <Header aggregate={agg} pages={pages} />
        {children}
        <Footer aggregate={agg} />
        {/* Prism 高亮（路由变更后由 ThemeRuntime 重跑） */}
        <script src="/vendor/prism.js" defer />
        {/* 运行时效果：菜单/搜索/夜间切换/返回顶部/评论高亮等 */}
        <ThemeRuntime />
        {/* 图片灯箱 */}
        <Lightbox />
        {/* 主题自定义 JS */}
        {theme.custom_script && (
          <script dangerouslySetInnerHTML={{ __html: theme.custom_script }} />
        )}
      </body>
    </html>
  )
}
