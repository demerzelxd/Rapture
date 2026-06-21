#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');
const errors = [];
const warnings = [];
const placeholderHosts = new Set(['rapture.example.com', 'example.com', 'your-domain.com']);

validateSiteUrl();
validateDistOutput();
report();

function validateSiteUrl() {
  const siteUrl = process.env.PUBLIC_SITE_URL;

  if (!siteUrl) {
    addError('PUBLIC_SITE_URL', 'must be set before a production launch check');
    return;
  }

  let parsed;
  try {
    parsed = new URL(siteUrl);
  } catch {
    addError('PUBLIC_SITE_URL', `must be an absolute URL: ${siteUrl}`);
    return;
  }

  if (parsed.protocol !== 'https:') {
    addError('PUBLIC_SITE_URL', `must use https: ${siteUrl}`);
  }

  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    addError('PUBLIC_SITE_URL', `must be an origin only, without path/query/hash: ${siteUrl}`);
  }

  if (placeholderHosts.has(parsed.hostname)) {
    addError('PUBLIC_SITE_URL', `must not use a placeholder host: ${parsed.hostname}`);
  }

  if (parsed.hostname.endsWith('.example.com') || parsed.hostname.endsWith('.test') || parsed.hostname.endsWith('.localhost')) {
    addWarning('PUBLIC_SITE_URL', `looks non-production: ${parsed.hostname}`);
  }
}

function validateDistOutput() {
  if (!existsSync(distDir)) {
    addError('dist', 'missing build output; run npm run build with PUBLIC_SITE_URL before validate:launch');
    return;
  }

  const files = collectFiles(distDir)
    .filter((filePath) => /\.(html|json|xml|txt|webmanifest)$/i.test(filePath));

  for (const filePath of files) {
    const relativePath = path.relative(distDir, filePath).replaceAll(path.sep, '/');
    const text = readFileSync(filePath, 'utf8');

    for (const host of placeholderHosts) {
      if (text.includes(host)) {
        addError(relativePath, `contains placeholder host: ${host}`);
      }
    }
  }
}

function collectFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(filePath);
    if (entry.isFile()) return [filePath];
    return [];
  });
}

function addError(scope, message) {
  errors.push(`${scope}: ${message}`);
}

function addWarning(scope, message) {
  warnings.push(`${scope}: ${message}`);
}

function report() {
  if (warnings.length) {
    console.warn('\nWarnings:');
    warnings.forEach((warning) => console.warn(`- ${warning}`));
  }

  if (errors.length) {
    console.error('\nErrors:');
    errors.forEach((error) => console.error(`- ${error}`));
    console.error(`\nlaunch validation failed: ${errors.length} error(s), ${warnings.length} warning(s)`);
    process.exit(1);
  }

  console.log(`launch validation passed for ${process.env.PUBLIC_SITE_URL}`);
}
