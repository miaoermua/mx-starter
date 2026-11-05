import Link from 'next/link'
import { fetchPosts } from '@/lib/api'

/**
 * 分类页（archive.php 列表版式 → CategoryPage）
 *
 * DOM 契约：section.home-title > h1 + section.home-posts 同首页；无结果输出「没有找到结果 (QWQ)」
 */
export default async function CategoryPage({
  params,
}: {
  params: { slug: string }
}) {
  const { items } = await fetchPosts(1, 50)

  return (
    <main>
      <div className="wrap min">
        <section className="home-title">
          <h1>分类</h1>
        </section>
        {items.length > 0 ? (
          <section className="home-posts">
            {items.map((post) => (
              <div className="post-item" key={post.id}>
                <h2>
                  <Link
                    href={`/posts/${post.categorySlug || 'uncategorized'}/${post.slug}`}
                  >
                    {post.title}
                  </Link>
                </h2>
                <p>{post.summary}</p>
              </div>
            ))}
          </section>
        ) : (
          <p>没有找到结果 (QWQ)</p>
        )}
      </div>
    </main>
  )
}
