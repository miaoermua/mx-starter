'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

/**
 * 运行时效果
 *
 * 通用站点交互：菜单折叠、搜索展开、明暗切换（body.dark + cookie 防闪屏）、
 * 返回顶部、Prism 高亮重跑、评论 @ 引用高亮。
 * 必须在路由变更 / 正文就绪后重新绑定，卸载时清理监听（SPA 陷阱），
 * 所以挂在 layout.tsx 并以 usePathname() 作为 effect 依赖。
 * 与具体主题样式解耦：只切换 className，样式由主题作者实现。
 */
export function ThemeRuntime() {
  const pathname = usePathname()

  // 1. 菜单折叠：.toggle-btn 切换 .head-menu.active
  // 2. 搜索展开：.search-btn 切换 .head-search.active
  useEffect(() => {
    const toggleBtn = document.querySelector('.toggle-btn')
    const headMenu = document.querySelector('.head-menu')
    const searchBtn = document.querySelector('.search-btn')
    const headSearch = document.querySelector('.head-search')

    const onToggle = () => headMenu?.classList.toggle('active')
    const onSearch = () => headSearch?.classList.toggle('active')

    toggleBtn?.addEventListener('click', onToggle)
    searchBtn?.addEventListener('click', onSearch)
    return () => {
      toggleBtn?.removeEventListener('click', onToggle)
      searchBtn?.removeEventListener('click', onSearch)
      headMenu?.classList.remove('active')
      headSearch?.classList.remove('active')
    }
  }, [pathname])

  // 3. 明暗切换：.light-btn 切换 body.dark，写 cookie 供 SSR 防闪屏
  useEffect(() => {
    const lightBtn = document.querySelector('.light-btn')
    if (!lightBtn) return

    const applyDark = (on: boolean) => {
      document.body.classList.toggle('dark', on)
      document.cookie = `theme=${on ? '1' : '0'};path=/;max-age=21600`
    }

    const onLight = () => {
      applyDark(!document.body.classList.contains('dark'))
    }
    lightBtn.addEventListener('click', onLight)

    return () => {
      lightBtn.removeEventListener('click', onLight)
    }
  }, [pathname])

  // 4. 返回顶部：滚动过半屏 .to-top.active
  useEffect(() => {
    const toTop = document.querySelector('.to-top') as HTMLElement | null
    if (!toTop) return

    const onScroll = () => {
      const half = window.innerHeight / 2
      toTop.classList.toggle('active', window.scrollY > half)
    }
    const onClick = (e: Event) => {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    window.addEventListener('scroll', onScroll)
    toTop.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('scroll', onScroll)
      toTop.removeEventListener('click', onClick)
    }
  }, [pathname])

  // 5. Prism 高亮（路由变更后重跑）
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Prism) {
      ;(window as any).Prism.highlightAll()
    }
  }, [pathname])

  // 6. 评论 @ 引用高亮：hover .comment-item.active
  useEffect(() => {
    const links = document.querySelectorAll<HTMLElement>(
      '.comment-content [href^="#comment"]',
    )
    if (!links.length) return

    const handlers: Array<{ el: HTMLElement; enter: () => void; leave: () => void }> = []
    links.forEach((link) => {
      const href = link.getAttribute('href')
      if (!href) return
      const target = document.querySelector(href)
      if (!target) return
      const enter = () => target.classList.add('active')
      const leave = () => target.classList.remove('active')
      link.addEventListener('mouseenter', enter)
      link.addEventListener('mouseleave', leave)
      handlers.push({ el: link, enter, leave })
    })
    return () => {
      handlers.forEach(({ el, enter, leave }) => {
        el.removeEventListener('mouseenter', enter)
        el.removeEventListener('mouseleave', leave)
      })
    }
  }, [pathname])

  return null
}
