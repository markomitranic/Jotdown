"use client";

import { fetchJson } from "@jotdown/core/lib/fetch-json";

/**
 * Commits an image or a font for the settings and answers with the address the config names it by.
 *
 * The bytes go as the body, the way the editor sends its uploads, and the
 * server reads the real format off them rather than trusting the name.
 *
 * @example await uploadBrandFile(projectId, png, "image", "the icon"); // { url: "/img/brand/3f1c….png" }
 */
export function uploadBrandFile(projectId: string, file: Blob, kind: "image" | "font", what: string) {
  const query = new URLSearchParams({ kind, what });
  return fetchJson<{ url: string }>(`/api/projects/${projectId}/settings/upload?${query}`, {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body: file,
  });
}
