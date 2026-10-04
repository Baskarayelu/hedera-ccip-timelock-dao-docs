import Link from 'next/link';
import { CopyButton } from '@/components/copy-button';
import { ArrowRightIcon, ExternalIcon } from '@/components/icons';
import { Markdown } from '@/components/markdown';
import { getHomeFacts, getPages, repoUrl } from '@/lib/content';

// Every fact on this page is read from the pinned source: the title and first paragraph
// from the README, the scaffold command from its Quick start, the costs from docs/costs.md.
// The labels and layout are the site's own.

const CARDS = [
  { group: 'getting-started', title: 'Scaffold it and take part', pages: ['introduction', 'quick-start', 'quick-start#take-part-with-a-testnet-wallet'] },
  { group: 'guide', title: 'How the DAO runs itself', pages: ['how-it-works', 'architecture', 'wrap-to-vote'] },
  { group: 'reference', title: 'Contracts, proofs and costs', pages: ['proofs', 'costs', 'threat-model'] },
] as const;

export default async function Home() {
  const facts = await getHomeFacts();
  const pages = await getPages();
  const bySlug = (slug: string) => {
    const page = pages.find((p) => p.spec.slug === slug);
    if (!page) throw new Error(`Home links to a page that is not in the manifest: ${slug}`);
    return page;
  };
  // "page" or "page#heading": a heading link takes its title from the page's own headings.
  const target = (ref: string) => {
    const [slug, hash] = ref.split('#') as [string, string | undefined];
    const page = bySlug(slug);
    if (!hash) return { title: page.title, url: page.url };
    const item = page.toc.find((t) => t.url === `#${hash}`);
    if (!item) throw new Error(`Home links to ${ref}, but that page has no such heading.`);
    return { title: String(item.title), url: `${page.url}#${hash}` };
  };
  const quickStart = bySlug('quick-start');
  const costs = bySlug('costs');

  return (
    <main className="home" data-home>
      <section aria-labelledby="home-title" className="home-hero">
        <span className="eyebrow">A Scaffold-HBAR template</span>
        <h1 id="home-title" className="home-title">
          {facts.title}
        </h1>
        <div className="home-lede" data-fact="lede">
          <Markdown tree={facts.lede} />
        </div>
      </section>

      <section aria-label="Scaffold command">
        <div className="command">
          <pre id="scaffold-command" data-fact="command">
            <code>{facts.scaffoldCommand}</code>
          </pre>
          <CopyButton text={facts.scaffoldCommand} label="Copy the scaffold command" />
        </div>
        <div className="home-actions">
          <Link className="btn btn-primary" href={quickStart.url}>
            {quickStart.title}
          </Link>
          {facts.liveDemoUrl && (
            <a className="btn" href={facts.liveDemoUrl}>
              Open the live demo
              <ExternalIcon />
            </a>
          )}
          <a className="btn" href={repoUrl}>
            Repository on GitHub
            <ExternalIcon />
          </a>
        </div>
      </section>

      <section aria-label="What it costs" className="costs">
        <div className="cost">
          <span className="cost-label">Take part once</span>
          <span className="cost-value" data-fact="take-part">
            about {facts.takePart.hbar} HBAR
          </span>
          <span className="cost-note" data-fact="take-part-note">
            {facts.takePart.qualifier ? `${facts.takePart.steps}; ${facts.takePart.qualifier}` : facts.takePart.steps}
          </span>
        </div>
        <div className="cost">
          <span className="cost-label">Deploy your own DAO</span>
          <span className="cost-value" data-fact="deploy">
            about {facts.deploy.hbar} HBAR
          </span>
          <span className="cost-note">{facts.deploy.label}</span>
        </div>
        <Link className="costs-link" href={costs.url}>
          Every cost, measured
          <ArrowRightIcon />
        </Link>
      </section>

      <section aria-label="Where to start" className="cards">
        {CARDS.map((card) => {
          const group = bySlug(card.pages[0]).group;
          return (
            <div key={card.group} className="card">
              <div className="card-head">
                <span className="card-group">{group.title}</span>
                <Link className="card-title" href={bySlug(card.pages[0]).url}>
                  {card.title}
                </Link>
              </div>
              <ul>
                {card.pages.map((ref) => {
                  const p = target(ref);
                  return (
                    <li key={ref}>
                      <Link href={p.url}>
                        {p.title}
                        <ArrowRightIcon />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>
    </main>
  );
}
