#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const blogDir = path.join(rootDir, 'src', 'content', 'blog');
const photosDir = path.join(rootDir, 'src', 'content', 'photos');
const publicDir = path.join(rootDir, 'public');
const options = parseArgs(process.argv.slice(2));
const errors = [];
const warnings = [];

const blogFiles = collectMdx(blogDir);
const photoFiles = collectMdx(photosDir);

const seenPhotoSources = new Map();

validateUniqueSlugs(blogFiles, 'blog');
validateUniqueSlugs(photoFiles, 'photos');

for (const filePath of blogFiles) {
  validateBlog(filePath);
}

for (const filePath of photoFiles) {
  await validatePhoto(filePath);
}

validatePublicAssets();

report();

function validateBlog(filePath) {
  const entry = readEntry(filePath);
  const data = entry.data;

  requireString(filePath, data, 'title');
  requireString(filePath, data, 'description');
  requireDate(filePath, data, 'date');

  if (data.updated !== undefined) {
    requireDate(filePath, data, 'updated');
  }

  if (data.sourceKey !== undefined) {
    requireSourceKey(filePath, data.sourceKey);
  }

  if (data.tags === undefined) {
    addError(filePath, 'missing required field: tags');
  } else if (!Array.isArray(data.tags)) {
    addError(filePath, 'tags must be an array');
  } else if (data.tags.some((tag) => typeof tag !== 'string' || !tag.trim())) {
    addError(filePath, 'tags must contain non-empty strings');
  }

  if (data.cover !== undefined) {
    validateImageSource(filePath, data.cover, 'cover');
    if (!data.coverAlt) {
      addWarning(filePath, 'cover is present without coverAlt');
    }
  }

  if (!entry.body.trim()) {
    addWarning(filePath, 'post body is empty');
  }
}

async function validatePhoto(filePath) {
  const entry = readEntry(filePath);
  const data = entry.data;

  requireString(filePath, data, 'title');
  requireString(filePath, data, 'location');
  requireDate(filePath, data, 'date');
  requireString(filePath, data, 'tone');
  requireString(filePath, data, 'src');
  requirePositiveInteger(filePath, data, 'width');
  requirePositiveInteger(filePath, data, 'height');

  if (!data.alt) {
    addWarning(filePath, 'photo is missing alt text');
  }

  if (typeof data.src !== 'string') {
    return;
  }

  validateImageSource(filePath, data.src, 'src');

  if (seenPhotoSources.has(data.src)) {
    addError(filePath, `duplicate photo src also used by ${seenPhotoSources.get(data.src)}`);
  } else {
    seenPhotoSources.set(data.src, relative(filePath));
  }

  const expected = {
    width: Number(data.width),
    height: Number(data.height),
  };

  if (!Number.isInteger(expected.width) || !Number.isInteger(expected.height)) {
    return;
  }

  const actual = await resolveImageSize(data.src, filePath);
  if (!actual) return;

  if (actual.width !== expected.width || actual.height !== expected.height) {
    addError(
      filePath,
      `image dimensions mismatch for ${data.src}: frontmatter ${expected.width}x${expected.height}, actual ${actual.width}x${actual.height}`,
    );
  }
}

function readEntry(filePath) {
  const text = readFileSync(filePath, 'utf8');
  const parsed = splitFrontmatter(text);
  if (!parsed.hasFrontmatter) {
    addError(filePath, 'missing frontmatter fence');
  }
  return parsed;
}

function validatePublicAssets() {
  const manifestPath = path.join(publicDir, 'site.webmanifest');
  requirePublicFile('site.webmanifest');
  requirePublicFile('favicon.png');
  requirePublicFile('favicon.svg');
  validatePublicImage('og-image.png', { width: 1200, height: 630 });

  if (!existsSync(manifestPath)) {
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    addError(manifestPath, `site.webmanifest is not valid JSON: ${error.message}`);
    return;
  }

  requireManifestString(manifestPath, manifest, 'name');
  requireManifestString(manifestPath, manifest, 'short_name');
  requireManifestString(manifestPath, manifest, 'start_url');
  requireManifestString(manifestPath, manifest, 'display');
  requireManifestString(manifestPath, manifest, 'theme_color');
  requireManifestString(manifestPath, manifest, 'background_color');

  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    addError(manifestPath, 'manifest must include at least one icon');
    return;
  }

  const requiredIconSizes = new Set(['180x180', '192x192', '512x512']);
  for (const icon of manifest.icons) {
    if (!icon || typeof icon !== 'object') {
      addError(manifestPath, 'manifest icons must be objects');
      continue;
    }

    if (typeof icon.src !== 'string' || !icon.src.startsWith('/')) {
      addError(manifestPath, `manifest icon src must be an absolute public path: ${icon.src}`);
      continue;
    }

    const iconPath = icon.src.slice(1);
    requirePublicFile(iconPath);

    if (icon.type === 'image/png' && typeof icon.sizes === 'string') {
      const expected = parseIconSize(icon.sizes);
      if (expected) {
        validatePublicImage(iconPath, expected);
        requiredIconSizes.delete(icon.sizes);
      }
    }
  }

  for (const size of requiredIconSizes) {
    addError(manifestPath, `manifest is missing required PNG icon size: ${size}`);
  }
}

function requireManifestString(filePath, manifest, field) {
  if (typeof manifest[field] !== 'string' || !manifest[field].trim()) {
    addError(filePath, `manifest missing or invalid string field: ${field}`);
  }
}

function parseIconSize(value) {
  const match = value.match(/^(\d+)x(\d+)$/);
  if (!match) return undefined;
  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

function requirePublicFile(publicPath) {
  const filePath = path.join(publicDir, publicPath);
  if (!existsSync(filePath)) {
    addError(filePath, `missing public asset: /${publicPath}`);
  }
}

function validatePublicImage(publicPath, expected) {
  const filePath = path.join(publicDir, publicPath);
  if (!existsSync(filePath)) {
    addError(filePath, `missing public image: /${publicPath}`);
    return;
  }

  const actual = readImageSize(readFileSync(filePath));
  if (!actual) {
    addError(filePath, `unsupported public image format: /${publicPath}`);
    return;
  }

  if (actual.width !== expected.width || actual.height !== expected.height) {
    addError(filePath, `public image dimensions mismatch for /${publicPath}: expected ${expected.width}x${expected.height}, actual ${actual.width}x${actual.height}`);
  }
}

function splitFrontmatter(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return { hasFrontmatter: false, data: {}, body: text };
  }

  const end = normalized.indexOf('\n---\n', 4);
  if (end < 0) {
    return { hasFrontmatter: false, data: {}, body: text };
  }

  return {
    hasFrontmatter: true,
    data: parseFrontmatter(normalized.slice(4, end)),
    body: normalized.slice(end + 5),
  };
}

function parseFrontmatter(raw) {
  const data = {};
  for (const rawLine of raw.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    const value = match[2].trim();
    data[key] = parseValue(value);
  }
  return data;
}

function parseValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);

  if (value.startsWith('[') && value.endsWith(']')) {
    try {
      return JSON.parse(value);
    } catch {
      return value
        .slice(1, -1)
        .split(',')
        .map((entry) => unquote(entry.trim()))
        .filter(Boolean);
    }
  }

  return unquote(value);
}

function unquote(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function validateImageSource(filePath, value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    addError(filePath, `${field} must be a non-empty string`);
    return;
  }

  if (value.startsWith('/')) {
    const localPath = path.join(publicDir, value);
    if (!existsSync(localPath)) {
      addError(filePath, `${field} points to a missing public file: ${value}`);
    }
    return;
  }

  try {
    new URL(value);
  } catch {
    addError(filePath, `${field} must be a public path or full URL: ${value}`);
  }
}

async function resolveImageSize(src, filePath) {
  if (src.startsWith('/')) {
    const localPath = path.join(publicDir, src);
    if (!existsSync(localPath)) return undefined;
    const size = readImageSize(readFileSync(localPath));
    if (!size) {
      addError(filePath, `unsupported local image format: ${src}`);
    }
    return size;
  }

  if (!options.remote) return undefined;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(src, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'RaptureContentValidator/1.0',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      addError(filePath, `remote image returned ${response.status}: ${src}`);
      return undefined;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const size = readImageSize(buffer);
    if (!size) {
      addError(filePath, `unsupported remote image format: ${src}`);
    }
    return size;
  } catch (error) {
    addError(filePath, `failed to fetch remote image ${src}: ${error.message}`);
    return undefined;
  }
}

function readImageSize(buffer) {
  if (buffer.length > 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      const marker = buffer[offset + 1];
      if (marker === 0xd9 || marker === 0xda) break;
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

function requireString(filePath, data, field) {
  if (typeof data[field] !== 'string' || !data[field].trim()) {
    addError(filePath, `missing or invalid string field: ${field}`);
  }
}

function requireDate(filePath, data, field) {
  if (typeof data[field] !== 'string' || Number.isNaN(Date.parse(data[field]))) {
    addError(filePath, `missing or invalid date field: ${field}`);
  }
}

function requirePositiveInteger(filePath, data, field) {
  if (!Number.isInteger(data[field]) || data[field] <= 0) {
    addError(filePath, `missing or invalid positive integer field: ${field}`);
  }
}

function requireSourceKey(filePath, value) {
  if (typeof value !== 'string' || !/^sha256:[a-f0-9]{16}$/.test(value)) {
    addError(filePath, 'sourceKey must use the Obsidian importer hash format: sha256:<16 lowercase hex chars>');
  }
}

function collectMdx(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.mdx?$/i.test(entry.name))
    .map((entry) => path.join(directory, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

function validateUniqueSlugs(files, collectionName) {
  const seen = new Set();
  for (const filePath of files) {
    const slug = path.basename(filePath, path.extname(filePath));
    if (seen.has(slug)) {
      addError(filePath, `duplicate ${collectionName} slug: ${slug}`);
    }
    seen.add(slug);
  }
}

function parseArgs(values) {
  return {
    remote: values.includes('--remote'),
  };
}

function addError(filePath, message) {
  errors.push(`${relative(filePath)}: ${message}`);
}

function addWarning(filePath, message) {
  warnings.push(`${relative(filePath)}: ${message}`);
}

function relative(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, '/');
}

function report() {
  if (warnings.length) {
    console.warn('\nWarnings:');
    warnings.forEach((warning) => console.warn(`- ${warning}`));
  }

  if (errors.length) {
    console.error('\nErrors:');
    errors.forEach((error) => console.error(`- ${error}`));
    console.error(`\ncontent validation failed: ${errors.length} error(s), ${warnings.length} warning(s)`);
    process.exit(1);
  }

  const remoteNote = options.remote ? 'remote image dimensions checked' : 'remote image dimensions skipped';
  console.log(`content validation passed: ${blogFiles.length} post(s), ${photoFiles.length} photo(s), ${warnings.length} warning(s); ${remoteNote}`);
}
