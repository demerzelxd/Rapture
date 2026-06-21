# Rapture content workflow

Rapture is a static Astro site. New writing and gallery entries are published by adding MDX files, then letting Vercel rebuild the site.

For the full hosting setup, see [deployment.md](deployment.md).

## Deployment metadata

Set `PUBLIC_SITE_URL` in Vercel after connecting a domain, for example `https://your-domain.com`. If it is not set, the build falls back to Vercel's generated URL when `VERCEL_URL` is available.

The static build generates:

- `/content.json` for a machine-readable public index of writing and gallery entries.
- `/feed.json` for a JSON Feed timeline of published writing and gallery updates.
- `/opensearch.xml` for browser-level discovery of the public search page.
- `/rss.xml` for the public writing feed.
- `/sitemap.xml` for the homepage, writing, gallery, posts, and photo pages.
- `/robots.txt` pointing crawlers at the sitemap.

`/content.json` includes canonical absolute URLs and only published entries. `/feed.json` follows the same draft filtering and keeps `/rss.xml` focused on writing only. `/opensearch.xml` points browsers at `/search/?q={searchTerms}` and does not require a server.

## Writing

For a browser-based drafting surface, open `/studio/`. It generates the same MDX format as the command-line helper and lets you copy or download the file.

Use the local helper for routine drafts:

```bash
npm run new:post -- -- --title "Post title" --description "One short sentence for cards and metadata." --tags "note,frontend"
```

Posts created this way are drafts by default. Add `--publish` when the entry is ready to appear on the public site:

```bash
npm run new:post -- -- --title "Post title" --description "One short sentence." --tags "note,frontend" --publish
```

The command writes an `.mdx` file under `src/content/blog/` with the required frontmatter. You can then open that file in your editor and write normally.

Manual format:

```mdx
---
title: "Post title"
description: "One short sentence for cards and metadata."
date: 2026-06-20
tags: ["note", "frontend"]
cover: "https://example.com/photo.jpg"
coverAlt: "Describe the cover image."
draft: false
---

Write in Markdown here.

```ts
console.log('code blocks are supported');
```
```

Notes:

- `draft: true` keeps the post out of generated routes.
- `draft: true` also keeps the post out of `/content.json`, `/feed.json`, `/rss.xml`, and `/sitemap.xml`.
- `cover` and `coverAlt` are optional.
- `##` and `###` headings are collected into the article chapter rail automatically.
- Published articles link to the adjacent newer and older posts automatically.
- Code blocks, links, blockquotes, tables, and images are styled by the article renderer.

## Gallery

For a browser-based drafting surface, open `/studio/` and switch to Gallery. It generates a photo MDX file with the same fields used by the static gallery.

Use the local helper for new photo entries:

```bash
npm run new:photo -- -- --title "Photo title" --src /photos/photo.jpg --location Shanghai --tone "quiet blue" --alt "Describe the photo."
```

For local PNG and JPG files under `public/`, the helper reads `width` and `height` automatically. Remote URLs need explicit dimensions:

```bash
npm run new:photo -- -- --title "Photo title" --src "https://example.com/photo.jpg" --width 1400 --height 933 --location Shanghai --tone "quiet blue"
```

Photo entries created by the helper are drafts by default. Add `--publish` when the frame is ready for the public gallery.

For a folder of local images, put them under `public/photos/` and import them in one pass:

```bash
npm run import:photos -- -- --from public/photos --location Shanghai --tone "quiet blue"
```

The batch importer scans nested folders for PNG, JPG, JPEG, and WebP files, reads dimensions automatically, creates draft photo entries, and skips any image whose public `src` already exists in `src/content/photos/`. Add `--publish` only when the imported batch should immediately appear in the public gallery.

Manual format:

```mdx
---
title: "Photo title"
location: "Shanghai"
date: 2026-06-20
src: "https://example.com/photo.jpg"
width: 1400
height: 933
tone: "quiet blue"
alt: "Describe the photo."
draft: false
---

Optional short note for the photo detail page.
```

Notes:

- `src` can be a remote image URL. For local images, put them under `public/photos/` and use paths like `/photos/my-image.jpg`.
- `draft: true` keeps the photo out of the gallery, detail routes, `/content.json`, `/feed.json`, and the sitemap.
- `width` and `height` reserve layout space and keep the gallery stable while images load.
- Photo detail pages link to adjacent frames based on the gallery date order.

## Obsidian

The low-friction path is to keep an Obsidian vault folder for drafts, then import finished or nearly finished notes into the site:

```bash
npm run import:obsidian -- -- --from "C:/path/to/vault/My Note.md" --tags "note,essay"
```

Imported posts are drafts by default. Add `--publish` to publish immediately:

```bash
npm run import:obsidian -- -- --from "C:/path/to/vault/My Note.md" --tags "note,essay" --publish
```

The importer preserves the note body, derives the title from frontmatter, the first `# Heading`, or the filename, and fills missing Rapture frontmatter. After pushing to GitHub, Vercel rebuilds and publishes the static pages.

For a one-command inbox, keep publishable notes in a dedicated vault folder and import the whole folder:

```bash
npm run import:obsidian:folder -- -- --from "C:/path/to/vault/Rapture" --tags "note,essay"
```

The folder importer scans nested `.md` and `.mdx` files. It creates draft posts by default, preserves each note body, and skips source files that were already imported by a previous folder run. It does this with a `sourceKey` frontmatter value derived from a short SHA-256 hash of the source path; the local vault path itself is not written into the post. Add `--publish` only when the whole folder should become public immediately. Add `--force` when you intentionally want to import a source file again as a new post.

## Validation

Run a fast local content check before committing new entries:

```bash
npm run validate:content
```

This checks required frontmatter, duplicate slugs, duplicate photo sources, local image paths, local image dimensions, dates, tags, missing accessibility text, the web manifest, PWA icon dimensions, core favicon files, and the default social preview image.

Before publishing a larger gallery update, run the remote image check too:

```bash
npm run validate:content:remote
```

The remote check fetches external photo URLs and compares their actual dimensions with the `width` and `height` stored in frontmatter. This catches the kind of mismatch that can make cards or detail pages reserve the wrong aspect ratio.
