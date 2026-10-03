// Turns the pinned template docs (fetched into .source/repo by scripts/fetch-source.mjs)
// into site pages. Transforms are mechanical only: split at headings, shift heading levels,
// rewrite links, mark diagrams. Any source text that cannot be placed fails the build.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import GithubSlugger from 'github-slugger';
import type { Element, Root as HastRoot } from 'hast';
import { imageSize } from 'image-size';
import type { Code, Heading, Link, Image, Paragraph, Root, RootContent, Table } from 'mdast';
import { toString } from 'mdast-util-to-string';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype, { type Options as RemarkRehypeOptions } from 'remark-rehype';
import { rehypeCode } from 'fumadocs-core/mdx-plugins';
import type { StructuredData } from 'fumadocs-core/mdx-plugins';
import type { TOCItemType } from 'fumadocs-core/toc';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { ELSEWHERE, GROUPS, PAGES, type GroupId, type PageSpec } from '@/content/manifest';
import config from '../../docs.config.json';
import diagramIndex from '@/content/diagrams/index.json';
import sourceIssues from '@/content/source-issues.json';
import lock from '../../source.lock.json';
import { createHash } from 'node:crypto';

const REPO_DIR = join(process.cwd(), '.source', 'repo');
export const SOURCE = { repo: config.repo, ref: config.ref, commit: lock.commit as string, short: (lock.commit as string).slice(0, 7) };
export const repoUrl = `https://github.com/${SOURCE.repo}`;
export const blobUrl = (path: string) => `${repoUrl}/blob/${SOURCE.commit}/${path}`;

export interface DocPage {
  spec: PageSpec;
  url: string;
  title: string;
  group: { id: GroupId; title: string };
  /** Source file plus the heading range, for the "From … at …" line. */
  sourceLabel: string;
  sourceUrl: string;
  hast: HastRoot;
  toc: TOCItemType[];
  structuredData: StructuredData;
  /** Plain-text units of the source, in order, for the drift check. */
  units: string[];
}

class SourceError extends Error {
  constructor(message: string) {
    super(`[docs source] ${message}`);
  }
}

// ---------- parsing ----------

interface ParsedFile {
  path: string;
  tree: Root;
  /** slug of every heading, in document order, the way GitHub assigns them. */
  slugs: Map<Heading, string>;
  raw: string;
}

const parsed = new Map<string, ParsedFile>();

function parseFile(path: string): ParsedFile {
  const hit = parsed.get(path);
  if (hit) return hit;
  const abs = join(REPO_DIR, path);
  if (!existsSync(abs)) throw new SourceError(`${path} is not in the pinned source. Run \`npm run fetch-source\`.`);
  const raw = readFileSync(abs, 'utf8');
  const tree = unified().use(remarkParse).use(remarkGfm).parse(raw) as Root;
  visit(tree, 'html', (node) => {
    throw new SourceError(`${path}:${node.position?.start.line} has raw HTML (${node.value.slice(0, 40)}), which the site does not render.`);
  });
  const slugger = new GithubSlugger();
  const slugs = new Map<Heading, string>();
  visit(tree, 'heading', (h) => {
    slugs.set(h, slugger.slug(toString(h)));
  });
  const file = { path, tree, slugs, raw };
  parsed.set(path, file);
  return file;
}

/** Top-level nodes that ELSEWHERE takes out of whatever page they fall in (by `nodeMatches`). */
function excludedNodes(file: ParsedFile): Set<RootContent> {
  const out = new Set<RootContent>();
  for (const x of ELSEWHERE.filter((e) => e.file === file.path && e.nodeMatches)) {
    const re = new RegExp(x.nodeMatches!);
    const hits = file.tree.children.filter((n) => re.test(file.raw.slice(n.position!.start.offset, n.position!.end.offset)));
    if (hits.length === 0) throw new SourceError(`${file.path}: nothing matches ${x.nodeMatches} (${x.reason}). Update src/content/manifest.json.`);
    hits.forEach((n) => out.add(n));
  }
  return out;
}

function headingIndex(file: ParsedFile, text: string): number {
  const i = file.tree.children.findIndex((n) => n.type === 'heading' && toString(n) === text);
  if (i < 0) throw new SourceError(`${file.path} has no heading "${text}". Update src/content/manifest.ts.`);
  return i;
}

/** Top-level node index range [start, end) for a from/to pair. */
function range(file: ParsedFile, from?: string, to?: string): [number, number] {
  const start = from ? headingIndex(file, from) : 0;
  const end = to ? headingIndex(file, to) : file.tree.children.length;
  if (end <= start) throw new SourceError(`${file.path}: "${to}" comes before "${from}".`);
  return [start, end];
}

// ---------- plain-text units (shared by the drift check) ----------

/** Every piece of readable text a reader must find on the page, in source order. */
export function textUnits(nodes: RootContent[]): string[] {
  const out: string[] = [];
  const push = (s: string) => {
    const t = s.replace(/\s+/g, ' ').trim();
    if (t) out.push(t);
  };
  const walk = (n: RootContent) => {
    switch (n.type) {
      case 'heading':
      case 'paragraph':
        // Image alt text is not visible text; it is checked as an attribute instead.
        push(toString(n, { includeImageAlt: false }));
        return;
      case 'code':
        for (const line of n.value.split('\n')) push(line);
        return;
      case 'table':
        for (const row of n.children) for (const cell of row.children) push(toString(cell));
        return;
      case 'list':
      case 'listItem':
      case 'blockquote':
        for (const c of n.children) walk(c as RootContent);
        return;
      case 'thematicBreak':
        return;
      default:
        push(toString(n));
    }
  };
  nodes.forEach(walk);
  return out;
}

// ---------- link rewriting ----------

interface AnchorTarget {
  url: string;
}

let anchorMap: Map<string, AnchorTarget> | undefined;
let fileMap: Map<string, string> | undefined;

function pageUrl(spec: PageSpec) {
  return `/${spec.group}/${spec.slug}`;
}

/** `${file}#${slug}` → where that heading lives on the site. */
function anchors() {
  if (anchorMap && fileMap) return { anchorMap, fileMap };
  anchorMap = new Map();
  fileMap = new Map();
  for (const spec of PAGES) {
    const file = parseFile(spec.file);
    const [start, end] = range(file, spec.from, spec.to);
    const url = pageUrl(spec);
    if (!spec.from && !spec.to) fileMap.set(spec.file, url);
    file.tree.children.slice(start, end).forEach((n, i) => {
      if (n.type !== 'heading') return;
      const slug = file.slugs.get(n)!;
      const isTitle = (i === 0 && (spec.from || n.depth === 1));
      anchorMap!.set(`${spec.file}#${slug}`, { url: isTitle ? url : `${url}#${slug}` });
    });
  }
  // The README as a whole, and its title, are the home page.
  fileMap.set('README.md', '/');
  const readme = parseFile('README.md');
  const h1 = readme.tree.children[0];
  if (h1?.type === 'heading') anchorMap.set(`README.md#${readme.slugs.get(h1)}`, { url: '/' });
  return { anchorMap, fileMap };
}

function rewriteUrl(fromFile: string, raw: string, kind: 'link' | 'image'): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw; // http:, https:, mailto:
  const { anchorMap, fileMap } = anchors();
  const [pathPart, hash] = raw.split('#') as [string, string | undefined];
  const target = pathPart === '' ? fromFile : posix.normalize(posix.join(posix.dirname(fromFile), pathPart)).replace(/\/$/, '');
  if (target.startsWith('..')) throw new SourceError(`${fromFile} links outside the repository: ${raw}`);

  if (kind === 'image') {
    if (!existsSync(join(REPO_DIR, target))) throw new SourceError(`${fromFile} shows a missing image: ${raw}`);
    return `/source/${target}`;
  }
  if (hash !== undefined && hash !== '') {
    const hit = anchorMap.get(`${target}#${hash}`);
    if (hit) return hit.url;
    if (fileMap.has(target)) throw new SourceError(`${fromFile} links to ${raw}, but ${target} has no heading "#${hash}" on the site.`);
  } else if (fileMap.has(target)) {
    return fileMap.get(target)!;
  }
  // Anything else in the repo (AGENTS.md, LICENCE, code) is linked on GitHub at the pinned commit.
  const abs = join(REPO_DIR, target);
  if (!existsSync(abs)) throw new SourceError(`${fromFile} links to ${raw}, which does not exist at ${SOURCE.short}.`);
  const kindPath = statSync(abs).isDirectory() ? 'tree' : 'blob';
  return `${repoUrl}/${kindPath}/${SOURCE.commit}/${target}${hash ? `#${hash}` : ''}`;
}

// ---------- rendering ----------

function structured(nodes: RootContent[], slugOf: (h: Heading) => string): StructuredData {
  const data: StructuredData = { headings: [], contents: [] };
  let current: string | undefined;
  const walk = (n: RootContent) => {
    if (n.type === 'heading') {
      current = slugOf(n);
      data.headings.push({ id: current, content: toString(n) });
    } else if (n.type === 'paragraph') {
      data.contents.push({ heading: current, content: toString(n) });
    } else if (n.type === 'table') {
      for (const row of (n as Table).children) for (const cell of row.children) data.contents.push({ heading: current, content: toString(cell) });
    } else if ('children' in n) {
      for (const c of n.children as RootContent[]) walk(c);
    }
  };
  nodes.forEach(walk);
  return data;
}

// ---------- diagrams ----------

interface DiagramEntry {
  sources: string[];
  error?: string;
  themes: Partial<Record<'light' | 'dark', { file: string; width: number; height: number }>>;
}
const DIAGRAMS = (diagramIndex as { commit: string; diagrams: Record<string, DiagramEntry> }).diagrams;
const KNOWN_ISSUES = (sourceIssues as { diagrams: Record<string, string> }).diagrams;

let diagramsChecked = false;
/** Diagrams are drawn ahead of time by `npm run diagrams`, keyed by the sha256 of their source. */
function checkDiagramIndex() {
  if (diagramsChecked) return;
  diagramsChecked = true;
  if ((diagramIndex as { commit: string }).commit !== SOURCE.commit) {
    throw new SourceError(`src/content/diagrams/ was drawn from ${(diagramIndex as { commit: string }).commit.slice(0, 7)}, not the pinned ${SOURCE.short}. Run \`npm run diagrams\` and commit the result.`);
  }
  for (const [hash, note] of Object.entries(KNOWN_ISSUES)) {
    if (!DIAGRAMS[hash]?.error) throw new SourceError(`source-issues.json lists diagram ${hash.slice(0, 16)} (${note.slice(0, 60)}…), but it now renders or no longer exists. Remove the entry.`);
  }
}

function diagramElement(fromFile: string, code: string): Element {
  checkDiagramIndex();
  const hash = createHash('sha256').update(code).digest('hex');
  const entry = DIAGRAMS[hash];
  if (!entry) throw new SourceError(`A diagram in ${fromFile} has no drawing (${hash.slice(0, 16)}). Run \`npm run diagrams\`.`);
  if (entry.error && !KNOWN_ISSUES[hash]) {
    throw new SourceError(`A diagram in ${fromFile} does not parse: ${entry.error}. Report it to the template, or list it in src/content/source-issues.json.`);
  }
  return {
    type: 'element',
    tagName: 'mermaid-diagram',
    properties: { dataHash: hash },
    children: [{ type: 'text', value: code }],
  };
}

export function getDiagram(hash: string) {
  return DIAGRAMS[hash];
}

async function toHast(fromFile: string, nodes: RootContent[], depthShift: number, slugOf: (h: Heading) => string): Promise<HastRoot> {
  const root: Root = { type: 'root', children: structuredClone(nodes) };
  // structuredClone loses the Map identity, so re-key headings by position before cloning.
  let hi = 0;
  const original: Heading[] = [];
  visit({ type: 'root', children: nodes } as Root, 'heading', (h) => {
    original.push(h);
  });
  visit(root, (node) => {
    if (node.type === 'heading') {
      const h = node as Heading;
      const id = slugOf(original[hi++]!);
      h.depth = Math.max(2, Math.min(6, h.depth - depthShift)) as Heading['depth'];
      h.data = { ...h.data, hProperties: { id } };
    } else if (node.type === 'link') {
      (node as Link).url = rewriteUrl(fromFile, (node as Link).url, 'link');
    } else if (node.type === 'image') {
      const img = node as Image;
      img.url = rewriteUrl(fromFile, img.url, 'image');
      const dim = imageSize(readFileSync(join(process.cwd(), 'public', img.url)));
      img.data = { ...img.data, hProperties: { width: dim.width, height: dim.height, loading: 'lazy', decoding: 'async' } };
    } else if (node.type === 'definition') {
      throw new SourceError(`${fromFile} uses a reference-style link definition, which the site does not support yet.`);
    }
  });
  visit(root, 'code', (node: Code, index, parent) => {
    if (node.lang === 'mermaid' && parent && index !== undefined) {
      parent.children[index] = { type: 'mermaidBlock', value: node.value } as unknown as RootContent;
    }
  });
  const processor = unified()
    .use(remarkRehype, { handlers: { mermaidBlock: (_state: unknown, node: { value: string }) => diagramElement(fromFile, node.value) } } as RemarkRehypeOptions)
    .use(rehypeCode, {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultLanguage: 'text',
      fallbackLanguage: 'text',
      icon: false,
    });
  return (await processor.run(root as never)) as HastRoot;
}

async function buildPage(spec: PageSpec): Promise<DocPage> {
  const file = parseFile(spec.file);
  const [start, end] = range(file, spec.from, spec.to);
  let nodes = file.tree.children.slice(start, end);
  let title = spec.title;
  let depthShift = 0;
  const first = nodes[0];
  if (spec.from) {
    // The `from` heading is the page title; headings under it move up to match.
    if (first?.type !== 'heading') throw new SourceError(`${spec.file}: expected a heading to start ${spec.slug}.`);
    title = toString(first);
    depthShift = first.depth - 1;
    nodes = nodes.slice(1);
  } else if (first?.type === 'heading' && first.depth === 1) {
    // A whole file's H1 is its title, unless the manifest names the page (the README's
    // H1 is the home page title, so the introduction page is called something else).
    title ??= toString(first);
    nodes = nodes.slice(1);
  }
  if (!title) throw new SourceError(`${spec.file}: page ${spec.slug} has no title.`);
  const excluded = excludedNodes(file);
  nodes = nodes.filter((n) => !excluded.has(n));

  const slugOf = (h: Heading) => file.slugs.get(h)!;
  const hast = await toHast(spec.file, nodes, depthShift, slugOf);
  const toc: TOCItemType[] = [];
  for (const n of nodes) {
    if (n.type !== 'heading') continue;
    const depth = n.depth - depthShift;
    if (depth === 2 || depth === 3) toc.push({ title: toString(n), url: `#${slugOf(n)}`, depth });
  }
  const group = GROUPS.find((g) => g.id === spec.group)!;
  const sectionNote = spec.from ? ` › ${spec.from}` : spec.to ? ` (to “${spec.to}”)` : '';
  return {
    spec,
    url: pageUrl(spec),
    title,
    group,
    sourceLabel: `${spec.file}${sectionNote}`,
    sourceUrl: blobUrl(spec.file),
    hast,
    toc,
    structuredData: structured(nodes, slugOf),
    units: textUnits(nodes),
  };
}

let pagesPromise: Promise<DocPage[]> | undefined;

export function getPages(): Promise<DocPage[]> {
  pagesPromise ??= (async () => {
    checkCoverage();
    return Promise.all(PAGES.map(buildPage));
  })();
  return pagesPromise;
}

export async function getPage(group: string, slug: string) {
  return (await getPages()).find((p) => p.spec.group === group && p.spec.slug === slug);
}

/** Every top-level node of every tracked markdown file must land on exactly one page or a declared place. */
function checkCoverage() {
  const files = Object.keys(lock.files).filter((f) => f.endsWith('.md'));
  for (const path of files) {
    const file = parseFile(path);
    const owner = new Array<string | undefined>(file.tree.children.length);
    // Nodes taken out by pattern belong to their ELSEWHERE entry, whatever page range they sit in.
    const excluded = excludedNodes(file);
    file.tree.children.forEach((n, i) => {
      if (excluded.has(n)) owner[i] = 'excluded by pattern';
    });
    const claim = (start: number, end: number, who: string) => {
      for (let i = start; i < end; i++) {
        if (excluded.has(file.tree.children[i]!)) continue;
        if (owner[i]) throw new SourceError(`${path} node ${i} is claimed by both ${owner[i]} and ${who}.`);
        owner[i] = who;
      }
    };
    for (const spec of PAGES.filter((p) => p.file === path)) {
      const [s, e] = range(file, spec.from, spec.to);
      claim(spec.title && !spec.from && file.tree.children[0]?.type === 'heading' ? s + 1 : s, e, `page ${spec.slug}`);
    }
    for (const x of ELSEWHERE.filter((x) => x.file === path)) {
      if (x.nodeMatches) continue;
      if (x.firstNodeOnly) claim(0, 1, x.shownOn);
      else claim(...range(file, x.from, x.to), x.shownOn);
    }
    const missing = owner.findIndex((o) => !o);
    if (missing >= 0) {
      const n = file.tree.children[missing]!;
      throw new SourceError(`${path}:${n.position?.start.line} ("${toString(n).slice(0, 60)}") is not on any page. Map it in src/content/manifest.ts.`);
    }
  }
}

// ---------- facts for the home page and the footer ----------

export interface HomeFacts {
  title: string;
  /** The README's first paragraph, rendered. */
  lede: HastRoot;
  ledeText: string;
  scaffoldCommand: string;
  takePart: { hbar: string; steps: string; withAssociation: string };
  deploy: { hbar: string; label: string };
  liveDemoUrl: string | null;
  licence: HastRoot;
  licenceText: string;
}

let factsPromise: Promise<HomeFacts> | undefined;

export function getHomeFacts(): Promise<HomeFacts> {
  factsPromise ??= (async () => {
    const readme = parseFile('README.md');
    const h1 = readme.tree.children[0];
    if (h1?.type !== 'heading' || h1.depth !== 1) throw new SourceError('README.md does not start with an H1.');
    // The first paragraph under the title that starts with text (a badge or link line does not).
    const para = readme.tree.children.find((n, i): n is Paragraph => i > 0 && n.type === 'paragraph' && n.children[0]?.type === 'text');
    if (!para || readme.tree.children.slice(1, readme.tree.children.indexOf(para)).some((n) => n.type === 'heading')) {
      throw new SourceError('README.md has no paragraph of text under its title.');
    }

    const [qs, qe] = range(readme, 'Quick start', 'How it works');
    let scaffoldCommand: string | undefined;
    for (const n of readme.tree.children.slice(qs, qe)) {
      if (n.type === 'code' && !scaffoldCommand) scaffoldCommand = n.value.split('\n').find((l) => l.startsWith('npx create-scaffold-hbar'));
    }
    if (!scaffoldCommand) throw new SourceError('README.md Quick start has no `npx create-scaffold-hbar` line.');

    const costs = parseFile('docs/costs.md');
    let takePart: HomeFacts['takePart'] | undefined;
    let deploy: HomeFacts['deploy'] | undefined;
    visit(costs.tree, 'paragraph', (p) => {
      const m = toString(p).match(/Setting up and taking part once \(([^)]+)\) spends about ([\d.]+) HBAR, or ([\d.]+) with an association/);
      if (m && !takePart) takePart = { steps: m[1]!, hbar: m[2]!, withAssociation: m[3]! };
    });
    visit(costs.tree, 'tableRow', (row) => {
      const label = toString(row.children[0]!);
      const value = toString(row.children[row.children.length - 1]!);
      const m = value.match(/^about ([\d.]+)$/);
      if (label === 'Total with the default funding' && m && !deploy) deploy = { hbar: m[1]!, label: label.toLowerCase() };
    });
    if (!takePart) throw new SourceError('docs/costs.md no longer says "Setting up and taking part once (…) spends about X HBAR, or Y with an association". The home page cost strip reads it from there.');
    if (!deploy) throw new SourceError('docs/costs.md has no "Total with the default funding | | about N" row. The home page cost strip reads it from there.');

    let liveDemoUrl: string | null = null;
    visit(readme.tree, 'link', (l) => {
      if (!liveDemoUrl && /live demo/i.test(toString(l)) && /^https:\/\//.test(l.url)) liveDemoUrl = l.url;
    });

    const [ls, le] = range(readme, 'Licence');
    const licenceNodes = readme.tree.children.slice(ls + 1, le);
    const slugOf = (h: Heading) => readme.slugs.get(h)!;
    return {
      title: toString(h1),
      lede: await toHast('README.md', [para], 0, slugOf),
      ledeText: toString(para),
      scaffoldCommand,
      takePart,
      deploy,
      liveDemoUrl,
      licence: await toHast('README.md', licenceNodes, 0, slugOf),
      licenceText: textUnits(licenceNodes).join(' '),
    };
  })();
  return factsPromise;
}
