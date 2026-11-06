import { buildReplyTree, type Comment, type CommentWindow } from './adapter'

/**
 * 长评论线程的合并逻辑（`/api/comments/thread` 的纯函数部分）。
 *
 * core 对超过阈值的线程只返回头部 + 尾部，中间的回复由游标分批补（见
 * `comment.service.ts` 的 buildReplyWindow / getThreadReplies）。这里负责把
 * 「已经渲染的子树」和「新拿到的一批回复」合成新的子树，并且不丢任何有效回复：
 *
 * - 两批数据都先拍平，同一个 id 只保留一份（重复加载、重复点击都安全）；
 * - 用 buildReplyTree 按 parentCommentId 重建，父级缺失/自引用/环状引用都不会
 *   让节点消失（buildReplyTree 有兜底）；
 * - 一批数据里没有任何新节点时直接结束，避免服务端游标异常导致无限拉取。
 */
export interface ThreadPage {
  items?: Comment[]
  nextCursor?: string | null
  remaining?: number | null
  done?: boolean
}

export interface ThreadMergeResult {
  children: Comment[]
  /** 新的窗口状态；undefined 表示调用方没有传入窗口信息，不去编造 */
  window?: CommentWindow
}

/** 把树拍平（先序），用于合并与去重 */
export function flattenThread(comments: Comment[]): Comment[] {
  const out: Comment[] = []
  const walk = (list: Comment[]) => {
    for (const comment of list) {
      out.push(comment)
      if (comment.children?.length) walk(comment.children)
    }
  }
  walk(comments)
  return out
}

export function mergeThreadPage(params: {
  /** 已经渲染的子回复树 */
  children: Comment[]
  /** 线程根评论 id */
  rootId: string
  /** 接口返回的一页（items 也是树） */
  page: ThreadPage
  /** 上一轮的窗口状态 */
  window?: CommentWindow
}): ThreadMergeResult {
  const { children, rootId, page, window: prev } = params

  const existing = flattenThread(children)
  const incoming = flattenThread(page.items ?? [])

  const known = new Set(existing.map((item) => item.id))
  const hasNew = incoming.some((item) => !known.has(item.id))

  // buildReplyTree 内部按 id 去重（后出现的覆盖先出现的），重复加载不会产生重复节点
  const merged = buildReplyTree([...existing, ...incoming], rootId)

  // 没有新节点（或服务端明确 done）时停掉按钮，防止游标异常时无限拉取
  const done = page.done === true || !hasNew
  const nextCursor = done ? undefined : (page.nextCursor ?? undefined)
  const hasHidden = !done && Boolean(nextCursor)

  if (!prev) return { children: merged }

  return {
    children: merged,
    window: {
      ...prev,
      hasHidden,
      hiddenCount: hasHidden ? Number(page.remaining ?? prev.hiddenCount ?? 0) : 0,
      nextCursor,
    },
  }
}
