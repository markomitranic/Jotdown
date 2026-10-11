import { mdastToMarkdown, parseMarkdown } from "../markdown/pipeline";
import { rangeIn } from "@jotdown/core/lib/source-range";
import type { Draft } from "./draft";
import type { History } from "./history";

/**
 * Connects a Mermaid fence to the page's draft and shared undo history.
 * @example const diagram = createDiagram(source, stamp, draft, history); diagram?.write("graph LR\nA-->B");
 */
export function createDiagram(source: string, stamp: string, draft: Draft, history: History) {
  const range = rangeIn(source, stamp);
  if (!range) return null;
  const original = readDiagram(source.slice(range.start, range.end));
  if (!original) return null;

  const group = {};
  let cachedMarkdown: string | null = null;
  let cachedCode = original.value;
  const restored = draft.edits().get(stamp);
  if (restored !== undefined) {
    history.did({ undo: () => draft.write(stamp, null), redo: () => draft.write(stamp, restored) });
  }

  return {
    subscribe(listener: () => void) {
      return draft.subscribe((change) => {
        if (change === "clear") cachedMarkdown = null;
        listener();
      });
    },
    get() {
      const markdown = draft.edits().get(stamp) ?? null;
      if (markdown !== cachedMarkdown) {
        cachedMarkdown = markdown;
        cachedCode = markdown === null ? original.value : (readDiagram(markdown)?.value ?? original.value);
      }
      return cachedCode;
    },
    write(code: string) {
      const before = draft.edits().get(stamp) ?? null;
      const after = code === original.value ? null : mdastToMarkdown({ ...original, value: code });
      if (before === after) return;
      history.did({ undo: () => draft.write(stamp, before), redo: () => draft.write(stamp, after) }, group);
      cachedMarkdown = after;
      cachedCode = code;
      draft.write(stamp, after);
    },
    undo: history.undo,
    redo: history.redo,
  };
}

/** Reads exactly one Mermaid fence, leaving authored JSX and other block shapes untouched. */
function readDiagram(markdown: string) {
  const [block, ...rest] = parseMarkdown(markdown).children;
  return block?.type === "code" && block.lang === "mermaid" && rest.length === 0 ? block : null;
}
