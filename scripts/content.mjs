#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const blogDir = path.join(rootDir, 'src', 'content', 'blog');
const photosDir = path.join(rootDir, 'src', 'content', 'photos');
const publicDir = path.join(rootDir, 'public');

const command = process.argv[2];
const args = parseArgs(process.argv.slice(3));

try {
  if (command === 'post') {
    createPost(args);
  } else if (command === 'photo') {
    createPhoto(args);
  } else if (command === 'import-post') {
    importPost(args);
  } else if (command === 'import-posts') {
    importPosts(args);
  } else if (command === 'import-photos') {
    importPhotos(args);
  } else if (command === 'normalize-posts') {
    normalizePosts();
  } else {
    printUsage();
    process.exit(command ? 1 : 0);
  }
} catch (error) {
  console.error(`\n${error.message}`);
  process.exit(1);
}

function parseArgs(values) {
  const result = { _: [] };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (!value.startsWith('--')) {
      result._.push(value);
      continue;
    }

    const withoutPrefix = value.slice(2);
    const equalIndex = withoutPrefix.indexOf('=');

    if (equalIndex >= 0) {
      const key = toCamelCase(withoutPrefix.slice(0, equalIndex));
      result[key] = withoutPrefix.slice(equalIndex + 1);
      continue;
    }

    const key = toCamelCase(withoutPrefix);
    const next = values[index + 1];
    if (!next || next.startsWith('--')) {
      result[key] = true;
    } else {
      result[key] = next;
      index += 1;
    }
  }

  return result;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function createPost(options) {
  const title = required(options.title, '--title is required');
  const date = options.date ?? today();
  const slug = uniqueSlug(blogDir, options.slug ?? title);
  const destination = path.join(blogDir, `${slug}.mdx`);
  const description = options.description ?? 'A note from below the surface.';
  const tags = list(options.tags, ['note']);
  const draft = options.publish ? false : options.draft !== false;
  const body = options.body ?? 'Write from the room behind the glass.';

  const content = [
    '---',
    line('title', title),
    line('description', description),
    dateLine('date', date),
    arrayLine('tags', tags),
    options.cover ? line('cover', options.cover) : undefined,
    options.coverAlt ? line('coverAlt', options.coverAlt) : undefined,
    line('draft', draft),
    '---',
    '',
    body,
    '',
  ].filter(Boolean).join('\n');

  ensureDirectory(blogDir);
  writeFileSync(destination, content, 'utf8');
  report(destination, draft ? 'draft post created' : 'published post created');
}

function createPhoto(options) {
  const title = required(options.title, '--title is required');
  const src = required(options.src, '--src is required');
  const date = options.date ?? today();
  const slug = uniqueSlug(photosDir, options.slug ?? title);
  const destination = path.join(photosDir, `${slug}.mdx`);
  const dimensions = resolveDimensions(src, options.width, options.height);
  const draft = options.publish ? false : options.draft !== false;
  const body = options.note ?? 'A frame held below the surface.';

  const content = [
    '---',
    line('title', title),
    line('location', options.location ?? 'Unknown'),
    dateLine('date', date),
    line('src', src),
    line('width', dimensions.width),
    line('height', dimensions.height),
    line('tone', options.tone ?? 'quiet pressure'),
    options.alt ? line('alt', options.alt) : undefined,
    line('draft', draft),
    '---',
    '',
    body,
    '',
  ].filter(Boolean).join('\n');

  ensureDirectory(photosDir);
  writeFileSync(destination, content, 'utf8');
  report(destination, draft ? 'draft photo entry created' : 'published photo entry created');
}

function importPost(options) {
  const source = required(options.from, '--from is required');
  const sourcePath = path.resolve(process.cwd(), source);

  const result = writeImportedPost(sourcePath, options, {
    sourceKey: sourceKey(sourcePath),
  });

  report(result.destination, result.draft ? 'Obsidian post imported as draft' : 'Obsidian post imported as published');
}

function importPosts(options) {
  const source = required(options.from, '--from is required');
  const sourceDirectory = path.resolve(process.cwd(), source);

  if (!existsSync(sourceDirectory)) {
    throw new Error(`Source directory does not exist: ${sourceDirectory}`);
  }

  if (!statSync(sourceDirectory).isDirectory()) {
    throw new Error(`--from must point to a directory for batch imports: ${sourceDirectory}`);
  }

  const files = collectMarkdownFiles(sourceDirectory);
  if (files.length === 0) {
    throw new Error(`No Markdown or MDX notes found under: ${sourceDirectory}`);
  }

  const existingSourceKeys = readExistingPostSourceKeys();
  let imported = 0;
  let skipped = 0;

  for (const sourcePath of files) {
    const key = sourceKey(sourcePath);
    if (existingSourceKeys.has(key) && !options.force) {
      skipped += 1;
      continue;
    }

    const result = writeImportedPost(sourcePath, options, {
      sourceKey: key,
    });
    existingSourceKeys.set(key, relative(result.destination));
    imported += 1;
    report(result.destination, result.draft ? 'Obsidian draft imported' : 'Obsidian post published');
  }

  console.log(`Obsidian folder import complete: ${imported} imported, ${skipped} skipped`);
}

function normalizePosts() {
  ensureDirectory(blogDir);

  const files = collectMarkdownFiles(blogDir);
  let changed = 0;
  let unchanged = 0;

  for (const filePath of files) {
    const original = readFileSync(filePath, 'utf8');
    const normalized = normalizePostContent(filePath, original);

    if (normalized === original) {
      unchanged += 1;
      continue;
    }

    writeFileSync(filePath, normalized, 'utf8');
    changed += 1;
    report(filePath, 'Obsidian post normalized');
  }

  console.log(`post normalization complete: ${changed} updated, ${unchanged} unchanged`);
}

function normalizePostContent(filePath, text) {
  const parsed = splitFrontmatter(text);
  const data = parsed.data;

  if (hasValidPostFrontmatter(data)) {
    return text;
  }

  const body = parsed.body.trim();
  const title = cleanText(data.title) ?? firstHeading(body) ?? titleFromFile(filePath);
  const existingDescription = cleanText(data.description);
  const description = existingDescription && !isTableLikeText(existingDescription)
    ? existingDescription
    : firstParagraph(body) ?? title;
  const tags = list(data.tags, ['note']);
  const date = normalizeDate(data.date, fileDate(filePath));
  const updated = data.updated ? normalizeDate(data.updated) : undefined;
  const draft = normalizeBoolean(data.draft, false);
  const cover = cleanText(data.cover);
  const coverAlt = cleanText(data.coverAlt);
  const sourceKeyValue = cleanText(data.sourceKey);

  return [
    '---',
    line('title', title),
    line('description', description),
    dateLine('date', date),
    updated ? dateLine('updated', updated) : undefined,
    arrayLine('tags', tags),
    cover ? line('cover', cover) : undefined,
    coverAlt ? line('coverAlt', coverAlt) : undefined,
    line('draft', draft),
    sourceKeyValue ? line('sourceKey', sourceKeyValue) : undefined,
    '---',
    '',
    body,
    '',
  ].filter((lineValue) => lineValue !== undefined).join('\n');
}

function hasValidPostFrontmatter(data) {
  const description = cleanText(data.description);

  return Boolean(
    cleanText(data.title) &&
    description &&
    !isTableLikeText(description) &&
    normalizeDate(data.date) &&
    Array.isArray(list(data.tags, [])) &&
    list(data.tags, []).length > 0,
  );
}

function writeImportedPost(sourcePath, options, metadata = {}) {
  if (!existsSync(sourcePath)) {
    throw new Error(`Source file does not exist: ${sourcePath}`);
  }

  const sourceText = readFileSync(sourcePath, 'utf8');
  const parsed = splitFrontmatter(sourceText);
  const sourceTitle = options.title ?? parsed.data.title ?? firstHeading(parsed.body) ?? titleFromFile(sourcePath);
  const description = options.description ?? parsed.data.description ?? firstParagraph(parsed.body) ?? 'A note from below the surface.';
  const date = options.date ?? parsed.data.date ?? today();
  const tags = list(options.tags ?? parsed.data.tags, ['note']);
  const draft = options.publish ? false : options.draft !== false;
  const slug = uniqueSlug(blogDir, options.slug ?? sourceTitle);
  const destination = path.join(blogDir, `${slug}.mdx`);
  const cover = options.cover ?? parsed.data.cover;
  const coverAlt = options.coverAlt ?? parsed.data.coverAlt;

  const content = [
    '---',
    line('title', sourceTitle),
    line('description', description),
    dateLine('date', date),
    arrayLine('tags', tags),
    cover ? line('cover', cover) : undefined,
    coverAlt ? line('coverAlt', coverAlt) : undefined,
    line('draft', draft),
    metadata.sourceKey ? line('sourceKey', metadata.sourceKey) : undefined,
    '---',
    '',
    parsed.body.trim(),
    '',
  ].filter(Boolean).join('\n');

  ensureDirectory(blogDir);
  writeFileSync(destination, content, 'utf8');
  return { destination, draft };
}

function importPhotos(options) {
  const sourceInput = options.from ?? 'public/photos';
  const sourceDirectory = path.resolve(rootDir, sourceInput);
  const publicRoot = path.resolve(publicDir);

  if (!existsSync(sourceDirectory)) {
    throw new Error(`Photo directory does not exist: ${sourceDirectory}`);
  }

  if (!isInside(sourceDirectory, publicRoot)) {
    throw new Error('--from must point to a directory under public/ so generated src paths can be served statically');
  }

  const files = collectImageFiles(sourceDirectory);
  if (files.length === 0) {
    throw new Error(`No PNG, JPG, JPEG, or WebP files found under: ${sourceDirectory}`);
  }

  const existingSources = readExistingPhotoSources();
  let created = 0;
  let skipped = 0;

  ensureDirectory(photosDir);

  files.forEach((filePath) => {
    const src = publicPath(filePath);
    if (existingSources.has(src) && !options.force) {
      skipped += 1;
      return;
    }

    const dimensions = readImageSize(filePath);
    if (!dimensions) {
      skipped += 1;
      console.warn(`skipped unsupported image dimensions: ${src}`);
      return;
    }

    const title = titleFromFile(filePath);
    const slug = uniqueSlug(photosDir, title);
    const destination = path.join(photosDir, `${slug}.mdx`);
    const draft = options.publish ? false : options.draft !== false;
    const content = [
      '---',
      line('title', title),
      line('location', options.location ?? 'Unsorted'),
      dateLine('date', options.date ?? today()),
      line('src', src),
      line('width', dimensions.width),
      line('height', dimensions.height),
      line('tone', options.tone ?? 'uncatalogued light'),
      line('alt', options.alt ?? `${title}.`),
      line('draft', draft),
      '---',
      '',
      options.note ?? 'A frame waiting for its pressure note.',
      '',
    ].join('\n');

    writeFileSync(destination, content, 'utf8');
    existingSources.add(src);
    created += 1;
    report(destination, draft ? 'draft photo imported' : 'published photo imported');
  });

  console.log(`photo import complete: ${created} created, ${skipped} skipped`);
}

function splitFrontmatter(text) {
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) {
    return { data: {}, body: text };
  }

  const normalized = text.replace(/\r\n/g, '\n');
  const end = normalized.indexOf('\n---\n', 4);
  if (end < 0) {
    return { data: {}, body: text };
  }

  const raw = normalized.slice(4, end);
  const body = normalized.slice(end + 5);
  return { data: parseSimpleFrontmatter(raw), body };
}

function parseSimpleFrontmatter(raw) {
  const data = {};
  for (const rawLine of raw.split('\n')) {
    const match = rawLine.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!match) continue;

    const key = toCamelCase(match[1]);
    const value = match[2].trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = value
        .slice(1, -1)
        .split(',')
        .map((entry) => unquote(entry.trim()))
        .filter(Boolean);
    } else {
      data[key] = unquote(value);
    }
  }

  return data;
}

function unquote(value) {
  if (!value) return value;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function firstHeading(body) {
  const match = body.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim();
}

function firstParagraph(body) {
  return body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .find((block) => block && !block.startsWith('#') && !block.startsWith('```') && !isMarkdownTable(block) && !isTableLikeText(block))
    ?.replace(/\s+/g, ' ')
    .slice(0, 180);
}

function isMarkdownTable(block) {
  const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.length >= 2 && lines.every((line) => line.startsWith('|') && line.endsWith('|'));
}

function isTableLikeText(value) {
  const text = cleanText(value);
  if (!text) return false;

  const normalized = text.replace(/^["']|["']$/g, '').trim();
  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return false;

  const pipeLines = lines.filter((line) => line.startsWith('|') || line.includes(' | '));
  return normalized.startsWith('|') || normalized.split('|').length > 4 || pipeLines.length / lines.length >= 0.5;
}

function titleFromFile(filePath) {
  return path.basename(filePath, path.extname(filePath)).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanText(value) {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text || undefined;
}

function normalizeBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function normalizeDate(value, fallback) {
  const text = cleanText(value);
  if (!text) return fallback;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.valueOf())) return fallback;
  return formatDate(parsed);
}

function fileDate(filePath) {
  return formatDate(statSync(filePath).mtime);
}

function formatDate(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveDimensions(src, widthInput, heightInput) {
  const width = number(widthInput);
  const height = number(heightInput);

  if (width && height) {
    return { width, height };
  }

  const localPath = localImagePath(src);
  if (localPath && existsSync(localPath)) {
    const size = readImageSize(localPath);
    if (size) {
      return size;
    }
  }

  throw new Error('--width and --height are required unless --src points to a local PNG or JPG under public/');
}

function localImagePath(src) {
  if (!src.startsWith('/')) return undefined;
  return path.join(publicDir, src);
}

function readImageSize(filePath) {
  const buffer = readFileSync(filePath);

  if (buffer.length > 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      const isStartOfFrame = marker >= 0xc0 && marker <= 0xc3;
      if (isStartOfFrame) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }

      offset += 2 + length;
    }
  }

  if (buffer.length > 30 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    const chunkType = buffer.toString('ascii', 12, 16);
    if (chunkType === 'VP8X') {
      return {
        width: 1 + buffer.readUIntLE(24, 3),
        height: 1 + buffer.readUIntLE(27, 3),
      };
    }

    if (chunkType === 'VP8 ' && buffer.length > 30) {
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      };
    }

    if (chunkType === 'VP8L' && buffer.length > 25) {
      const bits = buffer.readUInt32LE(21);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
  }

  return undefined;
}

function collectImageFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectImageFiles(entryPath);
      if (entry.isFile() && /\.(png|jpe?g|webp)$/i.test(entry.name)) return [entryPath];
      return [];
    })
    .sort((a, b) => a.localeCompare(b));
}

function collectMarkdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectMarkdownFiles(entryPath);
      if (entry.isFile() && /\.mdx?$/i.test(entry.name)) return [entryPath];
      return [];
    })
    .sort((a, b) => a.localeCompare(b));
}

function readExistingPhotoSources() {
  ensureDirectory(photosDir);
  const sources = new Set();
  readdirSync(photosDir, { withFileTypes: true }).forEach((entry) => {
    if (!entry.isFile() || !entry.name.endsWith('.mdx')) return;
    const text = readFileSync(path.join(photosDir, entry.name), 'utf8');
    const parsed = splitFrontmatter(text);
    if (parsed.data.src) sources.add(parsed.data.src);
  });
  return sources;
}

function readExistingPostSourceKeys() {
  ensureDirectory(blogDir);
  const sources = new Map();
  readdirSync(blogDir, { withFileTypes: true }).forEach((entry) => {
    if (!entry.isFile() || !entry.name.endsWith('.mdx')) return;
    const filePath = path.join(blogDir, entry.name);
    const text = readFileSync(filePath, 'utf8');
    const parsed = splitFrontmatter(text);
    if (parsed.data.sourceKey) sources.set(parsed.data.sourceKey, relative(filePath));
  });
  return sources;
}

function sourceKey(filePath) {
  const normalizedPath = path.resolve(filePath).replaceAll(path.sep, '/').toLowerCase();
  return `sha256:${createHash('sha256').update(normalizedPath).digest('hex').slice(0, 16)}`;
}

function publicPath(filePath) {
  const relativePath = path.relative(publicDir, filePath).replaceAll(path.sep, '/');
  return `/${relativePath}`;
}

function isInside(target, parent) {
  const relativePath = path.relative(parent, target);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function list(value, fallback) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return fallback;
}

function required(value, message) {
  if (value === undefined || value === '') {
    throw new Error(message);
  }
  return value;
}

function number(value) {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received: ${value}`);
  }
  return parsed;
}

function line(key, value) {
  if (typeof value === 'boolean' || typeof value === 'number') {
    return `${key}: ${value}`;
  }
  return `${key}: ${JSON.stringify(String(value))}`;
}

function dateLine(key, value) {
  return `${key}: ${String(value)}`;
}

function arrayLine(key, values) {
  return `${key}: [${values.map((value) => JSON.stringify(String(value))).join(', ')}]`;
}

function uniqueSlug(directory, input) {
  const base = slugify(input) || `entry-${today()}`;
  let slug = base;
  let index = 2;
  while (existsSync(path.join(directory, `${slug}.mdx`))) {
    slug = `${base}-${index}`;
    index += 1;
  }
  return slug;
}

function slugify(value) {
  return String(value)
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function today() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function ensureDirectory(directory) {
  mkdirSync(directory, { recursive: true });
}

function relative(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, '/');
}

function report(filePath, message) {
  console.log(`${message}: ${relative(filePath)}`);
}

function printUsage() {
  console.log(`Rapture content tools

Usage:
  npm run new:post -- -- --title "Title" --description "One sentence" --tags "note,frontend" [--publish]
  npm run new:photo -- -- --title "Photo" --src /photos/photo.jpg --location Shanghai --tone "quiet blue"
  npm run import:obsidian -- -- --from "C:/vault/note.md" --tags "note,essay" [--publish]
  npm run import:obsidian:folder -- -- --from "C:/vault/Rapture" --tags "note,essay" [--publish]
  npm run import:photos -- -- --from public/photos --location Shanghai --tone "quiet blue" [--publish]
  npm run normalize:obsidian

Notes:
  - Posts are drafts by default. Add --publish when the entry is ready.
  - Batch Obsidian imports scan nested .md and .mdx files and skip previously imported source files unless --force is set.
  - Obsidian normalization fills missing blog frontmatter before validation and builds.
  - Local photo dimensions are inferred for PNG, JPG, JPEG, and WebP files under public/.
  - Batch photo import skips files whose public src already exists in src/content/photos/.
  - Remote photo URLs need --width and --height.`);
}
