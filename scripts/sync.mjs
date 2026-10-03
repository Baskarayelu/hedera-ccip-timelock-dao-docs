// npm run sync: pin the site to whatever docs.config.json's ref points at now.
// Writes source.lock.json; review its diff (and the site) before committing it.
import { writeFileSync } from 'node:fs';
import { CONFIG, LOCK_PATH, downloadRepo, hashTracked, resolveRef } from './lib/source.mjs';

const commit = resolveRef(CONFIG.repo, CONFIG.ref);
await downloadRepo(CONFIG.repo, commit);
const lock = { repo: CONFIG.repo, ref: CONFIG.ref, commit, files: hashTracked() };
writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + '\n');
console.log(`Pinned ${CONFIG.repo}@${CONFIG.ref} to ${commit} (${Object.keys(lock.files).length} files).`);
