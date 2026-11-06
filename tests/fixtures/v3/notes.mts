/**
 * Core v3（/api/v3）日记响应夹具
 *
 * 与 v12 的差异只有外壳：
 * - 成功：`{ data: Note, meta: { interaction: { isLiked } } }`
 * - 密码缺失/错误：403 + `{ error: { code: 'NOTE_FORBIDDEN', message } }`
 * - 不存在：404 + `{ error: { code: 'NOTE_NOT_FOUND' } }`
 */

export const v3NoteEnvelope = {
  data: {
    id: 'note_1',
    nid: 1,
    title: 'v3 日记',
    text: '今天下雨',
    content: '今天下雨',
    contentFormat: 'markdown',
    mood: 'happy',
    weather: 'rain',
    createdAt: '2026-03-01T08:00:00.000Z',
    modifiedAt: null,
    isPublished: true,
  },
  meta: { interaction: { isLiked: false } },
}

export const v3NoteLocked = {
  error: {
    code: 'NOTE_FORBIDDEN',
    message: '不要偷看人家的小心思啦~',
  },
}

export const v3NoteNotFound = {
  error: {
    code: 'NOTE_NOT_FOUND',
    message: '日记不存在',
  },
}
