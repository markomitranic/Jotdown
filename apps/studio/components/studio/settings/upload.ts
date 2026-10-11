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

/**
 * An image drawn into a PNG no bigger than a box, keeping its shape, so an SVG or a huge photo arrives as a sensible file.
 *
 * @example await fittedPng(file, 1200, 400); // Blob of a 1200×300 PNG for a 4:1 logo
 */
export async function fittedPng(file: File, width: number, height: number) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image: SVG, PNG, JPEG or WebP.");

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => {
      throw new Error("That image could not be read.");
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("That image has no size.");

    const scale = Math.min(1, width / image.naturalWidth, height / image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("That image could not be drawn.");
    return { blob, preview: canvas.toDataURL("image/png") };
  } finally {
    URL.revokeObjectURL(url);
  }
}
