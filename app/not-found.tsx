/**
 * 404 页
 *
 * 裸 DOM 结构：main > .wrap > .error-page > h1 + p
 */
export default function NotFound() {
  return (
    <main>
      <div className="wrap">
        <div className="error-page">
          <h1>404</h1>
          <p>你访问的页面不存在</p>
        </div>
      </div>
    </main>
  )
}
