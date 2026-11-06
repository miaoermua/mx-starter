import { isIP } from 'node:net'

import type { NextRequest } from 'next/server'

import { MX_SSR_UA } from './config'

/**
 * 访客 IP 透传。
 *
 * core 的 `getIp()` 依次读 `true-client-ip` / `cf-connecting-ip` / `x-forwarded-for`
 * / `x-real-ip`，然后取 `split(',')[0]`——**取链条最左边那个**。所以：
 *
 * - 直接把客户端传进来的 `x-forwarded-for` 原样转发是危险的：浏览器可以自己写
 *   `X-Forwarded-For: 1.1.1.1`，nginx 用 `$proxy_add_x_forwarded_for` 追加真实 IP 后
 *   链条变成 `1.1.1.1, <真实IP>`，core 读到的就是伪造值。点赞态、阅读去重、
 *   评论限流全部可以绕过。
 * - 因此这里按「可信代理层数」从**右边**取第 N 个，并且只转发这一个 IP，
 *   让 core 的左取语义和我们的判定一致。
 *
 * `MX_TRUSTED_PROXY_HOPS` 的**精确定义**：应用服务器之前的反向代理层数，
 * **包含紧邻应用的那一层**（Next 自己不算）。
 *
 * 记 N 层代理由远到近为 PN … P1（P1 直连应用）。标准 `$proxy_add_x_forwarded_for`
 * 追加语义下，链路是 `客户端, PN, P(N-1), …, P2`，长度恰为 N，所以
 * 「右侧第 N 个」= 第 0 个 = 客户端。这与 Express `trust proxy = N` 的取值
 * （`addrs[N]`，addrs = [socket, …xff 反转]）完全一致：
 *
 * | 部署 | XFF（无伪造时） | hops | 取到 |
 * |---|---|---|---|
 * | Next 直连公网 | （无） | 0 | 不转发 |
 * | nginx 单层 | `C` | 1 | `chain[0] = C` |
 * | CDN → nginx | `C, CDN` | 2 | `chain[0] = C` |
 * | CDN → nginx → ingress | `C, CDN, ingress` | 3 | `chain[0] = C` |
 *
 * **超出实际层数是危险的**：hops 每多 1，索引就向左移一格，而左侧完全由客户端
 * 控制。因此链长不足以支撑 `hops` 时（说明代理没按预期追加，或 hops 配大了），
 * 这里 **fail closed**（返回 null、不转发任何 IP），不做「取最左」这种猜测。
 *
 * 设成 0 表示不信任任何代理头（Next 直接暴露在公网时用），core 会退回 socket 地址
 * ——不可伪造，但全站访客会共用一个 IP。
 */

const DEFAULT_TRUSTED_HOPS = 1

/** 可信代理层数（无法解析或非法值一律退回默认值，避免配置错误放大安全问题） */
export function trustedProxyHops(): number {
  const raw = process.env.MX_TRUSTED_PROXY_HOPS?.trim()
  if (!raw) return DEFAULT_TRUSTED_HOPS
  const hops = Number(raw)
  if (!Number.isInteger(hops) || hops < 0) return DEFAULT_TRUSTED_HOPS
  return hops
}

/** 只依赖 `get`，兼容 `next/headers` 的 ReadonlyHeaders 与 route handler 的 Headers */
export interface HeaderReader {
  get(name: string): string | null | undefined
}

/**
 * 归一化单个 IP：去引号/空白、剥端口与 IPv6 方括号，非法值返回 null。
 *
 * 非法值必须被丢掉而不是原样透传，否则 core 侧会把它当身份写进计数表。
 */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null
  let ip = raw.trim().replace(/^"(.*)"$/, '$1')
  if (!ip) return null

  // [2001:db8::1] / [2001:db8::1]:443
  if (ip.startsWith('[')) {
    const end = ip.indexOf(']')
    if (end === -1) return null
    ip = ip.slice(1, end)
  } else if (isIP(ip) === 0) {
    // 1.2.3.4:5678 这类带端口的形态；裸 IPv6 先试原值，失败再尝试剥端口
    const stripped = ip.replace(/:\d{1,5}$/, '')
    if (isIP(stripped) !== 0) ip = stripped
  }

  return isIP(ip) === 0 ? null : ip
}

function parseChain(value: string | null | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((part) => normalizeIp(part))
    .filter((ip): ip is string => ip !== null)
}

/**
 * 解析访客 IP。返回 null 表示「不要转发任何 IP」。
 *
 * 三个 null 分支（都是 fail closed）：
 * 1. `hops < 1`：显式配置为不信任任何代理头；
 * 2. `chain.length < hops`：链长不足以跳过全部可信代理，说明代理没有按
 *    `$proxy_add_x_forwarded_for` 追加（例如 `proxy_set_header X-Forwarded-For
 *    $remote_addr` 覆写）或 hops 配大了。两种情况都无法确定哪一格可信，
 *    此时「取最左」会直接返回客户端可控的值；
 * 3. 没有 XFF 且 `hops >= 2`：此时 `x-real-ip` 只可能是中间层地址。
 *
 * 这里不用 socket peer 兜底：Next App Router 的 route handler / `headers()`
 * 都拿不到 TCP 对端地址（`NextRequest.ip` 只在 Vercel 运行时存在），
 * 拿不到锚点就不做猜测。
 */
export function resolveClientIp(
  source: HeaderReader,
  hops: number = trustedProxyHops(),
): string | null {
  if (!Number.isInteger(hops) || hops < 1) return null

  // 先丢掉非法项再按层数取：可信代理追加的是合法 IP，位于最右侧，
  // 丢弃左侧垃圾项不会移动「右侧第 hops 个」的指向
  const chain = parseChain(source.get('x-forwarded-for'))
  if (chain.length > 0) {
    if (chain.length < hops) return null
    return chain[chain.length - hops]
  }

  // 没有 XFF 时退回 x-real-ip，但**只在 hops === 1 时**：
  // x-real-ip 是单值，含义是「最近一层代理看到的上游地址」。hops === 1 时它正好
  // 就是访客；hops >= 2 时它只可能是 CDN/ingress 的地址，拿它当身份会让全站
  // 访客共用一个 IP，且一旦代理没覆写该头就完全由客户端控制 —— 因此 fail closed。
  if (hops !== 1) return null
  return normalizeIp(source.get('x-real-ip'))
}

/**
 * 需要注入到 core 请求上的 IP 头。
 *
 * 只写 `x-forwarded-for` / `x-real-ip` 且只写一个值；**不**转发
 * `cf-connecting-ip` / `true-client-ip`（core 优先读它们，转发等于把客户端
 * 可伪造的头部当身份）。也不转发 Cookie / Authorization 等凭据。
 */
export function ipForwardHeaders(
  source: HeaderReader,
  hops: number = trustedProxyHops(),
): Record<string, string> {
  const ip = resolveClientIp(source, hops)
  if (!ip) return {}
  return { 'x-forwarded-for': ip, 'x-real-ip': ip }
}

/**
 * route handler 转发到 core 时使用的请求头。
 *
 * core 的 `getIp()` 不做 trust proxy 判定，代理层如果不透传访客 IP，
 * 点赞、阅读数（按 IP 去重）、评论限流都会把全站访客当成同一个人。
 */
export function proxyHeaders(request: NextRequest): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'User-Agent': MX_SSR_UA,
    ...ipForwardHeaders(request.headers),
  }
}
