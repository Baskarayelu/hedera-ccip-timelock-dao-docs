// Prebuild: fetch the pinned source and refuse to build from anything else.
//  1. The ref in docs.config.json must still point at the commit in source.lock.json.
//  2. The tracked files at that commit must hash to exactly what the lock records.
// Either failing means the site would no longer match the source at the pinned ref.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG, LOCK_PATH, REPO_DIR, ROOT, SOURCE_DIR, downloadRepo, fail, hashTracked, resolveRef } from './lib/source.mjs';

if (!existsSync(LOCK_PATH)) fail('source.lock.json is missing. Run `npm run sync`.');
const lock = JSON.parse(readFileSync(LOCK_PATH, 'utf8'));

if (lock.repo !== CONFIG.repo || lock.ref !== CONFIG.ref) {
  fail(`docs.config.json pins ${CONFIG.repo}@${CONFIG.ref} but source.lock.json was made for ${lock.repo}@${lock.ref}. Run \`npm run sync\`.`);
}

const now = resolveRef(CONFIG.repo, CONFIG.ref);
if (now !== lock.commit) {
  fail(`Source drift: ${CONFIG.repo}@${CONFIG.ref} now points at ${now}, but the site is pinned to ${lock.commit}.\n  Run \`npm run sync\`, review the change, and commit source.lock.json.`);
}

const cached = existsSync(join(SOURCE_DIR, 'commit')) && readFileSync(join(SOURCE_DIR, 'commit'), 'utf8').trim() === lock.commit;
if (!cached) await downloadRepo(CONFIG.repo, lock.commit);

const actual = hashTracked();
const problems = [];
for (const [path, hash] of Object.entries(lock.files)) {
  if (!actual[path]) problems.push(`missing at ${lock.commit.slice(0, 7)}: ${path}`);
  else if (actual[path] !== hash) problems.push(`changed: ${path}`);
}
for (const path of Object.keys(actual)) if (!lock.files[path]) problems.push(`not in the lock: ${path}`);
if (problems.length) fail(`Source drift against source.lock.json:\n  ${problems.join('\n  ')}`);

// Images referenced by the docs are served from public/source/.
const publicDir = join(ROOT, 'public', 'source');
rmSync(publicDir, { recursive: true, force: true });
mkdirSync(join(publicDir, 'docs'), { recursive: true });
if (existsSync(join(REPO_DIR, 'docs', 'img'))) cpSync(join(REPO_DIR, 'docs', 'img'), join(publicDir, 'docs', 'img'), { recursive: true });

console.log(`Source OK: ${CONFIG.repo}@${CONFIG.ref} = ${lock.commit} (${Object.keys(lock.files).length} files match the lock).`);
