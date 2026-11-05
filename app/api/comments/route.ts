import { NextRequest, NextResponse } from 'next/server'
import { fetchComments } from '@/lib/api'

/**
 * 评论分页读取 route
 *
 * GET /api/comments?postId=xxx&page=1&size=10
 * 供客户端 CommentSection 翻页时调用。
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const postId = searchParams.get('postId') || ''
  const page = Number(searchParams.get('page') || '1')
  const size = Number(searchParams.get('size') || '10')

  if (!postId) {
    return NextResponse.json({ error: 'missing postId' }, { status: 400 })
  }

  const { items, pagination } = await fetchComments(postId, page, size)
  return NextResponse.json({
    items,
    page: pagination?.page ?? page,
    totalPages: pagination?.totalPages ?? 1,
    total: pagination?.total ?? items.length,
  })
}
