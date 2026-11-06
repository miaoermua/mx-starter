/**
 * Core v12（/api/v2）日记响应夹具
 *
 * 成功：单个对象（也可能被包一层 { data }）
 * 密码缺失/错误：403 + `{ ok: 0, code: 14000, message }`
 */

export const v12Note = {
  id: 'note_1',
  nid: 1,
  title: 'v12 日记',
  content: '今天晴',
  mood: 'happy',
  weather: 'sun',
  created: '2026-03-01T08:00:00.000Z',
  modified: null,
  isPublished: true,
}

export const v12NoteWrapped = { data: v12Note }

export const v12NoteLocked = {
  ok: 0,
  code: 14000,
  message: '不要偷看人家的小心思啦~',
}
