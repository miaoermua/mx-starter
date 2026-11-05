import { NextRequest, NextResponse } from 'next/server'
import { MX_CORE_URL, MX_SSR_UA, apiUrl } from '@/lib/api/config'

/**
 * 评论写入代理 route（C8）
 *
 * 客户端 POST /api/comment { id, author, mail, url, text }
 * 转发到 core POST /comments/guest/:id
 *
 * v12.x：游客走 /comments/guest/:id，Reader 登录态走 /comments/reader/:id（C4）
 * 当前实现游客路径；Reader 登录态留待日后升级。
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { id, ...payload } = body

  if (!id) {
    return NextResponse.json({ error: 'missing id' }, { status: 400 })
  }

  if (!MX_CORE_URL) {
    // mock 环境：返回成功 + 待审核
    return NextResponse.json({ ok: true, needAudit: true, mock: true })
  }

  const res = await fetch(apiUrl(`/comments/guest/${id}`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': MX_SSR_UA,
    },
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => ({}))
  // core 审核开启时返回的 state 可能不是 Read，前端据此提示
  const needAudit = res.status === 200 && data.state !== undefined && data.state !== 'Read'
  return NextResponse.json({ ...data, needAudit }, { status: res.status })
}
