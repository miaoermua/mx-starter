import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NOTE_FORBIDDEN_CODE,
  classifyNoteResponse,
  resolveNotePageAction,
} from '../lib/api/note-access.ts'

// core 的 BizException 响应：{ ok: 0, code: 14000, message: '不要偷看人家的小心思啦~' }
const forbiddenBody = { ok: 0, code: NOTE_FORBIDDEN_CODE, message: '不要偷看人家的小心思啦~' }

test('200 + { data } 信封 → 正常日记', () => {
  const result = classifyNoteResponse(200, {
    data: { id: 'n1', nid: 7, text: '# hi', content: '# hi' },
    prev: null,
    next: null,
  })

  assert.equal(result.locked, false)
  assert.equal(result.reason, 'ok')
  assert.equal(result.note?.nid, 7)
  assert.equal(result.note?.content, '# hi')
})

test('200 + 裸对象（无信封）→ 正常日记', () => {
  const result = classifyNoteResponse(200, { id: 'n2', nid: 8, content: 'hello' })
  assert.equal(result.locked, false)
  assert.equal(result.note?.content, 'hello')
})

test('403 + 业务码 14000 → 需要密码', () => {
  const result = classifyNoteResponse(403, forbiddenBody)
  assert.equal(result.locked, true)
  assert.equal(result.reason, 'password')
  assert.equal(result.note, null)
})

test('403 + 字符串业务码 "14000" 也判为需要密码', () => {
  const result = classifyNoteResponse(403, { code: '14000', message: 'x' })
  assert.equal(result.locked, true)
})

test('403 + 业务码在 data 里也判为需要密码', () => {
  const result = classifyNoteResponse(403, { data: { code: NOTE_FORBIDDEN_CODE } })
  assert.equal(result.locked, true)
})

test('403 + 其他业务码（如评论禁止 14005）不当作密码错误', () => {
  const result = classifyNoteResponse(403, { ok: 0, code: 14005, message: '禁止评论' })
  assert.equal(result.locked, false)
  assert.equal(result.reason, 'error')
})

test('403 + 无响应体（WAF / 代理返回 HTML）不当作密码错误', () => {
  assert.equal(classifyNoteResponse(403, null).locked, false)
  assert.equal(classifyNoteResponse(403, null).reason, 'error')
  assert.equal(classifyNoteResponse(403, '<html>forbidden</html>').locked, false)
  assert.equal(classifyNoteResponse(403, {}).locked, false)
  assert.equal(classifyNoteResponse(403, { code: 'oops' }).locked, false)
})

test('404 → 不存在，不展示密码页', () => {
  const result = classifyNoteResponse(404, { ok: 0, code: 14004, message: 'not found' })
  assert.equal(result.locked, false)
  assert.equal(result.reason, 'not-found')
  assert.equal(result.note, null)
})

test('5xx / 其他状态码 → error，不展示密码页', () => {
  for (const status of [400, 401, 429, 500, 502, 503]) {
    const result = classifyNoteResponse(status, { ok: 0, code: 14000 })
    assert.equal(result.locked, false, `status ${status}`)
    assert.equal(result.reason, 'error', `status ${status}`)
  }
})

test('200 但响应体异常时不抛异常', () => {
  for (const body of [null, 'text', [], { data: null }]) {
    assert.doesNotThrow(() => classifyNoteResponse(200, body))
  }
})

/* ---------- 页面动作：四种状态必须互斥且可区分 ---------- */

test('页面动作：正常响应 → render', () => {
  const access = classifyNoteResponse(200, { data: { id: 'n1', nid: 1, content: 'x' } })
  assert.equal(resolveNotePageAction(access), 'render')
})

test('页面动作：403 + 14000 → password（不跳 404）', () => {
  const access = classifyNoteResponse(403, forbiddenBody)
  assert.equal(resolveNotePageAction(access), 'password')
})

test('页面动作：404 → not-found', () => {
  const access = classifyNoteResponse(404, { ok: 0, code: 14004 })
  assert.equal(resolveNotePageAction(access), 'not-found')
})

test('页面动作：5xx / 429 / 网络错误 / 非 14000 的 403 → error，不得降级成 404', () => {
  const cases = [
    classifyNoteResponse(500, null),
    classifyNoteResponse(502, { ok: 0, code: 0 }),
    classifyNoteResponse(503, null),
    classifyNoteResponse(429, { message: 'too many' }),
    classifyNoteResponse(403, null), // WAF / 反向代理的 403 HTML
    classifyNoteResponse(403, { ok: 0, code: 14005 }),
  ]
  for (const access of cases) {
    assert.equal(resolveNotePageAction(access), 'error')
  }
})

test('页面动作：reason=ok 但 note 缺失时按故障处理，不渲染空白页', () => {
  assert.equal(resolveNotePageAction({ note: null, locked: false, reason: 'ok' }), 'error')
})

test('页面动作：password 时 note 为 null 也不会被当成 render', () => {
  assert.equal(resolveNotePageAction({ note: null, locked: true, reason: 'password' }), 'password')
})
