import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDiagram } from '@/lib/content';

// The minimum share of a diagram's natural width it is drawn at. Wider than the column,
// it scrolls sideways instead of shrinking its labels below a readable size.
const MIN_SCALE = 0.75;

/** A diagram drawn at build time (see scripts/render-diagrams.mjs), in both themes. */
export function Diagram({ hash, chart }: { hash: string; chart: string }) {
  const entry = getDiagram(hash);
  const themes = entry?.themes ?? {};
  return (
    <figure className="diagram" data-diagram={hash}>
      {entry?.error ? (
        <p className="diagram-error" data-diagram-error>
          This diagram in the source does not parse, so it is shown as its source below. Mermaid reports: {entry.error}
        </p>
      ) : (
        <div className="diagram-canvas" role="img" aria-label="Diagram; its source is below">
          {(['light', 'dark'] as const).map((theme) => {
            const t = themes[theme];
            if (!t) return null;
            const svg = readFileSync(join(process.cwd(), 'src', 'content', 'diagrams', t.file), 'utf8');
            return (
              <div
                key={theme}
                className={`diagram-svg diagram-${theme}`}
                style={{ width: `clamp(${Math.round(t.width * MIN_SCALE)}px, 100%, ${t.width}px)`, aspectRatio: `${t.width} / ${t.height}` }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            );
          })}
        </div>
      )}
      <details open={Boolean(entry?.error)}>
        <summary>Diagram source</summary>
        <pre>{chart}</pre>
      </details>
    </figure>
  );
}
