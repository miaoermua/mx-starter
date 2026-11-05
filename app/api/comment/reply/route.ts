import { NextRequest, NextResponse } from 'next/server'
import { MX_CORE_URL, apiUrl } from '@/lib/api/config'
import { proxyHeaders } from '@/lib/api/proxy'

/**
 * 评论回复代理 route（C7）
 *
 * POST /api/comment/reply { id, ref, author, mail, url, text }
 * 转发到 core POST /comments/guest/reply/:id
 * id = 被回复的评论 ID，ref = 文章 ID（core 不读 body 里的 ref，这里不再转发）
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { id, ref: _ref, ...payload } = body

  if (!id) {
    return NextResponse.json({ error: 'missing id' }, { status: 400 })
  }

  if (!MX_CORE_URL) {
    return NextResponse.json({ ok: true, needAudit: true, mock: true })
  }

  const res = await fetch(apiUrl(`/comments/guest/reply/${id}`), {
    method: 'POST',
    headers: proxyHeaders(request),
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => ({}))
  // core v12.x 的 state 是数字枚举（1 = Read，即无需审核）
  const doc = (data?.data ?? data) as Record<string, unknown>
  const needAudit = res.ok && doc?.state !== undefined && Number(doc.state) !== 1
  return NextResponse.json({ ...data, needAudit }, { status: res.status })
}
