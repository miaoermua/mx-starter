# AGENTS.md

面向在此仓库工作的 AI 编码助手与人类贡献者的约束与指引。

## 定位

Mix Space **通用主题脚手架**：core v12.x（API v2，SDK 4.4.0）+ Next.js 14 App Router。
目标是覆盖 mx 全部访客侧特性的通用模板——仓库不附带任何主题 CSS，价值在数据层与页面骨架。
许可证 GPL-3.0。

## 架构红线

1. **数据只能经 `lib/api/index.ts` 的 24 个方法获取**。页面/组件禁止直接 fetch core。
2. **core 响应形状的差异（信封、分页、字段命名）只允许改 `lib/api/adapter.ts`**，且必须收敛在这一个文件里。业务代码看到的永远是 adapter 归一化后的 camelCase 模型。
3. `MX_CORE_URL` 为空时必须能完整跑（mock 兜底，`lib/api/mock.ts`）。新增数据方法必须同时补 mock 分支。
4. 页面默认是 Server Component（`async function` + `await` 取数）。客户端组件仅限交互必需（评论表单、点赞、灯箱、运行时效果），放 `components/` 对应目录。
5. 不引入 CSS 框架、不内联大段样式。组件输出带语义化 className 的裸 DOM，样式归主题作者。
6. 不保留任何特定主题的专属实现（壁纸 API、夜间自动切换、复制提示、主题私有配置项等）。通用能力才进脚手架；`lib/theme-config.ts` 只放最小通用字段（background / custom_css / custom_script），扩展字段由主题自己加。
7. 通用的 DOM 钩子保持稳定：`.head-menu`、`.search-btn`、`.toggle-btn`、`.light-btn`、`.to-top`、`.comment-item`、`.comment-child`。ThemeRuntime 依赖它们，改名必须同步。

## 环境变量

见 `.env.example`：`MX_CORE_URL`（空 = mock）、`MX_API_PREFIX`（固定 /api/v2）、`MX_SSR_UA`（必须含 mx-space，否则被 SpiderGuard 拦）、`MX_THEME_NAME`（对应后台 Snippet name）。

## 命令

- `npm run dev` 开发（mock 模式零依赖）
- `npm run typecheck` 提交前必须全绿
- `npm run lint` / `npm run build`

## 版本与分支

- `main`：API v2（core v12.x），唯一受支持的主线。
- v3 适配：从 main 切 `next` 分支开发，成熟前不要合回；v3 定案后翻转默认分支，v2 留维护分支。
- core 若发布 v13+，不要在 main 上兼容两代，走 next 分支。

## 可选扩展

`app/api/link-preview/`、`lib/link-cards.ts`、`lib/link-preview.ts`、`components/content/LinkCard.tsx` 是一组（kami 移植的链接卡片），互相依赖，增删必须整组进行。文件头有标注。

## 协作约定

- 不要执行 `git commit` / `git push`，改动只落工作区，由用户自行提交。
- 不要把 `docs/` 级别的长篇设计文档搬进仓库；设计讨论放 issue 或用户自己的笔记。
- 新增依赖需要明确理由（脚手架刻意保持 6 个运行时依赖的瘦身材）。
