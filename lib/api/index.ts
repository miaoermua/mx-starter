/**
 * API 客户端封装（Core v12 / v3 双版本）
 *
 * SSR 侧统一走 fetch + 适配层，保证 UA 含 mx-space 绕过 SpiderGuard（R7）。
 * 客户端侧不直接调 core（避免暴露跨域与爬虫守卫问题），由 SSR 注水或 route handler 代理。
 *
 * 版本差异只在这一层和 adapter / envelope 里消化：
 * - 前缀由 config.ts 决定，页面不参与；
 * - 信封（v3 恒为 {data, meta?}）由 envelope.ts 拆；
 * - 分页位置（v3 meta.pagination / v12 顶层 pagination）由 envelope.readPagination 统一；
 * - 字段归一化交给 adapter.ts。
 *
 * 开发环境无 MX_CORE_URL 时走 mock（FRONTEND_PLAN S1 骨架阶段用假数据）。
 */

import { headers } from 'next/headers'

import {
  MX_API_VERSION,
  MX_CORE_URL,
  MX_SSR_UA,
  THEME_NAME,
  apiUrl,
  hasCore,
} from './config'
import {
  readErrorMessage,
  readMeta,
  readPagination,
  unwrapEnvelope,
  unwrapList,
} from './envelope'
import {
  adaptCategory,
  adaptComment,
  adaptFriend,
  adaptNote,
  adaptPage,
  adaptPost,
  adaptPostDetail,
  adaptProject,
  adaptRecently,
  adaptSay,
  adaptTag,
  adaptTimeline,
  camelKeys,
  nestCommentReplies,
  parsePagination,
  type Comment,
  type Category,
  type FriendLink,
  type Note,
  type PageDetail,
  type PostDetail,
  type PostSummary,
  type Project,
  type Recently,
  type Say,
  type Tag,
  type TimelineItem,
} from './adapter'
import { mockAggregate, mockPosts, mockPostDetail, mockPage, mockComments, mockFriends, mockCategories, mockNote, mockSays, mockRecently } from './mock'
import { classifyNoteResponse, type NoteAccess } from './note-access'
import { ipForwardHeaders } from './proxy'

/**
 * SSR fetch 专用 headers。
 *
 * core 的 IP 判定直接读 `x-forwarded-for` / `x-real-ip`，SSR 请求如果不带访客 IP，
 * `liked`（详情页点赞态）、按 IP 去重的阅读数都会落到服务器 IP 上。
 *
 * IP 的取值规则与 route handler 共用 `ipForwardHeaders`（按可信代理层数从链条右侧取），
 * 不把浏览器可伪造的 `x-forwarded-for` 原样透传。
 */
function ssrHeaders(): Record<string, string> {
  const out: Record<string, string> = {
    'User-Agent': MX_SSR_UA,
    Accept: 'application/json',
  }
  try {
    Object.assign(out, ipForwardHeaders(headers()))
  } catch {
    // 构建期（无请求上下文）取不到 headers，忽略即可
  }
  return out
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
    // 5xx 必须抛出（不能伪装成 404 / 空列表），并保留 core 的错误信息
    const body = await res.json().catch(() => null)
    const detail = readErrorMessage(body)
    throw new Error(
      `API ${path} returned ${res.status}${detail ? ` (${detail})` : ''}`,
    )
  }
  return res.json() as Promise<T>
}

/* ---------- 聚合根 ---------- */

export interface AggregateData {
  user?: { name?: string; avatar?: string; description?: string; url?: string }
  seo?: { title?: string; description?: string; keywords?: string }
  /** core v12.x 只返回 webUrl（adminUrl 已被 core 摘掉） */
  url?: { webUrl?: string }
  theme?: Record<string, unknown>
  commentOptions?: { disableComment?: boolean; allowGuestComment?: boolean }
  ai?: { enableSummary?: boolean }
  latestNoteId?: string | null
}

export async function fetchAggregate(themeName = THEME_NAME): Promise<AggregateData> {
  if (!hasCore()) return mockAggregate
  const raw = await get<unknown>(`/aggregate?theme=${themeName}`)
  // v3 把聚合根包进 { data }；v12 原样返回
  const a = camelKeys<Record<string, unknown>>(
    unwrapEnvelope<Record<string, unknown>>(raw, MX_API_VERSION),
  )
  return {
    user: a.user as AggregateData['user'],
    seo: a.seo as AggregateData['seo'],
    url: a.url as AggregateData['url'],
    theme: a.theme as AggregateData['theme'],
    commentOptions: a.commentOptions as AggregateData['commentOptions'],
    ai: a.ai as AggregateData['ai'],
    latestNoteId: (a.latestNoteId as string | null | undefined) ?? null,
  }
}

/* ---------- Snippet 主题配置（S6） ---------- */

/**
 * 读取主题 Snippet。
 *
 * - v12：`GET /snippets/theme/:name` 是**公开**接口，直接返回内容；
 * - v3 ：snippet 控制器所有路由都挂了 `@Auth()`，没有公开等价接口。
 *        主题配置改由 `aggregate?theme=<name>` 的 `theme` 字段提供
 *        （layout 本来就是「aggregate.theme 与 snippet 合并」，所以这里
 *        直接返回 null，让上层只用 aggregate.theme，避免每次渲染都吃一个 401）。
 */
export async function fetchSnippet(
  refType: string,
  name: string,
): Promise<Record<string, unknown> | null> {
  if (!hasCore()) return null
  if (MX_API_VERSION === 3) return null
  const raw = await get<Record<string, unknown>>(
    `/snippets/${refType}/${name}`,
  )
  if (!raw) return null
  // core v12.x 直接返回 snippet 内容本身（可能是 JSON 对象，也可能是纯字符串）；
  // 旧版本是 { data: {...} } 信封，两者都兼容
  const inner = (raw as Record<string, unknown>).data
  const value = inner ?? raw
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
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
  // truncate：core 会把 text 截断到指定长度，列表只需要摘要，避免整篇正文（含 Lexical 树）过网
  const raw = await get<unknown>(`/posts?page=${page}&size=${size}&truncate=200`)
  if (!raw) return { items: [] }
  const items = unwrapList<Record<string, unknown>>(raw, MX_API_VERSION).map(adaptPost)
  return { items, pagination: readPagination(raw, MX_API_VERSION) }
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
  // v3 的点赞态与相关文章在 meta 里（interaction.isLiked / related）
  return adaptPostDetail(
    unwrapEnvelope<Record<string, unknown>>(raw, MX_API_VERSION),
    readMeta(raw),
  )
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
  // select 让 core 跳过正文（列表只需要标题与 slug）。v3 的 /pages 只接受 page/size，
  // 多传 select 会被 schema 忽略（若开了 forbidNonWhitelisted 则是 400），所以按版本区分。
  const query = MX_API_VERSION === 3 ? 'size=50' : 'size=50&select=title,slug'
  const raw = await get<unknown>(`/pages?${query}`)
  if (!raw) return []
  const arr = unwrapList<Record<string, unknown>>(raw, MX_API_VERSION)
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
  return adaptPage(unwrapEnvelope<Record<string, unknown>>(raw, MX_API_VERSION))
}

/* ---------- 分类 / 标签 ---------- */

export async function fetchCategories(): Promise<Category[]> {
  if (!hasCore()) return mockCategories
  const raw = await get<unknown>('/categories')
  return unwrapList<Record<string, unknown>>(raw, MX_API_VERSION).map(adaptCategory)
}

/** 标签聚合：GET /categories?type=tag → [{ name, count }] */
export async function fetchTags(): Promise<Tag[]> {
  if (!hasCore()) {
    const names = new Set(mockPosts.flatMap((p) => p.tags ?? []))
    return [...names].map((name) => ({
      name,
      count: mockPosts.filter((p) => p.tags?.includes(name)).length,
    }))
  }
  const raw = await get<unknown>('/categories?type=tag')
  return unwrapList<Record<string, unknown>>(raw, MX_API_VERSION).map(adaptTag)
}

export interface CategoryDetail {
  category: Category
  /** 该分类下全部文章（core 不在这里分页，前端自行分页或全量渲染） */
  posts: PostSummary[]
}

/**
 * 分类详情：GET /categories/:slug
 * core 返回 { data: { ...category, children: Post[] } }。
 * 注意 children 不过滤未发布，前端需要自己剔除 isPublished === false 的项。
 */
export async function fetchCategoryDetail(
  slug: string,
): Promise<CategoryDetail | null> {
  if (!hasCore()) {
    const category = mockCategories.find((c) => c.slug === slug)
    if (!category) return null
    return {
      category,
      posts: mockPosts.filter((p) => p.categorySlug === slug),
    }
  }
  const raw = await get<Record<string, unknown>>(
    `/categories/${encodeURIComponent(slug)}`,
  )
  if (!raw) return null
  const data = unwrapEnvelope<Record<string, unknown>>(raw, MX_API_VERSION)
  const children = Array.isArray(data.children)
    ? (data.children as Record<string, unknown>[])
    : []
  return {
    category: adaptCategory(data),
    posts: children.map(adaptPost).filter((p) => p.isPublished !== false),
  }
}

/**
 * 标签下的文章：GET /categories/:tag?tag=true → { tag, data: Post[] }。
 * 同样不过滤未发布，前端自行剔除。
 */
export async function fetchPostsByTag(tag: string): Promise<PostSummary[]> {
  if (!hasCore()) {
    return mockPosts.filter((p) => p.tags?.includes(tag))
  }
  const raw = await get<Record<string, unknown>>(
    `/categories/${encodeURIComponent(tag)}?tag=true`,
  )
  if (!raw) return []
  // v12: { data: Post[] }；v3: { data: { tag, data: Post[] } } —— unwrapList 两种都能拆
  return unwrapList<Record<string, unknown>>(raw, MX_API_VERSION)
    .map(adaptPost)
    .filter((p) => p.isPublished !== false)
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
  // ref 由路径里的 refId 决定，GET 不需要 ref 参数；sort 默认 pinned（置顶优先）
  const raw = await get<unknown>(
    `/comments/ref/${refId}?page=${page}&size=${size}`,
  )
  if (!raw) return { items: [] }
  const items = unwrapList<Record<string, unknown>>(raw, MX_API_VERSION).map(
    adaptComment,
  )
  // core 的 replies 是扁平列表，按 parentCommentId 还原成树
  return {
    items: nestCommentReplies(items),
    pagination: readPagination(raw, MX_API_VERSION),
  }
}

/* ---------- 友链 ---------- */

export async function fetchFriends(): Promise<FriendLink[]> {
  if (!hasCore()) return mockFriends
  const raw = await get<unknown>('/links/all')
  return unwrapList<Record<string, unknown>>(raw, MX_API_VERSION).map(adaptFriend)
}

/* ---------- 日记 Note（M3） ---------- */

/** 日记详情；有密码的日记需要传 password，否则 core 返回 403 且正文被隐藏 */
export type { NoteAccess }

export async function fetchNoteWithAccess(
  nid: string,
  password?: string,
): Promise<NoteAccess> {
  if (!hasCore()) {
    return { note: mockNote, locked: false, reason: 'ok' }
  }
  const qs = password ? `?password=${encodeURIComponent(password)}` : ''
  // 这里需要区分 403（加密日记）、404 与基础设施故障，不能复用 get() 的 null 兜底。
  // 403 还要再看业务码（14000）才算密码问题，see lib/api/note-access.ts
  let res: Response
  try {
    res = await fetch(apiUrl(`/notes/nid/${nid}${qs}`), {
      headers: ssrHeaders(),
      cache: 'no-store',
    })
  } catch {
    // 网络错误（DNS / 连接被拒 / 超时）不是「日记不存在」，归入 error
    return { note: null, locked: false, reason: 'error' }
  }
  const body = await res.json().catch(() => null)
  return classifyNoteResponse(res.status, body)
}

export async function fetchNote(
  nid: string,
  password?: string,
): Promise<Note | null> {
  return (await fetchNoteWithAccess(nid, password)).note
}

export async function fetchNotes(size = 10): Promise<Note[]> {
  if (!hasCore()) return [mockNote]
  const raw = await get<unknown>(`/notes?size=${size}`)
  return unwrapList<Record<string, unknown>>(raw, MX_API_VERSION).map((n) =>
    adaptNote(n),
  )
}

/* ---------- 说说 Say（M4） ---------- */

export async function fetchSays(size = 10): Promise<Say[]> {
  if (!hasCore()) return mockSays
  const raw = await get<unknown>(`/says?size=${size}`)
  return unwrapList<Record<string, unknown>>(raw, MX_API_VERSION).map(adaptSay)
}

/* ---------- 项目 Projects ---------- */

/** 项目列表：GET /projects（core v12.x 新增模块，访客可读） */
export async function fetchProjects(size = 50): Promise<Project[]> {
  if (!hasCore()) return []
  const raw = await get<unknown>(`/projects?size=${size}`)
  return unwrapList<Record<string, unknown>>(raw, MX_API_VERSION).map(adaptProject)
}

/* ---------- 动态 Recently（M4） ---------- */

export async function fetchRecently(size = 10): Promise<Recently[]> {
  if (!hasCore()) return mockRecently
  const raw = await get<unknown>(`/recently?size=${size}`)
  return unwrapList<Record<string, unknown>>(raw, MX_API_VERSION).map(adaptRecently)
}

/* ---------- 时间轴 Timeline（M2/M5） ---------- */

/**
 * 归档/时间轴：GET /aggregate/timeline
 * - `type` 在 core 里是数字枚举（0=post，1=note），传字符串会 422
 * - 不传 type 时同时返回 posts 与 notes
 * - `sort=-1` 倒序，`year` 可按年过滤（SQL 层过滤，不受条数限制）
 */
export async function fetchTimeline(
  type?: 'post' | 'note',
  options: { year?: number; sort?: 1 | -1 } = {},
): Promise<TimelineItem[]> {
  if (!hasCore()) {
    const posts = mockPosts.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      category: p.category,
      categorySlug: p.categorySlug,
      created: p.created,
      type: 'post' as const,
    }))
    const notes = [
      {
        id: mockNote.id,
        title: mockNote.title ?? '',
        slug: String(mockNote.nid),
        nid: mockNote.nid,
        created: mockNote.created,
        type: 'note' as const,
      },
    ]
    return [...posts, ...notes]
      .filter((i) => (type ? i.type === type : true))
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
  }
  const params = new URLSearchParams()
  if (type) params.set('type', type === 'post' ? '0' : '1')
  if (options.year) params.set('year', String(options.year))
  if (options.sort) params.set('sort', String(options.sort))
  const qs = params.toString()
  const raw = await get<unknown>(`/aggregate/timeline${qs ? `?${qs}` : ''}`)
  if (!raw) return []
  // v12: { data: { posts, notes } }；v3: { data: { posts, notes }, meta }
  const data = unwrapEnvelope<Record<string, unknown>>(raw, MX_API_VERSION)
  const posts = (data?.posts as Record<string, unknown>[]) || []
  const notes = (data?.notes as Record<string, unknown>[]) || []
  return [
    ...posts.map((p) => adaptTimeline(p, 'post')),
    ...notes.map((n) => adaptTimeline(n, 'note')),
  ].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
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
  const arr = unwrapList<Record<string, unknown>>(raw, MX_API_VERSION)
  return arr.map((item) => {
    const post = adaptPost(item)
    // core 的 highlight.snippet 为 string | null（没有命中片段时是 null），
    // 只有非空字符串才覆盖摘要，否则保留 adaptPost 的兜底结果
    const highlight = item.highlight as Record<string, unknown> | undefined
    const snippet =
      typeof highlight?.snippet === 'string' ? highlight.snippet.trim() : ''
    return snippet ? { ...post, summary: snippet } : post
  })
}

/* ---------- 上下篇（A8：core 文章详情不含 prev/next，前端按 created 查相邻） ---------- */

function timelineToSummary(item: TimelineItem): PostSummary {
  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    category: item.category,
    categorySlug: item.categorySlug,
    created: item.created,
  }
}

/**
 * 文章上下篇。
 * 旧实现请求的 `/categories/:slug/posts` 在 core 里不存在（404）；
 * 改用 `/aggregate/timeline?type=0` 一次拿到全部已发布文章（不分页），
 * 需要限定同分类时按 categorySlug 过滤。
 */
export async function fetchAdjacentPosts(
  currentId: string,
  _created: string,
  categorySlug?: string,
): Promise<{ prev: PostSummary | null; next: PostSummary | null }> {
  if (!hasCore()) {
    const all = mockPosts
    const idx = all.findIndex((p) => p.id === currentId)
    return {
      prev: idx > 0 ? all[idx - 1] : null,
      next: idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null,
    }
  }
  const items = (await fetchTimeline('post'))
    .filter((item) => (categorySlug ? item.categorySlug === categorySlug : true))
    .map(timelineToSummary)
    .sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime())
  const idx = items.findIndex((p) => p.id === currentId)
  if (idx === -1) return { prev: null, next: null }
  return {
    prev: idx > 0 ? items[idx - 1] : null,
    next: idx < items.length - 1 ? items[idx + 1] : null,
  }
}

/* ---------- 最近文章 / 热门文章 / 最近评论（侧栏与页脚 widget） ---------- */

/**
 * 最近文章：`sortBy` 必须是 core 认识的字段名（createdAt/modifiedAt/pinAt），
 * 传 `created` 会被忽略并退回「置顶优先」的默认排序。
 */
export async function fetchRecentPosts(size = 6): Promise<PostSummary[]> {
  if (!hasCore()) return mockPosts.slice(0, size)
  const raw = await get<unknown>(
    `/posts?size=${size}&sortBy=createdAt&sortOrder=desc&truncate=200`,
  )
  if (!raw) return []
  return unwrapList<Record<string, unknown>>(raw, MX_API_VERSION).map(adaptPost)
}

/** 热门文章：GET /aggregate/top 按阅读量排序，返回 { posts, notes } */
export async function fetchHotPosts(size = 6): Promise<PostSummary[]> {
  if (!hasCore()) return mockPosts.slice(0, size)
  const raw = await get<Record<string, unknown>>(`/aggregate/top?size=${size}`)
  if (!raw) return []
  const payload = unwrapEnvelope<Record<string, unknown>>(raw, MX_API_VERSION)
  const arr = Array.isArray(payload?.posts)
    ? (payload.posts as Record<string, unknown>[])
    : []
  return arr.map(adaptPost)
}

export interface RecentComment {
  author: string
  avatar?: string
  content: string
  /** 被评论内容的标题（core 直接给出） */
  title?: string
  link?: string
  created?: string
}

/**
 * 最近评论：GET /activity/recent → { like, comment, recent, post, note }
 * 字段名是单数 `comment`（旧实现读 `comments`，永远为空）。
 */
export async function fetchRecentComments(): Promise<RecentComment[]> {
  if (!hasCore()) {
    return mockComments.slice(0, 3).map((c) => ({
      author: c.author,
      content: c.content,
    }))
  }
  const raw = await get<Record<string, unknown>>('/activity/recent')
  if (!raw) return []
  const payload = unwrapEnvelope<Record<string, unknown>>(raw, MX_API_VERSION)
  const arr = Array.isArray(payload.comment)
    ? (payload.comment as Record<string, unknown>[])
    : []
  return arr.map((c) => {
    const p = camelKeys<Record<string, unknown>>(c)
    const type = String(p.type ?? 'post').toLowerCase()
    const category = p.category as Record<string, unknown> | undefined
    let link: string | undefined
    if (type === 'note') {
      link = p.nid ? `/notes/${p.nid}` : undefined
    } else if (type === 'page') {
      link = p.slug ? `/pages/${p.slug}` : undefined
    } else if (p.slug) {
      link = `/posts/${category?.slug ?? 'uncategorized'}/${p.slug}`
    }
    return {
      author: String(p.author ?? ''),
      avatar: p.avatar as string | undefined,
      content: String(p.text ?? p.content ?? ''),
      title: p.title as string | undefined,
      link,
      created: (p.createdAt ?? p.created) as string | undefined,
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
