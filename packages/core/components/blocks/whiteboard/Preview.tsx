"use client";

import Image from "next/image";
import { IMAGE, optimizable } from "@jotdown/core/lib/images";
import type { WhiteboardData, WhiteboardRequest } from "./model";
import { WHITEBOARD_EVENT } from "./model";

/** Shows the committed preview and asks the page to open its shared whiteboard editor.
 * @example <WhiteboardPreview data={data} />
 */
export function WhiteboardPreview({ data, edit }: { data: WhiteboardData; edit?: Omit<WhiteboardRequest, "data"> }) {
  const download = data.scene ? `data:application/json;charset=utf-8,${encodeURIComponent(data.scene)}` : data.src;

  return (
    <figure className="not-prose my-4 overflow-hidden rounded-xl border border-border bg-card">
      {data.preview ? (
        <Image
          src={data.preview}
          alt="Whiteboard drawing"
          width={IMAGE.column}
          height={0}
          sizes={IMAGE.sizes}
          unoptimized={!optimizable(data.preview)}
          className="m-0 max-h-[600px] w-full object-contain"
        />
      ) : (
        <div className="p-12 text-center text-muted-foreground">Empty whiteboard</div>
      )}
      <figcaption className="flex items-center justify-between gap-3 border-border border-t px-4 py-2 text-sm">
        <span>Whiteboard</span>
        <div className="flex gap-4">
          {download && (
            <a href={download} download="whiteboard.excalidraw">
              Download drawing
            </a>
          )}
          {edit && (
            <button
              type="button"
              className="cursor-pointer font-medium"
              onClick={(event) => {
                event.currentTarget.dispatchEvent(
                  new CustomEvent<WhiteboardRequest>(WHITEBOARD_EVENT, {
                    bubbles: true,
                    detail: { data, ...edit },
                  }),
                );
              }}
            >
              Edit whiteboard
            </button>
          )}
        </div>
      </figcaption>
    </figure>
  );
}
