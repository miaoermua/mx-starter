'use client'

import { useState, useEffect } from 'react'

/**
 * 评论表单（comments.php form → CommentForm）
 *
 * DOM 契约：
 * .row > fieldset.col-m-6（author/mail/url inputs）+ fieldset.col-m-6（textarea + submit）
 *
 * 校验（C3/C8）：
 * - author ≤ 20、text ≤ 500、mail 必填且合法邮箱、url 可选但需带协议
 * - remember() 用 localStorage（C5）
 * - 提交成功后提示「你的评论正等待审核」（C6）
 *
 * 回复（C7）：replyTo 非空时走 POST /api/comment/reply { id: replyTo, ...payload }
 *          并显示取消回复链接
 */

interface FormData {
  author: string
  mail: string
  url: string
  text: string
}

const STORAGE_KEY = 'mx_comment_remember'

export function CommentForm({
  postId,
  replyTo,
  onCancelReply,
  onSubmitted,
}: {
  postId: string
  replyTo: string | null
  onCancelReply: () => void
  /** 提交成功后通知父级刷新列表 */
  onSubmitted?: () => void
}) {
  const [data, setData] = useState<FormData>({ author: '', mail: '', url: '', text: '' })
  const [errors, setErrors] = useState<Partial<FormData>>({})
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  // remember 回填（C5）
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        setData((d) => ({ ...d, author: parsed.author || '', mail: parsed.mail || '', url: parsed.url || '' }))
      }
    } catch {}
  }, [])

  const validate = (): boolean => {
    const e: Partial<FormData> = {}
    if (!data.author.trim()) e.author = '请填写昵称'
    else if (data.author.length > 20) e.author = '昵称不超过 20 字'
    if (!data.mail.trim()) e.mail = '请填写邮箱'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.mail)) e.mail = '邮箱格式不正确'
    if (data.url && !/^https?:\/\//.test(data.url)) e.url = '网址需带协议'
    if (!data.text.trim()) e.text = '请填写评论内容'
    else if (data.text.length > 500) e.text = '评论不超过 500 字'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setSuccessMsg('')
    try {
      // 保存 remember（C5）
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ author: data.author, mail: data.mail, url: data.url }),
      )
      // 回复走 /api/comment/reply，普通评论走 /api/comment（C7）
      const endpoint = replyTo ? '/api/comment/reply' : '/api/comment'
      // url 为空时不传，避免后端 422（core 要求 url 非空则必须合法）
      const payload = replyTo
        ? { author: data.author, mail: data.mail, text: data.text, url: data.url || undefined, id: replyTo, ref: postId }
        : { author: data.author, mail: data.mail, text: data.text, url: data.url || undefined, id: postId }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const result = await res.json().catch(() => ({}))
        setSuccessMsg(result.needAudit ? '你的评论正等待审核' : '评论成功！')
        setData((d) => ({ ...d, text: '' }))
        if (replyTo) onCancelReply()
        onSubmitted?.()
      } else {
        setSuccessMsg('评论失败，请稍后重试')
      }
    } catch {
      setSuccessMsg('网络错误，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form method="post" onSubmit={onSubmit}>
      {replyTo && (
        <span className="cancel-comment-reply">
          正在回复评论 #{replyTo}{' '}
          <a
            href="javascript:void(0)"
            onClick={(e) => {
              e.preventDefault()
              onCancelReply()
            }}
          >
            点击取消
          </a>
        </span>
      )}
      <div className="row">
        <fieldset className="col-m-6">
          <input
            type="text"
            name="author"
            placeholder="昵称 *："
            value={data.author}
            onChange={(e) => setData({ ...data, author: e.target.value })}
            required
          />
          {errors.author && <small style={{ color: 'red' }}>{errors.author}</small>}
          <input
            type="email"
            name="mail"
            placeholder="电邮 *："
            value={data.mail}
            onChange={(e) => setData({ ...data, mail: e.target.value })}
            required
          />
          {errors.mail && <small style={{ color: 'red' }}>{errors.mail}</small>}
          <input
            type="url"
            name="url"
            placeholder="http://"
            value={data.url}
            onChange={(e) => setData({ ...data, url: e.target.value })}
          />
          {errors.url && <small style={{ color: 'red' }}>{errors.url}</small>}
        </fieldset>
        <fieldset className="col-m-6">
          <textarea
            rows={3}
            name="text"
            id="textarea"
            placeholder="快来评论吧 (*≧ω≦)ﾉ"
            value={data.text}
            onChange={(e) => setData({ ...data, text: e.target.value })}
            required
          />
          {errors.text && <small style={{ color: 'red' }}>{errors.text}</small>}
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? '提交中...' : '写好了~'}
          </button>
        </fieldset>
      </div>
      {successMsg && (
        <p style={{ textAlign: 'center', color: 'var(--blue, #3498db)' }}>{successMsg}</p>
      )}
    </form>
  )
}
