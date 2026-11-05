# mx-starter

Mix Space **通用主题脚手架**（core **v12.x / API v2** · Next.js 14 App Router · 零样式依赖）

目标：覆盖 mx 全部访客侧特性（文章 / 页面 / 分类 / 标签 / 评论 / 友链 / 日记 / 说说 / 动态 / 时间轴 / 搜索 / 点赞阅读数 / RSS / 站点地图）的通用模板——做自己的主题时只换样式和组件，数据层与页面骨架零改动。

数据层已经从 core 挖好并封装完毕，共 24 个方法。

## 快速开始

```bash
npm install
cp .env.example .env   # 不配置 core 也能跑（自动 mock）
npm run dev
```

接入真实 core：把 `.env` 的 `MX_CORE_URL` 改成你的实例地址，重启即可，代码零改动。

## 主题配置（core Snippet）

core 后台 → 配置与云函数 → 新建：引用 `theme`、名字 = `.env` 里的 `MX_THEME_NAME`、数据类型 YAML、勾选公开。当前只有三个通用字段：`background`（背景图 URL）、`custom_css`、`custom_script`，定义见 `lib/theme-config.ts`，按你的主题自行扩展。

## 目录

```
app/          路由（22 个：页面 + 代理 core 的 API route）
components/   组件（裸 DOM className，无样式）
lib/api/      数据层：index 方法 / adapter 响应归一化 / config 连接配置 / mock 假数据
lib/markdown.ts  marked 渲染管线（代码高亮 / TOC / 外链处理）
app/api/link-preview + lib/link-cards + components/content/LinkCard
              可选扩展（移植自 kami），不需要可整组删除
public/vendor/prism.js  代码高亮运行时
```

## 做新主题

1. 自带你的样式系统（Tailwind / CSS Modules / 手写均可），给 `app/`、`components/` 里的裸 className 上样式；
2. 按你的主题改 `lib/theme-config.ts` 的配置字段；
3. 页面结构（路由、数据流）一般不用动。

## 分支

`main` = API v2（core v12.x）。core 升级 v3 后另开 `next` 分支适配，成熟后翻转默认分支，v2 保留为维护分支。

## License

GPL-3.0。

## 出处

数据层与页面骨架来自 mx-Single 的 Mix Space 适配实践，本仓库按 core API v2 重新实现，未保留任何主题专属实现。LinkCard 能力移植自 [kami](https://github.com/mx-space/kami)。
