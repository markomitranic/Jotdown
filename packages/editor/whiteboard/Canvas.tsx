"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Excalidraw, exportToBlob, loadFromBlob, serializeAsJSON } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import {
  MAX_WHITEBOARD_BYTES,
  readScene,
  type WhiteboardData,
  type WhiteboardRequest,
} from "@jotdown/core/components/blocks/whiteboard/model";
import { confirmInPage } from "@jotdown/core/components/confirm";
import { dataUrl } from "./fromFile";

/** Hosts Excalidraw and applies its editable file and preview to the page draft. */
export default function WhiteboardCanvas({ request, onClose }: { request: WhiteboardRequest; onClose(): void }) {
  const api = useRef<ExcalidrawImperativeAPI | null>(null);
  const changed = useRef(false);
  const baseline = useRef<string | null>(null);

  const loading = useQuery({
    queryKey: ["whiteboard", request.data.src, request.data.scene],
    queryFn: ({ signal }) => loadDrawing(request.data, signal),
    staleTime: Infinity,
    gcTime: 0,
  });
  const initial = loading.data;

  const applying = useMutation({
    mutationFn: (editor: ExcalidrawImperativeAPI) => applyDrawing(editor, request),
    onSuccess: onClose,
  });
  const busy = applying.isPending;
  const error = applying.error?.message ?? loading.error?.message;

  /** Exports the current scene and image together, leaving the actual commit to page Save. */
  function apply() {
    const editor = api.current;
    if (!editor || !request.alive()) return;
    applying.mutate(editor);
  }

  /** Confirms before closing a drawing that has not been applied to its page draft. */
  async function close() {
    const closing =
      !changed.current ||
      (await confirmInPage({
        title: "Discard this drawing's changes?",
        description: "They were never applied to the page.",
        confirm: "Discard changes",
      }));
    if (closing) onClose();
  }

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (changed.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);

  return (
    <>
      <div className="flex items-center justify-between gap-4 border-border border-b px-4 py-3">
        <span className="text-sm">Apply to draft, then save the page.</span>
        <div className="flex shrink-0 gap-3">
          <button type="button" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
            onClick={apply}
            disabled={busy || !initial}
          >
            {busy ? "Preparing…" : "Apply to page"}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="px-4 py-2 text-red-600">
          {error}
        </p>
      )}
      <div className="min-h-0 flex-1">
        {initial && (
          <Excalidraw
            initialData={initial}
            excalidrawAPI={(instance) => {
              api.current = instance;
            }}
            viewModeEnabled={busy}
            onChange={(elements, appState, files) => {
              const fingerprint = JSON.stringify([
                elements.map((element) => [element.id, element.version, element.isDeleted]),
                appState.viewBackgroundColor,
                Object.keys(files),
              ]);
              if (baseline.current === null) baseline.current = fingerprint;
              else changed.current = baseline.current !== fingerprint;
            }}
          />
        )}
      </div>
    </>
  );
}

/**
 * Reads a whiteboard's drawing into what Excalidraw opens with, inline or from its file.
 *
 * Only a content-addressed file under `/whiteboards/` is fetched, and the scene
 * is checked before Excalidraw sees it. No drawing at all opens an empty canvas.
 *
 * @example const initial = await loadDrawing(request.data, signal);
 */
async function loadDrawing(data: WhiteboardData, signal: AbortSignal) {
  let text = data.scene;
  if (!text && data.src) {
    if (!/^\/whiteboards\/[a-f0-9]{64}\.excalidraw$/.test(data.src)) throw new Error("Invalid whiteboard file path.");
    const response = await fetch(data.src, { signal });
    if (!response.ok) throw new Error("The whiteboard file could not be loaded.");
    text = await response.text();
  }
  if (text) readScene(text);
  const restored = text ? await loadFromBlob(new Blob([text], { type: "application/json" }), null, null) : {};
  return { ...restored, scrollToContent: true };
}

/**
 * Writes the editor's scene and a PNG preview of it into the page draft.
 *
 * Refuses a drawing too large to commit, and a page that changed underneath the
 * window, rather than writing into the wrong block.
 *
 * @example await applyDrawing(editor, request);
 */
async function applyDrawing(editor: ExcalidrawImperativeAPI, request: WhiteboardRequest) {
  const elements = editor.getSceneElements();
  const appState = editor.getAppState();
  const files = editor.getFiles();
  const scene = serializeAsJSON(elements, appState, files, "local");
  const blob = await exportToBlob({
    elements,
    files,
    appState: {
      ...appState,
      exportBackground: true,
      exportWithDarkMode: false,
      exportEmbedScene: false,
    },
    mimeType: "image/png",
    maxWidthOrHeight: 1600,
  });
  const preview = await dataUrl(blob);
  if (new TextEncoder().encode(scene + preview).byteLength > MAX_WHITEBOARD_BYTES) {
    throw new Error("This whiteboard is too large. Use smaller images to keep the drawing and preview under 3 MB.");
  }
  if (!request.alive())
    throw new Error("The page changed while this drawing was open. Download the drawing before closing.");
  request.write({ src: request.data.src, scene, preview });
}
