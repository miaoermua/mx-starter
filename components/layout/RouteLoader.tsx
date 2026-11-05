'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * 路由加载指示器
 *
 * 点击站内链接时立即显示转圈，路由完成后消失。
 * 挂在 footer .buttons 里，位于 .to-top 下方。
 *
 * 样式参考 miuix-vue 的 m-progress--circular-indet。
 * Next.js App Router 没有全局路由事件，用链接拦截 + pathname 变化检测。
 */
export function RouteLoader() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const prevPath = useRef(pathname)

  // pathname 变化 = 路由完成，隐藏转圈
  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname
      setLoading(false)
    }
  }, [pathname])

  // 拦截站内链接点击：开始转圈
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement)?.closest('a')
      if (!link) return
      const href = link.getAttribute('href')
      if (!href) return
      // 只拦截站内链接（非 hash、非外链、非新标签）
      if (href.startsWith('/') && !href.startsWith('#') && !link.target) {
        setLoading(true)
      }
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  // 浏览器后退/前进也能触发
  useEffect(() => {
    const onPop = () => setLoading(true)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  if (!loading) return null

  return (
    <div className="route-loader" aria-label="加载中">
      <svg
        className="m-progress m-progress--circular m-progress--circular-indet"
        width="30"
        height="30"
        viewBox="0 0 30 30"
        role="progressbar"
      >
        <circle
          className="m-progress__circ-bg"
          cx="15"
          cy="15"
          r="13"
          fill="none"
          strokeWidth="4"
        />
        <circle
          className="m-progress__circ-fg"
          cx="15"
          cy="15"
          r="13"
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          pathLength={360}
        />
      </svg>
    </div>
  )
}
