/**
 * 外链 metadata 抓取核心 —— 【脚手架自带：kami 扩展移植，可整组移除】
 *
 * kami 扩展能力移植：为 LinkCard 外链卡片抓取目标页 Open Graph 信息。
 * 逻辑平移自 my-kami/src/pages/api/link-preview.tsx（SSRF 防护 + og 解析 + 5s 超时），
 * 改为独立模块以便 SSR 预取（lib/link-cards.ts）与 API 路由（app/api/link-preview/route.ts）共用。
 *
 * 脚手架默认正文链接是普通 <a>，此能力为可选扩展。
 */

const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0', '::1'])
const PRIVATE_IPV4_RANGES = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
]

const FETCH_TIMEOUT_MS = 5000

export type LinkPreviewResult = {
  title: string
  description?: string
  image?: string
  url: string
}

export class LinkPreviewError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'LinkPreviewError'
  }
}

const stripTags = (value: string) =>
  value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const parseMetaContent = (
  html: string,
  attrName: 'property' | 'name',
  attrValue: string,
) => {
  const pattern = new RegExp(
    `<meta[^>]*${attrName}=["']${escapeRegex(attrValue)}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    'i',
  )
  return pattern.exec(html)?.[1]?.trim()
}

const parseTitle = (html: string) => {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  return match?.[1] ? decodeHtmlEntities(stripTags(match[1])) : undefined
}

/**
 * 本地 IP 判定，替代 node:net 的 isIP。
 *
 * 不用 node:net 是因为本模块会被 lib/markdown.ts 间接引入，
 * 一旦有客户端组件 import 到 markdown，webpack 就会因 `node:` 协议报错
 * （Vercel 构建失败的根因）。这里的判定只服务 SSRF 防护，够用。
 *
 * 返回 0（非 IP）/ 4（IPv4）/ 6（IPv6），与 node:net 的 isIP 对齐。
 */
const isIP = (value: string): 0 | 4 | 6 => {
  const v4 = value.split('.')
  if (
    v4.length === 4 &&
    v4.every(
      (part) =>
        /^\d{1,3}$/.test(part) &&
        // 拒绝前导零，避免 01.2.3.4 这类歧义写法绕过网段判断
        !(part.length > 1 && part.startsWith('0')) &&
        Number(part) <= 255,
    )
  ) {
    return 4
  }
  // IPv6：含冒号且仅由十六进制字符、冒号、点组成（覆盖 ::1、::ffff:1.2.3.4）
  if (value.includes(':') && /^[0-9a-f:.]+$/i.test(value)) {
    return 6
  }
  return 0
}

const isPrivateIpv4 = (ip: string) => {
  if (isIP(ip) !== 4) {
    return false
  }
  return PRIVATE_IPV4_RANGES.some((pattern) => pattern.test(ip))
}

const isBlockedTarget = (url: URL) => {
  const hostname = url.hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return true
  }

  const ipType = isIP(hostname)
  if (!ipType) {
    return false
  }
  if (ipType === 6) {
    // 基础 SSRF 防护：默认拦截 IPv6 直连目标
    return true
  }
  return isPrivateIpv4(hostname)
}

/**
 * 抓取外链 metadata（og:title / og:description / og:image）。
 * 失败抛 LinkPreviewError，由调用方降级处理。
 */
export async function fetchLinkMetadata(
  queryValue: string,
): Promise<LinkPreviewResult> {
  let targetUrl: URL
  try {
    targetUrl = new URL(queryValue)
  } catch {
    throw new LinkPreviewError('Invalid url', 400)
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    throw new LinkPreviewError('Only http(s) url is allowed', 400)
  }

  if (isBlockedTarget(targetUrl)) {
    throw new LinkPreviewError('Blocked target host', 400)
  }

  try {
    const response = await fetch(targetUrl.toString(), {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; MxStarterLinkPreviewBot/1.0)',
      },
    })

    if (!response.ok) {
      throw new LinkPreviewError(
        `Upstream status ${response.status}`,
        502,
      )
    }

    const finalUrl = new URL(response.url || targetUrl.toString())
    if (isBlockedTarget(finalUrl)) {
      throw new LinkPreviewError('Blocked redirect target host', 400)
    }

    const html = await response.text()

    const title =
      parseMetaContent(html, 'property', 'og:title') ||
      parseMetaContent(html, 'name', 'twitter:title') ||
      parseTitle(html) ||
      finalUrl.hostname
    const description =
      parseMetaContent(html, 'property', 'og:description') ||
      parseMetaContent(html, 'name', 'description') ||
      parseMetaContent(html, 'name', 'twitter:description')
    const image =
      parseMetaContent(html, 'property', 'og:image') ||
      parseMetaContent(html, 'name', 'twitter:image')

    return {
      title: decodeHtmlEntities(title),
      description: description
        ? decodeHtmlEntities(stripTags(description))
        : undefined,
      image,
      url: finalUrl.toString(),
    }
  } catch (err) {
    if (err instanceof LinkPreviewError) {
      throw err
    }
    throw new LinkPreviewError('Failed to fetch metadata', 500)
  }
}
