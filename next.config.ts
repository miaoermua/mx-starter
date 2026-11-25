import { networkInterfaces } from 'node:os'
import type { NextConfig } from 'next'

/**
 * 本机所有非回环 IPv4 地址。
 *
 * 手机连同一个 Wi-Fi 时用的是这个地址，不是 `localhost`。逐个网卡取而不是写死，
 * 因为切网络、插网线、开热点都会换 IP。
 */
function localIPv4(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((info) => info?.family === 'IPv4' && !info.internal)
    .map((info) => info!.address)
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 不暴露 `X-Powered-By: Next.js`：脚手架直接用于生产站点，指纹没必要外泄。
  poweredByHeader: false,
  // standalone 输出便于 Docker 部署（FRONTEND_PLAN.md 2.3）
  output: process.env.DOCKER_BUILD ? 'standalone' : undefined,
  // 开发时用 127.0.0.1 或局域网 IP 打开也必须能跑客户端代码。
  //
  // Next 16 默认只把 `localhost` 当作可信 dev origin，其它主机名请求 `/_next/hmr`
  // 等 dev 资源会被直接拦掉。表现很有迷惑性：HTML 与 CSS 都正常渲染，但 React
  // 永远不 hydrate —— 依赖客户端的交互会一起失灵，控制台里只有一条 WebSocket
  // 握手失败。自动带上本机网卡地址是为了手机真机预览开箱可用；另有 `DEV_ORIGINS`
  // 环境变量兜底（逗号分隔）。生产构建不走这里，不受影响。
  allowedDevOrigins: [
    '127.0.0.1',
    ...localIPv4(),
    ...(process.env.DEV_ORIGINS?.split(',').map((host) => host.trim()) ?? []),
  ],
  // /feed、/atom.xml、/sitemap 反代 core 根路径裸 XML（第 6 节路由表）
  async rewrites() {
    const coreBase = process.env.MX_CORE_URL || ''
    if (!coreBase) return []
    return [
      { source: '/feed', destination: `${coreBase}/feed` },
      { source: '/atom.xml', destination: `${coreBase}/atom.xml` },
      { source: '/sitemap', destination: `${coreBase}/sitemap` },
      { source: '/sitemap.xml', destination: `${coreBase}/sitemap.xml` },
    ]
  },
  // 旧链 301：/{category}/{slug}.html → /posts/{category}/{slug}（第 6 节路由表）
  // Next.js redirects 基于 path-to-regexp，不支持 negative lookahead，
  // 改用 middleware.ts 里的运行时 301 实现，避免保留词路径误跳。
  async redirects() {
    return []
  },
}

export default nextConfig
