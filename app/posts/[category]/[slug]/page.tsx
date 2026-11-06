import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchPostDetail, fetchAdjacentPosts, fetchComments } from '@/lib/api'
import { getAggregate } from '@/lib/api/server'
import { resolveBodyFormat } from '@/lib/api/adapter'
import { renderMarkdownSegments } from '@/lib/markdown'
import { resolveLinkCards } from '@/lib/link-cards'
import { ArticleTree } from '@/components/content/ArticleTree'
import { LinkCard } from '@/components/content/LinkCard'
import { LikeButton } from '@/components/post/LikeButton'
import { ReadAck } from '@/components/post/ReadAck'
import { CommentSection } from '@/components/comment/CommentSection'

/**
 * 文章详情（post.php → PostPage）
 *
 * DOM 契约：
 * section.post-title > h2 + .post-meta；
 * article.post-content（Markdown 渲染结果）；
 * section.post-near > ul>li*2；
 * section.post-tags；
 * section.post-author > figure.author-avatar + .author-info；
 * section#comments.post-comments（S4 评论组件）
 */
export default async function PostPage({
  params,
}: {
  params: { category: string; slug: string }
}) {
  const post = await fetchPostDetail(params.category, params.slug)
  if (!post) notFound()

  // 正文格式：markdown 走现有 marked 管线；lexical 本轮不引入渲染器，显式提示而不是硬渲染
  const bodyFormat = resolveBodyFormat(post.contentFormat)
  const isMarkdown = bodyFormat === 'markdown'
  // 链接卡片（脚手架自带：kami 扩展移植）：脚注解析 + SSR 并发预取，失败降级为朴素链接卡
  const rendered = isMarkdown ? renderMarkdownSegments(post.text) : null
  const segments = rendered?.segments ?? []
  const cards = rendered?.cards ?? []
  const cardData = cards.length > 0 ? await resolveLinkCards(cards) : new Map<string, null>()
  const modified = post.modified ? new Date(post.modified) : null
  const showStaleWarning =
    modified && Date.now() - modified.getTime() >= 15552000000

  const { prev, next } = await fetchAdjacentPosts(
    post.id,
    post.created,
    post.categorySlug,
  )

  const [comments, aggregate] = await Promise.all([
    fetchComments(post.id, 1, 10),
    getAggregate(),
  ])
  // total 可能在 core 侧缺失（补 0），用实际取到的条数兜底，避免显示出 0 条
  const commentTotal = Math.max(comments.pagination?.total ?? 0, comments.items.length)

  return (
    <main>
      <div className="wrap min">
        <section className="post-title">
          <h2>{post.title}</h2>
          <div className="post-meta">
            <time className="date">
              {new Date(post.created).toLocaleDateString('zh-CN')}
            </time>
            {post.category && (
              <span className="category">{post.category}</span>
            )}
            {/* 阅读量 */}
            {typeof post.count?.read === 'number' && (
              <span className="view">{post.count.read}</span>
            )}
            <span className="comments">{commentTotal}</span>
          </div>
        </section>

        <article className="post-content">
          {showStaleWarning && (
            <blockquote>
              这篇文章上次修改于{' '}
              {modified && Math.ceil((Date.now() - modified.getTime()) / 86400000)}{' '}
              天前，可能其部分内容已经发生变化，如有疑问可询问作者。
            </blockquote>
          )}
        {/* Lexical 正文：本轮不引入渲染器，给出明确提示，不把编辑器 JSON 当 Markdown 渲染 */}
        {bodyFormat !== 'markdown' && (
          <blockquote>
            {bodyFormat === 'lexical'
              ? '本文使用 Lexical 编辑器撰写，当前主题暂不支持渲染该格式，请前往原文查看。'
              : '无法识别的正文格式，请前往原文查看。'}
          </blockquote>
        )}
        {/* 正文：分段渲染。无卡片脚注时等价原单段 HTML；卡片为 kami 扩展能力（脚手架自带：kami 扩展移植） */}
        {segments.map((seg, i) => {
          if (seg.type === 'html') {
            return <div key={i} dangerouslySetInnerHTML={{ __html: seg.html }} />
          }
          const card = cards.find((c) => c.ref === seg.ref)
          if (!card) return null
          return (
            <LinkCard
              key={`card-${seg.ref}`}
              id={card.id}
              source={card.source}
              url={card.url}
              data={cardData.get(seg.ref) ?? null}
            />
          )
        })}
      </article>

        {/* 目录树：只有 Markdown 正文才有可提取的标题层级 */}
        {isMarkdown && <ArticleTree markdownText={post.text} />}

        {/* 上下篇（A8） */}
        <section className="post-near">
          <ul>
            <li>
              上一篇:{' '}
              {prev ? (
                <Link
                  href={`/posts/${prev.categorySlug || 'uncategorized'}/${prev.slug}`}
                >
                  {prev.title}
                </Link>
              ) : (
                '看完啦 (つд⊂)'
              )}
            </li>
            <li>
              下一篇:{' '}
              {next ? (
                <Link
                  href={`/posts/${next.categorySlug || 'uncategorized'}/${next.slug}`}
                >
                  {next.title}
                </Link>
              ) : (
                '看完啦 (つд⊂)'
              )}
            </li>
          </ul>
        </section>

        {post.tags && post.tags.length > 0 && (
          <section className="post-tags">
            {post.tags.map((t) => (
              <Link key={t} href={`/tag/${t}`}>
                {t}
              </Link>
            ))}
          </section>
        )}

        {/* 相关文章：core 详情接口直接返回 related */}
        {post.related && post.related.length > 0 && (
          <section className="post-related">
            <ul>
              {post.related.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/posts/${item.categorySlug || 'uncategorized'}/${item.slug}`}
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 阅读数上报（M8）：首屏触发一次 */}
        <ReadAck postId={post.id} type="post" />

        {/* 点赞按钮（M8） */}
        <LikeButton
          postId={post.id}
          initialLikes={post.count?.like ?? 0}
          initialLiked={post.liked}
        />

        {/* 评论区（S4）：SSR 预取第 1 页注水给客户端组件 */}
        <CommentSection
          postId={post.id}
          allowComment={!aggregate.commentOptions?.disableComment}
          initialItems={comments.items}
          initialTotal={commentTotal}
          initialPage={comments.pagination?.page ?? 1}
          initialTotalPages={comments.pagination?.totalPages ?? 1}
        />
      </div>
    </main>
  )
}

/** 文章页 SEO/OG（A10） */
export async function generateMetadata({
  params,
}: {
  params: { category: string; slug: string }
}): Promise<Metadata> {
  const post = await fetchPostDetail(params.category, params.slug)
  if (!post) return {}

  const ogImage = post.cover || post.images?.[0]
  return {
    title: post.title,
    description: post.summary || '',
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.summary || '',
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
      publishedTime: post.created,
      modifiedTime: post.modified,
    },
  }
}
