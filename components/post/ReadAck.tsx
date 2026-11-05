'use client'

import { useEffect, useRef } from 'react'

/**
 * 阅读数上报（M8）
 *
 * core v12.x 的 POST /ack 请求体是
 * `{ type: 'read', payload: { type: 'post' | 'note', id } }`，
 * 旧实现的 `{ id }` 会被 400 拒绝。
 * 同一文章 ID 在同一 session 只上报一次（防止刷新刷量）。
 */
export function ReadAck({
  postId,
  type = 'post',
}: {
  postId: string
  type?: 'post' | 'note' | 'page'
}) {
  const reported = useRef(false)

  useEffect(() => {
    if (reported.current) return
    reported.current = true

    const key = `mx_ack_${postId}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      // sessionStorage 不可用时也允许上报
    }

    fetch('/api/ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'read', payload: { type, id: postId } }),
    }).catch(() => {
      // 静默失败
    })
  }, [postId, type])

  return null
}
