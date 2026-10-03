'use client';

import { useState } from 'react';
import { CopyIcon } from './icons';

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused: select the command so it can be copied by hand.
      const pre = document.getElementById('scaffold-command');
      if (pre) window.getSelection()?.selectAllChildren(pre);
    }
  };
  return (
    <button type="button" className="copy-btn" aria-label={label} onClick={copy}>
      <CopyIcon />
      <span className="only-wide" aria-live="polite">
        {copied ? 'Copied' : 'Copy'}
      </span>
    </button>
  );
}
