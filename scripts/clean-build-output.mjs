#!/usr/bin/env node
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const name of ['dist']) {
  rmSync(path.join(rootDir, name), { recursive: true, force: true });
}
