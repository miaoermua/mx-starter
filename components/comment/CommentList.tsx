import type { Comment } from '@/lib/api'
import { CommentItem } from './CommentItem'

/**
 * 评论列表：递归渲染 children 嵌套树（v12.x，C7）
 * DOM：.comment-list > .comment-item[.comment-child]
 */
export function CommentList({
  comments,
  postId,
}: {
  comments: Comment[]
  postId: string
}) {
  return (
    <>
      {comments.map((c) => (
        <CommentItem key={c.id} comment={c} postId={postId} />
      ))}
    </>
  )
}
