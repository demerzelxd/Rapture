# Deployment

Rapture is designed to stay free-first: static Astro output, Vercel hosting, no server process, and no required database.

## Recommended Path

Use Vercel for hosting and GitHub as the source of truth.

1. Create a GitHub repository and push the project.
2. In Vercel, import the GitHub repository.
3. Use the checked-in `vercel.json` settings:
   - Framework preset: Astro
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm ci`
4. Add a production environment variable:

```text
PUBLIC_SITE_URL=https://your-domain.com
```

5. Connect the custom domain in Vercel.
6. Trigger a production deployment.

## Why `PUBLIC_SITE_URL` Matters

`PUBLIC_SITE_URL` is used by Astro and the site metadata layer to generate canonical URLs for:

- HTML canonical links
- Open Graph URLs
- the default `/og-image.png` social preview
- `/content.json` entry URLs
- `/feed.json` feed URLs
- `/opensearch.xml` search provider URLs
- RSS links
- `/sitemap.xml`
- `/robots.txt`

If it is not set, hosted Vercel builds use `VERCEL_URL`. Local builds use `https://rapture.example.com` as a harmless placeholder.

## Publishing Flow

For routine updates:

1. Add or import content locally.
2. Run `npm run check`.
3. Commit the content and code changes.
4. Push to GitHub.
5. GitHub Actions runs the same quality gate.
6. Vercel rebuilds and publishes the static site.

Draft content with `draft: true` is excluded from public lists, generated detail routes, and the sitemap.

For the first launch, and whenever the canonical domain changes, run the stricter launch gate locally:

```bash
PUBLIC_SITE_URL=https://your-domain.com npm run check:launch
```

On Windows PowerShell:

```powershell
$env:PUBLIC_SITE_URL = "https://your-domain.com"; npm run check:launch
```

This command checks remote image dimensions, builds with the configured origin, validates generated feeds and discovery files, and fails if placeholder hosts remain in `dist/`.

## Cost Boundaries

The current architecture has no required paid services:

- Hosting: Vercel static deployment
- Writing: MDX files in the repository
- Gallery: local files under `public/photos/` or remote image URLs
- Publishing: Git push triggers rebuild

Supabase is intentionally not required right now. It can be added later only if the site needs private auth, comments, likes, or a public API.

## Vercel Config

The repository includes `vercel.json` so production deploys do not depend on manually remembered settings.

It declares:

- `framework: astro`
- `installCommand: npm ci`
- `buildCommand: npm run build`
- `outputDirectory: dist`

It also adds low-risk security headers to all routes:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy` disabling camera, microphone, geolocation, payment, and USB access.

Content Security Policy is intentionally not set yet. The current site uses inline Astro scripts, Google Fonts, remote images, and the AquaInkGL WebGL effect; a rushed CSP would be easy to make too strict and break the visual experience. Add CSP later only after testing it against the homepage, Studio, gallery viewer, and remote image hosts.

## Pre-Deploy Checklist

- `npm install` has completed.
- `npm run check` passes, including post-build validation for generated feeds, sitemap, robots.txt, OpenSearch, metadata discovery links, accessibility anchors, image alt text, and internal links.
- `PUBLIC_SITE_URL=https://your-domain.com npm run check:launch` passes with the real production domain.
- GitHub Actions is green for the pushed branch.
- Run `npm run validate:content:remote` manually before large gallery updates that rely on remote image URLs.
- `PUBLIC_SITE_URL` is set in Vercel for production.
- Draft content that should remain private has `draft: true`.
- Public images have useful `alt` text.
- `/og-image.png` still matches the intended public identity.
- The custom domain points to the Vercel project.

## CI Gate

The repository includes `.github/workflows/ci.yml`.

It runs on pushes and pull requests with Node 22:

```bash
npm ci
npm run check
```

The CI gate intentionally skips `npm run validate:content:remote`. Local and frontmatter checks should be deterministic; remote image hosts are better verified manually before a gallery-heavy publish.
