import { NextRequest, NextResponse } from 'next/server'
import { MX_API_VERSION, MX_CORE_URL, MX_SSR_UA, apiUrl } from '@/lib/api/config'
import { unwrapEnvelope } from '@/lib/api/envelope'
import { proxyHeaders } from '@/lib/api/proxy'

/**
 * 友链自助申请代理 route（M1/A17）
 *
 * POST /api/friends/audit { name, url, avatar, description }
 * 转发到 core POST /links/audit
 *
 * 对浏览器输出扁平结构（v3 的 { data } 外壳在这里剥掉），
 * 并保证错误也有可读的 message。
 */

/** 把 core 的响应（含 v3 错误信封）压平成 { ...data, message } */
async function readFlat(res: Response): Promise<Record<string, unknown>> {
  const body = await res.json().catch(() => ({}))
  const payload = unwrapEnvelope<Record<string, unknown>>(body, MX_API_VERSION)
  const flat = payload && typeof payload === 'object' ? { ...payload } : {}
  if (!res.ok && !flat.message) {
    const err = (body as Record<string, unknown>)?.error
    const message = (err as Record<string, unknown> | undefined)?.message
    if (typeof message === 'string') flat.message = message
  }
  return flat
}
export async function POST(request: NextRequest) {
  const body = await request.json()

  if (!MX_CORE_URL) {
    return NextResponse.json({ ok: true, message: '申请成功（mock），等待审核！', mock: true })
  }

  const res = await fetch(apiUrl('/links/audit'), {
    method: 'POST',
    headers: proxyHeaders(request),
    body: JSON.stringify(body),
  })

  return NextResponse.json(await readFlat(res), { status: res.status })
}

/** GET /api/friends/audit → 查询是否可申请（{ can }） */
export async function GET() {
  if (!MX_CORE_URL) {
    return NextResponse.json({ can: true, mock: true })
  }
  const res = await fetch(apiUrl('/links/audit'), {
    headers: { 'User-Agent': MX_SSR_UA },
  })
  return NextResponse.json(await readFlat(res), { status: res.status })
}
