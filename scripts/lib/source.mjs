// Shared helpers for pinning, downloading and hashing the template repo's docs.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';

export const ROOT = new URL('../..', import.meta.url).pathname;
export const CONFIG = JSON.parse(readFileSync(join(ROOT, 'docs.config.json'), 'utf8'));
export const LOCK_PATH = join(ROOT, 'source.lock.json');
export const SOURCE_DIR = join(ROOT, '.source');
export const REPO_DIR = join(SOURCE_DIR, 'repo');

/** The files the site is built from. Everything else in the repo is only linked to. */
export function isTracked(path) {
  return path === 'README.md' || path === 'PROOFS.md' || path === 'AGENTS.md' || /^docs\/[^/]+\.md$/.test(path) || /^docs\/img\/[^/]+$/.test(path);
}

export function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

/** Resolve a branch or tag to a commit with `git ls-remote` (no API rate limits). */
export function resolveRef(repo, ref) {
  const out = execFileSync('git', ['ls-remote', `https://github.com/${repo}.git`, `refs/heads/${ref}`, `refs/tags/${ref}`, `refs/tags/${ref}^{}`], { encoding: 'utf8' });
  const lines = out.trim().split('\n').filter(Boolean).map((l) => l.split('\t'));
  if (lines.length === 0) fail(`Ref "${ref}" does not exist in ${repo}.`);
  // A peeled annotated tag (^{}) names the commit; prefer it, then a branch, then a lightweight tag.
  const pick = lines.find(([, n]) => n.endsWith('^{}')) ?? lines.find(([, n]) => n.startsWith('refs/heads/')) ?? lines[0];
  return pick[0];
}

/** Download the repo at `commit` from codeload and extract it into REPO_DIR. */
export async function downloadRepo(repo, commit) {
  const url = `https://codeload.github.com/${repo}/tar.gz/${commit}`;
  let res;
  for (let attempt = 1; attempt <= 3; attempt++) {
    res = await fetch(url).catch((e) => ({ ok: false, status: String(e) }));
    if (res.ok) break;
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
  if (!res.ok) fail(`Could not download ${url} (${res.status}).`);
  const tmp = mkdtempSync(join(tmpdir(), 'docs-src-'));
  const tarball = join(tmp, 'repo.tar.gz');
  writeFileSync(tarball, Buffer.from(await res.arrayBuffer()));
  rmSync(REPO_DIR, { recursive: true, force: true });
  mkdirSync(REPO_DIR, { recursive: true });
  execFileSync('tar', ['-xzf', tarball, '-C', REPO_DIR, '--strip-components=1']);
  rmSync(tmp, { recursive: true, force: true });
  writeFileSync(join(SOURCE_DIR, 'commit'), commit + '\n');
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

/** sha256 of every tracked file in REPO_DIR, keyed by repo-relative path, sorted. */
export function hashTracked() {
  const files = {};
  for (const abs of walk(REPO_DIR)) {
    const rel = relative(REPO_DIR, abs).split(sep).join('/');
    if (!isTracked(rel)) continue;
    files[rel] = createHash('sha256').update(readFileSync(abs)).digest('hex');
  }
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
}
