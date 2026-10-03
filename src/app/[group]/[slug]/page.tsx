import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalIcon } from '@/components/icons';
import { Markdown } from '@/components/markdown';
import { Sidebar } from '@/components/sidebar';
import { TocDropdown, TocProvider, TocRail } from '@/components/toc';
import { getPage, getPages, SOURCE } from '@/lib/content';
import { getNav } from '@/lib/site';

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getPages()).map((p) => ({ group: p.spec.group, slug: p.spec.slug }));
}

type Params = Promise<{ group: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { group, slug } = await params;
  const page = await getPage(group, slug);
  if (!page) return {};
  const firstParagraph = page.structuredData.contents.find((c) => c.content.length > 40)?.content;
  return {
    title: page.title,
    description: firstParagraph?.slice(0, 200),
    alternates: { canonical: page.url },
  };
}

export default async function DocPage({ params }: { params: Params }) {
  const { group, slug } = await params;
  const page = await getPage(group, slug);
  if (!page) notFound();
  const pages = await getPages();
  const { groups, links } = await getNav();
  const index = pages.indexOf(page);
  const prev = pages[index - 1];
  const next = pages[index + 1];

  return (
    <TocProvider toc={page.toc}>
      <div className="docs-shell">
        <aside className="docs-sidebar">
          <Sidebar groups={groups} links={links} />
        </aside>
        <div style={{ minWidth: 0 }}>
          <TocDropdown toc={page.toc} />
          <main className="doc-article">
            <article className="doc">
              <nav aria-label="Breadcrumb" className="breadcrumb">
                <Link href={pages.find((p) => p.group.id === page.group.id)!.url}>{page.group.title}</Link>
                <span aria-hidden="true">›</span>
                <span aria-current="page">{page.title}</span>
              </nav>
              <h1 className="doc-title">{page.title}</h1>
              <div className="doc-body" data-doc-body>
                <Markdown tree={page.hast} />
              </div>
              <div className="doc-foot">
                <div className="doc-source">
                  <span className="mono">
                    From {page.sourceLabel} at {SOURCE.ref} @ {SOURCE.short}
                  </span>
                  <a href={page.sourceUrl} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    View the source on GitHub
                    <ExternalIcon size={11} />
                  </a>
                </div>
                <nav aria-label="Previous and next page" className="pager">
                  {prev && (
                    <Link href={prev.url}>
                      <small>Previous</small>
                      <span>{prev.title}</span>
                    </Link>
                  )}
                  {next && (
                    <Link href={next.url} className="next">
                      <small>Next</small>
                      <span>{next.title}</span>
                    </Link>
                  )}
                </nav>
              </div>
            </article>
          </main>
        </div>
        <TocRail toc={page.toc} sourceUrl={page.sourceUrl} />
      </div>
    </TocProvider>
  );
}
