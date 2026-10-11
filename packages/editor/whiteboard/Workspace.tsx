"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type RefObject } from "react";
import { Dialog } from "radix-ui";
import { useIdentity } from "../client/identity";
import { useDrawing } from "../inplace/drawing";
import { WHITEBOARD_EVENT, type WhiteboardRequest } from "@jotdown/core/components/blocks/whiteboard/model";

const Canvas = dynamic(() => import("./Canvas"), {
  ssr: false,
  loading: () => <p className="p-6">Loading whiteboard…</p>,
});

/** Opens the page's drawing editor when a whiteboard on the page asks for it. */
export function WhiteboardWorkspace({ container }: { container: RefObject<HTMLDivElement | null> }) {
  const { identity } = useIdentity();
  const { setDrawing } = useDrawing();
  const [request, setRequest] = useState<WhiteboardRequest | null>(null);

  useEffect(() => {
    setDrawing(request !== null);
    return () => setDrawing(false);
  }, [request, setDrawing]);

  useEffect(() => {
    const open = (event: Event) => {
      if (
        !(event instanceof CustomEvent) ||
        !(event.target instanceof Node) ||
        !container.current?.contains(event.target)
      )
        return;
      setRequest(event.detail as WhiteboardRequest);
    };
    document.addEventListener(WHITEBOARD_EVENT, open);
    return () => document.removeEventListener(WHITEBOARD_EVENT, open);
  }, [container]);

  return (
    <Dialog.Root
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) setRequest(null);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content
          className="fixed inset-3 z-50 flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl sm:inset-6"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <Dialog.Title className="sr-only">Edit whiteboard</Dialog.Title>
          <Dialog.Description className="sr-only">
            Edit the drawing, then apply it to your page draft.
          </Dialog.Description>
          {request && identity ? (
            <Canvas request={request} onClose={() => setRequest(null)} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
              <p>This whiteboard cannot be edited here.</p>
              <Dialog.Close className="cursor-pointer rounded-lg border px-4 py-2">Close</Dialog.Close>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
