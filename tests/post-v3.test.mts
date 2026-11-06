import assert from 'node:assert/strict'
import test from 'node:test'

import {
  adaptPost,
  adaptPostDetail,
  resolveBodyFormat,
} from '../lib/api/adapter.ts'
import { readMeta, unwrapEnvelope } from '../lib/api/envelope.ts'
import { v12PostDetail, v12PostSummary } from './fixtures/v12/posts.mts'
import {
  v3PostDetailEnvelope,
  v3PostLexicalEnvelope,
  v3PostSummary,
  v3PostZeroCounts,
} from './fixtures/v3/posts.mts'

/* ---------- 计数 ---------- */

test('v3：readCount / likeCount 顶层数字直接映射', () => {
  const p = adaptPost(v3PostSummary)
  assert.equal(p.count?.read, 12)
  assert.equal(p.count?.like, 3)
})

test('v3：计数为 0 时保留 0，不能退化成 undefined', () => {
  const p = adaptPost(v3PostZeroCounts)
  assert.equal(p.count?.read, 0)
  assert.equal(p.count?.like, 0)
  assert.equal(typeof p.count?.read, 'number')
})

test('v12：count.read / count.like 兜底映射', () => {
  const p = adaptPost(v12PostSummary)
  assert.equal(p.count?.read, 7)
  assert.equal(p.count?.like, 1)
})

/* ---------- 时间与发布态 ---------- */

test('v3：createdAt / modifiedAt 正常映射', () => {
  const p = adaptPost(v3PostSummary)
  assert.equal(p.created, '2026-01-02T03:04:05.000Z')
  assert.equal(p.modified, '2026-01-03T00:00:00.000Z')
})

test('v12：created / modified 兼容映射', () => {
  const p = adaptPost(v12PostSummary)
  assert.equal(p.created, '2026-01-02T03:04:05.000Z')
  assert.equal(p.modified, '2026-01-03T00:00:00.000Z')
})

test('发布态统一映射为 isPublished（v3 无 hide 字段）', () => {
  assert.equal(adaptPost(v3PostSummary).isPublished, true)
  assert.equal(adaptPost({ ...v3PostSummary, isPublished: false }).isPublished, false)
  assert.equal(adaptPost(v12PostSummary).isPublished, true)
})

/* ---------- 详情 meta ---------- */

test('v3：liked 取自 meta.interaction.isLiked', () => {
  const raw = v3PostDetailEnvelope
  const detail = adaptPostDetail(
    unwrapEnvelope<Record<string, unknown>>(raw, 3),
    readMeta(raw),
  )
  assert.equal(detail.liked, true)
})

test('v3：related 取自 meta.related，并归一化成文章摘要', () => {
  const raw = v3PostDetailEnvelope
  const detail = adaptPostDetail(
    unwrapEnvelope<Record<string, unknown>>(raw, 3),
    readMeta(raw),
  )
  assert.equal(detail.related?.length, 2)
  assert.equal(detail.related?.[0].id, 'post_2')
  assert.equal(detail.related?.[0].title, '相关一')
})

test('v12：liked / related 仍在 body 顶层，不被 meta 逻辑影响', () => {
  const detail = adaptPostDetail(v12PostDetail)
  assert.equal(detail.liked, true)
  assert.equal(detail.related?.length, 1)
})

test('v3：没有 meta 时不伪造 liked / related', () => {
  const detail = adaptPostDetail(v3PostSummary)
  assert.equal(detail.liked, undefined)
  assert.equal(detail.related, undefined)
})

/* ---------- 正文格式 ---------- */

test('正文格式：缺省与 markdown 都走现有 marked 管线', () => {
  assert.equal(resolveBodyFormat(undefined), 'markdown')
  assert.equal(resolveBodyFormat(null), 'markdown')
  assert.equal(resolveBodyFormat(''), 'markdown')
  assert.equal(resolveBodyFormat('markdown'), 'markdown')
  assert.equal(resolveBodyFormat('Markdown'), 'markdown')
})

test('正文格式：lexical 必须被明确识别，不能当 Markdown', () => {
  assert.equal(resolveBodyFormat('lexical'), 'lexical')
  assert.equal(resolveBodyFormat('Lexical'), 'lexical')
})

test('正文格式：未知值归为 unknown，不做猜测', () => {
  assert.equal(resolveBodyFormat('mdx'), 'unknown')
  assert.equal(resolveBodyFormat('html'), 'unknown')
})

test('v3 Lexical 文章：text 保留纯文本 fallback，contentFormat 透传给页面', () => {
  const raw = v3PostLexicalEnvelope
  const detail = adaptPostDetail(
    unwrapEnvelope<Record<string, unknown>>(raw, 3),
    readMeta(raw),
  )
  assert.equal(detail.contentFormat, 'lexical')
  assert.equal(resolveBodyFormat(detail.contentFormat), 'lexical')
  // text 不能是 [object Object]，即不能把 content JSON 强转成字符串
  assert.equal(detail.text, 'Lexical 正文纯文本')
})

test('v3 Lexical 文章：content 是对象也不会污染 text', () => {
  const detail = adaptPostDetail({
    id: 'x',
    text: 'plain',
    content: { root: {} },
    contentFormat: 'lexical',
  })
  assert.equal(detail.text, 'plain')
})
