import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildReplyTree,
  nestCommentReplies,
  type Comment,
} from '../lib/api/adapter.ts'
import { flattenThread, mergeThreadPage } from '../lib/api/comment-thread.ts'

function reply(id: string, parent?: string, root?: string): Comment {
  return {
    id,
    author: id,
    content: `content-${id}`,
    created: '2026-01-01T00:00:00.000Z',
    parent,
    root,
  }
}

function ids(list: Comment[]): string[] {
  return flattenThread(list)
    .map((item) => item.id)
    .sort()
}

test('buildReplyTree 还原多层嵌套（core 的 replies 是扁平列表）', () => {
  const flat = [reply('a', 'root'), reply('b', 'a'), reply('c', 'b'), reply('d', 'c')]
  const tree = buildReplyTree(flat, 'root')

  assert.equal(tree.length, 1)
  assert.equal(tree[0].id, 'a')
  assert.equal(tree[0].children?.[0].id, 'b')
  assert.equal(tree[0].children?.[0].children?.[0].id, 'c')
  assert.equal(tree[0].children?.[0].children?.[0].children?.[0].id, 'd')
  assert.deepEqual(ids(tree), ['a', 'b', 'c', 'd'])
})

test('buildReplyTree 支持多个根级子回复', () => {
  const tree = buildReplyTree([reply('a', 'root'), reply('b', 'root')], 'root')
  assert.deepEqual(
    tree.map((item) => item.id),
    ['a', 'b'],
  )
})

test('buildReplyTree：parentCommentId 缺失的回复落到顶层，不丢失', () => {
  const tree = buildReplyTree([reply('a'), reply('b', undefined, 'root')], 'root')
  assert.deepEqual(ids(tree), ['a', 'b'])
})

test('buildReplyTree：父级指向不在本页的评论时退化为顶层', () => {
  // replyWindow 截断时父评论可能不在列表中
  const tree = buildReplyTree([reply('a', 'missing-parent')], 'root')
  assert.equal(tree.length, 1)
  assert.equal(tree[0].id, 'a')
})

test('buildReplyTree：parent 指向线程根评论时算顶层', () => {
  const tree = buildReplyTree([reply('a', 'root')], 'root')
  assert.equal(tree.length, 1)
  assert.equal(tree[0].children?.length ?? 0, 0)
})

test('buildReplyTree：rootCommentId 不一致不影响落位（只认 parentCommentId）', () => {
  const flat = [
    { ...reply('a', 'root'), root: 'another-root' },
    { ...reply('b', 'a'), root: 'another-root' },
  ]
  const tree = buildReplyTree(flat, 'root')
  assert.equal(tree[0].id, 'a')
  assert.equal(tree[0].children?.[0].id, 'b')
})

test('buildReplyTree：自引用（parent === 自己）不会让评论消失，也不会自嵌套', () => {
  const self = reply('a', 'a')
  const tree = buildReplyTree([self], 'root')
  assert.deepEqual(ids(tree), ['a'])
  assert.equal(tree[0].children?.length ?? 0, 0)
})

test('buildReplyTree：环状引用（a↔b）两条都在，且不会无限递归', () => {
  const flat = [reply('a', 'b'), reply('b', 'a')]
  const tree = buildReplyTree(flat, 'root')
  assert.deepEqual(ids(tree), ['a', 'b'])
})

test('buildReplyTree：环 + 正常节点混合时不丢任何有效回复', () => {
  const flat = [
    reply('r1', 'root'),
    reply('r1-child', 'r1'),
    reply('x', 'y'),
    reply('y', 'x'),
    reply('orphan', 'gone'),
  ]
  const tree = buildReplyTree(flat, 'root')
  assert.deepEqual(ids(tree), ['orphan', 'r1', 'r1-child', 'x', 'y'])
})

test('buildReplyTree：输入不被修改', () => {
  const a = reply('a', 'root')
  const b = reply('b', 'a')
  const flat = [a, b]
  buildReplyTree(flat, 'root')
  assert.equal(a.children, undefined)
  assert.equal(b.children, undefined)
})

test('nestCommentReplies 把根评论自带的 replies 还原成树', () => {
  const root: Comment = {
    id: 'root',
    author: 'me',
    content: 'root',
    created: '2026-01-01T00:00:00.000Z',
    children: [reply('a', 'root'), reply('b', 'a')],
  }
  const [nested] = nestCommentReplies([root])
  assert.equal(nested.children?.length, 1)
  assert.equal(nested.children?.[0].id, 'a')
  assert.equal(nested.children?.[0].children?.[0].id, 'b')
})

test('mergeThreadPage：按游标追加，并把新回复挂到已有父节点下', () => {
  const children = [reply('a', 'root')]
  const result = mergeThreadPage({
    children,
    rootId: 'root',
    page: {
      items: [reply('b', 'a'), reply('c', 'b')],
      nextCursor: 'cursor-2',
      remaining: 3,
      done: false,
    },
    window: {
      total: 9,
      returned: 2,
      threshold: 5,
      hasHidden: true,
      hiddenCount: 6,
      nextCursor: 'cursor-1',
    },
  })

  assert.equal(result.children[0].id, 'a')
  assert.equal(result.children[0].children?.[0].id, 'b')
  assert.equal(result.children[0].children?.[0].children?.[0].id, 'c')
  assert.equal(result.window?.hasHidden, true)
  assert.equal(result.window?.hiddenCount, 3)
  assert.equal(result.window?.nextCursor, 'cursor-2')
  // 原有的 total/threshold 保留
  assert.equal(result.window?.total, 9)
  assert.equal(result.window?.threshold, 5)
})

test('mergeThreadPage：重复加载同一页不会产生重复节点', () => {
  const page = {
    items: [reply('b', 'a')],
    nextCursor: 'cursor-2',
    remaining: 1,
    done: false,
  }
  const first = mergeThreadPage({
    children: [reply('a', 'root')],
    rootId: 'root',
    page,
    window: {
      total: 3,
      returned: 1,
      threshold: 5,
      hasHidden: true,
      hiddenCount: 2,
      nextCursor: 'cursor-1',
    },
  })
  const second = mergeThreadPage({
    children: first.children,
    rootId: 'root',
    page,
    window: first.window,
  })

  assert.deepEqual(ids(second.children), ['a', 'b'])
  // 没有新节点就停掉「展开更多」，避免游标异常时无限拉取
  assert.equal(second.window?.hasHidden, false)
})

test('mergeThreadPage：空分页立即结束', () => {
  const result = mergeThreadPage({
    children: [reply('a', 'root')],
    rootId: 'root',
    page: { items: [], nextCursor: 'cursor-2', remaining: 4, done: false },
    window: {
      total: 9,
      returned: 2,
      threshold: 5,
      hasHidden: true,
      hiddenCount: 7,
      nextCursor: 'cursor-1',
    },
  })

  assert.deepEqual(ids(result.children), ['a'])
  assert.equal(result.window?.hasHidden, false)
  assert.equal(result.window?.hiddenCount, 0)
  assert.equal(result.window?.nextCursor, undefined)
})

test('mergeThreadPage：done 为 true 时清空游标与剩余数', () => {
  const result = mergeThreadPage({
    children: [],
    rootId: 'root',
    page: { items: [reply('a', 'root')], nextCursor: null, remaining: 0, done: true },
    window: {
      total: 5,
      returned: 1,
      threshold: 5,
      hasHidden: true,
      hiddenCount: 4,
      nextCursor: 'cursor-1',
    },
  })

  assert.equal(result.window?.hasHidden, false)
  assert.equal(result.window?.hiddenCount, 0)
  assert.equal(result.window?.nextCursor, undefined)
})

test('mergeThreadPage：没有窗口信息时不编造 window', () => {
  const result = mergeThreadPage({
    children: [],
    rootId: 'root',
    page: { items: [reply('a', 'root')], done: true },
  })
  assert.equal(result.window, undefined)
  assert.deepEqual(ids(result.children), ['a'])
})

test('mergeThreadPage：合并前后节点集合不丢有效回复', () => {
  const existing = [reply('a', 'root'), reply('b', 'a')]
  const incoming = [reply('c', 'b'), reply('d', 'root')]
  const result = mergeThreadPage({
    children: existing,
    rootId: 'root',
    page: { items: incoming, nextCursor: 'n', remaining: 0, done: false },
  })
  assert.deepEqual(ids(result.children), ['a', 'b', 'c', 'd'])
})
