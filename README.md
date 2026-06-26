# Rapture

Rapture 是一个基于 Astro 的静态个人主页，用来承载写作和摄影。首页以 WebGL 油墨效果作为第一印象，内容层保持可维护：MDX 博文、静态相册、RSS、JSON Feed、OpenSearch、站点地图、`robots.txt`、公开内容索引，以及基于 Obsidian/FNS/Git 的低摩擦内容工作流。

## 技术栈

- Astro 静态输出
- MDX Content Collections
- 不依赖数据库或自建服务器
- 适合部署到 Vercel 免费额度
- 本地内容工具：创建博文、创建照片条目、导入 Obsidian、批量导入照片
- 远程 Gallery 照片草稿生成：自动读取远程图片尺寸
- Obsidian + fast-note-sync-service 内容工作台
- Web App Manifest 和移动端主屏元数据
- 写作与相册共用的 JSON Feed
- OpenSearch，让浏览器可以发现站内搜索
- 公开的 JSON 内容索引，方便个人脚本或自动化读取

## 本地开发

安装依赖：

```bash
npm install
```

启动本地开发服务：

```bash
npm run dev
```

打开：

```text
http://127.0.0.1:4321/
```

发布前运行本地质量门：

```bash
npm run check
```

这个命令会校验内容元数据、公开品牌资源、PWA 图标，执行 Astro 类型和内容检查，构建静态站点，并检查生成后的 feed、发现文件、可访问性锚点、图片 `alt` 文本和内部链接。GitHub Actions 使用的也是同一个命令。

只构建站点：

```bash
npm run build
```

校验内容 frontmatter、本地图片元数据和公开品牌资源：

```bash
npm run validate:content
```

构建后校验生成的公开输出：

```bash
npm run validate:public
```

在发布较大的相册更新前，可以额外运行远程图片尺寸校验：

```bash
npm run validate:content:remote
```

远程图片校验需要联网，外部图床也可能变慢或短暂不可用，所以它被设计成手动执行。

配置最终域名后，运行上线检查：

```bash
PUBLIC_SITE_URL=https://your-domain.com npm run check:launch
```

Windows PowerShell 写法：

```powershell
$env:PUBLIC_SITE_URL = "https://your-domain.com"; npm run check:launch
```

这个较慢的检查会校验远程图片尺寸，使用生产域名构建，验证生成的公开输出，并在静态产物里残留占位域名时失败。

预览生产构建：

```bash
npm run preview
```

## 内容目录

发布内容位于：

- `src/content/blog/`：写作内容
- `src/content/photos/`：相册条目
- `public/photos/`：本地图片文件

创建一篇草稿：

```bash
npm run new:post -- -- --title "文章标题" --description "一句用于卡片和元数据的摘要。" --tags "note,essay"
```

创建一个照片条目：

```bash
npm run new:photo -- -- --title "照片标题" --src /photos/photo.jpg --thumb /photos/thumbs/photo.webp --location Shanghai --tone "quiet blue" --alt "描述这张照片。"
```

从 R2 原图 URL 创建 Gallery 草稿，并自动生成/上传缩略图：

```bash
npm run new:r2-photo -- -- --src "https://file.getschwifty.me/rapture/gallery/full/photo.webp" --location Shanghai --tone "quiet blue"
```

如果这张原图已经有相册条目，只想补缩略图：

```bash
npm run new:r2-photo -- -- --src "https://file.getschwifty.me/rapture/gallery/full/photo.webp" --update-existing
```

相册字段约定：`src` 是详情页和 FULL FRAME 使用的原图或高清图，`thumb` 是首页、相册列表、搜索和 feed 使用的轻量图。`thumb` 可选；没填时会自动回退到 `src`。如果你已经手工准备好了 `thumb` URL，也仍然可以使用 `new:remote-photo --thumb`。

导入一篇 Obsidian 笔记：

```bash
npm run import:obsidian -- -- --from "C:/path/to/vault/My Note.md" --tags "note,essay"
```

导入一个 Obsidian 文件夹：

```bash
npm run import:obsidian:folder -- -- --from "C:/path/to/vault/Rapture" --tags "note,essay"
```

批量导入本地照片：

```bash
npm run import:photos -- -- --from public/photos --location Shanghai --tone "quiet blue"
```

这些命令默认生成草稿。只有加上 `--publish`，条目才会公开出现在路由、列表、feed 和 sitemap 里。

完整内容流程见 [docs/content-workflow.md](docs/content-workflow.md)。如果你想把 Obsidian 作为博客、文章图片和 Gallery 摄影的统一工作台，直接看 [docs/obsidian-workbench.md](docs/obsidian-workbench.md)。

## 部署

推荐的生产路径是 Vercel 免费静态托管：

1. 把本仓库推送到 GitHub。
2. 在 Vercel 中导入 GitHub 仓库。
3. 保持默认 Astro 构建设置：
   - Build command: `npm run build`
   - Output directory: `dist`
4. 设置 `PUBLIC_SITE_URL` 为最终规范域名，例如 `https://your-domain.com`。
5. 在 Vercel 中绑定自定义域名。

GitHub Actions 会在 push 和 pull request 时运行 `npm run check`。依赖 Vercel 生产部署前，先保持这个质量门为绿色。

如果没有设置 `PUBLIC_SITE_URL`，托管在 Vercel 上构建时会回退到 Vercel 提供的 `VERCEL_URL`。本地构建会回退到 `https://rapture.example.com`，因此生产环境应明确设置 `PUBLIC_SITE_URL`。

更多部署细节见 [docs/deployment.md](docs/deployment.md)。

## 生成的公开文件

静态构建会包含：

- `/content.json`
- `/feed.json`
- `/og-image.png`
- `/opensearch.xml`
- `/rss.xml`
- `/sitemap.xml`
- `/robots.txt`

这些文件在可用时都会使用 `PUBLIC_SITE_URL` 生成绝对 URL。

`/content.json` 只列出已发布的文章和相册条目，草稿会被排除。

`/feed.json` 是 JSON Feed 1.1 时间线，包含已发布的写作和相册更新。`/rss.xml` 仍然只保留写作内容。

`/opensearch.xml` 让浏览器可以把 Rapture 的 `/search/?q=...` 页面识别为可搜索站点。

`/og-image.png` 是默认社交预览图，`public/og-image.svg` 是它的可编辑源文件。
