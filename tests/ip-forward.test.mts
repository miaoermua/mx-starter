import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ipForwardHeaders,
  normalizeIp,
  resolveClientIp,
  trustedProxyHops,
} from '../lib/api/proxy.ts'

function headersOf(map: Record<string, string | undefined>) {
  return {
    get(name: string) {
      const value = map[name.toLowerCase()]
      return value === undefined ? null : value
    },
  }
}

test('normalizeIp 接受常见 IP 形态', () => {
  assert.equal(normalizeIp('1.2.3.4'), '1.2.3.4')
  assert.equal(normalizeIp('  1.2.3.4  '), '1.2.3.4')
  assert.equal(normalizeIp('"1.2.3.4"'), '1.2.3.4')
  assert.equal(normalizeIp('1.2.3.4:8080'), '1.2.3.4')
  assert.equal(normalizeIp('2001:db8::1'), '2001:db8::1')
  assert.equal(normalizeIp('[2001:db8::1]'), '2001:db8::1')
  assert.equal(normalizeIp('[2001:db8::1]:443'), '2001:db8::1')
  assert.equal(normalizeIp('::ffff:127.0.0.1'), '::ffff:127.0.0.1')
})

test('normalizeIp 丢弃非法值，不把垃圾透传给 core', () => {
  assert.equal(normalizeIp(''), null)
  assert.equal(normalizeIp('   '), null)
  assert.equal(normalizeIp('unknown'), null)
  assert.equal(normalizeIp('999.1.1.1'), null)
  assert.equal(normalizeIp('1.2.3'), null)
  assert.equal(normalizeIp('1.2.3.4.5'), null)
  assert.equal(normalizeIp('<script>'), null)
  assert.equal(normalizeIp(undefined), null)
  assert.equal(normalizeIp(null), null)
})

test('resolveClientIp 取链条右侧的可信跳（左侧可被客户端伪造）', () => {
  const source = headersOf({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3' })

  // 默认 1 层可信代理：最右边那个由最近的代理写入
  assert.equal(resolveClientIp(source, 1), '3.3.3.3')
  // 两层（CDN → nginx）
  assert.equal(resolveClientIp(source, 2), '2.2.2.2')
  // 三层
  assert.equal(resolveClientIp(source, 3), '1.1.1.1')
})

test('链长不足以跳过全部可信代理时 fail closed，不退到最左侧', () => {
  // 旧实现在 hops > 链长时返回 chain[0]，那正好是客户端可控的伪造区。
  // 真实代理在 hops > 实际层数时要么覆写了 XFF（链短），要么配置错了，
  // 两种情况都无法确定哪一格可信 —— 只能不转发。
  const source = headersOf({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' })
  assert.equal(resolveClientIp(source, 3), null)
  assert.equal(resolveClientIp(source, 99), null)
})

test('resolveClientIp 忽略链条里的非法项，不受伪造噪声影响', () => {
  const source = headersOf({
    'x-forwarded-for': 'evil, 2.2.2.2.2.2, 3.3.3.3',
  })
  assert.equal(resolveClientIp(source, 1), '3.3.3.3')
})

test('hops=0 时不信任任何代理头（直连部署 fail closed）', () => {
  const source = headersOf({
    'x-forwarded-for': '1.1.1.1',
    'x-real-ip': '2.2.2.2',
  })
  assert.equal(resolveClientIp(source, 0), null)
  assert.equal(resolveClientIp(source, -1), null)
  assert.equal(resolveClientIp(source, 1.5), null)
})

test('没有 x-forwarded-for 且 hops=1 时退回 x-real-ip', () => {
  assert.equal(resolveClientIp(headersOf({ 'x-real-ip': '4.4.4.4' }), 1), '4.4.4.4')
  assert.equal(resolveClientIp(headersOf({ 'x-real-ip': 'nope' }), 1), null)
  assert.equal(resolveClientIp(headersOf({}), 1), null)
})

test('hops>=2 且没有 x-forwarded-for 时不退回 x-real-ip（那只会是中间层地址）', () => {
  assert.equal(resolveClientIp(headersOf({ 'x-real-ip': '4.4.4.4' }), 2), null)
  assert.equal(resolveClientIp(headersOf({ 'x-real-ip': '4.4.4.4' }), 3), null)
})

test('x-forwarded-for 全是非法值时，hops=1 退回 x-real-ip、hops>=2 fail closed', () => {
  const source = headersOf({
    'x-forwarded-for': 'unknown',
    'x-real-ip': '5.5.5.5',
  })
  assert.equal(resolveClientIp(source, 1), '5.5.5.5')
  assert.equal(resolveClientIp(source, 2), null)
})

test('ipForwardHeaders 只写两个头、只写一个 IP，不转发凭据类头', () => {
  const source = headersOf({
    'x-forwarded-for': '1.1.1.1, 6.6.6.6',
    'cf-connecting-ip': '7.7.7.7',
    'true-client-ip': '8.8.8.8',
    'x-real-ip': '9.9.9.9',
    cookie: 'mx_token=secret',
    authorization: 'Bearer secret',
  })
  const forwarded = ipForwardHeaders(source, 1)

  assert.deepEqual(forwarded, {
    'x-forwarded-for': '6.6.6.6',
    'x-real-ip': '6.6.6.6',
  })
  // core 会优先读这两个头，转发客户端可控的值等于把身份交给访客
  assert.equal('cf-connecting-ip' in forwarded, false)
  assert.equal('true-client-ip' in forwarded, false)
  assert.equal('cookie' in forwarded, false)
  assert.equal('authorization' in forwarded, false)
})

test('ipForwardHeaders 在拿不到可信 IP 时返回空对象', () => {
  assert.deepEqual(ipForwardHeaders(headersOf({}), 1), {})
  assert.deepEqual(ipForwardHeaders(headersOf({ 'x-forwarded-for': '1.1.1.1' }), 0), {})
})

test('trustedProxyHops 解析环境变量并对非法值回落到默认值', () => {
  const original = process.env.MX_TRUSTED_PROXY_HOPS
  try {
    delete process.env.MX_TRUSTED_PROXY_HOPS
    assert.equal(trustedProxyHops(), 1)

    process.env.MX_TRUSTED_PROXY_HOPS = '2'
    assert.equal(trustedProxyHops(), 2)

    process.env.MX_TRUSTED_PROXY_HOPS = ' 0 '
    assert.equal(trustedProxyHops(), 0)

    for (const bad of ['abc', '-1', '1.5', 'NaN', '']) {
      process.env.MX_TRUSTED_PROXY_HOPS = bad
      assert.equal(trustedProxyHops(), 1, `bad value: ${bad}`)
    }
  } finally {
    if (original === undefined) delete process.env.MX_TRUSTED_PROXY_HOPS
    else process.env.MX_TRUSTED_PROXY_HOPS = original
  }
})

test('环境变量决定默认跳数', () => {
  const original = process.env.MX_TRUSTED_PROXY_HOPS
  try {
    process.env.MX_TRUSTED_PROXY_HOPS = '2'
    const source = headersOf({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' })
    assert.equal(resolveClientIp(source), '1.1.1.1')
  } finally {
    if (original === undefined) delete process.env.MX_TRUSTED_PROXY_HOPS
    else process.env.MX_TRUSTED_PROXY_HOPS = original
  }
})
