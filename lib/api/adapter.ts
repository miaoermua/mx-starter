/**
 * v12.x 数据适配层（FRONTEND_PLAN.md 第 5 节）
 *
 * 职责（仅一件）：
 * - 把 core 返回的 snake_case 信封拆包、分页字段、时间/计数字段、评论树 children
 *   整理成统一 camelCase 模型。
 *
 * v12.x 形态（COMPATIBILITY.md 第 11 节左列）：
 * - 响应：对象原样 / 数组包 {data}
 * - 分页：顶层 pagination 六字段
 * - 时间/计数：created/modified、count.read/like
 * - 正文：text（Markdown 原文）
 * - 评论树：children 嵌套（≤10 层）
 *
 * v13+ 差异（统一信封、meta.pagination、thread、Lexical）不实现。
 */

/* ---------- 通用工具 ---------- */

type AnyObj = Record<string, unknown>

/** snake_case → camelCase（浅层，只转顶层 key） */
function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

/** 把对象顶层 key 转 camelCase */
export function camelKeys<T = AnyObj>(obj: AnyObj): T {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj as T
  }
  const out: AnyObj = {}
  for (const k of Object.keys(obj)) {
    out[toCamel(k)] = obj[k]
  }
  return out as T
}

/** 拆信封：v12.x 数组包 {data}、对象原样 */
export function unwrap<T>(raw: unknown): T {
  if (Array.isArray(raw)) return raw as T
  if (raw && typeof raw === 'object') {
    const o = raw as AnyObj
    if (Array.isArray(o.data)) return o.data as T
  }
  return raw as T
}

/** 从 Markdown 正文提取摘要（core 的 summary 字段常为空） */
function extractSummary(text?: string): string | undefined {
  if (!text) return undefined
  return text
    // 去掉 HTML 标签
    .replace(/<[^>]+>/g, '')
    // 去掉 Markdown 图片/链接语法
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // 去掉 Markdown 标题/引用/代码标记
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/`{1,3}/g, '')
    // 去掉多余空白
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
}

/* ---------- 分页 ---------- */

export interface Pagination {
  page: number
  size: number
  total: number
  totalPages: number
  hasPrev: boolean
  hasNext: boolean
}

export function parsePagination(raw: AnyObj): Pagination | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const p = camelKeys<AnyObj>(raw)
  // 后端字段：current_page / total_page / has_next_page / has_prev_page
  // camelKeys 转成 currentPage / totalPage / hasNextPage / hasPrevPage
  const page = Number(p.currentPage ?? p.page)
  if (isNaN(page)) return undefined
  return {
    page,
    size: Number(p.size),
    total: Number(p.total),
    totalPages: Number(p.totalPage ?? p.totalPages),
    hasPrev: !!(p.hasPrevPage ?? p.hasPrev),
    hasNext: !!(p.hasNextPage ?? p.hasNext),
  }
}

/* ---------- 文章 / 页面 ---------- */

export interface PostSummary {
  id: string
  title: string
  slug: string
  category?: string
  categorySlug?: string
  tags?: string[]
  summary?: string
  created: string
  modified?: string
  count?: { read?: number; like?: number; comments?: number }
  cover?: string
  images?: string[]
}

export interface PostDetail extends PostSummary {
  text: string
  allowComment?: boolean
  copyright?: boolean
  modified?: string
}

export interface PageDetail {
  id: string
  title: string
  slug: string
  text: string
  created: string
  modified?: string
  allowComment?: boolean
}

/** 适配单条文章摘要（来自列表） */
export function adaptPost(raw: AnyObj): PostSummary {
  const p = camelKeys<AnyObj>(raw)
  const count = p.count as AnyObj | undefined
  return {
    id: String(p.id ?? p._id ?? ''),
    title: String(p.title ?? ''),
    slug: String(p.slug ?? ''),
    category: (p.category as AnyObj)?.name as string | undefined,
    categorySlug: (p.category as AnyObj)?.slug as string | undefined,
    tags: p.tags as string[] | undefined,
    summary: (p.summary as string | undefined) || extractSummary(p.text as string | undefined),
    created: String(p.createdAt ?? p.created ?? ''),
    modified: p.modified as string | undefined,
    count: {
      // core v12.x 列表接口 count 为 null，实际值在 read_count/like_count 顶层字段
      read: p.readCount as number | undefined,
      like: p.likeCount as number | undefined,
      comments: count?.comments as number | undefined,
    },
    // cover 可能是字符串或 { src, ... } 对象
    cover: typeof p.cover === 'string'
      ? p.cover
      : (p.cover as AnyObj)?.src as string | undefined,
    // images 元素可能是 { src, type, ... } 对象或字符串
    images: Array.isArray(p.images)
      ? p.images
          .map((img: unknown) =>
            typeof img === 'string' ? img : (img as AnyObj)?.src,
          )
          .filter((s: unknown): s is string => typeof s === 'string')
      : undefined,
  }
}

/** 适配文章详情 */
export function adaptPostDetail(raw: AnyObj): PostDetail {
  const base = adaptPost(raw)
  const p = camelKeys<AnyObj>(raw)
  return {
    ...base,
    text: String(p.text ?? ''),
    allowComment: p.allowComment as boolean | undefined,
    copyright: p.copyright as boolean | undefined,
  }
}

/** 适配独立页面 */
export function adaptPage(raw: AnyObj): PageDetail {
  const p = camelKeys<AnyObj>(raw)
  return {
    id: String(p.id ?? p._id ?? ''),
    title: String(p.title ?? ''),
    slug: String(p.slug ?? ''),
    text: String(p.text ?? ''),
    created: String(p.createdAt ?? p.created ?? ''),
    modified: p.modified as string | undefined,
    allowComment: p.allowComment as boolean | undefined,
  }
}

/* ---------- 分类 / 标签 ---------- */

export interface Category {
  id: string
  name: string
  slug: string
  count: number
}

export function adaptCategory(raw: AnyObj): Category {
  const p = camelKeys<AnyObj>(raw)
  return {
    id: String(p.id ?? p._id ?? ''),
    name: String(p.name ?? ''),
    slug: String(p.slug ?? ''),
    count: Number(p.count ?? 0),
  }
}

/* ---------- 评论 ---------- */

export interface Comment {
  id: string
  author: string
  avatar?: string
  content: string
  created: string
  url?: string
  mailHash?: string
  isWhispers?: boolean
  pin?: boolean
  parent?: string
  children?: Comment[]
}

export function adaptComment(raw: AnyObj): Comment {
  const p = camelKeys<AnyObj>(raw)
  // core v12.x：内容在 text 字段，子评论在 replies，父级在 parent_comment_id
  const childrenRaw = (p.replies ?? p.children) as AnyObj[] | undefined
  return {
    id: String(p.id ?? p._id ?? ''),
    author: String(p.author ?? ''),
    avatar: p.avatar as string | undefined,
    content: String(p.content ?? p.text ?? ''),
    created: String(p.createdAt ?? p.created ?? ''),
    url: p.url as string | undefined,
    mailHash: p.mailHash as string | undefined,
    isWhispers: p.isWhispers as boolean | undefined,
    pin: p.pin as boolean | undefined,
    parent: (p.parentCommentId ?? p.parent) as string | undefined,
    children: childrenRaw?.map(adaptComment),
  }
}

/* ---------- 友链 ---------- */

/** 友链状态：0=正常、2=失联、3=禁止（core v12.x） */
export type FriendState = 0 | 2 | 3
/** 友链类型：0=友链、1=收藏（core v12.x） */
export type FriendType = 0 | 1

export interface FriendLink {
  id: string
  name: string
  url: string
  avatar?: string
  description?: string
  /** 0=友链、1=收藏 */
  type: FriendType
  /** 0=正常、2=失联、3=禁止 */
  state: FriendState
  /** 添加时间，用于排序 */
  created?: string
}

export function adaptFriend(raw: AnyObj): FriendLink {
  const p = camelKeys<AnyObj>(raw)
  const type = (Number(p.type) === 1 ? 1 : 0) as FriendType
  const stateRaw = Number(p.state)
  const state = (stateRaw === 2 ? 2 : stateRaw === 3 ? 3 : 0) as FriendState
  return {
    id: String(p.id ?? p._id ?? ''),
    name: String(p.name ?? ''),
    url: String(p.url ?? ''),
    avatar: p.avatar as string | undefined,
    description: p.description as string | undefined,
    type,
    state,
    created: String(p.createdAt ?? p.created ?? ''),
  }
}

/* ---------- 日记 Note（M3） ---------- */

export interface Note {
  id: string
  nid: number
  title?: string
  content: string
  created: string
  modified?: string
  mood?: string
  weather?: string
  readCount?: number
  likeCount?: number
  bookmark?: { title: string; url: string }[]
  hide?: boolean
  password?: boolean
}

export function adaptNote(raw: AnyObj): Note {
  const p = camelKeys<AnyObj>(raw)
  return {
    id: String(p.id ?? p._id ?? ''),
    nid: Number(p.nid ?? 0),
    title: p.title as string | undefined,
    // core v12.x：content 常为 null，实际内容在 text 字段
    content: String(p.content ?? p.text ?? ''),
    created: String(p.createdAt ?? p.created ?? ''),
    modified: p.modifiedAt as string | undefined,
    mood: p.mood as string | undefined,
    weather: p.weather as string | undefined,
    readCount: p.readCount as number | undefined,
    likeCount: p.likeCount as number | undefined,
    bookmark: p.bookmark as Note['bookmark'],
    hide: p.hide as boolean | undefined,
    password: p.password as boolean | undefined,
  }
}

/* ---------- 说说 Say（M4） ---------- */

export interface Say {
  id: string
  content: string
  created: string
}

export function adaptSay(raw: AnyObj): Say {
  const p = camelKeys<AnyObj>(raw)
  return {
    id: String(p.id ?? p._id ?? ''),
    content: String(p.content ?? ''),
    created: String(p.createdAt ?? p.created ?? ''),
  }
}

/* ---------- 动态 Recently（M4） ---------- */

export interface Recently {
  id: string
  content: string
  created: string
}

export function adaptRecently(raw: AnyObj): Recently {
  const p = camelKeys<AnyObj>(raw)
  return {
    id: String(p.id ?? p._id ?? ''),
    content: String(p.content ?? ''),
    created: String(p.createdAt ?? p.created ?? ''),
  }
}

/* ---------- 时间轴 Timeline（M2/M5） ---------- */

export interface TimelineItem {
  id: string
  title: string
  slug: string
  category?: string
  created: string
  type?: string
}

export function adaptTimeline(raw: AnyObj): TimelineItem {
  const p = camelKeys<AnyObj>(raw)
  return {
    id: String(p.id ?? p._id ?? ''),
    title: String(p.title ?? ''),
    slug: String(p.slug ?? ''),
    category: (p.category as AnyObj)?.name as string | undefined,
    created: String(p.createdAt ?? p.created ?? ''),
    type: p.type as string | undefined,
  }
}
