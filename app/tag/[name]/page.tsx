import Link from 'next/link'
import { fetchPosts } from '@/lib/api'

/**
 * 标签页（archive.php 列表版式 → TagPage）
 */
export default async function TagPage({
  params,
}: {
  params: { name: string }
}) {
  const { items } = await fetchPosts(1, 50)

  return (
    <main>
      <div className="wrap min">
        <section className="home-title">
          <h1>标签：{decodeURIComponent(params.name)}</h1>
        </section>
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
      </div>
    </main>
  )
}
