"use client";

import { useMemo, type ReactNode } from "react";
import { KitEditorScope, type KitEditor } from "@jotdown/kit";
import { rangeIn, stampAt } from "@jotdown/core/lib/source-range";
import { useInplace, type Inplace } from "../inplace/context";
import { openingTag, withChildren, withProp } from "./tag";

/**
 * Gives the project blocks of an editable page the editor their primitives write through.
 *
 * Outside an editable page the blocks get none, and draw as they would on the site.
 *
 * @example <ProjectEditing><MDX components={components} /></ProjectEditing>
 */
export function ProjectEditing({ children }: { children: ReactNode }) {
  const inplace = useInplace();
  const editor = useMemo(() => (inplace ? kitEditor(inplace) : null), [inplace]);

  return <KitEditorScope editor={editor}>{children}</KitEditorScope>;
}

/** What has been changed in one block's tag: its props, and the first paragraph written into it. */
type TagEdits = { props: Map<string, string>; fill: string | null };

/**
 * The editor a page hands its project blocks: every change is written into the block's opening tag.
 *
 * The tag is a stretch of the file of its own in the draft, so a prop edited
 * beside prose typed between the tags never overwrites it, and the block
 * carries both wherever it is moved. The stretch starts after the `<`, so it
 * stays inside the block's own even when the tag is the whole block. The tag is written again from the file's
 * own each time, with every change so far laid over it, so typing a prop
 * twice or filling a block twice replaces rather than adds.
 */
function kitEditor(inplace: Inplace): KitEditor {
  const tags = new Map<string, TagEdits>();

  function edit(stamp: string, change: (edits: TagEdits) => void) {
    const range = rangeIn(inplace.source, stamp);
    if (range === null) return;

    const slice = inplace.source.slice(range.start, range.end);
    const tag = openingTag(slice);
    if (tag === null) return;

    const tagStamp = stampAt(inplace.source, range.start + tag.start + 1, range.start + tag.end);
    const edits = tags.get(tagStamp) ?? { props: new Map(), fill: null };
    change(edits);
    tags.set(tagStamp, edits);

    let block = slice.slice(tag.start);
    for (const [prop, value] of edits.props) block = withProp(block, prop, value);
    if (edits.fill !== null) block = withChildren(block, edits.fill);

    const rest = slice.slice(tag.end);
    const original = slice.slice(tag.start + 1, tag.end);
    const written = block.slice(1, block.length - rest.length);
    inplace.draft.write(tagStamp, written === original ? null : written);
  }

  return {
    setProp: (stamp, prop, value) => edit(stamp, (edits) => edits.props.set(prop, value)),
    fill: (stamp, text) =>
      edit(stamp, (edits) => {
        edits.fill = text;
      }),
    upload: (file) => inplace.uploading.uploadImage(file),
  };
}
