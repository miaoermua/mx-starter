import { NextRequest, NextResponse } from 'next/server'
import { MX_CORE_URL, apiUrl } from '@/lib/api/config'
import { proxyHeaders } from '@/lib/api/proxy'

/**
 * 阅读数上报代理 route（M8）
 *
 * POST /api/ack 上报阅读。客户端调 /api/ack，本 route 转发到 core。
 */
export async function POST(request: NextRequest) {
  if (!MX_CORE_URL) {
    return NextResponse.json({ ok: true, mock: true })
  }

  const body = await request.json()
  const res = await fetch(apiUrl('/ack'), {
    method: 'POST',
    headers: proxyHeaders(request),
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
