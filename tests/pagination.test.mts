import assert from 'node:assert/strict'
import test from 'node:test'

import { parsePagination } from '../lib/api/adapter.ts'
import { readPagination } from '../lib/api/envelope.ts'
import { v12PostListResponse } from './fixtures/v12/posts.mts'
import { v3PostListEnvelope } from './fixtures/v3/posts.mts'

test('v3：分页在 meta.pagination，字段名 page/size/total/totalPages', () => {
  const p = readPagination(v3PostListEnvelope, 3)
  assert.deepEqual(p, {
    page: 2,
    size: 10,
    total: 23,
    totalPages: 3,
    hasPrev: true,
    hasNext: true,
  })
})

test('v12：分页在顶层 pagination，字段名 currentPage/totalPage/hasNextPage', () => {
  const p = readPagination(v12PostListResponse, 12)
  assert.deepEqual(p, {
    page: 1,
    size: 10,
    total: 11,
    totalPages: 2,
    hasPrev: false,
    hasNext: true,
  })
})

test('v3 缺少 hasNext/hasPrev 时按页码推导', () => {
  const first = readPagination(
    { data: [], meta: { pagination: { page: 1, size: 10, total: 5, totalPages: 1 } } },
    3,
  )
  assert.equal(first?.hasPrev, false)
  assert.equal(first?.hasNext, false)

  const last = readPagination(
    { data: [], meta: { pagination: { page: 3, size: 10, total: 30, totalPages: 3 } } },
    3,
  )
  assert.equal(last?.hasPrev, true)
  assert.equal(last?.hasNext, false)
})

test('空分页 / 缺 meta / 缺 pagination 都返回 undefined，不抛异常', () => {
  assert.equal(readPagination({ data: [] }, 3), undefined)
  assert.equal(readPagination({ data: [], meta: {} }, 3), undefined)
  assert.equal(readPagination({ data: [], meta: { pagination: null } }, 3), undefined)
  assert.equal(readPagination({ data: [] }, 12), undefined)
  assert.equal(readPagination(null, 3), undefined)
  assert.equal(readPagination([], 3), undefined)
})

test('分页字段不完整时按 0 补齐，page 缺失才返回 undefined', () => {
  const p = readPagination({ data: [], meta: { pagination: { page: 1 } } }, 3)
  assert.equal(p?.page, 1)
  assert.equal(p?.total, 0)
  assert.equal(p?.totalPages, 0)
  assert.equal(p?.hasNext, false)

  assert.equal(
    readPagination({ data: [], meta: { pagination: { size: 10 } } }, 3),
    undefined,
  )
})

test('parsePagination 直接吃裸分页对象时保留 0 值', () => {
  const p = parsePagination({ page: 1, size: 10, total: 0, totalPages: 0 })
  assert.equal(p?.total, 0)
  assert.equal(p?.totalPages, 0)
  assert.equal(p?.hasNext, false)
})
