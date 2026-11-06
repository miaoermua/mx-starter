/**
 * Core v12（/api/v2）文章响应夹具
 *
 * 与 v3 的差异：
 * - 单个对象**原样**返回（没有 { data } 外壳）
 * - 列表是 `{ data: [...] , pagination: { currentPage, totalPage, hasNextPage, hasPrevPage } }`
 * - 计数可能在 count.read / count.like
 */

export const v12PostSummary = {
  id: 'post_1',
  title: 'v12 文章',
  slug: 'v12-post',
  text: '正文…',
  content: '正文…',
  summary: '摘要',
  category: { id: 'cat_1', name: '技术', slug: 'tech' },
  tags: ['nextjs'],
  created: '2026-01-02T03:04:05.000Z',
  modified: '2026-01-03T00:00:00.000Z',
  isPublished: true,
  count: { read: 7, like: 1 },
}

export const v12PostListResponse = {
  data: [v12PostSummary],
  pagination: {
    currentPage: 1,
    size: 10,
    total: 11,
    totalPage: 2,
    hasNextPage: true,
    hasPrevPage: false,
  },
}

/** v12 详情：单个对象 + 顶层 liked / related */
export const v12PostDetail = {
  ...v12PostSummary,
  related: [{ id: 'post_9', title: '相关', slug: 'rel', category: { slug: 'tech' } }],
  liked: true,
}
