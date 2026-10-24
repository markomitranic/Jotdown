import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { imageSize } from "@fumari/image-size";
import type { Image, Root } from "mdast";
import type { Node } from "unist";
import type { VFile } from "vfile";
import { contentDirectory, readProjectConfig } from "@jotdown/core/server/config";
import { uploadFile } from "@jotdown/core/server/uploads";
import { optimizable } from "./images";

/**
 * Writes the pixel size of every picture the project hosts onto its image, as `width` and `height`.
 *
 * The project is the nearest folder above the page with a `.jotdown/config.json`,
 * and the picture its upload. A picture that cannot be found or read is left
 * without a size, and draws as one of unknown size.
 *
 * @example remarkPlugins: [remarkImageSizes]; // ![](/img/docs/a.png) gets width="1200" height="640"
 */
export function remarkImageSizes() {
  return (tree: Root, file: VFile) => {
    const repository = file.path ? projectAbove(dirname(file.path)) : null;
    if (!repository) return;

    const content = contentDirectory(repository);
    const { uploads } = readProjectConfig(repository);

    for (const image of imagesIn(tree)) {
      if (!optimizable(image.url)) continue;

      const size = pictureSize(join(content, uploadFile(decodeURI(image.url.split(/[?#]/)[0] ?? ""), uploads)));
      if (!size) continue;

      image.data ??= {};
      image.data.hProperties = { ...image.data.hProperties, width: size.width, height: size.height };
    }
  };
}

/** Every markdown image in a tree, in the order the page writes them. */
function imagesIn(node: Node & { children?: Node[] }): Image[] {
  if (node.type === "image") return [node as Image];
  return (node.children ?? []).flatMap(imagesIn);
}

/** The nearest folder at or above this one holding a project's `.jotdown/config.json`, or null. */
function projectAbove(folder: string): string | null {
  if (existsSync(join(folder, ".jotdown/config.json"))) return folder;

  const parent = dirname(folder);
  return parent === folder ? null : projectAbove(parent);
}

/**
 * A picture's width and height as it is shown, turned upright, or null when it cannot be read.
 *
 * @example pictureSize("/work/notes/docs/_uploads/img/docs/a.png"); // { width: 1200, height: 640 }
 */
function pictureSize(path: string) {
  try {
    const bytes = readFileSync(path);
    const size = imageSize(bytes);
    if (!size) return null;

    return onItsSide(bytes) ? { width: size.height, height: size.width } : { width: size.width, height: size.height };
  } catch {
    return null;
  }
}

const EXIF_ORIENTATION = 0x0112;
const START_OF_SCAN = 0xda;

/**
 * Whether a JPEG's EXIF orientation, 5 to 8, says it is shown turned a quarter, as a phone's portrait photo is.
 *
 * Reads the first `Exif` segment's first directory and stops at the picture's
 * own data. Anything other than a JPEG is upright as stored.
 *
 * @example onItsSide(portraitPhoto); // true
 */
export function onItsSide(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return false;

  for (let at = 2; at + 4 <= view.byteLength && view.getUint8(at) === 0xff; at += 2 + view.getUint16(at + 2)) {
    const marker = view.getUint8(at + 1);
    if (marker === START_OF_SCAN) return false;
    if (marker !== 0xe1 || view.getUint32(at + 4) !== 0x45786966) continue;

    const tiff = at + 10;
    const little = view.getUint16(tiff) === 0x4949;
    const directory = tiff + view.getUint32(tiff + 4, little);
    const entries = view.getUint16(directory, little);

    for (let entry = directory + 2; entry < directory + 2 + entries * 12; entry += 12) {
      if (view.getUint16(entry, little) === EXIF_ORIENTATION) return view.getUint16(entry + 8, little) >= 5;
    }
    return false;
  }

  return false;
}
