/**
 * An edited document back to file text.
 *
 * The whole point of this file is the diff. Re-serialising the tree would work
 * and would also renormalise list markers, emphasis characters and blank lines
 * across the entire document, so every save would touch every line and no
 * review of the result would be possible.
 *
 * So untouched blocks are never printed at all. A block whose current
 * serialisation still matches what it had at parse time is pristine, and runs of
 * consecutive pristine blocks are copied verbatim out of the original source,
 * carrying whatever spacing and oddities sat between them.
 */

import type { JSONContent } from "@tiptap/core";
import type { BlockOrigin, DocFields, ParsedDoc } from "../types";
import { patchFrontmatterField } from "./frontmatter";
import { printBlock } from "./fromProseMirror";

/**
 * Renders the edited document as the new contents of the file.
 *
 * `fields` are the frontmatter title, icon and description as the editor now
 * has them. Leaving it out keeps whatever the file already said.
 */
export function serializeDocument(
  parsed: ParsedDoc,
  doc: JSONContent,
  fields: DocFields = {
    title: parsed.title,
    icon: parsed.icon,
    description: parsed.description,
  },
): string {
  const body = renderBody(parsed, doc.content ?? []);
  const head = renderHead(parsed, fields, body);

  if (body === "") return parsed.source.endsWith("\n") ? `${head}\n` : head;
  return head + body + renderTail(parsed);
}

function renderBody(parsed: ParsedDoc, nodes: JSONContent[]): string {
  const pieces: string[] = [];
  let i = 0;

  while (i < nodes.length) {
    const node = nodes[i];
    if (node === undefined) break;

    const from = pristineOrigin(parsed, node);
    if (from === null) {
      pieces.push(printBlock(node));
      i += 1;
      continue;
    }

    let to = from;
    let end = i + 1;
    for (const following of nodes.slice(end)) {
      const next = pristineOrigin(parsed, following);
      if (next === null || next.srcIndex !== to.srcIndex + 1) break;
      to = next;
      end += 1;
    }

    pieces.push(parsed.source.slice(from.srcStart, to.srcEnd));
    i = end;
  }

  return pieces.filter((piece) => piece.trim() !== "").join("\n\n");
}

type Origin = { srcIndex: number; srcStart: number; srcEnd: number };

/**
 * The source range a block may be spliced from, or null when it has to be
 * printed instead.
 *
 * A block qualifies only if it came from the file and still prints exactly as it
 * did then. Blocks the reader created carry no origin, and an edited block's
 * origin no longer describes it.
 */
function pristineOrigin(parsed: ParsedDoc, node: JSONContent): Origin | null {
  const { srcIndex, srcStart, srcEnd } = (node.attrs ?? {}) as Partial<BlockOrigin>;
  if (typeof srcIndex !== "number" || typeof srcStart !== "number" || typeof srcEnd !== "number") {
    return null;
  }

  if (parsed.pristine.get(srcIndex) !== printBlock(node)) return null;
  return { srcIndex, srcStart, srcEnd };
}

/**
 * The patched frontmatter plus the gap that followed it in the original file.
 *
 * Reusing the original gap rather than assuming one blank line keeps a file that
 * happened to use two from drifting on its first save.
 */
function renderHead(parsed: ParsedDoc, fields: DocFields, body: string): string {
  if (parsed.frontmatter === null) return "";

  const patched = patchFrontmatterField(
    patchFrontmatterField(patchFrontmatterField(parsed.frontmatter, "title", fields.title), "icon", fields.icon),
    "description",
    fields.description,
  );

  const after = parsed.source.slice(parsed.frontmatter.length);
  const gap = after.match(/^\n*/)?.[0] ?? "";

  /**
   * A page with frontmatter and nothing under it yet, which is what a section
   * stub looks like between being created and being written. The gap is the
   * whole tail of the file, so it is kept rather than dropped, less the final
   * newline that `serializeDocument` puts back. Returning `patched` alone here
   * cost such a file one newline on every save.
   */
  if (body === "") return patched + gap.replace(/\n$/, "");

  return patched + (gap === "" ? "\n\n" : gap);
}

/**
 * The whitespace the original file carried after its last block.
 *
 * Usually one newline. A file that ended on a blank line keeps it, so a save
 * that never went near the end of the page does not show up in the diff as a
 * deleted line down there.
 *
 * @example renderTail(parsed); // "\n"
 */
function renderTail(parsed: ParsedDoc): string {
  const ends = (parsed.doc.content ?? [])
    .map((node) => (node.attrs as Partial<BlockOrigin> | undefined)?.srcEnd)
    .filter((end): end is number => typeof end === "number");

  if (ends.length === 0) return parsed.source.endsWith("\n") ? "\n" : "";
  return parsed.source.slice(Math.max(...ends));
}
