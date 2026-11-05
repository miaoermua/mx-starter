import { NextRequest, NextResponse } from 'next/server'
import { MX_CORE_URL, MX_SSR_UA, apiUrl } from '@/lib/api/config'

/**
 * 评论回复代理 route（C7）
 *
 * POST /api/comment/reply { id, ref, author, mail, url, text }
 * 转发到 core POST /comments/guest/reply/:id
 * id = 被回复的评论 ID，ref = 文章 ID
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { id, ref, ...payload } = body

  if (!id) {
    return NextResponse.json({ error: 'missing id' }, { status: 400 })
  }

  if (!MX_CORE_URL) {
    return NextResponse.json({ ok: true, needAudit: true, mock: true })
  }

  const res = await fetch(apiUrl(`/comments/guest/reply/${id}`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': MX_SSR_UA,
    },
    body: JSON.stringify({ ...payload, ref }),
  })

  const data = await res.json().catch(() => ({}))
  const needAudit = res.status === 200 && data.state !== undefined && data.state !== 'Read'
  return NextResponse.json({ ...data, needAudit }, { status: res.status })
}
