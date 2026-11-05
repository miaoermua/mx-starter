'use client'

import { useState } from 'react'
import type { Comment } from '@/lib/api'
import { buildReplyTree } from '@/lib/api/adapter'
import { CommentContent } from './CommentContent'

/**
 * 单条评论（comments.php threadedComments → CommentItem）
 *
 * DOM 结构：
 * .comment-list > .comment-item[.comment-child]#comment-{id}
 *   > img.avatar + .comment-meta(.comment-author, .comment-time, .comment-reply)
 *   > .comment-content > [@被回复者] + 正文
 *   > .comment-list（子级包裹层，CSS 依赖它做缩进）
 *
 * 头像直接用后端 avatar 字段（C9：不要在前端按邮箱推导）
 * 子级 .comment-child 缩进依赖 `.comment-list .comment-child`，所以嵌套必须再包一层 .comment-list
 * 回复按钮发出 mx:reply 事件，由 CommentSection 接收设置 replyTo（C7）
 */

/** Typecho 主题的评论时间格式：2025.06.05 */
function formatCommentTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`
}

export function CommentItem({
  comment,
  postId,
  parent,
}: {
  comment: Comment
  postId: string
  /** 父评论（用于子评论渲染 @被回复者 引用） */
  parent?: Comment
}) {
  // core 对长线程只返回头尾（replyWindow.hasHidden），中间部分靠 /api/comments/thread 分批补
  const [children, setChildren] = useState<Comment[]>(comment.children ?? [])
  const [replyWindow, setReplyWindow] = useState(comment.window)
  const [expanding, setExpanding] = useState(false)

  const hasChildren = children.length > 0

  const onReply = (e: React.MouseEvent) => {
    e.preventDefault()
    document.dispatchEvent(
      new CustomEvent('mx:reply', { detail: { id: comment.id } }),
    )
  }

  const flatten = (list: Comment[]): Comment[] =>
    list.flatMap((c) => [c, ...flatten(c.children ?? [])])

  const expandThread = async () => {
    if (!replyWindow?.hasHidden || expanding) return
    setExpanding(true)
    try {
      const qs = new URLSearchParams({ rootId: comment.id })
      if (replyWindow.nextCursor) qs.set('cursor', replyWindow.nextCursor)
      const res = await fetch(`/api/comments/thread?${qs}`)
      if (!res.ok) return
      const data = await res.json()
      const added: Comment[] = Array.isArray(data.items) ? data.items : []
      // 服务端返回的也是一棵树，先拍平再和新数据一起重建
      setChildren((prev) =>
        buildReplyTree([...flatten(prev), ...flatten(added)], comment.id),
      )
      setReplyWindow({
        ...replyWindow,
        hasHidden: !data.done,
        hiddenCount: Number(data.remaining ?? 0),
        nextCursor: data.nextCursor ?? undefined,
      })
    } catch {
      // 静默失败
    } finally {
      setExpanding(false)
    }
  }

  return (
    <div
      className={`comment-item${parent ? ' comment-child' : ''}`}
      id={`comment-${comment.id}`}
    >
      {comment.avatar && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="avatar" src={comment.avatar} alt={comment.author} loading="lazy" />
      )}
      <div className="comment-meta">
        <span className="comment-author">
          {comment.url ? (
            <a href={comment.url} rel="external nofollow" target="_blank">
              {comment.author}
            </a>
          ) : (
            comment.author
          )}
        </span>
        <time className="comment-time">{formatCommentTime(comment.created)}</time>
        <span className="comment-reply">
          <a href="#respond" data-reply-to={comment.id} onClick={onReply}>
            <i className="fa fa-reply" title="回复" />
          </a>
        </span>
      </div>
      <p className="comment-content">
        {parent && (
          <a href={`#comment-${parent.id}`}>@{parent.author} </a>
        )}
        <CommentContent text={comment.content} />
      </p>

      {hasChildren && (
        <div className="comment-list">
          {children.map((child) => (
            <CommentItem key={child.id} comment={child} postId={postId} parent={comment} />
          ))}
        </div>
      )}

      {replyWindow?.hasHidden && (
        <p className="comment-expand">
          <button type="button" onClick={expandThread} disabled={expanding}>
            {expanding ? '加载中…' : `展开更多回复（还有 ${replyWindow.hiddenCount} 条）`}
          </button>
        </p>
      )}
    </div>
  )
}
