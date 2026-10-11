/**
 * Images that arrived in a paste as an address, fetched into the browser so they upload like a copied picture.
 *
 * A page copied from another site carries its pictures as `<img src>` and
 * never their bytes. The browser asks for each one, first with the reader's
 * own sign-in and then without, and the site decides whether this page may
 * read the answer. An image that cannot be read comes back as nothing, for
 * the paste to put a placeholder where it stood.
 */

import type { JSONContent } from "@tiptap/core";
import { DOWNLOADABLE } from "./pasted";

/**
 * Whether a pasted block is an image still standing at the address it was copied from.
 *
 * @example isRemoteImage({ type: "image", attrs: { src: "https://example.com/a.png" } }); // true
 */
export function isRemoteImage(block: JSONContent) {
  return block.type === "image" && DOWNLOADABLE.test(String(block.attrs?.src ?? ""));
}

/**
 * The block a pasted image lands as: its upload, or an image with no address when it could not be fetched.
 *
 * Either way it keeps the alt it was copied with, which says more than a file name.
 *
 * @example landedImage(undefined, copied); // { type: "image", attrs: { src: "", alt: "Company logo" } }
 */
export function landedImage(uploaded: JSONContent | undefined, copied: JSONContent): JSONContent {
  const block = uploaded ?? { type: "image", attrs: { src: "" } };
  const alt = String(copied.attrs?.alt ?? "");

  return alt === "" ? block : { ...block, attrs: { ...block.attrs, alt } };
}

/**
 * The picture at an address as a file, or null when the site will not let this page read it.
 *
 * @example await downloadImage("https://example.com/logo.png"); // File { name: "logo.png" }
 */
export async function downloadImage(src: string): Promise<File | null> {
  const blob = (await fetchImage(src, "include")) ?? (await fetchImage(src, "omit"));
  if (blob === null) return null;

  return new File([blob], fileNameFor(src, blob.type), { type: blob.type });
}

/**
 * The image at an address, asked for with or without the reader's sign-in.
 *
 * Both are tried because a site that shares its images with every page
 * refuses the request that carries a sign-in, and a site that only shares them
 * with a signed-in reader refuses the one that does not.
 */
async function fetchImage(src: string, credentials: RequestCredentials) {
  try {
    const response = await fetch(src, { credentials });
    const blob = response.ok ? await response.blob() : null;
    return blob?.type.startsWith("image/") ? blob : null;
  } catch {
    return null;
  }
}

/**
 * A name for the downloaded file, from the address when it has one and the type when it does not.
 *
 * @example fileNameFor("https://example.com/img/logo.png?v=2", "image/png"); // "logo.png"
 * @example fileNameFor("data:image/png;base64,iVBOR…", "image/png"); // "pasted-image.png"
 */
function fileNameFor(src: string, type: string) {
  const last = src.startsWith("data:") ? "" : (new URL(src).pathname.split("/").pop() ?? "");
  const extension = type.replace("image/", "").replace("jpeg", "jpg").replace(/\+.*$/, "");

  return /\.\w+$/.test(last) ? decodeURIComponent(last) : `pasted-image.${extension}`;
}
