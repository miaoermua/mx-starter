import Link from 'next/link'
import { fetchPostsByTag } from '@/lib/api'

/**
 * 标签页（archive.php 列表版式 → TagPage）
 *
 * 数据来自 core GET /categories/:tag?tag=true（返回该标签下文章）。
 * core 这里不过滤未发布，fetchPostsByTag 已剔除 isPublished === false 的项。
 */
export async function generateMetadata({ params }: { params: { name: string } }) {
  return { title: `标签：${decodeURIComponent(params.name)}` }
}

export default async function TagPage({
  params,
}: {
  params: { name: string }
}) {
  const name = decodeURIComponent(params.name)
  const posts = await fetchPostsByTag(name)

  return (
    <main>
      <div className="wrap min">
        <section className="home-title">
          <h1>
            标签：{name}
            <small className="post-count">{posts.length}</small>
          </h1>
        </section>
        {posts.length > 0 ? (
          <section className="home-posts">
            {posts.map((post) => (
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
