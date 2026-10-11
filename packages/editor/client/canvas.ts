"use client";

import { fromStudio } from "@jotdown/core/lib/canvas";
import type { Transport } from "./api";

/**
 * The editor's requests, carried to the studio that framed the canvas and answered there.
 *
 * Each request goes up as a `request` message with an id, and comes back as the
 * `response` with the same id, made into a `Response` so the editor reads it
 * exactly as it reads one from `fetch`. A file being uploaded travels as the
 * `Blob` it is. A studio that never answers fails the request after a minute,
 * which the editor reports as a connection problem.
 *
 * @example sendRequestsThrough(canvasTransport(window.parent, "http://127.0.0.1:53041"));
 */
export function canvasTransport(studio: Window, origin: string): Transport {
  const waiting = new Map<string, (response: Response) => void>();

  window.addEventListener("message", (event) => {
    if (event.origin !== origin) return;
    const message = fromStudio.safeParse(event.data);
    if (!message.success || message.data.type !== "response") return;

    const { id, status, body } = message.data;
    waiting.get(id)?.(new Response(body === undefined ? null : JSON.stringify(body), { status }));
    waiting.delete(id);
  });

  return async (url, init) => {
    const id = crypto.randomUUID();
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const answer = new Promise<Response>((resolve, reject) => {
      waiting.set(id, resolve);
      setTimeout(() => {
        if (waiting.delete(id)) reject(new Error("The studio did not answer."));
      }, 60_000);
    });

    studio.postMessage(
      { type: "request", id, url, method: init?.method ?? "GET", headers, body: init?.body ?? undefined },
      origin,
    );
    return answer;
  };
}
