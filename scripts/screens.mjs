// Screenshots of the key views at 1440 and 390 px, light and dark.
//   node scripts/screens.mjs <outDir> [baseUrl]
// Without baseUrl the built site in out/ is served through request interception (no server).
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const outDir = process.argv[2] ?? join(ROOT, 'screens');
const base = process.argv[3] ?? 'http://docs.test';
const local = !process.argv[3];
mkdirSync(outDir, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain', '.xml': 'application/xml' };

function fileFor(pathname) {
  const out = join(ROOT, 'out');
  const candidates = [join(out, pathname), join(out, `${pathname}.html`), join(out, pathname, 'index.html')];
  return candidates.find((p) => existsSync(p) && statSync(p).isFile());
}

const views = [
  { name: 'home', path: '/' },
  { name: 'content-architecture', path: '/guide/architecture' },
  { name: 'proofs', path: '/reference/proofs' },
  { name: 'agents', path: '/reference/agents' },
  { name: 'search-open', path: '/guide/architecture', action: 'search', viewportOnly: true },
  { name: 'drawer-open', path: '/guide/architecture', action: 'drawer', viewportOnly: true, phoneOnly: true },
  { name: 'toc-open', path: '/guide/architecture', action: 'toc', viewportOnly: true, phoneOnly: true },
];

const browser = await chromium.launch();
for (const width of [1440, 390]) {
  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: width === 390 ? 2 : 1, colorScheme: scheme });
    if (local) {
      await context.route(`${base}/**`, (route) => {
        const { pathname } = new URL(route.request().url());
        const file = fileFor(decodeURIComponent(pathname));
        if (!file) return route.fulfill({ status: 404, body: 'not found' });
        const type = pathname.startsWith('/api/search') ? 'application/json' : TYPES[extname(file)] ?? 'application/octet-stream';
        return route.fulfill({ status: 200, contentType: type, body: readFileSync(file) });
      });
    }
    const page = await context.newPage();
    for (const v of views) {
      if (v.phoneOnly && width !== 390) continue;
      await page.goto(`${base}${v.path}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => [...document.querySelectorAll('.diagram-canvas')].every((d) => d.querySelector('svg') || d.textContent));
      if (v.action === 'search') {
        await page.keyboard.press('ControlOrMeta+k');
        await page.getByRole('dialog').waitFor();
        await page.keyboard.type('fee cap');
        await page.waitForTimeout(800);
      } else if (v.action === 'drawer') {
        await page.getByRole('button', { name: 'Open navigation' }).click();
      } else if (v.action === 'toc') {
        await page.locator('.toc-bar-btn').click();
      }
      const file = join(outDir, `${v.name}-${width}-${scheme}.png`);
      await page.screenshot({ path: file, fullPage: !v.viewportOnly });
      console.log(file);
    }
    await context.close();
  }
}
await browser.close();
