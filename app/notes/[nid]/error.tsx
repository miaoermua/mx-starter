'use client'

/**
 * 日记详情的错误边界。
 *
 * 只有基础设施故障（core 5xx / 429 / 网络错误 / 非 14000 的 403）会走到这里，
 * 此时 Next 返回 HTTP 500，页面提供「重试」而不是伪装成 404。
 *
 * 裸 DOM 结构：main > .wrap > .error-page > h1 + p + button
 */
export default function NoteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main>
      <div className="wrap">
        <div className="error-page">
          <h1>500</h1>
          <p>日记服务暂时不可用，请稍后重试</p>
          <button type="button" className="btn" onClick={() => reset()}>
            重试
          </button>
        </div>
      </div>
    </main>
  )
}
