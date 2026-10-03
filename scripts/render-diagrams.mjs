// npm run diagrams: draw every mermaid block in the pinned source as SVG, once per theme.
//
// Diagrams are drawn here, not in the reader's browser, so pages ship no diagram library,
// do not shift when a diagram appears, and show diagrams without JavaScript. Each SVG is
// keyed by the sha256 of its mermaid source: the site build refuses a diagram whose source
// has no matching SVG, and the drift check confirms the keys. Run after `npm run sync`
// whenever the template's diagrams change, and commit src/content/diagrams/.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const REPO = join(ROOT, '.source', 'repo');
const OUT = join(ROOT, 'src', 'content', 'diagrams');
const lock = JSON.parse(readFileSync(join(ROOT, 'source.lock.json'), 'utf8'));
if (readFileSync(join(ROOT, '.source', 'commit'), 'utf8').trim() !== lock.commit) {
  console.error('✖ .source is not the locked commit. Run `npm run fetch-source` first.');
  process.exit(1);
}

// Theme colours, read from the site's own stylesheet so diagrams match the pages.
const css = readFileSync(join(ROOT, 'src', 'app', 'global.css'), 'utf8');
function tokens(selector) {
  const block = css.match(new RegExp(`(^|\\n)${selector.replace('.', '\\.')} \\{([\\s\\S]*?)\\n\\}`))?.[2] ?? '';
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}
const light = tokens(':root');
const dark = { ...light, ...tokens('.dark') };

function themeVariables(t) {
  return {
    fontFamily: 'IBM Plex Sans',
    fontSize: '14px',
    background: t['surface-2'],
    primaryColor: t['diagram-node'],
    primaryTextColor: t.ink,
    primaryBorderColor: t['diagram-line'],
    secondaryColor: t['diagram-cluster'],
    tertiaryColor: t['diagram-cluster'],
    lineColor: t['diagram-edge'],
    textColor: t.ink,
    clusterBkg: t['diagram-cluster'],
    clusterBorder: t['diagram-line'],
    edgeLabelBackground: t['surface-2'],
    actorBkg: t['diagram-node'],
    actorBorder: t['diagram-line'],
    actorTextColor: t.ink,
    actorLineColor: t['diagram-line'],
    signalColor: t['diagram-edge'],
    signalTextColor: t.ink,
    labelBoxBkgColor: t['diagram-node'],
    labelBoxBorderColor: t['diagram-line'],
    labelTextColor: t.ink,
    loopTextColor: t.ink,
    noteBkgColor: t['diagram-note'],
    noteBorderColor: t['diagram-note-line'],
    noteTextColor: t.ink,
    sequenceNumberColor: t.bg,
  };
}

// Layout only (spacing, wrapping, type size), never content: keeps wide diagrams readable
// in a 760 px column without changing what they say.
const FLOWCHART = { useMaxWidth: false, nodeSpacing: 30, rankSpacing: 30, padding: 8, wrappingWidth: 120 };
const SEQUENCE = { useMaxWidth: false, wrap: true, width: 130, actorMargin: 36, boxMargin: 8, messageFontSize: 14, actorFontSize: 14, noteFontSize: 13, messageMargin: 34 };

// Every mermaid block in the tracked markdown.
const blocks = new Map(); // hash → { code, sources: [] }
for (const file of Object.keys(lock.files).filter((f) => f.endsWith('.md'))) {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(readFileSync(join(REPO, file), 'utf8'));
  visit(tree, 'code', (node) => {
    if (node.lang !== 'mermaid') return;
    const hash = createHash('sha256').update(node.value).digest('hex');
    if (!blocks.has(hash)) blocks.set(hash, { code: node.value, sources: [] });
    blocks.get(hash).sources.push(`${file}:${node.position.start.line}`);
  });
}

const fonts = join(ROOT, 'node_modules', '@fontsource', 'ibm-plex-sans', 'files');
const browser = await chromium.launch();
const page = await browser.newPage();
const html = `<!doctype html><html><head><style>
  ${[400, 500, 600].map((w) => `@font-face{font-family:'IBM Plex Sans';font-weight:${w};src:url(/fonts/${w}.woff2) format('woff2')}`).join('\n')}
  body{font-family:'IBM Plex Sans'}</style></head><body></body></html>`;
await page.route('http://render.test/**', (route) => {
  const { pathname } = new URL(route.request().url());
  const weight = pathname.match(/^\/fonts\/(\d+)\.woff2$/)?.[1];
  if (weight) return route.fulfill({ contentType: 'font/woff2', body: readFileSync(join(fonts, `ibm-plex-sans-latin-${weight}-normal.woff2`)) });
  return route.fulfill({ contentType: 'text/html', body: html });
});
await page.goto('http://render.test/');
await page.addScriptTag({ path: join(ROOT, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js') });
await page.evaluate(() => Promise.all([400, 500, 600].map((w) => document.fonts.load(`${w} 14px "IBM Plex Sans"`))));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const index = {};
for (const [hash, { code, sources }] of blocks) {
  const key = hash.slice(0, 16);
  index[hash] = { sources, themes: {} };
  for (const [theme, t] of [['light', light], ['dark', dark]]) {
    const id = `d${key}${theme[0]}`;
    const result = await page.evaluate(
      async ({ id, code, vars, FLOWCHART, SEQUENCE }) => {
        try {
          // eslint-disable-next-line no-undef
          mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', themeVariables: vars, flowchart: FLOWCHART, sequence: SEQUENCE });
          // eslint-disable-next-line no-undef
          return { svg: (await mermaid.render(id, code)).svg };
        } catch (e) {
          document.getElementById(id)?.remove();
          document.getElementById(`d${id}`)?.remove();
          return { error: String(e.message ?? e).split('\n').slice(0, 2).join(' ') };
        }
      },
      { id, code, vars: themeVariables(t), FLOWCHART, SEQUENCE },
    );
    if (result.error) {
      // A diagram the source gets wrong is recorded, not invented; the build decides what to do.
      index[hash].error = result.error;
      break;
    }
    const [, , width, height] = result.svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
    // Text was measured in IBM Plex Sans; on the page it uses the same face via the site's variable.
    // The page sizes the drawing, so the root's fixed width, height and max-width go.
    const out = result.svg
      .replace(/font-family:\s*[^;}"]*(?:"IBM Plex Sans"|IBM Plex Sans)[^;}]*/g, 'font-family:var(--font-sans)')
      .replace(/^<svg([^>]*?)\s(?:width|height)="[^"]*"/, '<svg$1')
      .replace(/^<svg([^>]*?)\s(?:width|height)="[^"]*"/, '<svg$1')
      .replace(/^<svg([^>]*?)\sstyle="[^"]*"/, '<svg$1');
    const fileName = `${key}-${theme}.svg`;
    writeFileSync(join(OUT, fileName), out);
    index[hash].themes[theme] = { file: fileName, width: Math.round(width), height: Math.round(height) };
  }
  console.log(`${key}  ${sources.join(', ')}${index[hash].error ? `  DOES NOT PARSE: ${index[hash].error}` : ''}`);
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify({ commit: lock.commit, diagrams: index }, null, 2) + '\n');
await browser.close();
const broken = Object.values(index).filter((d) => d.error).length;
console.log(`Drew ${blocks.size - broken} diagrams in light and dark into src/content/diagrams/${broken ? `; ${broken} in the source do not parse` : ''}.`);
