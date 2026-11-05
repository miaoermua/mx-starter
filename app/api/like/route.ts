import { NextRequest, NextResponse } from 'next/server'
import { MX_CORE_URL, apiUrl } from '@/lib/api/config'
import { proxyHeaders } from '@/lib/api/proxy'

/**
 * 点赞代理 route（M8）
 *
 * 客户端不直接调 core（跨域 + SpiderGuard），走同源 route 代理。
 * POST /api/activity/like { id, type }
 */
export async function POST(request: NextRequest) {
  if (!MX_CORE_URL) {
    // mock 环境：直接返回成功
    return NextResponse.json({ ok: true, mock: true })
  }

  const body = await request.json()
  const res = await fetch(apiUrl('/activity/like'), {
    method: 'POST',
    headers: proxyHeaders(request),
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
