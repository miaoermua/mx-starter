/**
 * Core v3（/api/v3）评论响应夹具
 *
 * 依据 packages/api-client/models/comment.ts：
 * - parentCommentId / rootCommentId 显式给出父子关系
 * - parent 是父评论**预览对象**（父节点被分页截断时用于展示上下文）
 * - replyCount 是真实回复数
 * - /comments/ref/:id → withMeta([thread...], meta.pagination)
 * - /comments/thread/:rootId → { replies, remaining, done, nextCursor } 包在 { data } 里
 */

export const v3RootComment = {
  id: 'c_root',
  refType: 'post',
  refId: 'post_1',
  author: '访客甲',
  text: '根评论',
  createdAt: '2026-02-01T10:00:00.000Z',
  parentCommentId: null,
  rootCommentId: null,
  replyCount: 2,
  replies: [
    {
      id: 'c_child',
      author: '访客乙',
      text: '一层回复',
      createdAt: '2026-02-01T10:01:00.000Z',
      parentCommentId: 'c_root',
      rootCommentId: 'c_root',
      replyCount: 1,
      replies: [
        {
          id: 'c_grand',
          author: '访客丙',
          text: '二层回复',
          createdAt: '2026-02-01T10:02:00.000Z',
          parentCommentId: 'c_child',
          rootCommentId: 'c_root',
          replyCount: 0,
        },
      ],
    },
  ],
}

export const v3CommentListEnvelope = {
  data: [v3RootComment],
  meta: { pagination: { page: 1, size: 10, total: 1, totalPages: 1 } },
}

/** 父节点被截断时，core 附带 parent 预览对象而不是父 id */
export const v3CommentWithParentPreview = {
  id: 'c_orphan',
  author: '访客丁',
  text: '看不到父级的回复',
  createdAt: '2026-02-01T11:00:00.000Z',
  parentCommentId: null,
  rootCommentId: 'c_root',
  replyCount: 0,
  parent: {
    id: 'c_hidden_parent',
    author: '访客某',
    text: '被截断的父评论',
    isDeleted: false,
  },
}

/** 长线程补拉结果：v3 把它包进 { data } */
export const v3ThreadEnvelope = {
  data: {
    replies: [
      {
        id: 'c_page2',
        author: '访客戊',
        text: '第二页回复',
        createdAt: '2026-02-01T12:00:00.000Z',
        parentCommentId: 'c_child',
        rootCommentId: 'c_root',
        replyCount: 0,
      },
    ],
    remaining: 4,
    done: false,
    nextCursor: 'cursor_2',
  },
}

/** 环状脏数据：a → b → a */
export const v3CyclicComments = [
  {
    id: 'a',
    author: 'A',
    text: 'a',
    createdAt: '2026-02-01T00:00:00.000Z',
    parentCommentId: 'b',
    rootCommentId: 'a',
    replyCount: 1,
  },
  {
    id: 'b',
    author: 'B',
    text: 'b',
    createdAt: '2026-02-01T00:01:00.000Z',
    parentCommentId: 'a',
    rootCommentId: 'a',
    replyCount: 1,
  },
]
