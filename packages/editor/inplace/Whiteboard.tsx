"use client";

import { useRef } from "react";
import { useEditable } from "./useEditable";
import { WhiteboardPreview } from "@jotdown/core/components/blocks/whiteboard/Preview";
import { whiteboardData, type WhiteboardData } from "@jotdown/core/components/blocks/whiteboard/model";

/** Renders a whiteboard preview and hands its stamped block to in-place editing.
 * @example <EditableWhiteboard src="/whiteboards/a.excalidraw" preview="/whiteboards/a.png" />
 */
export function EditableWhiteboard(props: Partial<WhiteboardData> & { "data-src-range"?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useEditable(root, props["data-src-range"]);
  return (
    <div ref={root} data-src-range={props["data-src-range"]}>
      <WhiteboardPreview data={whiteboardData(props)} />
    </div>
  );
}
