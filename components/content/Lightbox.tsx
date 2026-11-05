'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * 图片灯箱：点击正文图片全屏预览
 *
 * 只对 .post-content:not(.is-special) img / .page-content:not(.is-special) img 生效（:185）。
 * 行为：点击放大、左右切换、loading 球。
 *
 * DOM 契约：.ks-image > .ks-prev + img + .ks-next + .ks-ball
 * （只输出 className 钩子，样式由主题作者实现）
 */

interface LightboxState {
  visible: boolean
  loading: boolean
  current: number
  images: HTMLImageElement[]
}

export function Lightbox() {
  const pathname = usePathname()
  const [state, setState] = useState<LightboxState>({
    visible: false,
    loading: false,
    current: 0,
    images: [],
  })

  // 绑定正文图片点击
  useEffect(() => {
    const selector =
      '.post-content:not(.is-special) img, .page-content:not(.is-special) img'
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(selector))

    imgs.forEach((img, i) => {
      img.setAttribute('ks-image', 'active')
      img.onclick = () => {
        setState({ visible: true, loading: true, current: i, images: imgs })
      }
    })

    return () => {
      imgs.forEach((img) => {
        img.removeAttribute('ks-image')
        img.onclick = null
      })
    }
  }, [pathname])

  const showAt = (i: number) => {
    if (i < 0 || i >= state.images.length) return
    setState((s) => ({ ...s, current: i, loading: true }))
  }

  if (!state.visible) return null

  const img = state.images[state.current]
  const src = img?.getAttribute('ks-original') || img?.src || ''

  return (
    <div
      className={`ks-image ${state.loading ? 'loading' : ''}`}
      onClick={() => setState((s) => ({ ...s, visible: false }))}
    >
      <div
        className={`ks-prev ${state.current === 0 ? 'ended' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          showAt(state.current - 1)
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        onLoad={() => setState((s) => ({ ...s, loading: false }))}
      />
      <div
        className={`ks-next ${state.current === state.images.length - 1 ? 'ended' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          showAt(state.current + 1)
        }}
      />
      <div className="ks-ball" />
    </div>
  )
}
