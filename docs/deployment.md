# 部署

Rapture 的架构目标是优先免费：Astro 静态输出、Vercel 托管、无服务器进程、无必需数据库。

## 推荐路径

使用 Vercel 托管，GitHub 作为代码和内容的唯一事实来源。

1. 创建 GitHub 仓库并推送项目。
2. 在 Vercel 中导入这个 GitHub 仓库。
3. 使用仓库里的 `vercel.json` 设置：
   - Framework preset: Astro
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm ci`
4. 添加生产环境变量：

```text
PUBLIC_SITE_URL=https://your-domain.com
```

5. 在 Vercel 中绑定自定义域名。
6. 触发一次生产部署。

## 为什么 `PUBLIC_SITE_URL` 很重要

`PUBLIC_SITE_URL` 会被 Astro 和站点元数据层用来生成以下规范 URL：

- HTML canonical links
- Open Graph URLs
- 默认社交预览图 `/og-image.png`
- `/content.json` 条目 URL
- `/feed.json` feed URL
- `/opensearch.xml` 搜索提供器 URL
- RSS 链接
- `/sitemap.xml`
- `/robots.txt`

如果没有设置它，Vercel 托管构建会使用 `VERCEL_URL`。本地构建会使用 `https://rapture.example.com` 作为无害占位域名。

## 发布流程

日常更新：

1. 在本地新增或导入内容。
2. 运行 `npm run check`。
3. 提交内容和代码改动。
4. 推送到 GitHub。
5. GitHub Actions 运行同一个质量门。
6. Vercel 重新构建并发布静态站点。

带有 `draft: true` 的草稿内容不会进入公开列表、详情路由和 sitemap。

首次上线，以及规范域名发生变化时，在本地运行更严格的上线检查：

```bash
PUBLIC_SITE_URL=https://your-domain.com npm run check:launch
```

Windows PowerShell 写法：

```powershell
$env:PUBLIC_SITE_URL = "https://your-domain.com"; npm run check:launch
```

这个命令会检查远程图片尺寸，使用配置的 origin 构建，验证生成的 feed 和发现文件，并在 `dist/` 中残留占位域名时失败。

## 成本边界

当前架构不需要任何付费服务：

- 托管：Vercel 静态部署
- 写作：仓库中的 MDX 文件
- 相册：`public/photos/` 下的本地文件，或远程图片 URL
- 发布：Git push 触发重新构建

Supabase 目前被刻意排除在必需依赖之外。只有当网站未来需要私有登录、评论、点赞或公开 API 时，再考虑引入。

## Vercel 配置

仓库包含 `vercel.json`，这样生产部署不依赖手动记忆设置。

它声明了：

- `framework: astro`
- `installCommand: npm ci`
- `buildCommand: npm run build`
- `outputDirectory: dist`

它也给所有路由添加了低风险安全响应头：

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy` 禁用 camera、microphone、geolocation、payment 和 USB access

目前没有设置 Content Security Policy。站点使用了 Astro inline scripts、Google Fonts、远程图片和 AquaInkGL WebGL 效果；仓促添加 CSP 很容易过严并破坏视觉体验。之后如果要加 CSP，应先覆盖测试首页、相册查看器、远程图片源，以及尚未删除的历史 `/studio/` 页面。

## 部署前检查清单

- `npm install` 已完成。
- `npm run check` 通过，包括构建后对 feed、sitemap、`robots.txt`、OpenSearch、元数据发现链接、可访问性锚点、图片 `alt` 文本和内部链接的校验。
- 使用真实生产域名运行 `PUBLIC_SITE_URL=https://your-domain.com npm run check:launch` 并通过。
- 推送分支的 GitHub Actions 为绿色。
- 大量使用远程图片 URL 的相册更新前，手动运行 `npm run validate:content:remote`。
- Vercel 生产环境设置了 `PUBLIC_SITE_URL`。
- 不应公开的草稿内容保留 `draft: true`。
- 公开图片都有有意义的 `alt` 文本。
- `/og-image.png` 仍符合当前公开身份。
- 自定义域名已指向对应 Vercel 项目。

## CI 质量门

仓库包含 `.github/workflows/ci.yml`。

它会在 push 和 pull request 时使用 Node 22 运行：

```bash
npm ci
npm run check
```

CI 有意不运行 `npm run validate:content:remote`。本地内容和 frontmatter 检查应该保持确定性；依赖远程图床的检查更适合在发布相册密集更新前手动执行。
