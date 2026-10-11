"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { RenderResult } from "mermaid";
import { Button } from "@jotdown/core/components/ui/button";
import DiagramStage from "@jotdown/core/components/blocks/mermaid/DiagramStage";
import { MERMAID_CONFIG } from "@jotdown/core/components/blocks/mermaid/config";
import { answeredFor } from "@jotdown/core/lib/source-range";

/** Loads Mermaid on demand and draws one chart, so the library only arrives on a page that has one. */
async function draw(id: string, chart: string) {
  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({ startOnLoad: false, ...MERMAID_CONFIG });
  return mermaid.render(id, chart);
}

/**
 * A ```mermaid fence, as a preview that shrinks to the column and a stage that fills the window.
 *
 * The compiler rewrites every fence into `<Mermaid chart="…" />`, so this
 * is the only place a diagram is drawn. Inline the drawing reads like an image;
 * clicking it opens the stage, where the reader pans with the trackpad and zooms
 * with a pinch the way a design canvas does. A chart Mermaid cannot parse falls
 * back to its own source, which is the one form that is never wrong.
 *
 * A stamped diagram is marked as answered for, because a diagram edits through
 * its own Edit button and would otherwise be picked up a second time by the
 * page's sweep for blocks nobody answers for.
 */
export function Mermaid({
  chart,
  onEdit,
  "data-src-range": stamp,
}: {
  chart: string;
  onEdit?(): void;
  "data-src-range"?: string;
}) {
  const id = `mermaid-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const drawing = useDrawing(id, chart);
  const result = drawing.data;
  const [expanded, setExpanded] = useState(false);

  return (
    <figure className="jd-diagram" data-src-range={stamp} {...answeredFor(stamp)}>
      {onEdit && (
        <Button type="button" variant="outline" size="sm" className="relative z-2 mb-2 cursor-pointer" onClick={onEdit}>
          Edit diagram
        </Button>
      )}
      {drawing.isError ? (
        <pre className="jd-diagram__source">{chart}</pre>
      ) : !result ? (
        <p role="status">Rendering diagram…</p>
      ) : (
        <button
          type="button"
          className="jd-diagram__preview"
          aria-label="Open diagram fullscreen"
          onClick={() => setExpanded(true)}
        >
          <Drawing result={result} />
        </button>
      )}

      {expanded && result && <DiagramStage svg={result.svg} onClose={() => setExpanded(false)} />}
    </figure>
  );
}

/**
 * One chart drawn by Mermaid, kept for as long as its source stays the same.
 *
 * A chart that does not parse is not tried again: the same source fails the
 * same way.
 *
 * @example const drawing = useDrawing("mermaid-r1", "graph TD; A-->B"); // drawing.data?.svg
 */
function useDrawing(id: string, chart: string) {
  return useQuery({
    queryKey: ["mermaid", id, chart],
    queryFn: () => draw(id, chart),
    staleTime: Infinity,
    retry: false,
  });
}

/** Puts Mermaid's SVG string on the page and lets it attach its own click handlers. */
function Drawing({ result }: { result: RenderResult }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) result.bindFunctions?.(ref.current);
  }, [result]);

  // biome-ignore lint/security/noDangerouslySetInnerHtml: the SVG Mermaid rendered from the page's own diagram
  return <div ref={ref} dangerouslySetInnerHTML={{ __html: result.svg }} />;
}
