/**
 * Release guard: the package version must be a plain `MAJOR.MINOR.PATCH`
 * strictly greater than every existing `v*` tag.
 *
 * Installed copies poll `releases/latest/download/x-monkey.meta.js` and update
 * only when that `@version` is newer, so a release that reuses or lowers a
 * version would either never reach users or look like a downgrade. Pre-release
 * suffixes are rejected because userscript managers order them inconsistently.
 *
 * Usage: pnpm run check:release-version
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Version = [number, number, number];

const PLAIN_VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

function parsePlain(text: string): Version | null {
  const match = PLAIN_VERSION.exec(text);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function compare(a: Version, b: Version): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as { version?: unknown };
const version = typeof pkg.version === 'string' ? pkg.version : '';
const current = parsePlain(version);
if (!current) {
  console.error(`package.json version "${version}" is not a plain MAJOR.MINOR.PATCH version.`);
  process.exit(1);
}

const tags = execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' }).split('\n').map((tag) => tag.trim()).filter(Boolean);
let highest: { tag: string; version: Version } | null = null;
for (const tag of tags) {
  // Pre-release tags (v0.1.0-alpha.1) sort below their release; the plain tags bound them.
  const parsed = parsePlain(tag.slice(1));
  if (parsed && (!highest || compare(parsed, highest.version) > 0)) highest = { tag, version: parsed };
}

if (highest && compare(current, highest.version) <= 0) {
  console.error(`package.json version ${version} is not greater than the latest tag ${highest.tag}; bump it before releasing.`);
  process.exit(1);
}

console.log(`OK: ${version} > ${highest?.tag ?? '(no tags)'}`);
