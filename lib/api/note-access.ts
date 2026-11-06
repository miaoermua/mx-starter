import { adaptNote, type Note } from './adapter'

/**
 * 加密日记的访问判定。
 *
 * core v12.x 的密码错误/缺失都用 `BizException(ErrorCodeEnum.NoteForbidden)` 抛出，
 * 响应是 HTTP **403** + `{ ok: 0, code: 14000, message: '不要偷看人家的小心思啦~' }`。
 *
 * 这里把「403」+「业务码 14000」两个条件一起判定：
 * 只有同时满足才当作「需要密码」，WAF / 反向代理返回的 403 HTML、
 * 其他业务 403（如 CommentForbidden 14005）都归为普通错误，避免把故障
 * 混淆成密码页。
 */
export const NOTE_FORBIDDEN_CODE = 14000

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

/** 从响应体里取业务错误码（顶层 code，兼容 { data: { code } } 形态） */
function readErrorCode(body: unknown): number | null {
  const root = readObject(body)
  if (!root) return null
  const nested = readObject(root.data)
  const code = Number(root.code ?? nested?.code)
  return Number.isFinite(code) ? code : null
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
 * - `password`：展示密码表单（只有 403 + 14000 会走到这里）；
 * - `not-found`：真正的 404，调用 `notFound()`；
 * - `error`：基础设施故障（5xx / 429 / WAF 403 / 网络错误），必须报错或可重试，
 *   **不能降级成 404**——那会把 Core 宕机伪装成内容不存在。
 */
export function classifyNoteResponse(status: number, body: unknown): NoteAccess {
  if (status >= 200 && status < 300) {
    return { note: adaptNote(unwrapNoteBody(body)), locked: false, reason: 'ok' }
  }

  if (status === 403 && readErrorCode(body) === NOTE_FORBIDDEN_CODE) {
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
