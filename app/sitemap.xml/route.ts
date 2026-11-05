import { coreUrl, hasCore, MX_SSR_UA } from '@/lib/api/config'

/**
 * 站点地图代理。
 *
 * core v12.x 的 sitemap 在根路径 /sitemap（不是 /sitemap.xml），
 * 且其中的 <loc> 用的是 core 配置里的 webUrl（即本站域名），
 * 所以直接转发即可得到正确的绝对地址。
 */
// 不能在构建期把 core 未配置时的 404 固化下来
export const dynamic = 'force-dynamic'
export const revalidate = 3600

export async function GET() {
  if (!hasCore()) {
    return new Response('Sitemap is unavailable: MX_CORE_URL is not configured.', {
      status: 404,
    })
  }
  const res = await fetch(coreUrl('/sitemap'), {
    headers: { 'User-Agent': MX_SSR_UA, Accept: 'application/xml,text/xml' },
    next: { revalidate },
  })
  if (!res.ok) {
    return new Response('Failed to fetch sitemap from core.', { status: 502 })
  }
  return new Response(await res.text(), {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
