/**
 * The upload endpoint's security checks.
 *
 * Anything that gets past these is committed to the repo and served from the
 * site's own origin. For an image that means the files that dress up as one: an
 * SVG, which is a script, and a RIFF container that is audio. For an attachment
 * it means the extension, because the extension is what decides the
 * `content-type` the file is later served under.
 */

import { describe, expect, test } from "vitest";
import { fileExtension, imageKind } from "./asset";

function bytes(...values: number[]) {
  return new Uint8Array(values);
}

/** A RIFF header with `kind` in the slot WebP puts its name in. */
function riff(kind: string) {
  return new Uint8Array([...Buffer.from("RIFF"), 0x1a, 0x00, 0x00, 0x00, ...Buffer.from(kind)]);
}

describe("imageKind", () => {
  test("recognises the four formats we accept", () => {
    expect(imageKind(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
    expect(imageKind(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpg");
    expect(imageKind(new Uint8Array(Buffer.from("GIF89a")))).toBe("gif");
    expect(imageKind(riff("WEBP"))).toBe("webp");
  });

  test("refuses an SVG, however it opens", () => {
    expect(imageKind(new Uint8Array(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">')))).toBe(null);
    expect(imageKind(new Uint8Array(Buffer.from('<?xml version="1.0"?><svg>')))).toBe(null);
  });

  test("refuses a RIFF container that is not WebP", () => {
    expect(imageKind(riff("WAVE"))).toBe(null);
  });

  test("refuses an empty body and a truncated header", () => {
    expect(imageKind(bytes())).toBe(null);
    expect(imageKind(bytes(0x89, 0x50))).toBe(null);
  });
});

describe("fileExtension", () => {
  test("accepts the formats a page may attach", () => {
    expect(fileExtension("zip")).toBe("zip");
    expect(fileExtension(".PDF")).toBe("pdf");
    expect(fileExtension(" xlsx ")).toBe("xlsx");
  });

  test("refuses anything the browser would run on our own origin", () => {
    expect(fileExtension("svg")).toBe(null);
    expect(fileExtension("html")).toBe(null);
    expect(fileExtension("xml")).toBe(null);
    expect(fileExtension("js")).toBe(null);
  });

  test("refuses a missing or dressed-up extension", () => {
    expect(fileExtension(null)).toBe(null);
    expect(fileExtension("")).toBe(null);
    expect(fileExtension("zip/../../evil")).toBe(null);
    expect(fileExtension("zip.html")).toBe(null);
  });
});
