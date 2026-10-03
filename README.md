# hedera-ccip-timelock-dao-docs

The documentation site for [hedera-ccip-timelock-dao](https://github.com/Baskarayelu/hedera-ccip-timelock-dao), a Scaffold-HBAR template. Live at https://hedera-ccip-timelock-dao-docs.vercel.app.

This repository holds no documentation text. Every page is built from the template's `README.md`, `docs/`, `PROOFS.md` and `AGENTS.md` at a pinned commit, so the site cannot say anything the template does not.

## How the content gets here

- `docs.config.json` names the template repository and the ref to follow (a branch or tag).
- `source.lock.json` records the commit that ref pointed to and a sha256 of every source file. Only `npm run sync` writes it.
- `src/content/manifest.json` says which part of which file becomes which page, and where the few sections that are not pages go (the README title is the home page title, its licence line is the footer, its list of docs is replaced by the sidebar, and its badge line, which links this site and the live demo, by the header).

`npm run build` runs three gates around `next build`, and any of them fails the build:

1. **Source lock** (`scripts/fetch-source.mjs`): the ref must still point at the locked commit, and the files at that commit must match the recorded hashes. If the template has moved on, run `npm run sync`, review the change to `source.lock.json`, and commit it.
2. **Drift check** (`scripts/check-drift.mjs`): re-reads the source independently of the renderer and requires every heading, paragraph, list item, table cell and code line of each mapped section to appear, in order, in that page's built HTML. It also checks the home page's facts (title, first paragraph, scaffold command, costs) against the README and `docs/costs.md`, the images, and the footer.
3. **Link check** (`scripts/check-links.mjs`): every internal link and `#anchor` must resolve in the build. Every external link is fetched with retries. HashScan, the CCIP explorer and Sourcify answer any path with their app, so those links are checked against the Hedera mirror node, the CCIP explorer's API and Sourcify's API. Basescan sits behind a Cloudflare bot challenge; a challenge or rate limit from Basescan only is logged as "not checkable from CI" (the template's own `npm run check:proofs` verifies those on chain), and any other failure, on any host, fails the build.

Diagrams are drawn ahead of time by `npm run diagrams` (headless Chromium, the site's own font and colours, light and dark) into `src/content/diagrams/`, keyed by the sha256 of each mermaid block. Pages ship no diagram library and show diagrams without JavaScript. The build refuses a diagram whose source has no drawing, and a source diagram that does not parse unless `src/content/source-issues.json` lists it with a reason; such a diagram is shown as its source with the parser's message, and a listed entry that no longer fails also fails the build.

The live demo link appears in the navbar, the menu and the home page as soon as the pinned README contains a link whose text includes "live demo".

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Fetch the pinned source and run the site at http://localhost:3000 |
| `npm run build` | Source lock, `next build` (static export to `out/`), drift check, link check |
| `npm run sync` | Re-pin to whatever the configured ref points at now, and redraw the diagrams |
| `npm run diagrams` | Redraw the diagrams from the pinned source (needs `npx playwright install chromium` once) |
| `npm run typecheck` | TypeScript |
| `node scripts/screens.mjs <dir> [url]` | Screenshots of the key views at 1440 and 390 px, light and dark |

Built with Next.js 15 and Fumadocs (search index, table of contents tracking, code blocks); the layout is this site's own. Node 20.18.3 or later.

## Licence

MIT.
