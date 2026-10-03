'use client';

import { AnchorProvider, TOCItem, useActiveAnchor, type TOCItemType } from 'fumadocs-core/toc';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDownIcon, ExternalIcon } from './icons';

/** Tracks which heading is in view for both the rail and the phone dropdown. */
export function TocProvider({ toc, children }: { toc: TOCItemType[]; children: ReactNode }) {
  return (
    <AnchorProvider toc={toc} single>
      {children}
    </AnchorProvider>
  );
}

export function TocRail({ toc, sourceUrl }: { toc: TOCItemType[]; sourceUrl: string }) {
  return (
    <aside className="docs-rail" aria-label="On this page">
      {toc.length > 0 && (
        <>
          <span className="rail-label">On this page</span>
          <ul className="toc-list">
            {toc.map((item) => (
              <li key={item.url}>
                <TOCItem href={item.url} data-depth={item.depth}>
                  {item.title}
                </TOCItem>
              </li>
            ))}
          </ul>
        </>
      )}
      <a className="rail-source" href={sourceUrl}>
        View the source
        <ExternalIcon size={11} />
      </a>
    </aside>
  );
}

export function TocDropdown({ toc }: { toc: TOCItemType[] }) {
  const active = useActiveAnchor();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (toc.length === 0) return null;
  const current = toc.find((t) => t.url === `#${active}`) ?? toc[0]!;
  return (
    <>
      {open && <div className="toc-scrim" aria-hidden="true" onClick={() => setOpen(false)} />}
      <div className="toc-bar">
        <button ref={button} type="button" className="toc-bar-btn" aria-expanded={open} aria-controls="toc-pop" onClick={() => setOpen((v) => !v)}>
          <span className="label">On this page</span>
          <span className="current">{current.title}</span>
          <ChevronDownIcon />
        </button>
        {open && (
          <ul id="toc-pop" className="toc-list toc-pop">
            {toc.map((item) => (
              <li key={item.url}>
                <TOCItem href={item.url} data-depth={item.depth} onClick={() => setOpen(false)}>
                  {item.title}
                </TOCItem>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
