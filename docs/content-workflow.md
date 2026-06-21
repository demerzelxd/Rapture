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
- `/sitemap.xml`：首页、写作、相册、文章页和照片页。
- `/robots.txt`：指向 sitemap，方便爬虫发现站点结构。

`/content.json` 包含规范绝对 URL，并且只包含已发布条目。`/feed.json` 使用同样的草稿过滤规则，`/rss.xml` 则保持为只包含写作内容。`/opensearch.xml` 指向 `/search/?q={searchTerms}`，不需要服务器支持。

## 推荐工作流

现在推荐把 Obsidian 作为日常工作台：在 Obsidian 写文章或维护 Gallery 条目，通过 fast-note-sync-service 推送到 GitHub 仓库里的 `src/content/blog/` 或 `src/content/photos/`，再由 Vercel 触发静态构建。

完整模板和图片托管建议见 [obsidian-workbench.md](obsidian-workbench.md)。

`/studio/` 是早期隐藏的浏览器 frontmatter 生成器，当前没有公开导航入口，也不进入 sitemap。Obsidian + FNS 跑顺后可以删除它；在删除前，它只作为历史备用工具，不再作为推荐路径。

## 写作

日常草稿也可以使用本地 helper：

```bash
npm run new:post -- -- --title "文章标题" --description "一句用于卡片和元数据的摘要。" --tags "note,frontend"
```

这样创建的文章默认是草稿。准备公开时加上 `--publish`：

```bash
npm run new:post -- -- --title "文章标题" --description "一句摘要。" --tags "note,frontend" --publish
```

命令会在 `src/content/blog/` 下写入一个带必需 frontmatter 的 `.mdx` 文件。之后可以直接在编辑器里正常写 Markdown。

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

新增照片条目可以使用本地 helper：

```bash
npm run new:photo -- -- --title "照片标题" --src /photos/photo.jpg --location Shanghai --tone "quiet blue" --alt "描述这张照片。"
```

对于 `public/` 下的本地 PNG 和 JPG 文件，helper 会自动读取 `width` 和 `height`。远程 URL 需要显式传入尺寸：

```bash
npm run new:photo -- -- --title "照片标题" --src "https://example.com/photo.jpg" --width 1400 --height 933 --location Shanghai --tone "quiet blue"
```

helper 创建的照片条目默认是草稿。只有加上 `--publish`，这张照片才会进入公开相册。

批量导入本地图片时，先把图片放到 `public/photos/`，再执行：

```bash
npm run import:photos -- -- --from public/photos --location Shanghai --tone "quiet blue"
```

批量导入器会扫描嵌套文件夹里的 PNG、JPG、JPEG 和 WebP 文件，自动读取尺寸，创建草稿照片条目，并跳过已经在 `src/content/photos/` 中存在同一公开 `src` 的图片。只有在整批照片都应立即公开时才加 `--publish`。

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

文章同步到 `src/content/blog/`，Gallery 条目同步到 `src/content/photos/`。文章缺少 frontmatter 时，`npm run build` 会先执行 `npm run normalize:obsidian` 自动补齐；但直接同步进 `src/content/blog/` 的文章如果没有 `draft: true`，会按公开内容处理。

如果仍然想从一个普通 vault 草稿箱手动导入文章，可以使用旧导入器：

```bash
npm run import:obsidian -- -- --from "C:/path/to/vault/My Note.md" --tags "note,essay"
```

导入文章默认是草稿。需要立即发布时加 `--publish`：

```bash
npm run import:obsidian -- -- --from "C:/path/to/vault/My Note.md" --tags "note,essay" --publish
```

导入器会保留笔记正文，从 frontmatter、第一个 `# Heading` 或文件名中推导标题，并补齐 Rapture 需要的 frontmatter。推送到 GitHub 后，Vercel 会重新构建并发布静态页面。

如果想做成一个一键收件箱，可以把可发布笔记放在专门的 vault 文件夹里，然后导入整个文件夹：

```bash
npm run import:obsidian:folder -- -- --from "C:/path/to/vault/Rapture" --tags "note,essay"
```

文件夹导入器会扫描嵌套的 `.md` 和 `.mdx` 文件。它默认创建草稿文章，保留每篇笔记正文，并跳过已经通过上一次文件夹导入处理过的源文件。去重依赖 `sourceKey` frontmatter，它由源路径的短 SHA-256 hash 生成；本地 vault 路径本身不会写入文章。只有整批内容都应立即公开时才加 `--publish`。如果明确想把同一个源文件再次导入为新文章，可以加 `--force`。

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
