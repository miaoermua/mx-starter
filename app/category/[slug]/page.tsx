import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchCategoryDetail } from '@/lib/api'

/**
 * 分类页（archive.php 列表版式 → CategoryPage）
 *
 * 数据来自 core GET /categories/:slug（返回该分类下全部文章），
 * 与首页共用 section.home-title + section.home-posts 的 DOM 契约。
 */
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const detail = await fetchCategoryDetail(decodeURIComponent(params.slug))
  return { title: detail ? `${detail.category.name} · 分类` : '分类' }
}

export default async function CategoryPage({
  params,
}: {
  params: { slug: string }
}) {
  const detail = await fetchCategoryDetail(decodeURIComponent(params.slug))
  if (!detail) notFound()

  const { category, posts } = detail

  return (
    <main>
      <div className="wrap min">
        <section className="home-title">
          <h1>
            分类：{category.name}
            <small className="post-count">{posts.length}</small>
          </h1>
        </section>
        {posts.length > 0 ? (
          <section className="home-posts">
            {posts.map((post) => (
              <div className="post-item" key={post.id}>
                <h2>
                  <Link
                    href={`/posts/${post.categorySlug || category.slug}/${post.slug}`}
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
