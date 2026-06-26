#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');
const errors = [];

validateDistExists();

const requiredFiles = [
  'index.html',
  '404.html',
  'archive/index.html',
  'blog/index.html',
  'gallery/index.html',
  'search/index.html',
  'content.json',
  'feed.json',
  'opensearch.xml',
  'robots.txt',
  'rss.xml',
  'sitemap.xml',
  'site.webmanifest',
];

for (const filePath of requiredFiles) {
  requireDistFile(filePath);
}

const content = readJson('content.json');
const feed = readJson('feed.json');
const manifest = readJson('site.webmanifest');
const indexHtml = readText('index.html');
const opensearch = readText('opensearch.xml');
const robots = readText('robots.txt');
const rss = readText('rss.xml');
const sitemap = readText('sitemap.xml');

validateHeadDiscovery(indexHtml);
validateContentIndex(content);
validateJsonFeed(feed, content);
validateOpenSearch(opensearch);
validateRss(rss, content);
validateSitemap(sitemap, content);
validateRobots(robots);
validateManifest(manifest);
validateSkipLinks();
validateInternalLinks(content);
validateImages();
validatePublicCopy();

report();

function validateDistExists() {
  if (!existsSync(distDir)) {
    addError('dist', 'missing build output; run npm run build before validate:public');
  }
}

function validateHeadDiscovery(html) {
  requireMatch('index.html', html, /<link\s+rel="canonical"[^>]+href="https?:\/\/[^"]+\/"/, 'missing canonical homepage URL');
  requireMatch('index.html', html, /<link\s+rel="alternate"\s+type="application\/rss\+xml"[^>]+href="https?:\/\/[^"]+\/rss\.xml"/, 'missing RSS discovery link');
  requireMatch('index.html', html, /<link\s+rel="alternate"\s+type="application\/feed\+json"[^>]+href="https?:\/\/[^"]+\/feed\.json"/, 'missing JSON Feed discovery link');
  requireMatch('index.html', html, /<link\s+rel="alternate"\s+type="application\/json"[^>]+href="https?:\/\/[^"]+\/content\.json"/, 'missing content JSON discovery link');
  requireMatch('index.html', html, /<link\s+rel="search"\s+type="application\/opensearchdescription\+xml"[^>]+href="https?:\/\/[^"]+\/opensearch\.xml"/, 'missing OpenSearch discovery link');
  requireMatch('index.html', html, /<link\s+rel="manifest"\s+href="\/site\.webmanifest"/, 'missing manifest link');
  requireMatch('index.html', html, /<meta\s+property="og:image"\s+content="https?:\/\/[^"]+\/og-image\.png"/, 'missing default Open Graph image');
}

function validateContentIndex(content) {
  if (!content || typeof content !== 'object') return;

  requireString('content.json', content.site, 'name');
  requireAbsoluteUrl('content.json', content.site?.url, 'site.url');

  const writing = Array.isArray(content.writing) ? content.writing : [];
  const gallery = Array.isArray(content.gallery) ? content.gallery : [];

  if (!writing.length) addError('content.json', 'writing array is empty');
  if (!gallery.length) addError('content.json', 'gallery array is empty');

  if (content.counts?.writing !== writing.length) {
    addError('content.json', `counts.writing is ${content.counts?.writing}, expected ${writing.length}`);
  }
  if (content.counts?.gallery !== gallery.length) {
    addError('content.json', `counts.gallery is ${content.counts?.gallery}, expected ${gallery.length}`);
  }
  if (content.counts?.total !== writing.length + gallery.length) {
    addError('content.json', `counts.total is ${content.counts?.total}, expected ${writing.length + gallery.length}`);
  }

  const seen = new Set();
  for (const entry of [...writing, ...gallery]) {
    const label = `content.json:${entry?.type ?? 'entry'}:${entry?.slug ?? 'unknown'}`;
    requireString(label, entry, 'title');
    requireString(label, entry, 'slug');
    requireAbsoluteUrl(label, entry?.url, 'url');
    if (seen.has(entry?.url)) {
      addError(label, `duplicate content URL: ${entry.url}`);
    }
    seen.add(entry?.url);
  }

  for (const photo of gallery) {
    const label = `content.json:gallery:${photo?.slug ?? 'unknown'}`;
    requireAbsoluteUrl(label, photo?.image, 'image');
    if (photo?.thumbnail !== undefined) {
      requireAbsoluteUrl(label, photo.thumbnail, 'thumbnail');
    }
    requirePositiveNumber(label, photo, 'width');
    requirePositiveNumber(label, photo, 'height');
    const expectedRatio = Number((photo.width / photo.height).toFixed(4));
    if (Math.abs(photo.aspectRatio - expectedRatio) > 0.0001) {
      addError(label, `aspectRatio is ${photo.aspectRatio}, expected ${expectedRatio}`);
    }
  }
}

function validateJsonFeed(feed, content) {
  if (!feed || typeof feed !== 'object' || !content || typeof content !== 'object') return;

  if (feed.version !== 'https://jsonfeed.org/version/1.1') {
    addError('feed.json', `unexpected JSON Feed version: ${feed.version}`);
  }
  requireAbsoluteUrl('feed.json', feed.home_page_url, 'home_page_url');
  requireAbsoluteUrl('feed.json', feed.feed_url, 'feed_url');
  requireAbsoluteUrl('feed.json', feed.icon, 'icon');
  requireAbsoluteUrl('feed.json', feed.favicon, 'favicon');

  const items = Array.isArray(feed.items) ? feed.items : [];
  const contentUrls = new Set([
    ...(content.writing ?? []).map((entry) => entry.url),
    ...(content.gallery ?? []).map((entry) => entry.url),
  ]);

  if (items.length !== contentUrls.size) {
    addError('feed.json', `items length is ${items.length}, expected ${contentUrls.size}`);
  }

  const feedUrls = new Set();
  for (const item of items) {
    const label = `feed.json:${item?.title ?? 'item'}`;
    requireAbsoluteUrl(label, item?.id, 'id');
    requireAbsoluteUrl(label, item?.url, 'url');
    requireString(label, item, 'title');
    requireDateString(label, item?.date_published, 'date_published');
    requireString(label, item?._rapture, 'type');
    feedUrls.add(item?.url);
  }

  for (const url of contentUrls) {
    if (!feedUrls.has(url)) {
      addError('feed.json', `missing content URL from feed items: ${url}`);
    }
  }
}

function validateOpenSearch(xml) {
  requireMatch('opensearch.xml', xml, /<OpenSearchDescription\s+xmlns="http:\/\/a9\.com\/-\/spec\/opensearch\/1\.1\/">/, 'missing OpenSearch 1.1 namespace');
  requireMatch('opensearch.xml', xml, /<ShortName>Rapture<\/ShortName>/, 'missing Rapture short name');
  requireMatch('opensearch.xml', xml, /<InputEncoding>UTF-8<\/InputEncoding>/, 'missing UTF-8 input encoding');
  requireMatch('opensearch.xml', xml, /<OutputEncoding>UTF-8<\/OutputEncoding>/, 'missing UTF-8 output encoding');
  requireMatch('opensearch.xml', xml, /<Image[^>]+type="image\/png">https?:\/\/[^<]+\/favicon\.png<\/Image>/, 'missing favicon image');
  requireMatch('opensearch.xml', xml, /<Url\s+type="text\/html"\s+method="get"\s+template="https?:\/\/[^"]+\/search\/\?q=\{searchTerms\}"\s*\/>/, 'missing search URL template');
}

function validateRss(xml, content) {
  requireMatch('rss.xml', xml, /<rss\s+version="2\.0">/, 'missing RSS 2.0 root');
  requireMatch('rss.xml', xml, /<channel>/, 'missing RSS channel');

  const itemCount = countMatches(xml, /<item>/g);
  const writingCount = Array.isArray(content?.writing) ? content.writing.length : 0;
  if (itemCount !== writingCount) {
    addError('rss.xml', `RSS item count is ${itemCount}, expected writing-only count ${writingCount}`);
  }

  for (const post of content?.writing ?? []) {
    if (!xml.includes(post.url)) {
      addError('rss.xml', `missing writing URL: ${post.url}`);
    }
  }

  for (const photo of content?.gallery ?? []) {
    if (xml.includes(photo.url)) {
      addError('rss.xml', `RSS should not include gallery URL: ${photo.url}`);
    }
  }
}

function validateSitemap(xml, content) {
  requireMatch('sitemap.xml', xml, /<urlset\s+xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/, 'missing sitemap namespace');

  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const unique = new Set(urls);
  if (unique.size !== urls.length) {
    addError('sitemap.xml', 'contains duplicate loc entries');
  }

  const requiredUrls = [
    content?.site?.url ? `${content.site.url}/` : undefined,
    content?.site?.url ? `${content.site.url}/blog/` : undefined,
    content?.site?.url ? `${content.site.url}/gallery/` : undefined,
    content?.site?.url ? `${content.site.url}/archive/` : undefined,
    content?.site?.url ? `${content.site.url}/search/` : undefined,
    ...(content?.writing ?? []).map((entry) => entry.url),
    ...(content?.gallery ?? []).map((entry) => entry.url),
  ].filter(Boolean);

  for (const url of requiredUrls) {
    if (!unique.has(url)) {
      addError('sitemap.xml', `missing URL: ${url}`);
    }
  }

  if ([...unique].some((url) => url.includes('/studio/'))) {
    addError('sitemap.xml', 'should not include hidden Studio route');
  }
}

function validateRobots(text) {
  requireMatch('robots.txt', text, /^User-agent: \*/m, 'missing User-agent rule');
  requireMatch('robots.txt', text, /^Sitemap: https?:\/\/.+\/sitemap\.xml$/m, 'missing absolute sitemap URL');
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') return;
  requireString('site.webmanifest', manifest, 'name');
  requireString('site.webmanifest', manifest, 'short_name');
  if (manifest.display !== 'standalone') {
    addError('site.webmanifest', `display is ${manifest.display}, expected standalone`);
  }
  if (!Array.isArray(manifest.icons) || manifest.icons.length < 3) {
    addError('site.webmanifest', 'expected at least 3 manifest icons');
  }
}

function validateSkipLinks() {
  const htmlFiles = collectFiles(distDir).filter((filePath) => filePath.endsWith('.html'));

  for (const filePath of htmlFiles) {
    const relativePath = relativeToDist(filePath);
    const html = readFileSync(filePath, 'utf8');
    requireMatch(relativePath, html, /<a\s+class="skip-link"\s+href="#main-content">Skip to content<\/a>/, 'missing skip link');
    requireMatch(relativePath, html, /<main\b[^>]*\bid="main-content"[^>]*\btabindex="-1"/, 'missing focusable main content target');
  }
}

function validateInternalLinks(content) {
  const htmlFiles = collectFiles(distDir).filter((filePath) => filePath.endsWith('.html'));
  const siteOrigin = originFromSite(content?.site?.url);

  for (const filePath of htmlFiles) {
    const relativePath = relativeToDist(filePath);
    const html = readFileSync(filePath, 'utf8');
    const links = extractUrlAttributes(html);

    for (const link of links) {
      const resolved = resolveInternalUrl(link.value, relativePath, siteOrigin);
      if (!resolved) continue;

      const target = resolveDistTarget(resolved.pathname);
      if (!target) {
        addError(relativePath, `${link.attribute} points to a missing internal path: ${link.value}`);
        continue;
      }

      if (resolved.hash && target.filePath.endsWith('.html')) {
        const targetHtml = readFileSync(target.filePath, 'utf8');
        if (!hasHtmlAnchor(targetHtml, resolved.hash)) {
          addError(relativePath, `${link.attribute} points to a missing anchor: ${link.value}`);
        }
      }
    }
  }
}

function validateImages() {
  const htmlFiles = collectFiles(distDir).filter((filePath) => filePath.endsWith('.html'));

  for (const filePath of htmlFiles) {
    const relativePath = relativeToDist(filePath);
    const html = readFileSync(filePath, 'utf8');
    const images = extractTags(html, 'img');

    for (const image of images) {
      const attributes = parseAttributes(image.tag);
      const src = attributes.src ?? '(missing src)';

      if (!Object.hasOwn(attributes, 'alt')) {
        addError(relativePath, `image is missing alt text: ${src}`);
        continue;
      }

      if (attributes.alt === '' && !isInsideAriaHidden(html, image.index)) {
        addError(relativePath, `image has empty alt outside an aria-hidden container: ${src}`);
      }
    }
  }
}

function validatePublicCopy() {
  const bannedPhrases = [
    'replace the sample',
    'sample sources',
    'your own images',
    'for testing chapters',
    'placeholder content',
    'rented template',
  ];

  const publicHtmlFiles = collectFiles(distDir)
    .filter((filePath) => filePath.endsWith('.html'))
    .filter((filePath) => !relativeToDist(filePath).startsWith('studio/'));

  for (const filePath of publicHtmlFiles) {
    const text = readFileSync(filePath, 'utf8').toLowerCase();
    for (const phrase of bannedPhrases) {
      if (text.includes(phrase)) {
        addError(relativeToDist(filePath), `public copy contains staging phrase: ${phrase}`);
      }
    }
  }
}

function requireDistFile(filePath) {
  const absolutePath = path.join(distDir, filePath);
  if (!existsSync(absolutePath)) {
    addError(filePath, 'missing generated file');
  }
}

function readText(filePath) {
  const absolutePath = path.join(distDir, filePath);
  if (!existsSync(absolutePath)) return '';
  return readFileSync(absolutePath, 'utf8');
}

function readJson(filePath) {
  const text = readText(filePath);
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch (error) {
    addError(filePath, `invalid JSON: ${error.message}`);
    return undefined;
  }
}

function extractUrlAttributes(html) {
  const links = [];
  const pattern = /\b(href|src)=("([^"]*)"|'([^']*)')/gi;
  let match;

  while ((match = pattern.exec(html))) {
    links.push({
      attribute: match[1].toLowerCase(),
      value: decodeHtmlAttribute(match[3] ?? match[4] ?? ''),
    });
  }

  return links;
}

function extractTags(html, tagName) {
  const tags = [];
  const pattern = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  let match;

  while ((match = pattern.exec(html))) {
    tags.push({
      tag: match[0],
      index: match.index,
    });
  }

  return tags;
}

function parseAttributes(tag) {
  const attributes = {};
  const pattern = /\s([:\w-]+)(?:=("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;

  while ((match = pattern.exec(tag))) {
    const name = match[1].toLowerCase();
    const value = match[3] ?? match[4] ?? match[5] ?? '';
    attributes[name] = decodeHtmlAttribute(value);
  }

  return attributes;
}

function isInsideAriaHidden(html, index) {
  const before = html.slice(0, index);
  const openIndex = before.lastIndexOf('<');
  const closeIndex = before.lastIndexOf('>');

  if (openIndex > closeIndex && /<[^>]+\saria-hidden=("true"|'true')/i.test(before.slice(openIndex))) {
    return true;
  }

  const hiddenOpenIndex = before.search(/<[^/!][^>]*\saria-hidden=("true"|'true')[^>]*>/i);
  if (hiddenOpenIndex < 0) return false;

  const hiddenStack = [];
  const tagPattern = /<\/?([a-z][\w:-]*)\b[^>]*>/gi;
  let match;

  while ((match = tagPattern.exec(before))) {
    const [raw, tagName] = match;
    if (raw.startsWith('</')) {
      const lastIndex = hiddenStack.lastIndexOf(tagName.toLowerCase());
      if (lastIndex >= 0) hiddenStack.splice(lastIndex, 1);
      continue;
    }

    if (/\saria-hidden=("true"|'true')/i.test(raw) && !raw.endsWith('/>')) {
      hiddenStack.push(tagName.toLowerCase());
    }
  }

  return hiddenStack.length > 0;
}

function decodeHtmlAttribute(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'");
}

function originFromSite(value) {
  if (typeof value !== 'string') return undefined;

  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function resolveInternalUrl(value, sourceHtmlPath, siteOrigin) {
  if (!value || value.startsWith('mailto:') || value.startsWith('tel:') || value.startsWith('javascript:') || value.startsWith('data:') || value.startsWith('blob:')) {
    return undefined;
  }

  try {
    const sourceDirectory = path.posix.dirname(`/${sourceHtmlPath}`);
    const basePath = sourceDirectory === '/' ? '/' : `${sourceDirectory}/`;
    const url = new URL(value, `https://rapture.local${basePath}`);

    if (url.origin !== 'https://rapture.local' && url.origin !== siteOrigin) {
      return undefined;
    }

    return {
      pathname: safeDecodePath(url.pathname),
      hash: url.hash ? safeDecodePath(url.hash.slice(1)) : '',
    };
  } catch {
    addError(sourceHtmlPath, `contains an invalid URL attribute: ${value}`);
    return undefined;
  }
}

function safeDecodePath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function resolveDistTarget(pathname) {
  const cleanPath = pathname.replace(/^\/+/, '');
  const directPath = path.join(distDir, cleanPath);

  if (pathname.endsWith('/')) {
    const indexPath = path.join(directPath, 'index.html');
    return existsSync(indexPath) ? { filePath: indexPath } : undefined;
  }

  if (existsSync(directPath)) {
    return { filePath: directPath };
  }

  if (!path.posix.extname(pathname)) {
    const indexPath = path.join(directPath, 'index.html');
    return existsSync(indexPath) ? { filePath: indexPath } : undefined;
  }

  return undefined;
}

function hasHtmlAnchor(html, rawAnchor) {
  if (!rawAnchor) return true;

  const anchor = escapeRegExp(rawAnchor);
  return new RegExp(`\\b(?:id|name)=["']${anchor}["']`, 'i').test(html);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function requireString(label, object, field) {
  if (!object || typeof object[field] !== 'string' || !object[field].trim()) {
    addError(label, `missing or invalid string field: ${field}`);
  }
}

function requirePositiveNumber(label, object, field) {
  if (!object || typeof object[field] !== 'number' || object[field] <= 0) {
    addError(label, `missing or invalid positive number field: ${field}`);
  }
}

function requireDateString(label, value, field) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    addError(label, `missing or invalid date field: ${field}`);
  }
}

function requireAbsoluteUrl(label, value, field) {
  if (typeof value !== 'string') {
    addError(label, `missing URL field: ${field}`);
    return;
  }
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      addError(label, `${field} must be an http(s) URL: ${value}`);
    }
  } catch {
    addError(label, `${field} must be an absolute URL: ${value}`);
  }
}

function requireMatch(filePath, text, pattern, message) {
  if (!pattern.test(text)) {
    addError(filePath, message);
  }
}

function countMatches(text, pattern) {
  return (text.match(pattern) ?? []).length;
}

function collectFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(filePath);
    if (entry.isFile()) return [filePath];
    return [];
  });
}

function relativeToDist(filePath) {
  return path.relative(distDir, filePath).replaceAll(path.sep, '/');
}

function addError(filePath, message) {
  errors.push(`${filePath}: ${message}`);
}

function report() {
  if (errors.length) {
    console.error('\nErrors:');
    errors.forEach((error) => console.error(`- ${error}`));
    console.error(`\npublic output validation failed: ${errors.length} error(s)`);
    process.exit(1);
  }

  const content = readJson('content.json');
  const writingCount = Array.isArray(content?.writing) ? content.writing.length : 0;
  const galleryCount = Array.isArray(content?.gallery) ? content.gallery.length : 0;
  console.log(`public output validation passed: ${writingCount} writing item(s), ${galleryCount} gallery item(s), feeds and discovery checked`);
}
