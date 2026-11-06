import { adaptNote, type Note } from './adapter'
import { readMeta } from './envelope'

/**
 * 加密日记的访问判定。
 *
 * 两个版本的「密码缺失/错误」都是 HTTP **403**，但业务码形态不同：
 *
 * | Core | 响应体 |
 * |---|---|
 * | v12（/api/v2） | `{ ok: 0, code: 14000, message: '不要偷看人家的小心思啦~' }` |
 * | v3（/api/v3）  | `{ error: { code: 'NOTE_FORBIDDEN', message: … } }` |
 *
 * 所以判定条件是「403」+「业务码属于密码集合」，两者同时满足才算密码问题。
 * WAF / 反向代理返回的 403 HTML、其他业务 403（如 CommentForbidden）
 * 都归为普通错误，避免把故障混淆成密码页。
 */
export const NOTE_FORBIDDEN_CODE = 14000

/** v3 的 AppErrorCode 是字符串，密码相关错误码即这个 */
export const NOTE_FORBIDDEN_CODES: readonly string[] = ['NOTE_FORBIDDEN']

export type NoteAccessReason = 'ok' | 'password' | 'not-found' | 'error'

export interface NoteAccess {
  note: Note | null
  /** true = 日记存在但密码缺失/错误，页面应展示密码表单而非 404 */
  locked: boolean
  reason: NoteAccessReason
}

function readObject(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  return body as Record<string, unknown>
}

/**
 * 从响应体里取业务错误码。
 *
 * 兼容三种位置：v12 顶层 `{code}`、v12 包裹 `{data:{code}}`、
 * v3 错误信封 `{error:{code}}`。返回值统一为字符串，便于同时比对
 * 数字码（'14000'）和枚举名（'NOTE_FORBIDDEN'）。
 */
function readErrorCode(body: unknown): string | null {
  const root = readObject(body)
  if (!root) return null
  // v3 的 error 对象优先，其次才是 v12 的 { data: { code } }
  const nested = readObject(root.error) ?? readObject(root.data)
  const code = root.code ?? nested?.code
  if (typeof code === 'number') return String(code)
  if (typeof code === 'string' && code.length > 0) return code
  return null
}

/** 403 是否属于「日记需要密码」 */
export function isNotePasswordError(body: unknown): boolean {
  const code = readErrorCode(body)
  if (!code) return false
  return (
    code === String(NOTE_FORBIDDEN_CODE) || NOTE_FORBIDDEN_CODES.includes(code)
  )
}

/** 拆 { data: {...} } 信封；对象原样返回 */
function unwrapNoteBody(body: unknown): Record<string, unknown> {
  const root = readObject(body)
  if (!root) return {}
  const inner = readObject(root.data)
  return inner ?? root
}

/**
 * 把 core 的响应翻译成页面需要的状态。四种 reason 互斥，页面必须分别处理：
 *
 * - `ok`：正常渲染；
 * - `password`：展示密码表单（只有 403 + 密码类业务码会走到这里）；
 * - `not-found`：真正的 404，调用 `notFound()`；
 * - `error`：基础设施故障（5xx / 429 / WAF 403 / 网络错误），必须报错或可重试，
 *   **不能降级成 404**——那会把 Core 宕机伪装成内容不存在。
 */
export function classifyNoteResponse(status: number, body: unknown): NoteAccess {
  if (status >= 200 && status < 300) {
    // v3 的点赞态/计数在信封的 meta 里，必须一起传进适配层
    return {
      note: adaptNote(unwrapNoteBody(body), readMeta(body)),
      locked: false,
      reason: 'ok',
    }
  }

  if (status === 403 && isNotePasswordError(body)) {
    return { note: null, locked: true, reason: 'password' }
  }

  if (status === 404) {
    return { note: null, locked: false, reason: 'not-found' }
  }

  return { note: null, locked: false, reason: 'error' }
}

/** 页面在拿到判定结果后应该做什么（抽出来便于测试，页面只做 switch） */
export type NotePageAction = 'render' | 'password' | 'not-found' | 'error'

export function resolveNotePageAction(access: NoteAccess): NotePageAction {
  switch (access.reason) {
    case 'ok':
      // 兜底：reason 与 note 不一致时按故障处理，绝不静默渲染空白页
      return access.note ? 'render' : 'error'
    case 'password':
      return 'password'
    case 'not-found':
      return 'not-found'
    default:
      return 'error'
  }
}
