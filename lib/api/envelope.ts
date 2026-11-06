/**
 * 响应信封适配（Core v12 / v3 差异集中在这里）
 *
 * 契约差异只有三处：
 *
 * | | v12（/api/v2） | v3（/api/v3） |
 * |---|---|---|
 * | 单个对象 | 原样返回 | `{ data: {...}, meta? }` |
 * | 列表 | 多数是 `{ data: [...] }` | `{ data: [...], meta? }` |
 * | 分页 | 顶层 `pagination: { currentPage, totalPage, hasNextPage… }` | `meta.pagination: { page, size, total, totalPages }` |
 *
 * 这里只做「剥壳 + 定位分页 + 取 meta」，不碰字段语义；
 * 字段归一化仍然在 adapter.ts。页面和组件永远拿不到信封。
 */

import type { ApiVersion } from './config'
import { parsePagination, type Pagination } from './adapter'

type AnyObj = Record<string, unknown>

function asObject(raw: unknown): AnyObj | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  return raw as AnyObj
}

const hasOwn = (obj: AnyObj, key: string) =>
  Object.prototype.hasOwnProperty.call(obj, key)

/**
 * 拆信封，返回业务数据本体。
 *
 * - v3：响应**恒为** `{ data, meta? }`，直接取 `data`。取不到时原样返回，
 *   由调用方按空数据处理（不在这里抛）。
 * - v12：只有列表被包成 `{ data: [...] }`，单个对象原样返回。为了不误伤
 *   业务对象里合法的 `data` 字段（例如某些 Snippet 内容），**只解数组**，
 *   与原实现保持一致。
 */
export function unwrapEnvelope<T>(raw: unknown, version: ApiVersion): T {
  if (Array.isArray(raw)) return raw as T

  const obj = asObject(raw)
  if (!obj) return raw as T

  if (version === 3) {
    return (hasOwn(obj, 'data') ? obj.data : raw) as T
  }

  if (Array.isArray(obj.data)) return obj.data as T
  return raw as T
}

/**
 * 拆信封并保证返回列表。兼容 v3 里「列表再包一层」的端点，
 * 例如 `GET /categories/:tag?tag=true` → `{ data: { tag, data: [...] } }`。
 */
export function unwrapList<T = AnyObj>(raw: unknown, version: ApiVersion): T[] {
  const payload = unwrapEnvelope<unknown>(raw, version)
  if (Array.isArray(payload)) return payload as T[]

  const obj = asObject(payload)
  if (obj && Array.isArray(obj.data)) return obj.data as T[]
  return []
}

/** 取响应 meta（v3 独有；v12 没有，返回 undefined） */
export function readMeta(raw: unknown): AnyObj | undefined {
  return asObject(asObject(raw)?.meta) ?? undefined
}

/**
 * 取分页并转成内部标准模型。
 *
 * 位置：v3 在 `meta.pagination`，v12 在顶层 `pagination`（也兼容 meta 形态）。
 * 两边的字段名差异由 `parsePagination` 吸收；v3 不提供 hasPrev/hasNext，
 * 按 page/totalPages 推导。
 */
export function readPagination(
  raw: unknown,
  version: ApiVersion,
): Pagination | undefined {
  const root = asObject(raw)
  if (!root) return undefined

  // v3：meta.pagination；v12：顶层 pagination（部分端点也可能塞进 meta）
  const source =
    asObject(readMeta(raw)?.pagination) ?? asObject(root.pagination)

  if (!source) return undefined
  return parsePagination(source)
}

/** 从错误响应体里提取可读信息（v12 `{code,message}` / v3 `{error:{code,message}}`） */
export function readErrorMessage(body: unknown): string | undefined {
  const root = asObject(body)
  if (!root) return undefined
  const err = asObject(root.error)
  const message = err?.message ?? root.message
  const code = err?.code ?? root.code
  if (typeof message !== 'string' || !message) return undefined
  return typeof code === 'string' || typeof code === 'number'
    ? `${code}: ${message}`
    : message
}
