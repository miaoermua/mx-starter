import { NextRequest, NextResponse } from 'next/server'
import { adaptComment, buildReplyTree } from '@/lib/api/adapter'
import { MX_CORE_URL, apiUrl } from '@/lib/api/config'
import { proxyHeaders } from '@/lib/api/proxy'

/**
 * 长评论线程补齐 route
 *
 * core 对超过阈值的线程只返回头部 + 尾部（replyWindow.hasHidden = true），
 * 中间的回复要通过 GET /comments/thread/:rootCommentId?cursor= 逐批取。
 *
 * GET /api/comments/thread?rootId=xxx&cursor=yyy
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rootId = searchParams.get('rootId')
  const cursor = searchParams.get('cursor')
  const size = searchParams.get('size') ?? '10'

  if (!rootId) {
    return NextResponse.json({ error: 'missing rootId' }, { status: 400 })
  }

  if (!MX_CORE_URL) {
    return NextResponse.json({ items: [], done: true, remaining: 0 })
  }

  const qs = new URLSearchParams({ size })
  if (cursor) qs.set('cursor', cursor)

  const res = await fetch(apiUrl(`/comments/thread/${rootId}?${qs}`), {
    headers: proxyHeaders(request),
    cache: 'no-store',
  })

  if (!res.ok) {
    return NextResponse.json(
      { error: 'upstream error', status: res.status },
      { status: res.status },
    )
  }

  const raw = (await res.json()) as Record<string, unknown>
  const replies = Array.isArray(raw.replies)
    ? (raw.replies as Record<string, unknown>[]).map(adaptComment)
    : []

  return NextResponse.json({
    items: buildReplyTree(replies, rootId),
    nextCursor: raw.nextCursor ?? null,
    remaining: raw.remaining ?? 0,
    done: Boolean(raw.done),
  })
}
