import { parseMarkdown } from "../markdown/pipeline";
import { rangeIn } from "@jotdown/core/lib/source-range";
import { applyDraft } from "./draft";
import type { Conflict, RecoveryCopy } from "./recovery";

/**
 * Moves edits only onto uniquely matching whole blocks; changed or ambiguous blocks need review.
 *
 * The front matter block counts as one of them. Nothing in the article edits
 * it, but the page's own title, icon and description do, through a stamp over
 * the same lines the compiler gives that `yaml` node, so leaving it out of the
 * blocks a stamp can land on turned every field edit into a conflict.
 *
 * @example recoverEdits(copy, newerSource); // { edits, conflicts }
 */
export function recoverEdits(
  copy: RecoveryCopy,
  source: string,
): {
  edits: Map<string, string>;
  conflicts: Conflict[];
  replacement?: string;
} {
  const edits = new Map<string, string>();
  const conflicts: Conflict[] = [...(copy.conflicts ?? [])];
  if (applyDraft(copy.replacement ?? copy.source, new Map(copy.edits)) === source) return { edits, conflicts };

  if (copy.replacement !== undefined) {
    if (copy.source === source) return { edits: new Map(copy.edits), conflicts, replacement: copy.replacement };
    conflicts.push({
      stamp: "page",
      before: copy.source,
      after: applyDraft(copy.replacement, new Map(copy.edits)),
    });
    return { edits, conflicts };
  }

  const blocks = parseMarkdown(source).children.flatMap((node) => {
    const position = node.position;
    if (!position) return [];
    const { start, end } = position;
    return [
      {
        stamp: `${start.line}:${start.column}-${end.line}:${end.column}`,
        text: source.slice(start.offset, end.offset),
      },
    ];
  });

  const oldBlocks = parseMarkdown(copy.source).children.flatMap((node) => {
    const position = node.position;
    return position ? [copy.source.slice(position.start.offset, position.end.offset)] : [];
  });

  for (const [stamp, after] of copy.edits) {
    const range = rangeIn(copy.source, stamp);
    const before = range ? copy.source.slice(range.start, range.end) : "";
    const matches = blocks.filter((block) => block.text === before);
    const target =
      source === copy.source
        ? blocks.find((block) => block.stamp === stamp)
        : matches.length === 1 && oldBlocks.filter((text) => text === before).length === 1
          ? matches[0]
          : undefined;

    if (!target || edits.has(target.stamp)) conflicts.push({ stamp, before, after });
    else edits.set(target.stamp, after);
  }

  return { edits, conflicts };
}
