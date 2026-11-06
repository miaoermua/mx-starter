/**
 * mx core 连接配置（支持 Core v12 / v3 双版本）
 *
 * 版本由 `MX_API_VERSION` 决定，**唯一入口**，页面与组件不得自行拼接前缀：
 *
 * | MX_API_VERSION | Core 版本 | 前缀 | 信封 |
 * |---|---|---|---|
 * | 12（默认） | v12.x（API v2） | /api/v2 | 数组包 {data}，对象原样 |
 * | 3 | v16.x（API v3） | /api/v3 | 恒为 {data, meta?} |
 *
 * `MX_API_PREFIX` 仍可覆盖前缀，供反代改写路径等特殊部署使用；
 * 它优先级最高，但不会改变响应形态的判定（形态永远看 MX_API_VERSION）。
 *
 * SSR 请求必须带含 mx-space 的 UA，否则被 SpiderGuard 拦截（R7）。
 */

/** 受支持的 Core API 版本。v12 = 旧 /api/v2，v3 = 新 /api/v3 */
export type ApiVersion = 12 | 3

export const SUPPORTED_API_VERSIONS: readonly ApiVersion[] = [12, 3]

/** 默认保持 v12，避免升级脚手架后打断现有部署 */
export const DEFAULT_API_VERSION: ApiVersion = 12

/**
 * 解析版本号。`'2'`/`'12'` → 12，`'3'` → 3。
 * 未设置或无法识别时回落到默认版本（保持旧行为），并给出一次性告警，
 * 而不是抛异常把整个站点打挂。
 */
export function resolveApiVersion(raw?: string): ApiVersion {
  if (!raw) return DEFAULT_API_VERSION
  const value = raw.trim().toLowerCase()
  if (value === '3' || value === 'v3' || value === 'api3') return 3
  if (value === '12' || value === '2' || value === 'v2' || value === 'api2') {
    return 12
  }
  if (typeof console !== 'undefined') {
    console.warn(
      `[mx-starter] 不支持的 MX_API_VERSION=${raw}，回落到 v${DEFAULT_API_VERSION}（/api/v2）。受支持的值：${SUPPORTED_API_VERSIONS.join(', ')}`,
    )
  }
  return DEFAULT_API_VERSION
}

/** 版本 → API 前缀 */
export function apiPrefixFor(version: ApiVersion): string {
  return version === 3 ? '/api/v3' : '/api/v2'
}

export const MX_API_VERSION: ApiVersion = resolveApiVersion(
  process.env.MX_API_VERSION,
)

/** 当前是否走 v3 契约（响应恒为 {data, meta?}） */
export const isApiV3 = MX_API_VERSION === 3

export const MX_API_PREFIX =
  process.env.MX_API_PREFIX || apiPrefixFor(MX_API_VERSION)

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
