// Postbuild link check. Fails the build on any dead link or anchor.
//
// Internal: every href/src in the built site must resolve to a built file, and every
// #anchor to an id on the target page.
// External: every link is fetched (3 tries with backoff). Some explorers answer every
// path with the same app shell, so their HTTP status proves nothing; those links are
// checked against the data the explorer shows instead:
//   hashscan.io   → Hedera testnet mirror node (contract, transaction, schedule, token, account)
//   ccip.chain.link/msg/<id> → the page, plus the CCIP explorer's message API
//   repo.sourcify.dev/<chain>/<address> → the page, plus Sourcify's verified-contract API
//   *.blockscout.com/tx|address/<id> → the page, plus Blockscout's API (tx succeeded; a contract at the address)
// Basescan sits behind a Cloudflare bot challenge. A challenge or rate limit from Basescan
// (and only Basescan) is logged as "not checkable from CI"; a 404 there still fails.
// Links to localhost are instructions for the reader's own machine and are skipped.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'node-html-parser';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'out');
const MIRROR = 'https://testnet.mirrornode.hedera.com/api/v1';
// Links to the site's own address (canonical URLs, sitemap) are checked against the build.
const SITE = JSON.parse(readFileSync(join(ROOT, 'docs.config.json'), 'utf8')).siteUrl;
const UA = 'Mozilla/5.0 (compatible; hedera-ccip-timelock-dao-docs link check; +https://github.com/Baskarayelu/hedera-ccip-timelock-dao-docs)';

const htmlFiles = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.html')) htmlFiles.push(p);
  }
})(OUT);

const pages = new Map(); // route → { ids, links: [{href, kind}] }
for (const file of htmlFiles) {
  const route = '/' + relative(OUT, file).replace(/(index)?\.html$/, '').replace(/\/$/, '');
  const doc = parse(readFileSync(file, 'utf8'), { blockTextElements: { script: true, noscript: true, style: true } });
  const ids = new Set(doc.querySelectorAll('[id]').map((e) => e.getAttribute('id')));
  const links = [
    ...doc.querySelectorAll('a[href]').map((a) => ({ href: a.getAttribute('href'), kind: 'link' })),
    ...doc.querySelectorAll('img[src]').map((i) => ({ href: i.getAttribute('src'), kind: 'image' })),
    ...doc.querySelectorAll('link[href]').map((l) => ({ href: l.getAttribute('href'), kind: 'asset' })),
    ...doc.querySelectorAll('script[src]').map((s) => ({ href: s.getAttribute('src'), kind: 'asset' })),
  ];
  pages.set(route === '/' ? '/' : route, { file, ids, links });
}

function builtFile(pathname) {
  const p = decodeURIComponent(pathname);
  const candidates = p === '/' ? [join(OUT, 'index.html')] : [join(OUT, p), join(OUT, `${p}.html`), join(OUT, p, 'index.html')];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile());
}

const failures = [];
const external = new Map(); // url → Set(route)
let internalCount = 0;
let anchorCount = 0;

for (const [route, page] of pages) {
  for (const { href: raw, kind } of page.links) {
    if (/^(mailto|tel):/.test(raw)) continue;
    const href = raw.startsWith(SITE) ? raw.slice(SITE.length) || '/' : raw;
    if (/^https?:\/\//.test(href)) {
      if (!external.has(href)) external.set(href, new Set());
      external.get(href).add(route);
      continue;
    }
    internalCount++;
    const url = new URL(href, `https://site.invalid${route === '/' ? '/' : route}`);
    const targetRoute = url.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
    const file = builtFile(url.pathname);
    if (!file) {
      failures.push(`${route}: ${kind} ${href} → no such file in the build`);
      continue;
    }
    if (url.hash && url.hash !== '#') {
      anchorCount++;
      const target = pages.get(targetRoute);
      const id = decodeURIComponent(url.hash.slice(1));
      if (!target) failures.push(`${route}: ${href} → anchor on a page that is not HTML`);
      else if (!target.ids.has(id)) failures.push(`${route}: ${href} → no element with id "${id}" on ${targetRoute}`);
    }
  }
}

// ---------- external ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, { method = 'GET', body, headers } = {}) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { method, body, headers: { 'user-agent': UA, ...headers }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
      const text = await res.text();
      last = { status: res.status, headers: res.headers, text };
      // Retry only what can be transient.
      if (res.status < 500 && res.status !== 429 && res.status !== 403) return last;
    } catch (e) {
      last = { status: 0, error: e.message };
    }
    if (attempt < 3) await sleep(attempt === 1 ? 1000 : 4000);
  }
  return last;
}

function describe(r) {
  return r.status ? `HTTP ${r.status}` : `network error (${r.error})`;
}

const MIRROR_PATH = {
  contract: (id) => `/contracts/${id}`,
  transaction: (id) => (/^0x[0-9a-f]{64}$/i.test(id) ? `/contracts/results/${id}` : `/transactions/${id}`),
  schedule: (id) => `/schedules/${id}`,
  token: (id) => `/tokens/${id}`,
  account: (id) => `/accounts/${id}`,
};

async function checkExternal(url) {
  const u = new URL(url);
  const host = u.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return { state: 'skipped', note: 'local address' };

  if (host === 'hashscan.io') {
    const m = u.pathname.match(/^\/testnet\/(contract|transaction|schedule|token|account)\/([^/]+)$/);
    if (!m) return { state: 'failed', note: 'HashScan link of a kind this check cannot verify' };
    const r = await get(MIRROR + MIRROR_PATH[m[1]](m[2]));
    if (r.status === 200) return { state: 'ok', note: `mirror node has ${m[1]} ${m[2]}` };
    return { state: 'failed', note: `mirror node: ${describe(r)} for ${m[1]} ${m[2]}` };
  }

  const page = await get(url);
  if (host.endsWith('basescan.org')) {
    const challenged = (page.status === 403 && (page.headers?.get('cf-mitigated') === 'challenge' || /challenge-platform|Just a moment/i.test(page.text ?? ''))) || page.status === 429;
    if (challenged) return { state: 'uncheckable', note: page.status === 429 ? 'rate limited' : 'Cloudflare bot challenge' };
  }
  if (!(page.status >= 200 && page.status < 300)) return { state: 'failed', note: describe(page) };

  const ccip = u.hostname === 'ccip.chain.link' && u.pathname.match(/^\/msg\/(0x[0-9a-f]{64})$/i);
  if (ccip) {
    const r = await get(`https://ccip.chain.link/api/h/atlas/message/${ccip[1]}`);
    if (r.status !== 200 || !r.text?.toLowerCase().includes(ccip[1].toLowerCase())) return { state: 'failed', note: `CCIP explorer API: ${describe(r)}` };
    return { state: 'ok', note: 'CCIP message found' };
  }
  const sourcify = u.hostname === 'repo.sourcify.dev' && u.pathname.match(/^\/(\d+)\/(0x[0-9a-f]{40})\/?$/i);
  if (sourcify) {
    const r = await get(`https://sourcify.dev/server/v2/contract/${sourcify[1]}/${sourcify[2]}`);
    if (r.status !== 200) return { state: 'failed', note: `Sourcify API: ${describe(r)} (not verified)` };
    return { state: 'ok', note: 'verified on Sourcify' };
  }
  const blockscout = u.hostname.endsWith('blockscout.com') && u.pathname.match(/^\/(tx|address)\/(0x[0-9a-f]+)\/?$/i);
  if (blockscout) {
    // Blockscout serves its app for any path; its API knows whether the thing exists.
    const kind = blockscout[1] === 'tx' ? 'transactions' : 'addresses';
    const r = await get(`${u.origin}/api/v2/${kind}/${blockscout[2]}`);
    let body = {};
    try {
      body = JSON.parse(r.text ?? '{}');
    } catch {}
    if (r.status !== 200) return { state: 'failed', note: `Blockscout API: ${describe(r)}` };
    if (kind === 'transactions' && body.status !== 'ok') return { state: 'failed', note: `Blockscout: transaction status ${body.status}` };
    // Any address answers 200, so an address link must at least point at a contract.
    if (kind === 'addresses' && body.is_contract !== true) return { state: 'failed', note: 'Blockscout: no contract at this address' };
    return { state: 'ok', note: kind === 'transactions' ? 'transaction succeeded' : `contract${body.is_verified ? `, verified as ${body.name}` : ''}` };
  }
  return { state: 'ok', note: describe(page) };
}

const urls = [...external.keys()];
const results = new Map();
let next = 0;
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (next < urls.length) {
      const url = urls[next++];
      results.set(url, await checkExternal(url));
    }
  }),
);

const by = (state) => urls.filter((u) => results.get(u).state === state);
for (const url of by('failed')) failures.push(`${url} → ${results.get(url).note} (linked from ${[...external.get(url)].join(', ')})`);

console.log(`Internal: ${internalCount} links checked, ${anchorCount} of them with anchors, across ${pages.size} pages.`);
console.log(`External: ${urls.length} unique links: ${by('ok').length} ok, ${by('failed').length} failed, ${by('uncheckable').length} not checkable from CI, ${by('skipped').length} skipped.`);
for (const url of by('uncheckable')) console.log(`  not checkable from CI (${results.get(url).note}): ${url}`);
for (const url of by('skipped')) console.log(`  skipped (${results.get(url).note}): ${url}`);

if (failures.length) {
  console.error(`\n✖ Link check failed (${failures.length}):\n  ${failures.join('\n  ')}\n`);
  process.exit(1);
}
console.log('Link check passed.');
