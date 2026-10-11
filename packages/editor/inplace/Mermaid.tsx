"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import MermaidDiagram from "../editor/nodes/MermaidDiagram";
import { useInplace, useRecovery, type Inplace } from "./context";
import type { createDiagram } from "./diagram";

type Diagram = NonNullable<ReturnType<typeof createDiagram>>;
const subscribeToNothing = () => () => {};

/**
 * Renders a diagram with its own Edit button, wired to page recovery, comparison and undo.
 * @example <EditableMermaid chart="graph LR\nA-->B" data-src-range="1:1-4:4" />
 */
export function EditableMermaid({ chart, "data-src-range": stamp }: { chart: string; "data-src-range"?: string }) {
  const page = useInplace();
  const recovery = useRecovery();
  const [binding, setBinding] = useState<{ page: Inplace; stamp: string; diagram: Diagram | null } | null>(null);
  const diagram = binding?.page === page && binding?.stamp === stamp ? binding.diagram : null;

  useEffect(() => {
    if (!page || !stamp) return;
    let live = true;
    void Promise.all([import("./diagram"), page.recovery.start()]).then(([{ createDiagram }]) => {
      if (live) setBinding({ page, stamp, diagram: createDiagram(page.source, stamp, page.draft, page.history) });
    });
    return () => {
      live = false;
    };
  }, [page, stamp]);

  const code = useSyncExternalStore(
    diagram?.subscribe ?? subscribeToNothing,
    diagram?.get ?? (() => chart),
    () => chart,
  );
  const writable = page && diagram && !recovery.current;

  return (
    <MermaidDiagram
      code={recovery.current ? chart : code}
      stamp={stamp}
      onChange={writable ? diagram.write : undefined}
      onUndo={writable ? diagram.undo : undefined}
      onRedo={writable ? diagram.redo : undefined}
    />
  );
}
