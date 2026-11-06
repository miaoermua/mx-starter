/**
 * 测试专用的 ESM 解析钩子。
 *
 * 源码里用的是 Next 风格的「无扩展名」相对导入（`./config`、`./adapter`），
 * 浏览器/打包器能解析，但 Node 的 ESM 解析器要求显式扩展名。这里在解析失败时
 * 补一次 `.ts` / `/index.ts` 再试，从而让 `node --test` 直接跑 TS 源码，
 * 不额外引入 tsx / vitest 之类的开发依赖。
 */
import { registerHooks } from 'node:module'

const CANDIDATES = ['.ts', '/index.ts', '.mts']

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
      return nextResolve(specifier, context)
    }

    try {
      return nextResolve(specifier, context)
    } catch (error) {
      for (const suffix of CANDIDATES) {
        try {
          return nextResolve(`${specifier}${suffix}`, context)
        } catch {
          // 继续尝试下一个候选
        }
      }
      throw error
    }
  },
})
