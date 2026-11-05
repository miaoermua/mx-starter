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
  /** core v12.x：置顶时间的展示用字段（列表本身已按 pinAt 优先排序） */
  pinAt?: string
  isPublished?: boolean
  count?: { read?: number; like?: number; comments?: number }
  cover?: string
  images?: string[]
}

export interface PostDetail extends PostSummary {
  text: string
  /** 'markdown' | 'lexical'，Lexical 正文的 text 只是降级纯文本 */
  contentFormat?: string
  /** 正文里被引用的相关文章（core 直接返回，无需再查） */
  related?: PostSummary[]
  /** 当前 IP 是否已点赞（core 详情接口按 IP 计算） */
  liked?: boolean
}

export interface PageDetail {
  id: string
  title: string
  slug: string
  text: string
  contentFormat?: string
  created: string
  modified?: string
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
    modified: (p.modifiedAt ?? p.modified) as string | undefined,
    pinAt: p.pinAt ? String(p.pinAt) : undefined,
    isPublished: p.isPublished as boolean | undefined,
    count: {
      // core v12.x：列表/详情在 read_count / like_count 顶层字段
      read: p.readCount as number | undefined,
      like: p.likeCount as number | undefined,
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
    contentFormat: p.contentFormat as string | undefined,
    related: Array.isArray(p.related)
      ? (p.related as AnyObj[]).map(adaptPost)
      : undefined,
    liked: p.liked as boolean | undefined,
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
    contentFormat: p.contentFormat as string | undefined,
    created: String(p.createdAt ?? p.created ?? ''),
    modified: (p.modifiedAt ?? p.modified) as string | undefined,
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

/** 标签聚合：GET /categories?type=tag 只返回 { name, count }，没有 id/slug */
export interface Tag {
  name: string
  /** 该标签下的已发布文章数 */
  count: number
}

export function adaptTag(raw: AnyObj): Tag {
  const p = camelKeys<AnyObj>(raw)
  return {
    name: String(p.name ?? ''),
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
  isWhispers?: boolean
  pin?: boolean
  /** 父评论 id；顶层评论为 undefined */
  parent?: string
  /** 评论线程根 id（core 的 rootCommentId） */
  root?: string
  replyCount?: number
  children?: Comment[]
  /** core 的 replyWindow：长线程只返回头部+尾部，中间的回复要靠 /comments/thread 分页补 */
  window?: CommentWindow
}

export interface CommentWindow {
  total: number
  returned: number
  threshold: number
  hasHidden: boolean
  hiddenCount: number
  nextCursor?: string
}

export function adaptComment(raw: AnyObj): Comment {
  const p = camelKeys<AnyObj>(raw)
  // core v12.x：内容在 text 字段，子评论在 replies（扁平回复列表），父级在 parent_comment_id
  const childrenRaw = (p.replies ?? p.children) as AnyObj[] | undefined
  return {
    id: String(p.id ?? p._id ?? ''),
    author: String(p.author ?? ''),
    avatar: p.avatar as string | undefined,
    content: String(p.content ?? p.text ?? ''),
    created: String(p.createdAt ?? p.created ?? ''),
    url: p.url as string | undefined,
    isWhispers: p.isWhispers as boolean | undefined,
    pin: p.pin as boolean | undefined,
    parent: (p.parentCommentId ?? p.parent) as string | undefined,
    root: p.rootCommentId as string | undefined,
    replyCount: p.replyCount as number | undefined,
    children: childrenRaw?.map(adaptComment),
    window: adaptCommentWindow(p.replyWindow),
  }
}

function adaptCommentWindow(raw: unknown): CommentWindow | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const w = camelKeys<AnyObj>(raw as AnyObj)
  return {
    total: Number(w.total ?? 0),
    returned: Number(w.returned ?? 0),
    threshold: Number(w.threshold ?? 0),
    hasHidden: Boolean(w.hasHidden),
    hiddenCount: Number(w.hiddenCount ?? 0),
    nextCursor: w.nextCursor as string | undefined,
  }
}

/**
 * core 的 `data[].replies` 是**扁平**回复列表（按 root 聚合，带 parentCommentId），
 * 不是嵌套树。这里按 parentCommentId 还原成树，供 `comment-child` 递归渲染。
 * 父评论被 replyWindow 截断时（不在本页）退化为顶层子评论，不丢内容。
 */
export function nestCommentReplies(list: Comment[]): Comment[] {
  return list.map((root) => {
    const flat = root.children ?? []
    if (flat.length === 0) return root
    return { ...root, children: buildReplyTree(flat, root.id) }
  })
}

/**
 * 把扁平回复列表还原成树。`rootId` 是线程根评论 id（父级指向它的算顶层）。
 */
export function buildReplyTree(flat: Comment[], rootId?: string): Comment[] {
  const byId = new Map(flat.map((c) => [c.id, { ...c, children: [] as Comment[] }]))
  for (const c of byId.values()) {
    const parent = c.parent ? byId.get(c.parent) : undefined
    if (parent && parent.id !== c.id) parent.children!.push(c)
  }

  const topLevel = [...byId.values()].filter(
    (c) => !c.parent || c.parent === rootId || !byId.has(c.parent),
  )

  // 兜底：parent 指向成环时上面的过滤会让评论从树上消失，这里补成顶层
  const reachable = new Set<string>()
  const walk = (c: Comment) => {
    if (reachable.has(c.id)) return
    reachable.add(c.id)
    ;(c.children ?? []).forEach(walk)
  }
  topLevel.forEach(walk)
  for (const c of byId.values()) {
    if (!reachable.has(c.id)) {
      topLevel.push(c)
      walk(c)
    }
  }

  return topLevel
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
  contentFormat?: string
  created: string
  modified?: string
  mood?: string
  weather?: string
  location?: string
  /**
   * core v12.x：bookmark 是布尔标记（「手记」收藏），不是 { title, url } 列表。
   * 旧版数组形态已不存在。
   */
  bookmark?: boolean
  /** 是否设置访问密码；正文会被 core 隐藏（详情需要 ?password=） */
  hasPassword?: boolean
  readCount?: number
  likeCount?: number
  /** 当前 IP 是否已点赞（core 详情接口按 IP 计算） */
  liked?: boolean
  images?: string[]
}

export function adaptNote(raw: AnyObj): Note {
  const p = camelKeys<AnyObj>(raw)
  const format = p.contentFormat as string | undefined
  const content =
    format === 'lexical'
      ? // Lexical 正文是 JSON，脚手架按 Markdown 渲染，只能用 core 生成的纯文本降级
        p.text
      : (p.content ?? p.text)
  return {
    id: String(p.id ?? p._id ?? ''),
    nid: Number(p.nid ?? 0),
    title: p.title as string | undefined,
    content: String(content ?? ''),
    contentFormat: format,
    created: String(p.createdAt ?? p.created ?? ''),
    modified: (p.modifiedAt ?? p.modified) as string | undefined,
    mood: p.mood as string | undefined,
    weather: p.weather as string | undefined,
    location: p.location as string | undefined,
    bookmark: p.bookmark as boolean | undefined,
    hasPassword: p.hasPassword as boolean | undefined,
    readCount: p.readCount as number | undefined,
    likeCount: p.likeCount as number | undefined,
    liked: p.liked as boolean | undefined,
    images: Array.isArray(p.images)
      ? (p.images as unknown[])
          .map((img) => (typeof img === 'string' ? img : (img as AnyObj)?.src))
          .filter((s): s is string => typeof s === 'string')
      : undefined,
  }
}

/* ---------- 说说 Say（M4） ---------- */

export interface Say {
  id: string
  /** 文案。core v12.x 的字段名是 `text`（旧实现读 `content`，恒为空） */
  content: string
  /** 来源（微博/推特等，可空） */
  source?: string
  author?: string
  created: string
}

export function adaptSay(raw: AnyObj): Say {
  const p = camelKeys<AnyObj>(raw)
  return {
    id: String(p.id ?? p._id ?? ''),
    content: String(p.text ?? p.content ?? ''),
    source: p.source as string | undefined,
    author: p.author as string | undefined,
    created: String(p.createdAt ?? p.created ?? ''),
  }
}

/* ---------- 动态 Recently（M4） ---------- */

/** recently 关联的内容摘要（core 的 `ref`） */
export interface RecentlyRef {
  type: string
  id: string
  title?: string
  slug?: string
  nid?: number
  url?: string
}

export interface Recently {
  id: string
  content: string
  /** 'text' | 'link'（link 时 content 是 URL，标题在 enrichments/metadata 里） */
  type?: string
  up?: number
  down?: number
  /** 评论数（core 读取时实时重算） */
  commentCount?: number
  ref?: RecentlyRef
  created: string
  modified?: string
}

export function adaptRecently(raw: AnyObj): Recently {
  const p = camelKeys<AnyObj>(raw)
  const ref = p.ref as AnyObj | null | undefined
  return {
    id: String(p.id ?? p._id ?? ''),
    content: String(p.content ?? ''),
    type: p.type as string | undefined,
    up: p.up as number | undefined,
    down: p.down as number | undefined,
    commentCount: p.commentsIndex as number | undefined,
    ref: ref
      ? {
          type: String(ref.type ?? ''),
          id: String(ref.id ?? ''),
          title: ref.title as string | undefined,
          slug: (ref.slug ?? undefined) as string | undefined,
          nid: ref.nid ? Number(ref.nid) : undefined,
          url: ref.url as string | undefined,
        }
      : undefined,
    created: String(p.createdAt ?? p.created ?? ''),
    modified: (p.modifiedAt ?? p.modified) as string | undefined,
  }
}

/* ---------- 时间轴 Timeline（M2/M5） ---------- */

export interface TimelineItem {
  id: string
  title: string
  slug: string
  category?: string
  categorySlug?: string
  nid?: number
  created: string
  type: 'post' | 'note'
}

/** 项目（core v12.x 的 Project 模块，访客可读） */
export interface Project {
  id: string
  name: string
  description?: string
  avatar?: string
  previewUrl?: string
  docUrl?: string
  projectUrl?: string
  images?: string[]
  text?: string
  created: string
}

export function adaptProject(raw: AnyObj): Project {
  const p = camelKeys<AnyObj>(raw)
  const images = Array.isArray(p.images)
    ? (p.images as unknown[])
        .map((img) => (typeof img === 'string' ? img : (img as AnyObj)?.src))
        .filter((s): s is string => typeof s === 'string')
    : undefined
  return {
    id: String(p.id ?? p._id ?? ''),
    name: String(p.name ?? ''),
    description: p.description as string | undefined,
    avatar: p.avatar as string | undefined,
    previewUrl: p.previewUrl as string | undefined,
    docUrl: p.docUrl as string | undefined,
    projectUrl: p.projectUrl as string | undefined,
    images,
    text: p.text as string | undefined,
    created: String(p.createdAt ?? p.created ?? ''),
  }
}

export function adaptTimeline(raw: AnyObj, type: 'post' | 'note'): TimelineItem {
  const p = camelKeys<AnyObj>(raw)
  return {
    id: String(p.id ?? p._id ?? ''),
    title: String(p.title ?? ''),
    slug: String(p.slug ?? ''),
    category: (p.category as AnyObj)?.name as string | undefined,
    categorySlug: (p.category as AnyObj)?.slug as string | undefined,
    nid: p.nid ? Number(p.nid) : undefined,
    created: String(p.createdAt ?? p.created ?? ''),
    type,
  }
}
