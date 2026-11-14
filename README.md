# 心屿 · Heart Isle

给情绪一个停靠的地方。

一个以情绪主题阅读为核心的静态网站，使用 Astro、TypeScript、原生 CSS 与 Markdown。代码采用 MIT 许可证。后续发布文章和图片时，请确认原创或转载授权，并按需要在文章中注明署名和授权范围。

## 环境与运行

需要 Node.js 22.23.4 或更高版本，建议 Node.js 24 LTS。

```powershell
cd D:\WorkSpace\HeartIsle
npm install
npm run dev
```

默认访问 http://localhost:4321/HeartIsle/。终端输出实际预览地址。

```sh
npm run check
npm run build
npm run preview
```

构建包含 Astro 和 TypeScript 检查，静态产物位于 dist/。依赖锁定在 package-lock.json，CI 使用 npm ci。首页只显示日期最新的一篇文章，全部 Markdown 均自动生成详情页。网站无客户端 JavaScript 依赖。

## 目录

```text
.github/workflows/deploy.yml   GitHub Pages 构建与部署
public/images/                首页插画及替换说明
src/
  components/Illustration.astro
  content/articles/           Markdown 文章
  content.config.ts           内容字段校验
  layouts/Layout.astro        公共页面结构
  lib/site.ts                 链接与日期
  pages/index.astro           首页
  pages/articles/[...id].astro 文章页面自动生成
  styles/global.css           响应式样式与阅读排版
astro.config.mjs              部署域名与子路径
```

## 提供第一篇文章

目前只有 first-article.md 占位文章。其标题、摘要和正文均明确标为待提供。date 是占位文件的创建日期，正式发表时更新。编辑该文件，填写真实内容并把 placeholder 改为 false。

新增文章时在 src/content/articles/ 放入 Markdown 文件，例如 understanding-emotions.md。

```markdown
---
title: "填写文章标题"
date: "2026-11-14"
summary: "填写文章摘要"
tags: ["情绪", "自我认识"]
placeholder: false
---

在这里填写正文，可使用 Markdown 标题、段落、引用、列表和图片。
```

文件名成为文章路径，例如 /HeartIsle/articles/understanding-emotions/。新增文件后无需改页面代码。日期最新的一篇显示在首页。正式首篇发布时请替换或删除占位文件。

Markdown 内的本地图片链接也需要部署子路径，例如 ![图片描述](/HeartIsle/images/example.webp)。使用相对文章路径或外部 HTTPS 图片同样可以。仓库改名时同步调整正文中手写的绝对路径。

## 替换首页插画

将图片保存为 public/images/flower-field.webp，也支持同名 png、jpg、jpeg。多种格式同时存在时依次优先 WebP、PNG、JPG、JPEG。重新构建即可显示，自动适配部署子路径。当前无图片附件，页面显示明确的插画占位。

## 首次部署 GitHub Pages

1. 在 GitHub 创建公开仓库 bluefateludi/HeartIsle。保持空仓库，便于首次推送。
2. 在本目录初始化 Git 并推送。若已经初始化，跳过 git init。若已配置 origin，使用 git remote set-url origin 更新地址。

```sh
git init -b main
git add .
git commit -m "feat: create Heart Isle reading MVP"
git remote add origin https://github.com/bluefateludi/HeartIsle.git
git push -u origin main
```

3. 打开仓库 Settings → Pages → Build and deployment，将 Source 设为 GitHub Actions。
4. 在 Actions 中查看 Deploy Heart Isle to GitHub Pages。如首次推送发生在启用 Pages 之前，可点击 Run workflow 重跑。
5. 成功后访问 https://bluefateludi.github.io/HeartIsle/。

工作流使用官方 configure-pages、upload-pages-artifact 和 deploy-pages。构建失败会使 build job 失败，deploy 依赖 build 成功。GitHub 官方说明见 [自定义 Pages 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

astro.config.mjs 在 Actions 中从 GITHUB_REPOSITORY 推导 owner 和仓库名，本地默认 bluefateludi/HeartIsle。首页、文章、CSS 和首页图片均适配 /HeartIsle/ 子路径。换仓库时更新本地默认值以及 src/lib/site.ts 的 GitHub 入口。用户根站仓库 owner.github.io 自动使用 /。

后续更新 Markdown 或图片后提交并推送 main，Actions 自动构建发布。无需手动上传 dist。

## 当前内容状态

- 第一篇文章等待提供正式标题和正文。
- 首页原始花海插画等待上传。
- 已连接公开仓库 bluefateludi/HeartIsle，并启用 GitHub Actions 作为 Pages 发布源。推送 main 自动部署到 https://bluefateludi.github.io/HeartIsle/。
