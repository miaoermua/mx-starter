/**
 * Core v12（/api/v2）评论响应夹具
 *
 * v12 的 replies 是扁平列表，父子关系靠 parentCommentId；
 * rootCommentId 也是显式字段，但没有 parent 预览对象。
 */

export const v12CommentListResponse = {
  data: [
    {
      id: 'c_root',
      author: '访客甲',
      text: '根评论',
      createdAt: '2026-02-01T10:00:00.000Z',
      parentCommentId: null,
      rootCommentId: null,
      replies: [
        {
          id: 'c_child',
          author: '访客乙',
          text: '回复',
          createdAt: '2026-02-01T10:01:00.000Z',
          parentCommentId: 'c_root',
          rootCommentId: 'c_root',
        },
      ],
    },
  ],
  pagination: {
    currentPage: 1,
    size: 10,
    total: 1,
    totalPage: 1,
    hasNextPage: false,
    hasPrevPage: false,
  },
}

export const v12ThreadResponse = {
  replies: [
    {
      id: 'c_page2',
      author: '访客戊',
      text: '第二页',
      createdAt: '2026-02-01T12:00:00.000Z',
      parentCommentId: 'c_child',
      rootCommentId: 'c_root',
    },
  ],
  remaining: 0,
  done: true,
  nextCursor: null,
}
