import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

/**
 * eslint-config-next 16 起直接导出扁平配置数组（`Linter.Config[]`），
 * 不再需要 `FlatCompat` 把 eslintrc 风格的对象翻译成扁平配置。
 */
const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'public/**', 'coverage/**'],
  },
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      // 图片主机名由站点主人决定（自建对象存储 / CDN），无法写死 remotePatterns，
      // 因此本仓库统一用原生 <img> 配合 loading="lazy"
      '@next/next/no-img-element': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // 数据层要承接 core 原始响应的可选/未知字段，adapter 层用 any 比堆 unknown 断言更可读
      '@typescript-eslint/no-explicit-any': 'warn',
      // 挂载后从 localStorage 恢复访客上次填写的评论信息，属于「与浏览器本地状态同步」，
      // 这条规则会把它和渲染期副作用一起报出来，降为提示
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    // purity 规则假设 render 会被重复调用，因此把 Date.now() 判为不纯。
    // app/ 下除 error.tsx 外全是 Server Component，每次请求只求值一次，
    // 「这篇文章多少天前改过」这类计算读取当前时间是正常写法。
    files: ['app/**/*.tsx'],
    ignores: ['app/notes/[nid]/error.tsx'],
    rules: {
      'react-hooks/purity': 'off',
    },
  },
]

export default config
