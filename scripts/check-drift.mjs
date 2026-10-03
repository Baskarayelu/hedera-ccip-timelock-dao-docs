// Postbuild drift check: the built site must say exactly what the pinned source says.
// It re-reads the source on its own (not through the renderer) and, for every page,
// requires each heading, paragraph, list item, table cell and code line of the mapped
// source section to appear, in order, in the page's built HTML. It also checks the home
// page facts, the footer, the images and that the site was built from the locked commit.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { toString } from 'mdast-util-to-string';
import { parse } from 'node-html-parser';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'out');
const REPO = join(ROOT, '.source', 'repo');
const manifest = JSON.parse(readFileSync(join(ROOT, 'src/content/manifest.json'), 'utf8'));
const lock = JSON.parse(readFileSync(join(ROOT, 'source.lock.json'), 'utf8'));

const problems = [];
const norm = (s) => s.replace(/\s+/g, ' ').trim();

if (readFileSync(join(ROOT, '.source', 'commit'), 'utf8').trim() !== lock.commit) problems.push('.source is not the locked commit');

const trees = new Map();
function tree(path) {
  if (!trees.has(path)) trees.set(path, unified().use(remarkParse).use(remarkGfm).parse(readFileSync(join(REPO, path), 'utf8')));
  return trees.get(path);
}
function slice(path, from, to) {
  const nodes = tree(path).children;
  const at = (text) => {
    const i = nodes.findIndex((n) => n.type === 'heading' && toString(n) === text);
    if (i < 0) throw new Error(`${path}: no heading "${text}"`);
    return i;
  };
  return nodes.slice(from ? at(from) : 0, to ? at(to) : nodes.length);
}
function units(nodes) {
  const out = [];
  const push = (s) => {
    const t = norm(s);
    if (t) out.push(t);
  };
  const walk = (n) => {
    // Image alt text is not visible text; images are checked separately below.
    if (n.type === 'heading' || n.type === 'paragraph') push(toString(n, { includeImageAlt: false }));
    else if (n.type === 'code') n.value.split('\n').forEach(push);
    else if (n.type === 'table') n.children.forEach((r) => r.children.forEach((c) => push(toString(c, { includeImageAlt: false }))));
    else if (n.type === 'list' || n.type === 'listItem' || n.type === 'blockquote') n.children.forEach(walk);
    else if (n.type !== 'thematicBreak') push(toString(n));
  };
  nodes.forEach(walk);
  return out;
}
/** Every unit must be found in `text`, each after the previous one. */
function inOrder(label, expected, text) {
  let pos = 0;
  let missing = 0;
  for (const u of expected) {
    const i = text.indexOf(u, pos);
    if (i < 0) {
      if (missing++ < 5) problems.push(`${label}: missing or out of order: "${u.slice(0, 100)}"`);
      continue;
    }
    pos = i + u.length;
  }
  if (missing > 5) problems.push(`${label}: …and ${missing - 5} more`);
  return expected.length;
}
function html(path) {
  const file = join(OUT, path);
  if (!existsSync(file)) {
    problems.push(`missing built page ${path}`);
    return null;
  }
  // Parse <pre> as markup (node-html-parser keeps it as raw text by default).
  return parse(readFileSync(file, 'utf8'), { blockTextElements: { script: true, noscript: true, style: true } });
}

// The licence section of the README is the footer of every page.
const licence = units(slice('README.md', 'Licence').slice(1)).join(' ');
let checkedUnits = 0;
let checkedPages = 0;

for (const spec of manifest.pages) {
  const label = `${spec.group}/${spec.slug}`;
  const doc = html(`${spec.group}/${spec.slug}.html`);
  if (!doc) continue;
  checkedPages++;
  let nodes = slice(spec.file, spec.from, spec.to);
  let title = spec.title;
  const first = nodes[0];
  if (spec.from) {
    title = toString(first);
    nodes = nodes.slice(1);
  } else if (first?.type === 'heading' && first.depth === 1) {
    title ??= toString(first);
    nodes = nodes.slice(1);
  }
  const h1 = doc.querySelector('h1.doc-title');
  if (!h1 || norm(h1.text) !== norm(title)) problems.push(`${label}: title is "${h1?.text}", source says "${title}"`);
  const body = doc.querySelector('[data-doc-body]');
  if (!body) {
    problems.push(`${label}: no [data-doc-body]`);
    continue;
  }
  checkedUnits += inOrder(label, units(nodes), norm(body.text));

  // Images: same alt text, and the file is in the build.
  const imgs = body.querySelectorAll('img');
  const sourceImages = [];
  visit({ type: 'root', children: nodes }, 'image', (n) => sourceImages.push(n));
  for (const img of sourceImages) {
    const built = imgs.find((i) => i.getAttribute('alt') === img.alt);
    if (!built) problems.push(`${label}: image "${img.alt.slice(0, 60)}" is missing`);
    else if (!existsSync(join(OUT, built.getAttribute('src')))) problems.push(`${label}: image file ${built.getAttribute('src')} is not in the build`);
  }
  if (!norm(doc.querySelector('.site-footer')?.text ?? '').includes(licence)) problems.push(`${label}: footer does not carry the README licence line`);
  if (!doc.querySelector('.site-footer')?.text.includes(lock.commit.slice(0, 7))) problems.push(`${label}: footer does not name the locked commit`);
}

// No built doc page that the manifest does not know about.
for (const g of manifest.groups) {
  const dir = join(OUT, g.id);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.html'))) {
    if (!manifest.pages.some((p) => p.group === g.id && `${p.slug}.html` === f)) problems.push(`out/${g.id}/${f} is not in the manifest`);
  }
}

// Home page facts, each re-read from the source here.
const home = html('index.html');
if (home) {
  const readme = tree('README.md').children;
  const fact = (name) => norm(home.querySelector(`[data-fact="${name}"]`)?.text ?? '');
  if (norm(home.querySelector('h1')?.text ?? '') !== toString(readme[0])) problems.push('home: title differs from the README H1');
  if (fact('lede') !== norm(toString(readme[1]))) problems.push('home: first paragraph differs from the README');
  const qs = slice('README.md', 'Quick start', 'How it works');
  const command = qs.filter((n) => n.type === 'code').flatMap((n) => n.value.split('\n')).find((l) => l.startsWith('npx create-scaffold-hbar'));
  if (!command || fact('command') !== command) problems.push(`home: scaffold command "${fact('command')}" differs from the README's "${command}"`);
  let take;
  let deploy;
  visit(tree('docs/costs.md'), 'paragraph', (p) => {
    take ??= toString(p).match(/taking part once \([^)]+\) spends about ([\d.]+) HBAR/)?.[1];
  });
  visit(tree('docs/costs.md'), 'tableRow', (r) => {
    if (toString(r.children[0]) === 'Total with the default funding') deploy ??= toString(r.children.at(-1)).match(/about ([\d.]+)/)?.[1];
  });
  if (!take || fact('take-part') !== `about ${take} HBAR`) problems.push(`home: take-part cost "${fact('take-part')}" differs from docs/costs.md (${take})`);
  if (!deploy || fact('deploy') !== `about ${deploy} HBAR`) problems.push(`home: deploy cost "${fact('deploy')}" differs from docs/costs.md (${deploy})`);
  if (/\$\s?\d/.test(home.querySelector('main')?.text ?? '')) problems.push('home: shows a USD figure; costs are HBAR only');
}

if (problems.length) {
  console.error(`\n✖ Drift check failed (${problems.length}):\n  ${problems.join('\n  ')}\n`);
  process.exit(1);
}
console.log(`Drift check passed: ${checkedPages} pages and the home page match ${lock.repo}@${lock.commit.slice(0, 7)} (${checkedUnits} text units in order).`);
