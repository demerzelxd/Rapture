# Rapture 内容工作流

Rapture 是一个静态 Astro 站点。新的文章和相册条目通过新增 MDX 文件发布，然后由 Vercel 重新构建静态页面。

完整托管配置见 [deployment.md](deployment.md)。

## 部署元数据

绑定域名后，在 Vercel 中设置 `PUBLIC_SITE_URL`，例如 `https://your-domain.com`。如果没有设置，Vercel 托管构建会在存在 `VERCEL_URL` 时回退到 Vercel 生成的地址。

静态构建会生成：

- `/content.json`：机器可读的公开内容索引，包含写作和相册条目。
- `/feed.json`：JSON Feed 时间线，包含已发布的写作和相册更新。
- `/opensearch.xml`：让浏览器发现公开搜索页。
- `/rss.xml`：公开写作 RSS。
- `/sitemap.xml`：首页、写作、相册、归档、搜索、文章页和照片页。
- `/robots.txt`：指向 sitemap，方便爬虫发现站点结构。

`/content.json` 包含规范绝对 URL，并且只包含已发布条目。`/feed.json` 使用同样的草稿过滤规则，`/rss.xml` 则保持为只包含写作内容。`/opensearch.xml` 指向 `/search/?q={searchTerms}`，不需要服务器支持。

`/archive/` 是公开系统索引：它会读取同一批内容集合，汇总文章、照片、标签、地点、媒体来源和最近更新，并用滚动点亮的深海电缆串起所有公开信号。全站命令面板会在用户按下 `Ctrl+K` / `Cmd+K` 或 `/` 时懒加载 `/content.json`，因此不会影响首页油墨首屏加载。

## 推荐工作流

现在推荐把 Obsidian 作为日常工作台：在 Obsidian 写文章或维护 Gallery 条目，通过 fast-note-sync-service 推送到 GitHub 仓库里的 `src/content/blog/` 或 `src/content/photos/`，再由 Vercel 触发静态构建。

完整模板和图片托管建议见 [obsidian-workbench.md](obsidian-workbench.md)。

早期隐藏的浏览器 frontmatter 生成器和本地辅助发布脚本已删除；当前只保留 Obsidian + FNS + 手写 frontmatter 这一条主线，避免维护多套发布入口。

## 写作

手动格式如下：

````mdx
---
title: "文章标题"
description: "一句用于卡片和元数据的摘要。"
date: 2026-06-20
tags: ["note", "frontend"]
cover: "https://example.com/photo.jpg"
coverAlt: "描述封面图片。"
draft: false
---

在这里写 Markdown。

```ts
console.log('支持代码块');
```
````

说明：

- `draft: true` 会让文章不生成公开路由。
- `draft: true` 也会让文章不进入 `/content.json`、`/feed.json`、`/rss.xml` 和 `/sitemap.xml`。
- `cover` 和 `coverAlt` 是可选字段。
- `##` 和 `###` 标题会自动进入文章侧边章节导航。
- 已发布文章会自动链接到相邻的新文章和旧文章。
- 代码块、链接、引用、表格和图片都会由文章渲染器统一样式化。

## 相册

手动格式如下：

```mdx
---
title: "照片标题"
location: "Shanghai"
date: 2026-06-20
src: "https://example.com/photo.jpg"
width: 1400
height: 933
tone: "quiet blue"
alt: "描述这张照片。"
draft: false
---

这里可以写照片详情页的短注释。
```

说明：

- `src` 可以是远程图片 URL。本地图片建议放在 `public/photos/` 下，并使用 `/photos/my-image.jpg` 这样的路径。
- `draft: true` 会让照片不进入相册、详情路由、`/content.json`、`/feed.json` 和 sitemap。
- `width` 和 `height` 用来预留布局空间，避免图片加载时相册抖动。
- 照片详情页会根据相册日期顺序自动链接到相邻照片。

## Obsidian

当前最顺的路径是让 Obsidian 直接维护 Rapture 内容目录，并由 fast-note-sync-service 负责 Git 同步：

```text
Obsidian -> FNS -> GitHub -> Vercel -> Rapture
```

文章同步到 `src/content/blog/`，Gallery 条目同步到 `src/content/photos/`。同步进仓库的文件必须带完整 frontmatter；构建不会再自动补齐缺失字段。还没准备发布的内容请保留 `draft: true`。

## 校验

提交新内容前，先运行快速本地内容检查：

```bash
npm run validate:content
```

这个命令会检查必需 frontmatter、重复 slug、重复照片源、本地图片路径、本地图片尺寸、日期、标签、缺失的可访问性文本、Web Manifest、PWA 图标尺寸、核心 favicon 文件和默认社交预览图。

在发布较大的相册更新前，也建议运行远程图片检查：

```bash
npm run validate:content:remote
```

远程检查会拉取外部图片 URL，并把真实尺寸与 frontmatter 里的 `width` 和 `height` 对比。它能提前发现会导致卡片或详情页预留错误比例的问题。

内容校验还会阻止已发布条目携带模板标题、示例图片域名、默认草稿文案或正文里重复 frontmatter 标题的一级标题。草稿里出现这些内容只会提示 warning，公开内容则会让构建失败。
