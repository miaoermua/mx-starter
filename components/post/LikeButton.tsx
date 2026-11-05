'use client'

import { useState } from 'react'

/**
 * 点赞按钮（M8）
 *
 * POST /api/activity/like 上报点赞。
 * core v12.x 的请求体是 `{ id, type: 'post' | 'note' }`，缺少 type 会 500。
 * 客户端组件，避免 SSR 暴露跨域问题。
 */
export function LikeButton({
  postId,
  type = 'post',
  initialLikes,
  initialLiked = false,
}: {
  postId: string
  type?: 'post' | 'note'
  initialLikes: number
  /** core 详情接口按 IP 返回 liked，避免刷新后按钮状态丢失 */
  initialLiked?: boolean
}) {
  const [likes, setLikes] = useState(initialLikes)
  const [liked, setLiked] = useState(initialLiked)
  const [loading, setLoading] = useState(false)

  const onLike = async () => {
    if (liked || loading) return
    setLoading(true)
    try {
      // 通过同源 route handler 代理，避免跨域 + SpiderGuard
      const res = await fetch('/api/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: postId, type }),
      })
      if (res.ok) {
        setLikes((n) => n + 1)
        setLiked(true)
      }
    } catch {
      // 静默失败，不影响阅读
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ textAlign: 'center', margin: '1.5em 0' }}>
      <button
        className={`like-btn ${liked ? 'liked' : ''}`}
        onClick={onLike}
        disabled={loading || liked}
        style={{
          padding: '.5em 1.5em',
          borderRadius: '2em',
          border: 'none',
          background: liked ? 'var(--blue, #3498db)' : 'var(--light-bg, #f5f5f5)',
          color: liked ? '#fff' : 'inherit',
          cursor: liked ? 'default' : 'pointer',
          transition: 'all .3s',
        }}
      >
        <i className="fa fa-heart" /> {likes}
      </button>
    </div>
  )
}
