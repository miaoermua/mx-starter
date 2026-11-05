/**
 * API 客户端封装（v12.x，/api/v2，SDK 4.4.0）
 *
 * SSR 侧统一走 fetch + 适配层，保证 UA 含 mx-space 绕过 SpiderGuard（R7）。
 * 客户端侧不直接调 core（避免暴露跨域与爬虫守卫问题），由 SSR 注水或 route handler 代理。
 *
 * 开发环境无 MX_CORE_URL 时走 mock（FRONTEND_PLAN S1 骨架阶段用假数据）。
 */

import { MX_CORE_URL, MX_SSR_UA, THEME_NAME, apiUrl, hasCore } from './config'
import {
  adaptCategory,
  adaptComment,
  adaptFriend,
  adaptNote,
  adaptPage,
  adaptPost,
  adaptPostDetail,
  adaptRecently,
  adaptSay,
  adaptTimeline,
  camelKeys,
  parsePagination,
  unwrap,
  type Comment,
  type Category,
  type FriendLink,
  type Note,
  type PageDetail,
  type PostDetail,
  type PostSummary,
  type Recently,
  type Say,
  type TimelineItem,
} from './adapter'
import { mockAggregate, mockPosts, mockPostDetail, mockPage, mockComments, mockFriends, mockCategories, mockNote, mockSays, mockRecently } from './mock'

/** SSR fetch 专用 headers */
function ssrHeaders(): HeadersInit {
  return {
    'User-Agent': MX_SSR_UA,
    Accept: 'application/json',
  }
}

/** 通用 GET：SSR 直接打 core，返回原始 JSON */
async function get<T>(path: string): Promise<T> {
  if (!hasCore()) {
    // 开发环境无 core，返回 null 由调用方走 mock
    return null as T
  }
  const res = await fetch(apiUrl(path), {
    headers: ssrHeaders(),
    cache: 'no-store',
  })
  if (!res.ok) {
    // 4xx 返回 null，由调用方走兜底而非抛 500
    if (res.status >= 400 && res.status < 500) return null as T
    throw new Error(`API ${path} returned ${res.status}`)
  }
  return res.json() as Promise<T>
}

/* ---------- 聚合根 ---------- */

export interface AggregateData {
  user?: { name?: string; avatar?: string; description?: string; url?: string }
  seo?: { title?: string; description?: string; keywords?: string }
  url?: { siteUrl?: string }
  theme?: Record<string, unknown>
  categories?: Category[]
  pages?: { title: string; slug: string }[]
}

export async function fetchAggregate(themeName = THEME_NAME): Promise<AggregateData> {
  if (!hasCore()) return mockAggregate
  const raw = await get<Record<string, unknown>>(`/aggregate?theme=${themeName}`)
  const a = camelKeys<Record<string, unknown>>(raw)
  return {
    user: a.user as AggregateData['user'],
    seo: a.seo as AggregateData['seo'],
    url: a.url as AggregateData['url'],
    theme: a.theme as AggregateData['theme'],
    categories: Array.isArray(a.categories)
      ? (a.categories as Record<string, unknown>[]).map(adaptCategory)
      : undefined,
    pages: a.pageMeta as AggregateData['pages'],
  }
}

/* ---------- Snippet 主题配置（S6：GET /snippets/theme/:name，公开） ---------- */

export async function fetchSnippet(
  refType: string,
  name: string,
): Promise<Record<string, unknown> | null> {
  if (!hasCore()) return null
  const raw = await get<Record<string, unknown>>(
    `/snippets/${refType}/${name}`,
  )
  if (!raw) return null
  // core 返回 { data: {...} } 信封，取 data
  const data = (raw as Record<string, unknown>).data
  return data as Record<string, unknown> | null
}

/* ---------- 文章 ---------- */

export interface PostsListResult {
  items: PostSummary[]
  pagination?: ReturnType<typeof parsePagination>
}

export async function fetchPosts(page = 1, size = 10): Promise<PostsListResult> {
  if (!hasCore()) {
    return { items: mockPosts }
  }
  const raw = await get<unknown>(`/posts?page=${page}&size=${size}`)
  const items = unwrap<Record<string, unknown>[]>(raw).map(adaptPost)
  const pagination = parsePagination(
    (raw as Record<string, unknown>)?.pagination as Record<string, unknown>,
  )
  return { items, pagination }
}

export async function fetchPostDetail(
  category: string,
  slug: string,
): Promise<PostDetail | null> {
  if (!hasCore()) {
    return mockPostDetail
  }
  const raw = await get<Record<string, unknown>>(`/posts/${category}/${slug}`)
  if (!raw) return null
  return adaptPostDetail(raw)
}

/* ---------- 页面 ---------- */

/**
 * 页面列表（页脚「站点」栏用）。【脚手架自带：kami 扩展移植，可整组移除】
 *
 * aggregate 在 v12.x 不返回 pageMeta（线上实测只有 user/seo/url/theme 等），
 * 所以单独打 /pages 列表接口，返回 { data: [...], pagination } 信封。
 * 详见 docs/EXTRA_FEATURES.md 第 4 节。
 */
/** 独立页面摘要（顶栏菜单 / 页脚站点栏 / 站点页共用） */
export interface PageSummary {
  title: string
  slug: string
}

export async function fetchPages(): Promise<PageSummary[]> {
  if (!hasCore()) return [{ title: '关于', slug: 'about' }]
  const raw = await get<unknown>('/pages?size=50')
  if (!raw) return []
  const arr = unwrap<Record<string, unknown>[]>(raw)
  if (!Array.isArray(arr)) return []
  return arr
    .map((p) => ({
      title: String(p.title ?? ''),
      slug: String(p.slug ?? ''),
    }))
    .filter((p) => p.slug)
}

export async function fetchPage(slug: string): Promise<PageDetail | null> {
  if (!hasCore()) {
    return mockPage(slug)
  }
  const raw = await get<Record<string, unknown>>(`/pages/slug/${slug}`)
  if (!raw) return null
  return adaptPage(raw)
}

/* ---------- 分类 / 标签 ---------- */

export async function fetchCategories(type?: 'tag'): Promise<Category[]> {
  if (!hasCore()) return mockCategories
  const path = type ? `/categories?type=${type}` : '/categories'
  const raw = await get<unknown>(path)
  return unwrap<Record<string, unknown>[]>(raw).map(adaptCategory)
}

/* ---------- 评论 ---------- */

export async function fetchComments(
  refId: string,
  page = 1,
  size = 10,
): Promise<{ items: Comment[]; pagination?: ReturnType<typeof parsePagination> }> {
  if (!hasCore()) {
    return { items: mockComments }
  }
  const raw = await get<unknown>(
    `/comments/ref/${refId}?page=${page}&size=${size}&ref=posts`,
  )
  if (!raw) return { items: [] }
  const unwrapped = unwrap<Record<string, unknown>[]>(raw)
  const items = (Array.isArray(unwrapped) ? unwrapped : []).map(adaptComment)
  const pagination = parsePagination(
    (raw as Record<string, unknown>)?.pagination as Record<string, unknown>,
  )
  return { items, pagination }
}

/* ---------- 友链 ---------- */

export async function fetchFriends(): Promise<FriendLink[]> {
  if (!hasCore()) return mockFriends
  const raw = await get<unknown>('/links/all')
  return unwrap<Record<string, unknown>[]>(raw).map(adaptFriend)
}

/* ---------- 日记 Note（M3） ---------- */

export async function fetchNote(nid: string): Promise<Note | null> {
  if (!hasCore()) {
    return mockNote
  }
  const raw = await get<Record<string, unknown>>(`/notes/nid/${nid}`)
  if (!raw) return null
  // core v12.x 返回 { data: {...} } 信封
  const data = (raw as Record<string, unknown>)?.data ?? raw
  return adaptNote(data as Record<string, unknown>)
}

export async function fetchNotes(size = 10): Promise<Note[]> {
  if (!hasCore()) return [mockNote]
  const raw = await get<unknown>(`/notes?size=${size}`)
  return unwrap<Record<string, unknown>[]>(raw).map(adaptNote)
}

/* ---------- 说说 Say（M4） ---------- */

export async function fetchSays(size = 10): Promise<Say[]> {
  if (!hasCore()) return mockSays
  const raw = await get<unknown>(`/says?size=${size}`)
  return unwrap<Record<string, unknown>[]>(raw).map(adaptSay)
}

/* ---------- 动态 Recently（M4） ---------- */

export async function fetchRecently(size = 10): Promise<Recently[]> {
  if (!hasCore()) return mockRecently
  const raw = await get<unknown>(`/recently?size=${size}`)
  return unwrap<Record<string, unknown>[]>(raw).map(adaptRecently)
}

/* ---------- 时间轴 Timeline（M2/M5） ---------- */

export async function fetchTimeline(_type = 'post'): Promise<TimelineItem[]> {
  if (!hasCore()) {
    return mockPosts.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      category: p.category,
      created: p.created,
      type: 'post',
    }))
  }
  // core v12.x：GET /aggregate/timeline 返回 { data: { posts: [...] } }
  // 不接受 type 参数（422）
  const raw = await get<unknown>('/aggregate/timeline')
  if (!raw) return []
  const data = (raw as Record<string, unknown>)?.data as Record<string, unknown> | undefined
  const posts = (data?.posts as Record<string, unknown>[]) || []
  return posts.map(adaptTimeline)
}

/* ---------- 搜索（S5） ---------- */

export async function fetchSearch(keyword: string): Promise<PostSummary[]> {
  if (!keyword.trim()) return []
  if (!hasCore()) {
    // mock：按标题/摘要模糊匹配
    const kw = keyword.toLowerCase()
    return mockPosts.filter(
      (p) =>
        p.title.toLowerCase().includes(kw) ||
        (p.summary || '').toLowerCase().includes(kw),
    )
  }
  const raw = await get<unknown>(`/search/post?keyword=${encodeURIComponent(keyword)}`)
  return unwrap<Record<string, unknown>[]>(raw).map(adaptPost)
}

/* ---------- 上下篇（A8：core 文章详情不含 prev/next，前端按 created 查相邻） ---------- */

export async function fetchAdjacentPosts(
  currentId: string,
  created: string,
  categorySlug?: string,
): Promise<{ prev: PostSummary | null; next: PostSummary | null }> {
  if (!hasCore()) {
    // mock：用列表里的顺序模拟
    const all = mockPosts
    const idx = all.findIndex((p) => p.id === currentId)
    return {
      prev: idx > 0 ? all[idx - 1] : null,
      next: idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null,
    }
  }
  // 取同分类/全局列表，按 created 找相邻
  const path = categorySlug
    ? `/categories/${categorySlug}/posts?size=50`
    : `/posts?size=50`
  const raw = await get<unknown>(path)
  if (!raw) return { prev: null, next: null }
  const unwrapped = unwrap<Record<string, unknown>[]>(raw)
  const items = (Array.isArray(unwrapped) ? unwrapped : []).map(adaptPost)
  const sorted = items.sort(
    (a, b) => new Date(a.created).getTime() - new Date(b.created).getTime(),
  )
  const idx = sorted.findIndex((p) => p.id === currentId)
  if (idx === -1) {
    return { prev: null, next: null }
  }
  return {
    prev: idx > 0 ? sorted[idx - 1] : null,
    next: idx < sorted.length - 1 ? sorted[idx + 1] : null,
  }
}

/* ---------- 最近文章 / 最近评论（页脚 widget） ---------- */

export async function fetchRecentPosts(size = 6): Promise<PostSummary[]> {
  if (!hasCore()) return mockPosts.slice(0, size)
  const raw = await get<unknown>(`/posts?size=${size}&sortBy=created`)
  if (!raw) return []
  const unwrapped = unwrap<Record<string, unknown>[]>(raw)
  return (Array.isArray(unwrapped) ? unwrapped : []).map(adaptPost)
}

/** 热点文章：core 默认按 read_count 降序 */
export async function fetchHotPosts(size = 6): Promise<PostSummary[]> {
  if (!hasCore()) return mockPosts.slice(0, size)
  const raw = await get<unknown>(`/posts?size=${size}`)
  if (!raw) return []
  const unwrapped = unwrap<Record<string, unknown>[]>(raw)
  return (Array.isArray(unwrapped) ? unwrapped : []).map(adaptPost)
}

export interface RecentComment {
  author: string
  content: string
  link?: string
}

export async function fetchRecentComments(): Promise<RecentComment[]> {
  if (!hasCore()) {
    return mockComments.slice(0, 3).map((c) => ({
      author: c.author,
      content: c.content,
    }))
  }
  // /activity/recent 可能返回 { data: { comments: [...] } } 或其他结构
  const raw = await get<unknown>('/activity/recent')
  const unwrapped = unwrap<Record<string, unknown> | Record<string, unknown>[]>(raw)
  const arr: Record<string, unknown>[] = Array.isArray(unwrapped)
    ? unwrapped
    : Array.isArray((unwrapped as Record<string, unknown>)?.comments)
      ? ((unwrapped as Record<string, unknown>).comments as Record<string, unknown>[])
      : []
  return arr.map((c) => {
    const p = camelKeys<Record<string, unknown>>(c)
    return {
      author: String(p.author ?? ''),
      content: String(p.content ?? ''),
      link: p.link as string | undefined,
    }
  })
}

export { hasCore, MX_CORE_URL, THEME_NAME }
export type {
  Comment,
  Category,
  FriendLink,
  Note,
  PageDetail,
  PostDetail,
  PostSummary,
  Recently,
  Say,
  TimelineItem,
} from './adapter'
