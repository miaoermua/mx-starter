import { NextRequest, NextResponse } from 'next/server'
import { MX_CORE_URL, apiUrl } from '@/lib/api/config'
import { proxyHeaders } from '@/lib/api/proxy'

/**
 * 评论写入代理 route（C8）
 *
 * 客户端 POST /api/comment { id, author, mail, url, text }
 * 转发到 core POST /comments/guest/:id
 *
 * 注意 ref：core 的 `ref` 是**引用类型**（post/note/page/recently），走 query 而非 body，
 * 不传时 core 用 `findGlobalById(id)` 自动判定。这里一律丢掉 body 里的 ref，
 * 避免把「文章 id」当成枚举值发出去。
 *
 * v12.x：游客走 /comments/guest/:id，Reader 登录态走 /comments/reader/:id（C4）
 * 当前实现游客路径；Reader 登录态留待日后升级。
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { id, ref: _ref, ...payload } = body

  if (!id) {
    return NextResponse.json({ error: 'missing id' }, { status: 400 })
  }

  if (!MX_CORE_URL) {
    // mock 环境：返回成功 + 待审核
    return NextResponse.json({ ok: true, needAudit: true, mock: true })
  }

  const res = await fetch(apiUrl(`/comments/guest/${id}`), {
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
