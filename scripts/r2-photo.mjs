#!/usr/bin/env node
import { createHash, createHmac } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const photosDir = path.join(rootDir, 'src', 'content', 'photos');

loadEnvFile(path.join(rootDir, '.env.local'));
loadEnvFile(path.join(rootDir, '.env'));

const args = parseArgs(process.argv.slice(2));

try {
  await createR2Photo(args);
} catch (error) {
  console.error(`\n${error.message}`);
  process.exit(1);
}

async function createR2Photo(options) {
  const sourceInput = options.src ?? options.url ?? options._[0];
  const sourceFile = options.from ?? options.file;

  if (!sourceInput && !sourceFile) {
    throw new Error('--src or --from is required');
  }

  const r2 = readR2Config();
  const source = sourceFile ? readLocalSource(sourceFile) : await fetchRemoteSource(sourceInput);
  const sourceName = options.filename ?? options.fileName ?? source.name;
  const sourceTitle = options.title ?? titleFromName(sourceName);
  const baseSlug = slugify(options.slug ?? sourceTitle) || `photo-${today()}`;
  const metadata = await sharp(source.buffer).rotate().metadata();
  const dimensions = resolveDimensions(metadata);
  const fullKey = sourceInput
    ? keyFromPublicUrl(sourceInput, r2.publicBaseUrl)
    : normalizeObjectKey(options.key ?? `${r2.prefix}/full/${baseSlug}${source.extension}`);
  const src = sourceInput ?? publicUrlForKey(r2.publicBaseUrl, fullKey);

  validatePublicUrl(src, 'src');

  const existingEntries = readExistingPhotoEntries();
  const existingEntry = existingEntries.get(src);
  if (existingEntry && !options.force && !options.updateExisting) {
    throw new Error(`photo source already exists in src/content/photos/: ${src}\nUse --update-existing to add a generated thumb to that entry.`);
  }

  const thumbSize = positiveInteger(options.thumbSize ?? options.thumbWidth ?? process.env.R2_THUMB_SIZE ?? process.env.R2_THUMB_WIDTH ?? 1100, 'thumb size');
  const thumbQuality = positiveInteger(options.thumbQuality ?? process.env.R2_THUMB_QUALITY ?? 78, 'thumb quality');
  const thumbKey = normalizeObjectKey(options.thumbKey ?? deriveThumbKey(fullKey, src, r2.prefix, baseSlug));
  const thumb = options.thumb ?? publicUrlForKey(r2.publicBaseUrl, thumbKey);
  const thumbBuffer = await sharp(source.buffer)
    .rotate()
    .resize({
      width: thumbSize,
      height: thumbSize,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({
      quality: Math.min(100, Math.max(1, thumbQuality)),
      effort: 4,
    })
    .toBuffer();

  if (options.dryRun) {
    console.log(`dry run: source ${src}`);
    console.log(`dry run: thumbnail ${thumb}`);
    console.log(`dry run: source dimensions ${dimensions.width}x${dimensions.height}`);
    console.log(`dry run: thumbnail bytes ${thumbBuffer.byteLength}`);
    return;
  }

  if (sourceFile && !sourceInput) {
    await putR2Object(r2, fullKey, source.buffer, source.contentType);
    console.log(`uploaded full image: ${src}`);
  }

  await putR2Object(r2, thumbKey, thumbBuffer, 'image/webp');
  console.log(`uploaded thumbnail: ${thumb}`);

  if (existingEntry && options.updateExisting) {
    updateExistingPhotoEntry(existingEntry.filePath, { thumb, width: dimensions.width, height: dimensions.height });
    console.log(`updated existing photo entry: ${relative(existingEntry.filePath)}`);
    console.log(`source dimensions: ${dimensions.width}x${dimensions.height}`);
    console.log(`thumbnail settings: ${thumbSize}px WebP q${thumbQuality}`);
    return;
  }

  const title = sourceTitle;
  const slug = uniqueSlug(photosDir, options.slug ?? title);
  const destination = path.join(photosDir, `${slug}.mdx`);
  const draft = options.publish ? false : options.draft !== false;
  const content = [
    '---',
    line('title', title),
    line('location', options.location ?? 'Unsorted'),
    dateLine('date', options.date ?? today()),
    line('src', src),
    line('thumb', thumb),
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

  ensureDirectory(photosDir);
  writeFileSync(destination, content, 'utf8');
  console.log(`${draft ? 'draft R2 photo entry created' : 'published R2 photo entry created'}: ${relative(destination)}`);
  console.log(`source dimensions: ${dimensions.width}x${dimensions.height}`);
  console.log(`thumbnail settings: ${thumbSize}px WebP q${thumbQuality}`);
}

function readR2Config() {
  const configuredEndpoint = process.env.R2_ENDPOINT?.trim();
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = requiredEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = requiredEnv('R2_SECRET_ACCESS_KEY');
  const bucket = requiredEnv('R2_BUCKET');
  const publicBaseUrl = normalizeBaseUrl(requiredEnv('R2_PUBLIC_BASE_URL'));
  const prefix = normalizeObjectKey(process.env.R2_PREFIX ?? 'rapture/gallery');
  const endpoint = normalizeBaseUrl(configuredEndpoint ?? (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : ''));
  if (!endpoint) {
    throw new Error('missing R2_ENDPOINT or R2_ACCOUNT_ID; add one of them to .env.local or your shell environment');
  }
  const host = new URL(endpoint).host;

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl,
    prefix,
    endpoint,
    host,
  };
}

async function putR2Object(config, key, body, contentType) {
  const encodedPath = `/${encodePathSegment(config.bucket)}/${encodeObjectKey(key)}`;
  const url = `${config.endpoint}${encodedPath}`;
  const payloadHash = sha256Hex(body);
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${config.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
    '',
  ].join('\n');
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    'PUT',
    encodedPath,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const signature = hmacHex(getSigningKey(config.secretAccessKey, dateStamp), stringToSign);
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(url, {
    method: 'PUT',
    body,
    headers: {
      Authorization: authorization,
      'Content-Type': contentType,
      'X-Amz-Content-Sha256': payloadHash,
      'X-Amz-Date': amzDate,
    },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`failed to upload ${key} to R2: ${response.status} ${response.statusText}${message ? `\n${message}` : ''}`);
  }
}

function getSigningKey(secretAccessKey, dateStamp) {
  const dateKey = hmac(Buffer.from(`AWS4${secretAccessKey}`, 'utf8'), dateStamp);
  const regionKey = hmac(dateKey, 'auto');
  const serviceKey = hmac(regionKey, 's3');
  return hmac(serviceKey, 'aws4_request');
}

async function fetchRemoteSource(src) {
  validatePublicUrl(src, 'src');

  const response = await fetch(src, {
    headers: {
      'User-Agent': 'RaptureR2Photo/1.0',
    },
  });
  if (!response.ok) {
    throw new Error(`remote image returned ${response.status}: ${src}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = normalizeImageContentType(response.headers.get('content-type'), src);
  return {
    buffer,
    contentType,
    extension: extensionFromContentType(contentType, src),
    name: titleFromUrl(src),
  };
}

function readLocalSource(filePathInput) {
  const filePath = path.resolve(process.cwd(), filePathInput);
  if (!existsSync(filePath)) {
    throw new Error(`local image does not exist: ${filePath}`);
  }

  const buffer = readFileSync(filePath);
  const contentType = normalizeImageContentType(undefined, filePath);
  return {
    buffer,
    contentType,
    extension: path.extname(filePath).toLowerCase(),
    name: path.basename(filePath),
  };
}

function deriveThumbKey(fullKey, src, prefix, fallbackSlug) {
  if (fullKey) {
    const withThumbSegment = fullKey.replace(/(^|\/)full\//, '$1thumb/');
    if (withThumbSegment !== fullKey) {
      return replaceExtension(withThumbSegment, '.webp');
    }
  }

  const name = titleFromUrl(src);
  const base = slugify(path.basename(name, path.extname(name))) || fallbackSlug;
  return `${prefix}/thumb/${base}.webp`;
}

function keyFromPublicUrl(src, publicBaseUrl) {
  try {
    const sourceUrl = new URL(src);
    const baseUrl = new URL(publicBaseUrl);
    if (sourceUrl.origin !== baseUrl.origin) return undefined;

    const basePath = stripSlashes(baseUrl.pathname);
    const sourcePath = stripSlashes(decodeURIComponent(sourceUrl.pathname));
    if (!basePath) return sourcePath;
    if (sourcePath === basePath) return undefined;
    if (sourcePath.startsWith(`${basePath}/`)) return sourcePath.slice(basePath.length + 1);
    return undefined;
  } catch {
    return undefined;
  }
}

function publicUrlForKey(publicBaseUrl, key) {
  const base = normalizeBaseUrl(publicBaseUrl);
  return `${base}/${encodeObjectKey(key)}`;
}

function resolveDimensions(metadata) {
  const width = metadata.width;
  const height = metadata.height;
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new Error('could not read image dimensions');
  }
  return { width, height };
}

function normalizeImageContentType(value, source) {
  const contentType = String(value ?? '').split(';')[0].trim().toLowerCase();
  if (['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
    return contentType;
  }

  const extension = path.extname(URLSafePath(source)).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  throw new Error(`unsupported image type for ${source}; use JPG, PNG, or WebP`);
}

function URLSafePath(value) {
  try {
    return new URL(value).pathname;
  } catch {
    return value;
  }
}

function extensionFromContentType(contentType, source) {
  const existing = path.extname(URLSafePath(source)).toLowerCase();
  if (existing) return existing;
  if (contentType === 'image/jpeg') return '.jpg';
  if (contentType === 'image/png') return '.png';
  if (contentType === 'image/webp') return '.webp';
  return '.jpg';
}

function replaceExtension(value, extension) {
  const parsed = path.posix.parse(value.replaceAll('\\', '/'));
  return path.posix.join(parsed.dir, `${parsed.name}${extension}`);
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
      result[toCamelCase(withoutPrefix.slice(0, equalIndex))] = withoutPrefix.slice(equalIndex + 1);
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

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  for (const rawLine of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const key = match[1];
    const value = unquoteEnv(match[2].trim());
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function unquoteEnv(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function readExistingPhotoEntries() {
  ensureDirectory(photosDir);
  const entries = new Map();
  readdirSync(photosDir, { withFileTypes: true }).forEach((entry) => {
    if (!entry.isFile() || !/\.mdx?$/i.test(entry.name)) return;
    const filePath = path.join(photosDir, entry.name);
    const text = readFileSync(filePath, 'utf8');
    const match = text.match(/\nsrc:\s*["']?([^"'\n]+)["']?/);
    if (match?.[1]) {
      const src = match[1].trim();
      entries.set(src, { filePath, text });
      entries.set(stripUrlSearch(src), { filePath, text });
    }
  });
  return entries;
}

function stripUrlSearch(value) {
  try {
    const url = new URL(value);
    url.search = '';
    url.hash = '';
    return url.href;
  } catch {
    return value;
  }
}

function updateExistingPhotoEntry(filePath, values) {
  let text = readFileSync(filePath, 'utf8');
  text = upsertFrontmatterField(text, 'thumb', values.thumb, 'src');
  text = upsertFrontmatterField(text, 'width', values.width, 'thumb');
  text = upsertFrontmatterField(text, 'height', values.height, 'width');
  writeFileSync(filePath, text, 'utf8');
}

function upsertFrontmatterField(text, key, value, afterKey) {
  const serialized = line(key, value);
  const fieldPattern = new RegExp(`(^|\\n)${escapeRegExp(key)}:\\s*[^\\n]*`);
  if (fieldPattern.test(text)) {
    return text.replace(fieldPattern, `$1${serialized}`);
  }

  const afterPattern = new RegExp(`(^|\\n)${escapeRegExp(afterKey)}:\\s*[^\\n]*`);
  if (afterPattern.test(text)) {
    return text.replace(afterPattern, (match) => `${match}\n${serialized}`);
  }

  return text.replace(/^---\r?\n/, `---\n${serialized}\n`);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function requiredEnv(key) {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`missing ${key}; add it to .env.local or your shell environment`);
  }
  return value;
}

function positiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function validatePublicUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL: ${value}`);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${label} must use http or https: ${value}`);
  }
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

function normalizeObjectKey(value) {
  return stripSlashes(String(value).replaceAll('\\', '/'));
}

function stripSlashes(value) {
  return String(value).replace(/^\/+|\/+$/g, '');
}

function encodeObjectKey(key) {
  return normalizeObjectKey(key).split('/').map(encodePathSegment).join('/');
}

function encodePathSegment(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key, value) {
  return createHmac('sha256', key).update(value).digest();
}

function hmacHex(key, value) {
  return createHmac('sha256', key).update(value).digest('hex');
}

function toAmzDate(value) {
  return value.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function titleFromUrl(value) {
  try {
    const url = new URL(value);
    return decodeURIComponent(path.posix.basename(url.pathname)) || `remote-photo-${today()}`;
  } catch {
    return `remote-photo-${today()}`;
  }
}

function titleFromName(value) {
  return path.basename(String(value), path.extname(String(value))).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
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
