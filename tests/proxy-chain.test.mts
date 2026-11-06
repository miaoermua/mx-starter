import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveClientIp } from '../lib/api/proxy.ts'

/**
 * 代理链场景测试。
 *
 * 这里不直接构造「看起来合理」的 XFF 字符串，而是**模拟真实代理行为**：
 * 客户端先带一个（可伪造的）XFF 到达第一层代理，每层代理按自己配置的语义
 * （追加 `$proxy_add_x_forwarded_for` 或覆写 `$remote_addr`）处理后转发，
 * 最后一层把请求交给 Next。
 *
 * 拓扑记号：C = 客户端，CDN / ingress = 中间层，N = 层数（= MX_TRUSTED_PROXY_HOPS）。
 */

const C = '1.1.1.1'
const CDN = '2.2.2.2'
const INGRESS = '3.3.3.3'
const FORGED = '9.9.9.9'

/** 追加语义：$proxy_add_x_forwarded_for = 原有 XFF + 本次连接的对端地址 */
function append(existing: string | null, peer: string): string {
  return existing ? `${existing}, ${peer}` : peer
}

/** 覆写语义：proxy_set_header X-Forwarded-For $remote_addr */
function overwrite(peer: string): string {
  return peer
}

function headersOf(map: Record<string, string | undefined>) {
  return {
    get(name: string) {
      const value = map[name.toLowerCase()]
      return value === undefined ? null : value
    },
  }
}

/** 应用侧看到的请求：XFF 为 null 表示代理没有设置该头 */
function fromNode(xff: string | null, realIp: string | null = null) {
  return headersOf({
    'x-forwarded-for': xff ?? undefined,
    'x-real-ip': realIp ?? undefined,
  })
}

/* ---------- 场景 1：nginx 单层，覆写 XFF ---------- */

test('场景1 nginx 单层 + 覆写：客户端自带 XFF 被丢弃', () => {
  const wire = overwrite(C)
  assert.equal(resolveClientIp(fromNode(wire), 1), C)
})

test('场景1 nginx 单层 + 覆写：hops 配成 2 时无法自证，fail closed', () => {
  // 覆写后链长恒为 1，永远支撑不了 hops=2。
  // 此时「取最左」会把唯一那格当结果，等于承认配置可信——不做这种猜测。
  const wire = overwrite(C)
  assert.equal(resolveClientIp(fromNode(wire), 2), null)
})

/* ---------- 场景 2：nginx 单层，追加 XFF ---------- */

test('场景2 nginx 单层 + 追加：无伪造时取到客户端', () => {
  const wire = append(null, C)
  assert.equal(resolveClientIp(fromNode(wire), 1), C)
})

test('场景2 nginx 单层 + 追加：客户端伪造前缀被跳过', () => {
  const wire = append(FORGED, C) // 9.9.9.9, 1.1.1.1
  assert.equal(resolveClientIp(fromNode(wire), 1), C)
})

/* ---------- 场景 3：CDN + nginx 双层，均追加 ---------- */

test('场景3 CDN + nginx + 追加：hops=2 取到客户端', () => {
  const wire = append(append(null, C), CDN) // 1.1.1.1, 2.2.2.2
  assert.equal(resolveClientIp(fromNode(wire), 2), C)
})

test('场景3 CDN + nginx + 追加：hops 少配 1 会退化成 CDN 地址', () => {
  // 不是安全漏洞（仍是可信方追加的地址），但所有访客会共用 CDN 的 IP
  const wire = append(append(null, C), CDN)
  assert.equal(resolveClientIp(fromNode(wire), 1), CDN)
})

test('场景3 CDN + nginx + 追加：伪造前缀不影响 hops=2', () => {
  const wire = append(append(append(null, FORGED), C), CDN)
  assert.equal(resolveClientIp(fromNode(wire), 2), C)
})

test('场景3 三层（CDN + nginx + ingress）：hops=3 取到客户端', () => {
  const wire = append(append(append(null, C), CDN), INGRESS)
  assert.equal(resolveClientIp(fromNode(wire), 3), C)
})

/* ---------- 场景 4：客户端伪造 XFF 前缀 ---------- */

test('场景4 单层追加：伪造多项前缀仍只取最右侧可信项', () => {
  const wire = append('8.8.8.8, 7.7.7.7, 6.6.6.6', C)
  assert.equal(resolveClientIp(fromNode(wire), 1), C)
})

test('场景4 单层追加：伪造项混入非法值不影响定位', () => {
  const wire = append('8.8.8.8, unknown, 6.6.6.6', C)
  assert.equal(resolveClientIp(fromNode(wire), 1), C)
})

test('场景4 客户端直接伪造 cf-connecting-ip / true-client-ip 无用', () => {
  // 这两个头不参与取值；core 会优先读它们，所以我们绝不转发（见 ip-forward 测试）
  const wire = append('8.8.8.8', C)
  const source = headersOf({
    'x-forwarded-for': wire,
    'cf-connecting-ip': FORGED,
    'true-client-ip': FORGED,
  })
  assert.equal(resolveClientIp(source, 1), C)
})

/* ---------- 场景 5：缺失 / 空值 / 非法 / 多级 ---------- */

test('场景5 XFF 缺失：hops=1 退回 x-real-ip（最近一层代理写入）', () => {
  assert.equal(resolveClientIp(fromNode(null, C), 1), C)
})

test('场景5 XFF 缺失：hops>=2 时 x-real-ip 只可能是中间层地址，fail closed', () => {
  // 双层部署里最近一层代理看到的对端是 CDN，不是访客；拿不到 XFF 就无法回溯，
  // 与其把「所有访客 = CDN」写进 core，不如不转发（core 退回 socket 地址）。
  assert.equal(resolveClientIp(fromNode(null, CDN), 2), null)
  assert.equal(resolveClientIp(fromNode(null, CDN), 3), null)
})

test('场景5 XFF 为空字符串：视为缺失，不产生空链', () => {
  assert.equal(resolveClientIp(fromNode('', C), 1), C)
  assert.equal(resolveClientIp(fromNode('   ', C), 1), C)
})

test('场景5 XFF 全为非法值：hops=1 退到 x-real-ip', () => {
  assert.equal(resolveClientIp(fromNode('unknown, nope', C), 1), C)
})

test('场景5 XFF 全为非法值：hops>=2 fail closed', () => {
  assert.equal(resolveClientIp(fromNode('unknown, nope', CDN), 2), null)
})

test('场景5 多级地址：hops 精确决定取哪一格', () => {
  const wire = `${C}, ${CDN}, ${INGRESS}`
  assert.equal(resolveClientIp(fromNode(wire), 1), INGRESS)
  assert.equal(resolveClientIp(fromNode(wire), 2), CDN)
  assert.equal(resolveClientIp(fromNode(wire), 3), C)
  assert.equal(resolveClientIp(fromNode(wire), 4), null)
})

/* ---------- 场景 6：hops=0 与超出实际链路 ---------- */

test('场景6 hops=0：完全不信任代理头', () => {
  const wire = append(append(null, C), CDN)
  assert.equal(resolveClientIp(fromNode(wire, C), 0), null)
})

test('场景6 hops 超出链路：不取最左，直接 fail closed', () => {
  const wire = append(append(null, C), CDN) // 2 层
  assert.equal(resolveClientIp(fromNode(wire), 3), null)
  assert.equal(resolveClientIp(fromNode(wire), 99), null)
})

test('场景6 hops 超出链路且客户端已填充伪造项：仍然 fail closed', () => {
  // 伪造填充把链长撑大，但 hops=4 > 真实层数 2，链长 3 依然不够
  const wire = append(append(append(null, FORGED), C), CDN)
  assert.equal(resolveClientIp(fromNode(wire), 4), null)
})

test('已知边界：hops 恰好比真实层数大 1 时会落到客户端伪造区（配置责任）', () => {
  // 双层部署被配成 hops=3，客户端补两个伪造项即可把链长撑到 4：
  // 9.9.9.9, 8.8.8.8, C, CDN → chain[len-3] = 8.8.8.8
  // XFF 本身无法自证真实层数（Next 拿不到 socket peer），只能靠部署方配对。
  const wire = append(append(append(null, `${FORGED}, 8.8.8.8`), C), CDN)
  assert.equal(resolveClientIp(fromNode(wire), 3), '8.8.8.8')
})
