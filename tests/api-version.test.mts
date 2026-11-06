import assert from 'node:assert/strict'
import test from 'node:test'

import {
  apiPrefixFor,
  resolveApiVersion,
  DEFAULT_API_VERSION,
  SUPPORTED_API_VERSIONS,
} from '../lib/api/config.ts'
import {
  readErrorMessage,
  readMeta,
  unwrapEnvelope,
  unwrapList,
} from '../lib/api/envelope.ts'

/* ---------- 版本解析 ---------- */

test('默认版本保持 v12，避免升级即破坏现有部署', () => {
  assert.equal(DEFAULT_API_VERSION, 12)
  assert.equal(resolveApiVersion(undefined), 12)
  assert.equal(resolveApiVersion(''), 12)
})

test('MX_API_VERSION 只认受支持的版本，其余回落并告警', () => {
  assert.deepEqual([...SUPPORTED_API_VERSIONS], [12, 3])
  assert.equal(resolveApiVersion('3'), 3)
  assert.equal(resolveApiVersion('v3'), 3)
  assert.equal(resolveApiVersion(' 3 '), 3)
  assert.equal(resolveApiVersion('12'), 12)
  assert.equal(resolveApiVersion('2'), 12)
  assert.equal(resolveApiVersion('v2'), 12)

  const warn = console.warn
  let warned = 0
  console.warn = () => { warned++ }
  try {
    assert.equal(resolveApiVersion('99'), 12)
    assert.equal(resolveApiVersion('abc'), 12)
  } finally {
    console.warn = warn
  }
  assert.equal(warned, 2)
})

test('版本前缀映射：v3 → /api/v3，v12 → /api/v2', () => {
  assert.equal(apiPrefixFor(3), '/api/v3')
  assert.equal(apiPrefixFor(12), '/api/v2')
})

/* ---------- 拆信封 ---------- */

test('v3 拆 { data } 信封：对象、数组都能拆', () => {
  assert.deepEqual(unwrapEnvelope({ data: { id: 'a' } }, 3), { id: 'a' })
  assert.deepEqual(unwrapEnvelope({ data: [1, 2] }, 3), [1, 2])
})

test('v3 带 meta 时只取 data，meta 不混进业务数据', () => {
  const raw = { data: { id: 'a' }, meta: { pagination: { page: 1 } } }
  assert.deepEqual(unwrapEnvelope(raw, 3), { id: 'a' })
  assert.deepEqual(readMeta(raw), { pagination: { page: 1 } })
})

test('v3 响应缺 data 键时原样返回，由调用方按空数据处理', () => {
  const raw = { id: 'a' }
  assert.deepEqual(unwrapEnvelope(raw, 3), raw)
})

test('v12 只解数组信封，业务对象里合法的 data 字段不被误拆', () => {
  // 列表：{ data: [...] }
  assert.deepEqual(unwrapEnvelope({ data: [1, 2] }, 12), [1, 2])
  // 单对象：原样返回（即使带 data 字段，也不能拆——否则 Snippet 之类会被吃掉）
  const biz = { id: 'a', data: { nested: true } }
  assert.deepEqual(unwrapEnvelope(biz, 12), biz)
})

test('重复拆包安全：已解包的数据再拆不会变成 undefined', () => {
  const already = { id: 'a', title: 't' }
  assert.deepEqual(unwrapEnvelope(unwrapEnvelope(already, 3), 3), already)
  assert.deepEqual(unwrapEnvelope(unwrapEnvelope(already, 12), 12), already)
})

test('unwrapList 兼容 v12 数组外壳与 v3 的「列表再包一层」', () => {
  assert.deepEqual(unwrapList({ data: [1] }, 12), [1])
  assert.deepEqual(unwrapList([1, 2], 3), [1, 2])
  // v3: GET /categories/:tag?tag=true → { data: { tag, data: [...] } }
  assert.deepEqual(
    unwrapList({ data: { tag: 'ts', data: [3, 4] } }, 3),
    [3, 4],
  )
  // 非列表一律返回 []
  assert.deepEqual(unwrapList({ data: { id: 'a' } }, 3), [])
  assert.deepEqual(unwrapList(null, 12), [])
})

/* ---------- 错误信息 ---------- */

test('错误信息两种信封都能读到，避免吞掉 API 错误', () => {
  assert.equal(readErrorMessage({ ok: 0, code: 14000, message: '密码错误' }), '14000: 密码错误')
  assert.equal(
    readErrorMessage({ error: { code: 'NOTE_FORBIDDEN', message: '别偷看' } }),
    'NOTE_FORBIDDEN: 别偷看',
  )
  assert.equal(readErrorMessage({ message: '只有消息' }), '只有消息')
  assert.equal(readErrorMessage(null), undefined)
  assert.equal(readErrorMessage('text'), undefined)
})
