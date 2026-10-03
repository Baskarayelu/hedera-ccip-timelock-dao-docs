'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavGroup, SiteLinks } from '@/lib/nav';
import { CommitIcon } from './icons';

export function Sidebar({ groups, links, label = 'Docs' }: { groups: NavGroup[]; links: SiteLinks; label?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="sidebar">
      {groups.map((g) => (
        <div key={g.title}>
          <span className="sidebar-group-label">{g.title}</span>
          <ul>
            {g.items.map((item) => (
              <li key={item.url}>
                <Link href={item.url} aria-current={pathname === item.url ? 'page' : undefined}>
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <SourcePin links={links} />
    </nav>
  );
}

export function SourcePin({ links }: { links: SiteLinks }) {
  return (
    <p className="source-pin">
      <CommitIcon />
      <span>
        Docs from {links.ref} @ <a href={links.commitUrl}>{links.commitShort}</a>
      </span>
    </p>
  );
}
