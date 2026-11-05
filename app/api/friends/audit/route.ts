import { NextRequest, NextResponse } from 'next/server'
import { MX_CORE_URL, MX_SSR_UA, apiUrl } from '@/lib/api/config'

/**
 * 友链自助申请代理 route（M1/A17）
 *
 * POST /api/friends/audit { name, url, avatar, description }
 * 转发到 core POST /links/audit
 */
export async function POST(request: NextRequest) {
  const body = await request.json()

  if (!MX_CORE_URL) {
    return NextResponse.json({ ok: true, message: '申请成功（mock），等待审核！', mock: true })
  }

  const res = await fetch(apiUrl('/links/audit'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': MX_SSR_UA,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}

/** GET /api/friends/audit → 查询是否可申请（{ can }） */
export async function GET() {
  if (!MX_CORE_URL) {
    return NextResponse.json({ can: true, mock: true })
  }
  const res = await fetch(apiUrl('/links/audit'), {
    headers: { 'User-Agent': MX_SSR_UA },
  })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
