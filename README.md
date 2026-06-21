# Rapture

Rapture is a static Astro personal site for writing and photography. It is built around a shader-led oil-ink home page, then keeps the rest of the site maintainable: MDX writing, a static gallery, RSS, JSON Feed, OpenSearch, sitemap, robots.txt, a JSON content index, and a hidden local drafting studio.

## Stack

- Astro static output
- MDX content collections
- No database or custom server
- Vercel-friendly free deployment
- Local content helpers for posts, photos, Obsidian imports, and photo batch imports
- Web app manifest and mobile home-screen metadata
- Unified JSON Feed for writing and gallery updates
- OpenSearch discovery for browser-level site search
- Public JSON content index for personal scripts and automation

## Local Development

Install dependencies:

```bash
npm install
```

Run the site locally:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:4321/
```

Run the local quality gate before publishing:

```bash
npm run check
```

This validates content metadata, public branding assets, PWA icons, runs Astro's type/content checks, builds the static site, and checks the generated public feeds/discovery files, accessibility anchors, image alt text, and internal links. It is the same command used by GitHub Actions.

Build the site directly:

```bash
npm run build
```

Validate content frontmatter, local image metadata, and public branding assets:

```bash
npm run validate:content
```

Validate the generated public output after a build:

```bash
npm run validate:public
```

Run the slower remote image dimension check before publishing a larger gallery update:

```bash
npm run validate:content:remote
```

Remote image validation is intentionally manual because external image hosts can be slow or temporarily unavailable.

Run the launch gate after setting the final domain:

```bash
PUBLIC_SITE_URL=https://your-domain.com npm run check:launch
```

On Windows PowerShell:

```powershell
$env:PUBLIC_SITE_URL = "https://your-domain.com"; npm run check:launch
```

This slower gate checks remote image dimensions, builds with the production domain, validates generated public output, and fails if placeholder hosts remain in the static build.

Preview the production build:

```bash
npm run preview
```

## Content

Published content lives under:

- `src/content/blog/` for writing
- `src/content/photos/` for gallery entries
- `public/photos/` for local image files

Create a draft post:

```bash
npm run new:post -- -- --title "Post title" --description "One short sentence." --tags "note,essay"
```

Create a draft photo entry:

```bash
npm run new:photo -- -- --title "Photo title" --src /photos/photo.jpg --location Shanghai --tone "quiet blue" --alt "Describe the photo."
```

Import an Obsidian note:

```bash
npm run import:obsidian -- -- --from "C:/path/to/vault/My Note.md" --tags "note,essay"
```

Import a folder of Obsidian notes:

```bash
npm run import:obsidian:folder -- -- --from "C:/path/to/vault/Rapture" --tags "note,essay"
```

Import a folder of local photos:

```bash
npm run import:photos -- -- --from public/photos --location Shanghai --tone "quiet blue"
```

Add `--publish` to these commands only when the entry should appear publicly. Draft entries stay out of routes, lists, and the sitemap.

For the full authoring workflow, see [docs/content-workflow.md](docs/content-workflow.md).

## Browser Studio

The hidden authoring surface is available at:

```text
/studio/
```

It generates the same MDX frontmatter as the command-line helpers. It is intentionally not linked from the public navigation and is marked `noindex`.

## Deployment

The intended production path is Vercel's free static hosting:

1. Push this repository to GitHub.
2. Import the repository into Vercel.
3. Keep the default Astro build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Set `PUBLIC_SITE_URL` to the final canonical domain, for example `https://your-domain.com`.
5. Connect the custom domain in Vercel.

GitHub Actions runs `npm run check` on pushes and pull requests. Keep that gate green before relying on Vercel's production deployment.

If `PUBLIC_SITE_URL` is not set, the site falls back to Vercel's generated `VERCEL_URL` during hosted builds. Local builds fall back to `https://rapture.example.com`, so production should set `PUBLIC_SITE_URL`.

More detail is in [docs/deployment.md](docs/deployment.md).

## Generated Public Files

The static build includes:

- `/content.json`
- `/feed.json`
- `/og-image.png`
- `/opensearch.xml`
- `/rss.xml`
- `/sitemap.xml`
- `/robots.txt`

These use `PUBLIC_SITE_URL` when it is available.

`/content.json` lists only published writing and gallery entries. Draft content is excluded.

`/feed.json` is a JSON Feed 1.1 timeline for published writing and gallery updates. `/rss.xml` remains the writing-only RSS feed.

`/opensearch.xml` lets browsers discover Rapture's built-in `/search/?q=...` page as a searchable site provider.

`/og-image.png` is the default social preview image. `public/og-image.svg` is the editable source.
