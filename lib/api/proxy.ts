import type { NextRequest } from 'next/server'

import { MX_SSR_UA } from './config'

/**
 * route handler 转发到 core 时使用的请求头。
 *
 * core 的 `getIp()` 直接读 `x-forwarded-for` / `x-real-ip`（不做 trust proxy 判定），
 * 代理层如果不透传访客 IP，core 只会看到 Next 服务器的 IP：
 * 点赞、阅读数（按 IP 去重）、评论限流都会把全站访客当成同一个人。
 */
export function proxyHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': MX_SSR_UA,
  }

  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = forwarded || realIp
  if (ip) {
    headers['x-forwarded-for'] = forwarded || ip
    headers['x-real-ip'] = realIp || ip.split(',')[0].trim()
  }

  return headers
}
