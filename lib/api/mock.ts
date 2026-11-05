/**
 * Mock 数据（S1 骨架阶段用假数据跑通视觉，FRONTEND_PLAN.md 14.3）
 *
 * 无 MX_CORE_URL 时启用，保证布局/样式可独立验证。
 */

import type { AggregateData } from './index'
import type { Category, Comment, FriendLink, PageDetail, PostDetail, PostSummary } from './adapter'

export const mockAggregate: AggregateData = {
  user: {
    name: 'Dreamer Paul',
    avatar: 'https://avatars.githubusercontent.com/u/26398357?v=4',
    description: '一个仰望星空的理想主义者',
    url: 'https://example.com',
  },
  seo: {
    title: 'mx-starter 测试站',
    description: 'mx-starter · Mix Space 前端脚手架演示站',
    keywords: 'mx-starter, mx-space, next.js',
  },
  url: { siteUrl: 'https://example.com' },
  theme: {},
  categories: [
    { id: '1', name: '随笔与杂谈', slug: 'essay', count: 12 },
    { id: '2', name: '技术笔记', slug: 'tech', count: 8 },
    { id: '3', name: '日常记录', slug: 'daily', count: 5 },
  ],
  pages: [
    { title: '关于我', slug: 'about' },
    { title: '朋友们', slug: 'friends' },
  ],
}

export const mockPosts: PostSummary[] = [
  {
    id: '1',
    title: 'Hello mx-starter',
    slug: 'hello-mx-starter',
    category: '随笔与杂谈',
    categorySlug: 'essay',
    tags: ['主题', 'Typecho'],
    summary: '这是一篇演示文章，用来展示列表页的文章卡片与元信息。',
    created: '2026-10-13T10:00:00.000Z',
    count: { read: 1024, like: 32, comments: 8 },
  },
  {
    id: '2',
    title: '用 Next.js 重写博客前端',
    slug: 'rewrite-with-nextjs',
    category: '技术笔记',
    categorySlug: 'tech',
    tags: ['Next.js', 'React'],
    summary: '从 Typecho PHP 模板迁移到 Next.js App Router 的实践记录，样式逐字节复用。',
    created: '2026-10-20T08:30:00.000Z',
    count: { read: 512, like: 18, comments: 3 },
  },
  {
    id: '3',
    title: '夜间模式的防闪屏实现',
    slug: 'dark-mode-no-flash',
    category: '技术笔记',
    categorySlug: 'tech',
    tags: ['CSS', 'SSR'],
    summary: 'SSR 阶段读 cookie 输出 dark-theme class，避免刷新时的白色闪屏。',
    created: '2026-10-28T14:00:00.000Z',
    count: { read: 256, like: 9, comments: 1 },
  },
]

export const mockPostDetail: PostDetail = {
  ...mockPosts[0],
  text: `## 这是一篇示例文章

这是脚手架自带的 **markdown 渲染演示**：标题、代码块、引用、列表、外链一应俱全。

\`\`\`javascript
console.log('Hello, mx-space!')
\`\`\`

> 这是一段引用文字，会显示蓝色边框。

- 列表项一
- 列表项二
- 列表项三

[脚手架仓库](https://github.com/miaoermua/mx-starter)`,
  allowComment: true,
}

export function mockPage(slug: string): PageDetail | null {
  if (slug === 'about') {
    return {
      id: 'p1',
      title: '关于我',
      slug: 'about',
      text: `## 关于

这里是关于页面，复用 \`page.php\` 版式。

这篇文章上次修改于很多天前，可能其部分内容已经发生变化。`,
      created: '2026-01-01T00:00:00.000Z',
      allowComment: true,
    }
  }
  return null
}

export const mockCategories: Category[] = mockAggregate.categories || []

export const mockComments: Comment[] = [
  {
    id: 'c1',
    author: '访客甲',
    avatar: '',
    content: '写得很棒！正在用这个主题。',
    created: '2026-10-14T09:00:00.000Z',
    children: [
      {
        id: 'c2',
        author: '博主',
        avatar: 'https://avatars.githubusercontent.com/u/26398357?v=4',
        content: '感谢支持~',
        created: '2026-10-14T10:00:00.000Z',
      },
    ],
  },
  {
    id: 'c3',
    author: '路人乙',
    content: '收藏了，回头试试 mx 版本。',
    created: '2026-10-15T12:00:00.000Z',
  },
]

export const mockFriends: FriendLink[] = [
  { id: 'f1', name: '示例友链', url: 'https://example.com', avatar: '', description: '一个示例友链', type: 0, state: 0 },
  { id: 'f2', name: 'Example Blog', url: 'https://example.com', avatar: '', description: '一个示例博客', type: 1, state: 0 },
]

import type { Note, Recently, Say } from './adapter'

export const mockNote: Note = {
  id: 'n1',
  nid: 1,
  title: '今天写了不少代码',
  content: '脚手架跑起来了，数据层 mock 工作正常。\n\n感觉还不错。',
  created: '2026-11-05T12:00:00.000Z',
  mood: '开心',
  weather: '晴',
}

export const mockSays: Say[] = [
  { id: 's1', content: '前端骨架终于跑通了！', created: '2026-11-05T11:00:00.000Z' },
  { id: 's2', content: 'Next.js App Router 真香。', created: '2026-11-04T18:00:00.000Z' },
  { id: 's3', content: '样式逐字节复用，零框架。', created: '2026-11-03T09:00:00.000Z' },
]

export const mockRecently: Recently[] = [
  { id: 'r1', content: '更新了文章《用 Next.js 重写博客前端》', created: '2026-10-20T08:30:00.000Z' },
  { id: 'r2', content: '用 mx-starter 起了一个新主题', created: '2026-11-05T10:00:00.000Z' },
]
