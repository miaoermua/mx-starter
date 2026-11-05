import { fetchFriends } from '@/lib/api'
import type { FriendLink } from '@/lib/api'
import { ApplyForm } from '@/components/friends/ApplyForm'

/**
 * 友链页（线上完整版 → FriendsPage）
 *
 * DOM 契约：section.page-title + article.page-content.is-special；
 * 分组 h1；.row > .col-6.col-m-4 > a.link-friend > img + h4 + p
 *
 * 分级渲染（core v12.x）：
 * - type=0 state=0 → 我的朋友（按 created 升序）
 * - type=1 state=0 → 我的收藏（按 created 升序）
 * - state=2 → 以下站点无法访问，已失联（纯文字+删除线，不可点击）
 * - state=3 → 以下站点不合规，已被禁止（纯文字+删除线，不可点击）
 */

interface GroupDef {
  filter: (f: FriendLink) => boolean
  title: string
  /** 失联/禁止：显示为纯文字+删除线，不渲染链接 */
  textOnly?: boolean
}

const GROUPS: GroupDef[] = [
  { filter: (f) => f.type === 0 && f.state === 0, title: '我的朋友' },
  { filter: (f) => f.type === 1 && f.state === 0, title: '我的收藏' },
  { filter: (f) => f.state === 2, title: '以下站点无法访问，已失联', textOnly: true },
  { filter: (f) => f.state === 3, title: '以下站点不合规，已被禁止', textOnly: true },
]

function sortByCreated(a: FriendLink, b: FriendLink): number {
  const ta = new Date(a.created || 0).getTime()
  const tb = new Date(b.created || 0).getTime()
  return ta - tb
}

export default async function FriendsPage() {
  const friends = await fetchFriends()

  return (
    <main>
      <div className="wrap min">
        <section className="page-title">
          <h2>朋友们</h2>
          <span>海内存知己，天涯若比邻</span>
        </section>
        <article className="page-content is-special">
          {GROUPS.map(({ filter, title, textOnly }) => {
            const list = friends.filter(filter).sort(sortByCreated)
            if (list.length === 0) return null
            return (
              <div key={title}>
                <h1>{title}</h1>
                <div className="row">
                  {list.map((f) => (
                    <div className="col-6 col-m-4" key={f.id}>
                      {textOnly ? (
                        // 失联/禁止：纯文字 + 删除线，不可点击
                        <div className="link-friend is-offline">
                          {f.avatar && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={f.avatar} alt={f.name} />
                          )}
                          <h4>
                            <s>{f.name}</s>
                          </h4>
                          <p>{f.description}</p>
                        </div>
                      ) : (
                        <a
                          className="link-friend"
                          href={f.url}
                          target="_blank"
                          rel="nofollow"
                        >
                          {f.avatar && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={f.avatar} alt={f.name} />
                          )}
                          <h4>{f.name}</h4>
                          <p>{f.description}</p>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {/* 自助申请表单（M1/A17） */}
          <ApplyForm />
        </article>
      </div>
    </main>
  )
}
