import { coreUrl, hasCore, MX_SSR_UA } from '@/lib/api/config'

/**
 * RSS/Atom 代理。
 *
 * core v12.x 在根路径直接输出 XML（GET /feed 与 /atom.xml，带 1h 缓存），
 * 不在 /api/v2 下；这里原样转发，保证博客域名下的 /feed 可用。
 */
// 不能在构建期把 core 未配置时的 404 固化下来
export const dynamic = 'force-dynamic'
export const revalidate = 3600

async function proxyFeed(path: string) {
  if (!hasCore()) {
    return new Response('RSS is unavailable: MX_CORE_URL is not configured.', {
      status: 404,
    })
  }
  const res = await fetch(coreUrl(path), {
    headers: { 'User-Agent': MX_SSR_UA, Accept: 'application/xml,text/xml' },
    next: { revalidate },
  })
  if (!res.ok) {
    return new Response('Failed to fetch feed from core.', { status: 502 })
  }
  return new Response(await res.text(), {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}

export async function GET() {
  return proxyFeed('/feed')
}
