import assert from 'node:assert/strict'
import test from 'node:test'

import {
  adaptComment,
  buildReplyTree,
  nestCommentReplies,
  type Comment,
} from '../lib/api/adapter.ts'
import { mergeThreadPage } from '../lib/api/comment-thread.ts'
import { unwrapEnvelope, unwrapList } from '../lib/api/envelope.ts'
import {
  v12CommentListResponse,
  v12ThreadResponse,
} from './fixtures/v12/comments.mts'
import {
  v3CommentListEnvelope,
  v3CommentWithParentPreview,
  v3CyclicComments,
  v3RootComment,
  v3ThreadEnvelope,
} from './fixtures/v3/comments.mts'

/* ---------- v3 字段映射 ---------- */

test('v3：嵌套 replies 递归映射为 children，保留 parentCommentId / rootCommentId', () => {
  const root = adaptComment(v3RootComment)
  assert.equal(root.parent, undefined)
  assert.equal(root.root, undefined)
  assert.equal(root.replyCount, 2)

  const child = root.children?.[0]
  assert.equal(child?.parent, 'c_root')
  assert.equal(child?.root, 'c_root')
  assert.equal(child?.children?.[0].parent, 'c_child')
  // 内部模型统一用 content（core 的 text 已归一化）
  assert.equal(child?.children?.[0].content, '二层回复')
})

test('v3：parent 是预览对象时不能当父 id 用，单独放进 parentPreview', () => {
  const c = adaptComment(v3CommentWithParentPreview)
  assert.equal(c.parent, undefined)
  assert.equal(c.root, 'c_root')
  assert.equal(c.parentPreview?.id, 'c_hidden_parent')
  assert.equal(c.parentPreview?.text, '被截断的父评论')
})

test('v12：parent 缺省时同样是 undefined，不会误取预览', () => {
  const c = adaptComment({ id: 'x', text: 't' })
  assert.equal(c.parent, undefined)
  assert.equal(c.parentPreview, undefined)
})

test('评论正文只接受字符串 content，避免 [object Object]', () => {
  assert.equal(adaptComment({ id: 'x', text: 'ok', content: { a: 1 } }).content, 'ok')
  assert.equal(adaptComment({ id: 'x', content: 'rich' }).content, 'rich')
  assert.equal(adaptComment({ id: 'x', text: '' }).content, '')
})

/* ---------- 列表 → 树 ---------- */

test('v3：/comments/ref 列表经 unwrapList + nestCommentReplies 还原成树', () => {
  const items = unwrapList<Record<string, unknown>>(v3CommentListEnvelope, 3).map(
    adaptComment,
  )
  const tree = nestCommentReplies(items)
  assert.equal(tree.length, 1)
  assert.equal(tree[0].id, 'c_root')
  assert.equal(tree[0].children?.[0].id, 'c_child')
  assert.equal(tree[0].children?.[0].children?.[0].id, 'c_grand')
})

test('v12：同一条路径仍然工作', () => {
  const items = unwrapList<Record<string, unknown>>(v12CommentListResponse, 12).map(
    adaptComment,
  )
  const tree = nestCommentReplies(items)
  assert.equal(tree[0].children?.[0].id, 'c_child')
})

test('扁平列表按 parentCommentId 建树，不丢任何回复', () => {
  const flat: Comment[] = [
    { id: 'a', author: 'A', content: '', created: '' },
    { id: 'b', author: 'B', content: '', created: '', parent: 'a' },
    { id: 'c', author: 'C', content: '', created: '', parent: 'b' },
    { id: 'd', author: 'D', content: '', created: '', parent: 'missing' },
  ]
  const tree = buildReplyTree(flat, 'a')
  const ids = new Set<string>()
  const walk = (list: Comment[]) => list.forEach((c) => { ids.add(c.id); walk(c.children ?? []) })
  walk(tree)
  assert.deepEqual([...ids].sort(), ['a', 'b', 'c', 'd'])
})

test('环状脏数据不会无限递归（a ↔ b）', () => {
  const flat = v3CyclicComments.map(adaptComment)
  const tree = buildReplyTree(flat, 'a')
  let count = 0
  const walk = (list: Comment[], depth: number) => {
    assert.ok(depth < 10, '树的深度不应爆炸')
    for (const c of list) {
      count++
      walk(c.children ?? [], depth + 1)
    }
  }
  walk(tree, 0)
  assert.equal(count, 2)
})

/* ---------- 长线程分页 ---------- */

test('v3：线程补拉响应被拆信封后与 v12 结构一致', () => {
  const raw = unwrapEnvelope<Record<string, unknown>>(v3ThreadEnvelope, 3)
  assert.equal(raw.remaining, 4)
  assert.equal(raw.done, false)
  assert.equal(raw.nextCursor, 'cursor_2')
  assert.equal(Array.isArray(raw.replies), true)

  const v12 = unwrapEnvelope<Record<string, unknown>>(v12ThreadResponse, 12)
  assert.equal(v12.done, true)
  assert.equal(v12.nextCursor, null)
})

test('mergeThreadPage：v3 补拉结果按 parent 挂到已有子树上，且不重复', () => {
  const root = adaptComment(v3RootComment)
  const existing = root.children ?? []

  const raw = unwrapEnvelope<Record<string, unknown>>(v3ThreadEnvelope, 3)
  const pageItems = (raw.replies as Record<string, unknown>[]).map(adaptComment)

  const merged = mergeThreadPage({
    children: existing,
    rootId: 'c_root',
    page: {
      items: pageItems,
      nextCursor: raw.nextCursor as string,
      remaining: raw.remaining as number,
      done: Boolean(raw.done),
    },
    window: { total: 3, returned: 1, threshold: 2, hasHidden: true, hiddenCount: 2 },
  })

  // c_page2 的父级是 c_child，会被挂到第二层，不是线程根的直接子级
  const findById = (list: Comment[], id: string): Comment | undefined => {
    for (const c of list) {
      if (c.id === id) return c
      const hit = findById(c.children ?? [], id)
      if (hit) return hit
    }
    return undefined
  }
  const second = findById(merged.children, 'c_page2')
  assert.ok(second, '补拉的回复不能丢')
  assert.equal(second?.parent, 'c_child')
  // window.hiddenCount 记录「还有多少条隐藏回复」，来自线程接口的 remaining
  assert.equal(merged.window?.hiddenCount, 4)

  // 再合并同一页：id 去重，不重复插入
  const again = mergeThreadPage({
    children: merged.children,
    rootId: 'c_root',
    page: {
      items: pageItems,
      nextCursor: null,
      remaining: 0,
      done: true,
    },
    window: merged.window,
  })
  const hits = []
  const walk = (list: Comment[]) => list.forEach((c) => { if (c.id === 'c_page2') hits.push(c); walk(c.children ?? []) })
  walk(again.children)
  assert.equal(hits.length, 1)
})
