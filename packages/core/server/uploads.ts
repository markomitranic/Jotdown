import { extname } from "node:path";

const TYPES: Record<string, string> = {
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".excalidraw": "application/json",
  ".txt": "text/plain",
  ".mp4": "video/mp4",
};

/**
 * The file in the content folder an upload's public address names.
 *
 * `/uploads/…` means the uploads folder itself, wherever it is kept.
 *
 * @example uploadFile("/img/logo.svg", "docs/_uploads"); // "docs/_uploads/img/logo.svg"
 * @example uploadFile("/uploads/fonts/inter.woff2", "docs/_uploads"); // "docs/_uploads/fonts/inter.woff2"
 */
export function uploadFile(address: string, folder: string) {
  const path = address.replace(/^\//, "");
  return `${folder}/${path.startsWith("uploads/") ? path.slice("uploads/".length) : path}`;
}

/**
 * The folder the files under one upload address live in, the reverse of `uploadFile`.
 *
 * @example uploadFolder("img", "docs/_uploads"); // "docs/_uploads/img"
 * @example uploadFolder("uploads", "docs/_uploads"); // "docs/_uploads"
 */
export function uploadFolder(root: string, folder: string) {
  return root === "uploads" ? folder : `${folder}/${root}`;
}

/**
 * The content type an upload is served with, by its extension.
 *
 * @example uploadType("logo.svg"); // "image/svg+xml"
 */
export function uploadType(path: string) {
  return TYPES[extname(path)] ?? "application/octet-stream";
}
