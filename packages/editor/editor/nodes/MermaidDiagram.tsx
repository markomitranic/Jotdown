"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Mermaid } from "@jotdown/core/components/blocks/Mermaid";
import { Button } from "@jotdown/core/components/ui/button";
import { answeredFor } from "@jotdown/core/lib/source-range";
import { DIAGRAM_TEMPLATES } from "./mermaidTemplates";

const MermaidStage = lazy(() => import("./MermaidStage"));

type Props = {
  code: string;
  stamp?: string;
  onChange?(code: string): void;
  onUndo?(): void;
  onRedo?(): void;
};

/**
 * Shares the reader's diagram preview; only the Edit button opens the graphical editor.
 * @example <MermaidDiagram code={code} onChange={write} />
 */
export default function MermaidDiagram({ code, stamp, onChange, onUndo, onRedo }: Props) {
  const [editing, setEditing] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  /** Closes the stage and returns keyboard focus to its editing control. */
  function close() {
    setEditing(false);
    root.current?.querySelector<HTMLButtonElement>("figure button")?.focus();
  }

  useEffect(() => {
    if (!onChange) setEditing(false);
  }, [onChange]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: catches undo and redo as they bubble up from the diagram's own controls
    <div
      ref={root}
      className="contents"
      onKeyDown={(event) => {
        if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z" || !onUndo) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) onRedo?.();
        else onUndo();
      }}
    >
      {code.trim() === "" && onChange ? (
        <figure className="jd-diagram flex flex-wrap items-center gap-2" data-src-range={stamp} {...answeredFor(stamp)}>
          <span>Start a diagram</span>
          {DIAGRAM_TEMPLATES.map((template) => (
            <Button
              key={template.title}
              size="sm"
              variant="outline"
              onClick={() => {
                onChange(template.code);
                setEditing(true);
              }}
            >
              {template.title}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit diagram
          </Button>
        </figure>
      ) : (
        <Mermaid chart={code} data-src-range={stamp} onEdit={onChange ? () => setEditing(true) : undefined} />
      )}
      {editing && onChange && (
        <Suspense fallback={<p role="status">Loading diagram editor…</p>}>
          <MermaidStage code={code} onCodeChange={onChange} onUndo={onUndo} onRedo={onRedo} onClose={close} />
        </Suspense>
      )}
    </div>
  );
}
