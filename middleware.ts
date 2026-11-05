import { NextResponse, type NextRequest } from 'next/server'

/**
 * 旧链 301：/{category}/{slug}.html → /posts/{category}/{slug}（FRONTEND_PLAN.md 第 6 节路由表）
 *
 * Next.js redirects 基于 path-to-regexp 不支持 negative lookahead，
 * 所以在 middleware 里按运行时路径判定，排除保留路由段。
 */
const RESERVED = new Set([
  'posts',
  'pages',
  'category',
  'tag',
  'search',
  'archive',
  'friends',
  'notes',
  'says',
  'recently',
  'timeline',
  'feed',
  'tags',
  'about',
  '_next',
  'api',
  'img',
  'vendor',
])

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 匹配 /:category/:slug.html
  if (pathname.endsWith('.html')) {
    const trimmed = pathname.slice(0, -5) // 去掉 .html
    const segs = trimmed.split('/').filter(Boolean)
    if (segs.length === 2) {
      const [category, slug] = segs
      if (!RESERVED.has(category)) {
        const url = request.nextUrl.clone()
        url.pathname = `/posts/${category}/${slug}`
        return NextResponse.redirect(url, 301)
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
