// Inline stroke icons. All decorative: the controls that use them carry their own labels.
const base = { fill: 'none', 'aria-hidden': true } as const;

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" {...base} style={{ flexShrink: 0, color: 'var(--accent)' }}>
      <rect x="1" y="1" width="30" height="30" rx="8" stroke="currentColor" strokeWidth="2" />
      <circle cx="11" cy="16" r="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="22" cy="16" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M15 16h3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <circle cx="7" cy="7" r="4.75" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" {...base}>
      <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" {...base}>
      <path d="m4 4 10 10M14 4 4 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function ExternalIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" {...base}>
      <path d="M4 2h6v6M10 2 3 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" {...base}>
      <path d="M3 7h8M7.5 3.5 11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" {...base}>
      <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SunIcon() {
  return (
    <svg className="theme-icon-dark" width="20" height="20" viewBox="0 0 20 20" {...base}>
      <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function MoonIcon() {
  return (
    <svg className="theme-icon-light" width="20" height="20" viewBox="0 0 20 20" {...base}>
      <path d="M16.5 12.2A6.5 6.5 0 0 1 7.8 3.5a6.5 6.5 0 1 0 8.7 8.7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" {...base}>
      <rect x="5" y="5" width="8.5" height="8.5" rx="1.75" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 3.5v-.75A1.25 1.25 0 0 0 9.25 1.5h-5A1.75 1.75 0 0 0 2.5 3.25v5A1.25 1.25 0 0 0 3.75 9.5h.75" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" {...base}>
      <path d="M6.5 9.5 9.5 6.5M7 4.5l1-1a2.83 2.83 0 0 1 4 4l-1 1M9 11.5l-1 1a2.83 2.83 0 0 1-4-4l1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CommitIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" {...base}>
      <circle cx="7" cy="7" r="2.25" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1 7h3.75M9.25 7H13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
