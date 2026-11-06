/**
 * Core v3（/api/v3）文章响应夹具
 *
 * 依据 ../core master（v16.4.1-9，API_VERSION=3）：
 * - post.controller.ts#getPostList → withMeta(docs, meta.pagination{page,size,total,totalPages})
 * - post.controller.ts#getPostById → data 里摘掉 related，related / interaction 进 meta
 * - 计数是顶层数字：readCount / likeCount
 * - 时间字段仍是 createdAt / modifiedAt
 */

export const v3PostSummary = {
  id: 'post_1',
  title: 'v3 文章',
  slug: 'v3-post',
  text: '正文前 200 字…',
  content: null,
  contentFormat: 'markdown',
  summary: '摘要',
  category: { id: 'cat_1', name: '技术', slug: 'tech', type: 0 },
  tags: ['nextjs'],
  createdAt: '2026-01-02T03:04:05.000Z',
  modifiedAt: '2026-01-03T00:00:00.000Z',
  isPublished: true,
  readCount: 12,
  likeCount: 3,
  pinAt: null,
  pinOrder: null,
  isPremium: false,
}

/** 计数为 0 的边界用例：0 必须保留，不能被当成缺省 */
export const v3PostZeroCounts = {
  ...v3PostSummary,
  id: 'post_zero',
  slug: 'zero',
  readCount: 0,
  likeCount: 0,
}

export const v3PostListEnvelope = {
  data: [v3PostSummary, v3PostZeroCounts],
  meta: {
    pagination: { page: 2, size: 10, total: 23, totalPages: 3 },
  },
}

/** 详情：related 与 isLiked 都在 meta 里 */
export const v3PostDetailEnvelope = {
  data: {
    ...v3PostSummary,
    text: '# 标题\n\n正文**加粗**',
    contentFormat: 'markdown',
  },
  meta: {
    interaction: { isLiked: true },
    related: [
      { id: 'post_2', title: '相关一', slug: 'related-1', nid: null, type: 'post' },
      { id: 'post_3', title: '相关二', slug: 'related-2', nid: null, type: 'post' },
    ],
  },
}

/** Lexical 编辑器的文章：content 是编辑器 JSON，text 仍是纯文本 */
export const v3PostLexicalEnvelope = {
  data: {
    ...v3PostSummary,
    id: 'post_lexical',
    slug: 'lexical',
    contentFormat: 'lexical',
    content: { root: { children: [], type: 'root', version: 1 } },
    text: 'Lexical 正文纯文本',
  },
  meta: {},
}
