import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { RootProvider } from 'fumadocs-ui/provider';
import type { ReactNode } from 'react';
import { Header } from '@/components/header';
import { Markdown } from '@/components/markdown';
import { getHomeFacts } from '@/lib/content';
import { getNav, SITE_NAME, SITE_URL } from '@/lib/site';
import './global.css';

const sans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], style: ['normal', 'italic'], variable: '--font-plex-sans', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const facts = await getHomeFacts();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
    description: facts.ledeText,
    openGraph: { type: 'website', siteName: SITE_NAME, url: SITE_URL },
    icons: { icon: '/icon.svg' },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1015' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { groups, links } = await getNav();
  const facts = await getHomeFacts();
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <RootProvider search={{ options: { type: 'static' } }}>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <Header groups={groups} links={links} />
          <div id="main">{children}</div>
          <footer className="site-footer">
            <div className="site-footer-inner">
              <div className="footer-licence">
                <Markdown tree={facts.licence} />
              </div>
              <p className="mono">
                Built from {links.ref} @ <a href={links.commitUrl}>{links.commitShort}</a>
              </p>
            </div>
          </footer>
        </RootProvider>
      </body>
    </html>
  );
}
