/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // standalone 输出便于 Docker 部署（FRONTEND_PLAN.md 2.3）
  output: process.env.DOCKER_BUILD ? 'standalone' : undefined,
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

module.exports = nextConfig
