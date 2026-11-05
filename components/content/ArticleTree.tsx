'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { extractHeadings, firstLevel, type TocHeading } from '@/lib/toc'

/**
 * 目录树：由 lib/toc.ts 的标题数据渲染
 *
 * DOM 契约：
 * body.has-trees；section.article-list > h4>span.title + a.item-{1..6}[href=#title-N]；
 * footer .buttons > button.toggle-list
 *
 * 桌面 ≥800px 贴右 15em 且 body 让出 margin；<800px 为底部抽屉（CSS 已定义）。
 *
 * 本组件是客户端组件，从 Markdown 原文提取标题，渲染侧栏 + toggle 按钮。
 * 标题 id 由 renderMarkdown 在 SSR 阶段已注入（title-{index}）。
 */
export function ArticleTree({ markdownText }: { markdownText: string }) {
  const pathname = usePathname()
  const treeRef = useRef<HTMLElement>(null)
  const headings = extractHeadings(markdownText)
  const fl = firstLevel(headings)

  useEffect(() => {
    if (!headings.length) return
    document.body.classList.add('has-trees')
    return () => {
      document.body.classList.remove('has-trees')
    }
  }, [pathname, headings.length])

  useEffect(() => {
    const tree = treeRef.current
    if (!tree) return
    const btn = document.querySelector('footer .buttons .toggle-list')
    if (!btn) return
    const onToggle = () => tree.classList.toggle('active')
    btn.addEventListener('click', onToggle)
    return () => btn.removeEventListener('click', onToggle)
  }, [pathname])

  if (!headings.length) {
    // 没有标题也要创建 toggle 按钮（原脚本有标题才建树，这里保持一致：无标题不渲染）
    return null
  }

  return (
    <>
      <section className="article-list" ref={treeRef}>
        <h4>
          <span className="title">目录</span>
        </h4>
        {headings.map((h: TocHeading) => {
          const level = h.level - fl + 1
          return (
            <a key={h.id} className={`item-${level}`} href={`#${h.id}`}>
              {h.text}
            </a>
          )
        })}
      </section>
      <ToggleListButton />
    </>
  )
}

/** 在 footer .buttons 里插入 toggle-list 按钮 */
function ToggleListButton() {
  useEffect(() => {
    const buttons = document.querySelector('footer .buttons')
    if (!buttons) return
    if (buttons.querySelector('.toggle-list')) return
    const btn = document.createElement('button')
    btn.className = 'toggle-list'
    btn.title = '切换文章目录'
    buttons.appendChild(btn)
    return () => {
      btn.remove()
    }
  }, [])

  return null
}
