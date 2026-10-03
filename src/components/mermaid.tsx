'use client';

import { useTheme } from 'next-themes';
import { useEffect, useId, useRef, useState } from 'react';

// A diagram wider than the column is drawn at no less than this share of its natural size
// and scrolls sideways, so its labels stay readable.
const MIN_SCALE = 0.75;

// Colours come from the site's tokens so diagrams follow the light and dark themes.
function themeVariables() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    fontFamily: v('--font-sans') || 'sans-serif',
    fontSize: '14px',
    background: v('--surface-2'),
    primaryColor: v('--diagram-node'),
    primaryTextColor: v('--ink'),
    primaryBorderColor: v('--diagram-line'),
    secondaryColor: v('--diagram-cluster'),
    tertiaryColor: v('--diagram-cluster'),
    lineColor: v('--diagram-edge'),
    textColor: v('--ink'),
    clusterBkg: v('--diagram-cluster'),
    clusterBorder: v('--diagram-line'),
    edgeLabelBackground: v('--surface-2'),
    actorBkg: v('--diagram-node'),
    actorBorder: v('--diagram-line'),
    actorTextColor: v('--ink'),
    actorLineColor: v('--diagram-line'),
    signalColor: v('--diagram-edge'),
    signalTextColor: v('--ink'),
    labelBoxBkgColor: v('--diagram-node'),
    labelBoxBorderColor: v('--diagram-line'),
    labelTextColor: v('--ink'),
    loopTextColor: v('--ink'),
    noteBkgColor: v('--diagram-note'),
    noteBorderColor: v('--diagram-note-line'),
    noteTextColor: v('--ink'),
    sequenceNumberColor: v('--bg'),
  };
}

export function Mermaid({ chart }: { chart: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState<string>();
  const [error, setError] = useState<string>();
  const canvas = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          themeVariables: themeVariables(),
          flowchart: { useMaxWidth: false },
          sequence: { useMaxWidth: false },
        });
        const { svg } = await mermaid.render(`mermaid-${id}-${resolvedTheme ?? 'x'}`, chart);
        if (!cancelled) setSvg(svg);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, id, resolvedTheme]);

  // Fit the drawing to the column, but never below MIN_SCALE of its natural width.
  useEffect(() => {
    const el = canvas.current;
    const svgEl = el?.querySelector('svg');
    if (!el || !svgEl) return;
    const natural = svgEl.viewBox.baseVal?.width || svgEl.getBoundingClientRect().width;
    const fit = () => {
      const available = el.clientWidth - 36;
      const width = natural <= available ? natural : Math.max(available, natural * MIN_SCALE);
      svgEl.style.width = `${width}px`;
      svgEl.removeAttribute('height');
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [svg]);

  return (
    <figure className="diagram">
      <div ref={canvas} className="diagram-canvas" role="img" aria-label="Diagram; its source is below">
        {svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : error ? <p>This diagram could not be drawn: {error}</p> : null}
      </div>
      <details>
        <summary>Diagram source</summary>
        <pre>{chart}</pre>
      </details>
    </figure>
  );
}
