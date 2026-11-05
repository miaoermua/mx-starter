/**
 * LinkCard 链接卡片 —— 【脚手架自带：kami 扩展移植，可整组移除】
 *
 * kami 扩展能力移植（my-kami/src/components/common/KamiMarkdown/renderers/link-card.tsx
 * 的 App Router / SSR 直出版本）。
 *
 * 与 kami 的差异：kami 在客户端进入视口后才 fetch 卡片数据；本工程是纯 SSR 架构，
 * 数据由 lib/link-cards.ts 在 SSR 阶段预取后经 data 传入，组件只负责渲染。
 * 预取失败（data 为 null）时降级为朴素链接卡，保证可点击、不阻塞页面。
 *
 * 样式：脚手架不附带 CSS，本组件只输出 link-card 前缀类名的裸 DOM，
 * 由主题作者自带样式（原参考实现见 mx-Single 仓库 styles/link-card.css）。
 *
 * 脚注自动识别只分 self / external 两种（与 kami 一致）；
 * gh 源仅支持手动组件用法：<LinkCard id="owner/repo" source="gh" />。
 */

import type { FC } from 'react'
import type { LinkCardData, LinkCardSource } from '@/lib/link-cards'

export type { LinkCardSource }
export interface LinkCardProps {
  /** self: 站内路径；external: 目标 URL；gh: owner/repo */
  id: string
  source: LinkCardSource
  className?: string
  url?: string
  /** SSR 预取结果（lib/link-cards.ts 的 resolveLinkCards）；缺省/null 走降级渲染 */
  data?: LinkCardData | null
}

function fallbackHref(source: LinkCardSource, id: string, url?: string): string {
  if (source === 'self') return `/${id}`
  if (source === 'gh') return `https://github.com/${id}`
  return url || id
}

function fallbackTitle(source: LinkCardSource, id: string, url?: string): string {
  if (source === 'external') {
    try {
      return new URL(url || id).hostname
    } catch {
      return url || id
    }
  }
  return id
}

export const LinkCard: FC<LinkCardProps> = ({
  id,
  source,
  className,
  url,
  data,
}) => {
  const href = data?.href ?? fallbackHref(source, id, url)
  const title = data?.title ?? fallbackTitle(source, id, url)
  const desc = data?.desc ?? (source === 'external' ? url || id : undefined)
  const image = data?.image
  const external = source !== 'self'

  const classNames = [
    'link-card',
    data ? 'link-card-resolved' : 'link-card-fallback',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <a
      className={classNames}
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer noopener' : undefined}
    >
      <div className="link-card-contents">
        <div className="link-card-title">{title}</div>
        {desc && <div className="link-card-desc">{desc}</div>}
      </div>
      {image && (
        <div
          className="link-card-image"
          style={{ backgroundImage: `url(${image})` }}
        />
      )}
    </a>
  )
}

export default LinkCard
