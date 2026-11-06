import assert from 'node:assert/strict'
import test from 'node:test'

import {
  adaptComment,
  adaptNote,
  adaptPostDetail,
  adaptSay,
} from '../lib/api/adapter.ts'

test('adaptSay 读 core 的 text 字段（v12.x），并保留 source/author', () => {
  const say = adaptSay({
    id: 's1',
    text: '今天也要开心',
    source: 'web',
    author: 'miaoer',
    createdAt: '2026-01-01T00:00:00.000Z',
  })

  assert.equal(say.content, '今天也要开心')
  assert.equal(say.source, 'web')
  assert.equal(say.author, 'miaoer')
})

test('adaptSay 兼容旧字段 content（历史数据/旧版 core）', () => {
  assert.equal(adaptSay({ id: 's2', content: 'legacy' }).content, 'legacy')
})

test('adaptSay 字段全缺时得到空串而不是 undefined', () => {
  const say = adaptSay({ id: 's3' })
  assert.equal(say.content, '')
  assert.equal(say.created, '')
})

test('adaptNote：lexical 正文降级用 text', () => {
  const note = adaptNote({
    id: 'n1',
    nid: 1,
    contentFormat: 'lexical',
    content: '{"root":{}}',
    text: '纯文本降级',
  })
  assert.equal(note.contentFormat, 'lexical')
  assert.equal(note.content, '纯文本降级')
})

test('adaptNote：markdown 正文优选用 content', () => {
  const note = adaptNote({ id: 'n2', nid: 2, content: '# md', text: 'ignored' })
  assert.equal(note.content, '# md')
})

test('adaptNote：透传 liked/hasPassword（详情页初始状态依赖它）', () => {
  const note = adaptNote({ id: 'n3', nid: 3, liked: true, hasPassword: true })
  assert.equal(note.liked, true)
  assert.equal(note.hasPassword, true)
})

test('adaptPostDetail：透传 liked 与 related 的 category', () => {
  const post = adaptPostDetail({
    id: 'p1',
    title: 't',
    slug: 's',
    text: 'body',
    liked: true,
    related: [{ id: 'p2', title: 'r', slug: 'r', category: { slug: 'cat', name: 'Cat' } }],
  })

  assert.equal(post.liked, true)
  assert.equal(post.related?.[0].categorySlug, 'cat')
})

test('adaptPostDetail：liked 缺失时是 undefined（不是 false），避免误判已点赞', () => {
  assert.equal(adaptPostDetail({ id: 'p3', slug: 's' }).liked, undefined)
})

test('adaptComment：parent 取自 parentCommentId，replies 保持扁平', () => {
  const comment = adaptComment({
    id: 'c1',
    author: 'a',
    text: 'hi',
    rootCommentId: 'root',
    parentCommentId: 'c0',
    replies: [{ id: 'c2', author: 'b', text: 'yo', parentCommentId: 'c1' }],
  })

  assert.equal(comment.content, 'hi')
  assert.equal(comment.root, 'root')
  assert.equal(comment.parent, 'c0')
  assert.equal(comment.children?.length, 1)
  assert.equal(comment.children?.[0].parent, 'c1')
})

test('adaptComment：replyWindow 映射成 window（长线程分页依赖它）', () => {
  const comment = adaptComment({
    id: 'c1',
    replyWindow: {
      total: 30,
      returned: 12,
      threshold: 10,
      hasHidden: true,
      hiddenCount: 18,
      nextCursor: 'c9',
    },
  })

  assert.deepEqual(comment.window, {
    total: 30,
    returned: 12,
    threshold: 10,
    hasHidden: true,
    hiddenCount: 18,
    nextCursor: 'c9',
  })
})

test('adaptComment：没有 replyWindow 时 window 为 undefined', () => {
  assert.equal(adaptComment({ id: 'c9' }).window, undefined)
})
