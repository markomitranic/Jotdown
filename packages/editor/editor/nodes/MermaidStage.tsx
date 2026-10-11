import mermaid from "mermaid";
import { MERMAID_CONFIG } from "@jotdown/core/components/blocks/mermaid/config";
import { useEffect, useId, useState } from "react";
import { skipToken, useQuery } from "@tanstack/react-query";
import { settle } from "@jotdown/core/lib/settle";
import { createPortal } from "react-dom";
import { cn } from "cn";
import { detectDiagramType } from "@visimer/core";
import { MermaidWysiwyg } from "@visimer/react";
import type { MermaidCanvasView, MermaidWysiwygEditor } from "@visimer/react";

type Tool = "select" | "connect";

type Props = {
  code: string;
  onCodeChange: (code: string) => void;
  onUndo?(): void;
  onRedo?(): void;
  onClose: () => void;
};

type Handles = { editor: MermaidWysiwygEditor; view: MermaidCanvasView };

/**
 * What "add one more of these" means in each diagram we can draw into.
 *
 * A flowchart goes through the canvas rather than the editor, because that
 * route opens the new node's label editor on the spot. The other two land as a
 * shape waiting to be renamed, which is a double-click away.
 */
const ADDITIONS = {
  flowchart: { label: "Add node", add: ({ view }: Handles) => view.addNode() },
  sequence: {
    label: "Add participant",
    add: ({ editor }: Handles) => editor.dispatch({ type: "seq.addParticipant" }),
  },
  state: {
    label: "Add state",
    add: ({ editor }: Handles) => editor.dispatch({ type: "st.addState" }),
  },
} as const;

/** The diagram's kind, read off its header line, or null if we cannot draw it. */
function additionFor(code: string) {
  const header = code
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line !== "");
  if (header === undefined) return null;

  const id = detectDiagramType(header)?.id;
  return id !== undefined && id in ADDITIONS ? ADDITIONS[id as keyof typeof ADDITIONS] : null;
}

/**
 * Edits Mermaid visually or as source, sending changes and undo to the page draft.
 * @example <MermaidStage code={code} onCodeChange={write} onClose={close} />
 */
export default function MermaidStage({ code, onCodeChange, onUndo, onRedo, onClose }: Props) {
  const [source, setSource] = useState(false);
  const [originalCode, setOriginalCode] = useState(code);
  const [tool, setTool] = useState<Tool>("select");
  const [handles, setHandles] = useState<Handles | null>(null);
  const addition = additionFor(code);
  const errorId = useId();
  const validation = useQuery({
    queryKey: ["mermaid", "syntax", code],
    queryFn: source ? ({ signal }) => syntaxError(code, signal) : skipToken,
    staleTime: Infinity,
    retry: false,
  });
  const pending = source && validation.isPending;
  const error = validation.data ?? null;
  const canFinish = !source || (!pending && !error);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && canFinish) onClose();
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z" || !onUndo) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.shiftKey) onRedo?.();
      else onUndo();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose, onUndo, onRedo, canFinish]);

  return createPortal(
    <div
      className="jd-stage jd-stage--editing jd-stage--mermaid"
      role="dialog"
      aria-modal="true"
      aria-label="Edit diagram"
    >
      <div className="jd-stage__toolbar">
        <button
          type="button"
          aria-pressed={source}
          disabled={!canFinish}
          onClick={() => {
            setHandles(null);
            if (!source) setOriginalCode(code);
            setSource(!source);
          }}
        >
          {source ? "Diagram" : "Source"}
        </button>
        {source && (
          <button
            type="button"
            onClick={() => {
              onCodeChange(originalCode);
              setSource(false);
            }}
          >
            Discard source changes
          </button>
        )}
        {onUndo && (
          <button type="button" onClick={onUndo}>
            Undo
          </button>
        )}
        {onRedo && (
          <button type="button" onClick={onRedo}>
            Redo
          </button>
        )}
        {!source && addition !== null && (
          <button type="button" onClick={() => handles !== null && addition.add(handles)} disabled={handles === null}>
            {addition.label}
          </button>
        )}
        {!source && (
          <button
            type="button"
            className={cn(tool === "connect" && "text-primary ring-1 ring-primary")}
            aria-pressed={tool === "connect"}
            onClick={() => setTool(tool === "connect" ? "select" : "connect")}
          >
            Connect
          </button>
        )}
        {!source && (
          <button type="button" onClick={() => handles?.view.fitView()}>
            Fit
          </button>
        )}
        <button type="button" onClick={onClose} disabled={!canFinish}>
          Done
        </button>
      </div>

      {source ? (
        <div className="absolute inset-x-4 top-20 bottom-4 flex flex-col gap-3">
          <textarea
            aria-label="Mermaid source"
            spellCheck={false}
            value={code}
            // biome-ignore lint/a11y/noAutofocus: opening the source view is asking to type in it
            autoFocus
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => onCodeChange(event.target.value)}
            className="min-h-0 flex-1 resize-none rounded-lg border border-border bg-background p-4 font-mono text-foreground text-sm"
          />
          {pending && (
            <p role="status" className="text-muted-foreground text-sm">
              Checking syntax…
            </p>
          )}
          {error && (
            <pre
              id={errorId}
              role="alert"
              className="max-h-48 shrink-0 overflow-auto whitespace-pre-wrap rounded-lg border border-red-500/30 bg-background p-4 text-red-600 text-sm dark:text-red-400"
            >
              {error}
            </pre>
          )}
        </div>
      ) : (
        <MermaidWysiwyg
          code={code}
          onCodeChange={onCodeChange}
          mermaid={mermaid}
          mermaidConfig={MERMAID_CONFIG}
          tool={tool}
          panZoom
          className="h-full w-full"
          onReady={(editor, view) => setHandles({ editor, view })}
        />
      )}
    </div>,
    document.body,
  );
}

/**
 * Why a diagram's source will not parse, or null when it does, once typing pauses.
 *
 * @example await syntaxError("graph TD; A-->", signal); // "Parse error on line 1: ..."
 */
async function syntaxError(code: string, signal: AbortSignal) {
  await settle(signal, 300);
  try {
    await mermaid.parse(code);
    return null;
  } catch (cause) {
    return cause instanceof Error ? cause.message : String(cause);
  }
}
