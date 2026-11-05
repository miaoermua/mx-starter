'use client'

import { useState } from 'react'

/**
 * 友链自助申请表单（M1/A17）
 *
 * mx 原生 POST /links/audit，取代线上「在评论区留言」申请友链的方式。
 * core v12.x 的 LinkDto 必填 author / name / url，
 * 其中 author 是提交人昵称（后台审核时展示），漏传会 400；
 * url 与 avatar 都强制 HTTPS，name ≤ 20、description ≤ 50。
 */
export function ApplyForm() {
  const [data, setData] = useState({
    author: '',
    name: '',
    url: '',
    avatar: '',
    description: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!data.author.trim() || !data.name.trim() || !data.url.trim()) {
      setMsg('请填写昵称、站点名称和网址')
      return
    }
    if (!/^https:\/\//i.test(data.url.trim())) {
      setMsg('站点地址必须以 https:// 开头')
      return
    }
    if (data.avatar.trim() && !/^https:\/\//i.test(data.avatar.trim())) {
      setMsg('头像地址必须以 https:// 开头')
      return
    }
    setSubmitting(true)
    setMsg('')
    try {
      const res = await fetch('/api/friends/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          author: data.author.trim(),
          name: data.name.trim(),
          url: data.url.trim(),
          avatar: data.avatar.trim(),
          description: data.description.trim(),
        }),
      })
      const result = await res.json().catch(() => ({}))
      if (res.ok) {
        setMsg(result.message || '申请成功，等待审核！')
        setData({ author: '', name: '', url: '', avatar: '', description: '' })
      } else {
        setMsg(result.message || result.error || '申请失败')
      }
    } catch {
      setMsg('网络错误，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ marginTop: '2em' }}>
      <h1>申请友链</h1>
      <form onSubmit={onSubmit}>
        <div className="row">
          <fieldset className="col-m-6">
            <input
              type="text"
              placeholder="你的昵称 *："
              maxLength={20}
              value={data.author}
              onChange={(e) => setData({ ...data, author: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="站点名称 *："
              maxLength={20}
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              required
            />
            <input
              type="url"
              placeholder="站点地址 *（https）："
              value={data.url}
              onChange={(e) => setData({ ...data, url: e.target.value })}
              required
            />
          </fieldset>
          <fieldset className="col-m-6">
            <input
              type="url"
              placeholder="头像地址："
              value={data.avatar}
              onChange={(e) => setData({ ...data, avatar: e.target.value })}
            />
            <textarea
              rows={2}
              maxLength={50}
              placeholder="站点简介（50 字以内）："
              value={data.description}
              onChange={(e) => setData({ ...data, description: e.target.value })}
            />
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? '提交中...' : '申请友链'}
            </button>
          </fieldset>
        </div>
        {msg && <p style={{ textAlign: 'center', color: 'var(--blue, #3498db)' }}>{msg}</p>}
      </form>
    </div>
  )
}
