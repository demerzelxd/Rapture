# Obsidian 工作台

这份文档描述推荐的低成本内容工作流：把 Obsidian 作为唯一编辑入口，用 fast-note-sync-service 同步 Markdown 到 Rapture 仓库，再由 Vercel 静态部署。目标是让博客文章、文章配图和 Gallery 摄影都能在一个工作台里维护，同时避免把大图直接塞进 Git 仓库。

## 推荐链路

```text
Obsidian
  -> fast-note-sync-service
  -> GitHub 仓库中的 src/content/*
  -> Vercel npm run build
  -> 静态页面、content.json、feed、sitemap
```

文章可以直接同步到 `src/content/blog/`。Rapture 的构建流程会在 `npm run build` 前自动执行 `npm run normalize:obsidian`，所以缺少部分 frontmatter 的 `.md` 文章也能被补齐并通过构建。

需要注意：直接同步进 `src/content/blog/` 的文章如果没有写 `draft: true`，规范化后会按公开文章处理。还没准备发布的笔记不要直接同步到这个目录，或者在模板里显式保留 `draft: true`。

## 文章模板

在 Obsidian 里新建可发布文章时，建议使用下面的模板。文件可以是 `.md` 或 `.mdx`，放到 `src/content/blog/` 后都会被 Astro Content Collections 读取。

```md
---
title: "文章标题"
description: "一句用于列表卡片、SEO 和 feed 的摘要。"
date: 2026-06-21
updated: 2026-06-21
tags: ["note", "essay"]
cover: "https://images.example.com/rapture/covers/example.webp"
coverAlt: "封面图片的无障碍描述。"
draft: true
---

# 文章标题

第一段最好可以单独成立。缺少 `description` 时，系统会尝试用第一段补齐，但正式发布前建议手写。

## 章节标题

`##` 和 `###` 会进入文章页章节导航。

### 小节标题

普通 Markdown、表格、引用、代码块和图片都会被统一渲染。

```ts
const city = 'Rapture';
```
```

字段说明：

- `title`、`description`、`date`、`tags` 是文章的核心字段。
- `updated` 可选，用来标记大改时间。
- `cover` 和 `coverAlt` 可选；如果写了 `cover`，建议一定写 `coverAlt`。
- `draft: true` 不进入公开路由、列表、feed、sitemap 和 `/content.json`。
- `sourceKey` 不建议手写。它是旧的 Obsidian 导入器用于去重的内部 hash，格式必须是 `sha256:<16 位小写十六进制>`；FNS 直接同步目录时不需要这个字段。

发布时，把 `draft` 改成 `false` 或删除 `draft` 后让系统默认公开，再让 FNS 推送到 GitHub。Vercel 接到 Git push 后会重新构建。

## 文章里的图片

文章图片不建议放进 Git 仓库。推荐路径是：

1. 安装 [PicList](https://piclist.cn/en/app)，并配置一个图床。
2. 在 PicList 开启上传服务，例如 `http://127.0.0.1:36677/upload`。
3. 在 Obsidian 安装 [Image Auto Upload Plugin](https://github.com/renmu123/obsidian-image-auto-upload-plugin) 或同类插件，把上传接口指向 PicList。
4. 在 Obsidian 里粘贴或拖入图片，插件自动上传并把本地图片替换成远程 URL。
5. 正文里保留标准 Markdown 图片语法。

```md
![海面下的霓虹走廊](https://images.example.com/rapture/posts/neon-corridor.webp)
```

如果某篇文章不希望自动上传图片，可以在 Obsidian frontmatter 中临时关闭：

```md
---
image-auto-upload: false
---
```

这个字段不会被 Rapture 使用，只是给 Obsidian 插件读取。发布前可以保留，也可以删除。

## Gallery 照片模板

Gallery 不是正文里的图片列表，而是 `src/content/photos/` 里的照片条目。每张照片对应一个 `.md` 或 `.mdx` 文件，图片本体放在图床，条目只保存元数据和远程 URL。

```md
---
title: "照片标题"
location: "Shanghai"
date: 2026-06-21
src: "https://images.example.com/rapture/gallery/photo-title.webp"
width: 1600
height: 1067
tone: "brass light after rain"
alt: "雨后街角，一束黄铜色灯光落在玻璃上。"
draft: true
---

这里写一小段照片注释。可以很短，重点是让照片详情页不只是裸图。
```

字段说明：

- `src` 可以是远程图片 URL，也可以是 `/photos/file.jpg` 这种本地 public 路径；Gallery 主流程推荐远程 URL。
- `width` 和 `height` 必填，用来锁定图片比例，避免移动端和详情页布局抖动。
- `tone` 是页面氛围字段，会显示在照片信息里，也适合写颜色、光线、天气或情绪。
- `alt` 可选但强烈建议写；公开页面会校验图片是否有可访问性文本。
- `draft: true` 不进入相册、详情路由、feed、sitemap 和 `/content.json`。

## Gallery 照片操作流

推荐的手工流：

1. 在 Obsidian 中建一个 `Rapture/Gallery` 文件夹。
2. 先用 PicList 上传原图或压缩后的 WebP/JPEG。
3. 复制 PicList 返回的远程 URL。
4. 用上面的 Gallery 模板新建照片条目，填入 `src`、`width`、`height`、`location`、`tone` 和 `alt`。
5. 通过 FNS 同步到 `src/content/photos/`。
6. 发布前运行 `npm run validate:content`；如果是远程图床，发布大量照片前再运行 `npm run validate:content:remote`。

如果后续觉得手工填尺寸麻烦，可以做一个小脚本或 PicList 上传后脚本：上传成功后自动生成 Gallery frontmatter 草稿，并把 `width`、`height`、远程 URL 和文件名写好。这个优化比把图片塞进 Git 仓库更值得做。

## 免费图床建议

当前更适合 Rapture 的免费选择是：

- [ImageKit](https://imagekit.io/lp/imagekit-forever-free-plan)：上手成本低，适合个人站点；官方免费方案当前提供每月 20GB 带宽且无需信用卡，并自带图片优化能力。
- [Cloudflare R2](https://developers.cloudflare.com/r2/pricing/)：更像长期对象存储。官方免费额度当前包含 10 GB-month 标准存储、每月 100 万 Class A 操作、1000 万 Class B 操作，并且公网出站流量免费。它更适合照片归档，但需要配置 bucket、公开访问或自定义域名，图片优化能力需要额外方案。

不建议把 Gallery 主照片放进 Git 仓库。原因是仓库会快速膨胀，克隆、CI、Vercel 构建都会越来越慢。也不建议依赖 Google Photos 作为网站图床；它适合个人备份和浏览，不适合作为稳定的公开静态图片 URL 来源。

一个务实组合：

```text
文章图片：Obsidian + Image Auto Upload + PicList + ImageKit
Gallery 摄影：Obsidian 条目 + PicList 上传 + ImageKit 或 Cloudflare R2 URL
Git 仓库：只保存 Markdown 和照片元数据
```

## `/studio/` 是否还需要

按现在的工作流，`/studio/` 已经不是主路径。它没有出现在公开导航里，也不会进入 sitemap，并且页面本身是 `noindex`。如果 Obsidian + FNS 工作流稳定，可以删除 `src/pages/studio.astro`，再清理 README 和部署文档中残留的 Studio 说明。

建议先把它视为历史备用工具：不再使用、不再扩展。等你确认 Obsidian 模板和图片上传链路跑顺后，再删除页面，避免在内容工作流还没完全稳定时少一个临时生成 frontmatter 的兜底入口。

## 后续优化空间

- 为 Obsidian 建两个模板：文章模板和 Gallery 照片模板，默认 `draft: true`。
- 加一个 `new:remote-photo` 脚本：输入远程 URL、本地原图路径或 PicList 输出，自动生成 `src/content/photos/*.md`。
- 约定图床路径，例如 `rapture/posts/YYYY/` 和 `rapture/gallery/YYYY/`，避免几年后图片目录失控。
- 在发布前对 Gallery 远程图片运行 `npm run validate:content:remote`，但不要放进默认 CI，避免外部图床短暂故障影响每次提交。
- 如果未来要在页面里展示 EXIF、相机、镜头、胶片模拟等信息，需要扩展 `src/content.config.ts` 的 photos schema。
