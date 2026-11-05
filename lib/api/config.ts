/**
 * mx core 连接配置（v12.x 单分支定案，COMPATIBILITY.md 第 2 节）
 *
 * - 前缀固定 /api/v2
 * - SDK 4.4.0
 * - SSR 请求必须带含 mx-space 的 UA，否则被 SpiderGuard 拦截（R7）
 */

export const MX_API_PREFIX = process.env.MX_API_PREFIX || '/api/v2'

export const MX_CORE_URL = process.env.MX_CORE_URL || ''

export const MX_SSR_UA =
  process.env.MX_SSR_UA || 'mx-space-mx-starter/0.1.0'

/**
 * 主题名：对应 core 后台 Snippet 的 name（reference='theme'、公开），
 * 也是 aggregate?theme=<name> 的查询值。做自己的主题时改成你的主题名。
 */
export const THEME_NAME = process.env.MX_THEME_NAME || 'mx-starter'

/** 是否有可用 core 实例；开发环境无配置时走 mock */
export const hasCore = () => MX_CORE_URL.length > 0

/** 拼接完整 API URL */
export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${MX_CORE_URL}${MX_API_PREFIX}${p}`
}

/** core 根路径（反代 feed/sitemap 等裸 XML 用，不带 /api/vN） */
export function coreUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${MX_CORE_URL}${p}`
}
