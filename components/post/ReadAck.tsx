'use client'

import { useEffect, useRef } from 'react'

/**
 * 阅读数上报（M8）
 *
 * 文章页首屏挂载后，POST /api/ack 上报阅读数。
 * 同一文章 ID 在同一 session 只上报一次（防止刷新刷量）。
 */
export function ReadAck({ postId }: { postId: string }) {
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
      body: JSON.stringify({ id: postId }),
    }).catch(() => {
      // 静默失败
    })
  }, [postId])

  return null
}
