'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useSearchContext } from 'fumadocs-ui/provider';
import { useEffect, useRef, useState } from 'react';
import type { NavGroup, SiteLinks } from '@/lib/nav';
import { CloseIcon, ExternalIcon, LogoMark, MenuIcon, MoonIcon, SearchIcon, SunIcon } from './icons';
import { Sidebar } from './sidebar';

export function Header({ groups, links }: { groups: NavGroup[]; links: SiteLinks }) {
  const pathname = usePathname();
  const { setOpenSearch } = useSearchContext();
  const { resolvedTheme, setTheme } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  // Close the drawer when the route changes.
  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      menuButton.current?.focus();
    };
  }, [drawerOpen]);

  const section = pathname.split('/')[1];
  const toggleTheme = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');

  return (
    <>
      <header className="site-header">
        <button ref={menuButton} type="button" className="icon-btn only-narrow menu-btn" aria-label="Open navigation" aria-expanded={drawerOpen} aria-controls="site-drawer" onClick={() => setDrawerOpen(true)}>
          <MenuIcon />
        </button>
        <Link href="/" className="brand">
          <LogoMark />
          <span className="brand-name">CCIP Timelock DAO</span>
          <span className="brand-tag">docs</span>
        </Link>
        <button type="button" className="search-box only-wide" onClick={() => setOpenSearch(true)}>
          <SearchIcon />
          <span>Search docs</span>
          <kbd>⌘K</kbd>
        </button>
        <div className="header-spacer" />
        <nav aria-label="Site" className="site-nav only-wide">
          <Link href={links.guide} aria-current={section === 'guide' ? 'true' : undefined}>
            Guide
          </Link>
          <Link href={links.reference} aria-current={section === 'reference' ? 'true' : undefined}>
            Reference
          </Link>
          {links.liveDemo && (
            <a href={links.liveDemo}>
              Live demo
              <ExternalIcon />
            </a>
          )}
          <a href={links.repo}>
            GitHub
            <ExternalIcon />
          </a>
        </nav>
        <span className="header-divider only-wide" aria-hidden="true" />
        <button type="button" className="icon-btn only-narrow" aria-label="Search the docs" onClick={() => setOpenSearch(true)}>
          <SearchIcon size={20} />
        </button>
        <button type="button" className="icon-btn theme-btn" aria-label="Switch between light and dark theme" onClick={toggleTheme}>
          <SunIcon />
          <MoonIcon />
        </button>
      </header>

      {drawerOpen && (
        <>
          <div className="drawer-scrim" aria-hidden="true" onClick={() => setDrawerOpen(false)} />
          <div id="site-drawer" role="dialog" aria-modal="true" aria-label="Navigation" className="drawer">
            <div className="drawer-head">
              <Link href="/" className="brand">
                <LogoMark size={26} />
                <span className="brand-name">CCIP Timelock DAO</span>
              </Link>
              <button ref={closeButton} type="button" className="icon-btn" aria-label="Close navigation" onClick={() => setDrawerOpen(false)}>
                <CloseIcon />
              </button>
            </div>
            <Sidebar groups={groups} links={links} label="Docs (menu)" />
            <div className="drawer-links">
              <Link href={links.guide}>Guide</Link>
              <Link href={links.reference}>Reference</Link>
              {links.liveDemo && (
                <a href={links.liveDemo}>
                  Live demo
                  <ExternalIcon />
                </a>
              )}
              <a href={links.repo}>
                GitHub
                <ExternalIcon />
              </a>
            </div>
          </div>
        </>
      )}
    </>
  );
}
