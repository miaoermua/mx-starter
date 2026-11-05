'use client'

import { useState, useEffect } from 'react'
import type { Comment } from '@/lib/api'
import { CommentList } from './CommentList'
import { CommentForm } from './CommentForm'

/**
 * 评论区容器（comments.php → CommentSection）
 *
 * SSR 预取第 1 页注水进来，客户端管理分页切换 + 回复状态。
 *
 * DOM 契约：
 * section.post-comments#comments > h3；
 * .comment-form；
 * .comment-list > .comment-item[.comment-child]；
 * div.page-navigator > span
 */
export function CommentSection({
  postId,
  allowComment,
  initialItems,
  initialTotal,
  initialPage,
  initialTotalPages,
}: {
  postId: string
  allowComment?: boolean
  initialItems: Comment[]
  initialTotal: number
  initialPage: number
  initialTotalPages: number
}) {
  const [items, setItems] = useState(initialItems)
  const [page, setPage] = useState(initialPage)
  const [totalPages, setTotalPages] = useState(initialTotalPages)
  const [total, setTotal] = useState(initialTotal)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [loadingPage, setLoadingPage] = useState(false)

  // 监听 CommentItem 发出的回复事件
  useEffect(() => {
    const onReply = (e: Event) => {
      const ce = e as CustomEvent<{ id: string }>
      if (ce.detail?.id) {
        setReplyTo(ce.detail.id)
        document.getElementById('respond')?.scrollIntoView({ behavior: 'smooth' })
      }
    }
    document.addEventListener('mx:reply', onReply)
    return () => document.removeEventListener('mx:reply', onReply)
  }, [])

  const loadPage = async (p: number, force = false) => {
    if ((!force && p === page) || loadingPage) return
    setLoadingPage(true)
    try {
      const res = await fetch(`/api/comments?postId=${postId}&page=${p}&size=10`)
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
        setPage(data.page ?? p)
        setTotalPages(data.totalPages ?? 1)
        setTotal(data.total ?? 0)
      }
    } catch {
      // 静默失败
    } finally {
      setLoadingPage(false)
    }
  }

  // 提交成功后回到第 1 页重新拉取，让新评论（无需审核时）立即出现
  const refreshList = () => loadPage(1, true)

  const count = total
  const heading =
    count === 0 ? '没有评论' : count === 1 ? '只有一条评论 (QwQ)' : `已有 ${count} 条评论`

  return (
    <section className="post-comments" id="comments">
      <h3>{heading}</h3>

      {allowComment === false ? (
        <p>博主关闭了评论...</p>
      ) : (
        <div className="comment-form" id="respond">
          <CommentForm
            postId={postId}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            onSubmitted={refreshList}
          />
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="comment-list">
            <CommentList comments={items} postId={postId} />
          </div>
          {totalPages > 1 && (
            <div className="page-navigator">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <span key={p} className={p === page ? 'current' : ''}>
                  <a
                    href={`#comments-page-${p}`}
                    onClick={(e) => {
                      e.preventDefault()
                      loadPage(p)
                    }}
                  >
                    {p}
                  </a>
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
