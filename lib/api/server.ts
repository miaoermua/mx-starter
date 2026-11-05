import { cache } from 'react'
import { fetchAggregate } from './index'

/**
 * 站点聚合信息的请求级去重包装。
 *
 * layout 与页面（文章/日记/独立页面）都要读 commentOptions，
 * 用 React 的 cache() 保证同一次 SSR 只向 core 发一次 /aggregate。
 * 只能在 Server Component / route handler 里使用。
 */
export const getAggregate = cache(fetchAggregate)
