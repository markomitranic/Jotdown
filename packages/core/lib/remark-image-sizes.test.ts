import { describe, expect, it } from "vitest";
import { onItsSide } from "./remark-image-sizes";

/** The start of a JPEG whose first `Exif` segment holds one entry, its orientation, written little- or big-endian. */
function jpegTurned(orientation: number, little = true) {
  const tiff = new DataView(new ArrayBuffer(26));
  tiff.setUint16(0, little ? 0x4949 : 0x4d4d);
  tiff.setUint16(2, 42, little);
  tiff.setUint32(4, 8, little);
  tiff.setUint16(8, 1, little);
  tiff.setUint16(10, 0x0112, little);
  tiff.setUint16(12, 3, little);
  tiff.setUint32(14, 1, little);
  tiff.setUint16(18, orientation, little);

  const exif = [..."Exif"].map((letter) => letter.charCodeAt(0));
  const length = 2 + 6 + tiff.byteLength;
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe1,
    length >> 8,
    length & 0xff,
    ...exif,
    0,
    0,
    ...new Uint8Array(tiff.buffer),
  ]);
}

describe("onItsSide", () => {
  it("reads a phone's portrait photo as turned, in either byte order", () => {
    expect(onItsSide(jpegTurned(6))).toBe(true);
    expect(onItsSide(jpegTurned(8, false))).toBe(true);
  });

  it("reads an upright or flipped photo as upright", () => {
    expect(onItsSide(jpegTurned(1))).toBe(false);
    expect(onItsSide(jpegTurned(3))).toBe(false);
  });

  it("reads anything but a JPEG as upright", () => {
    expect(onItsSide(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
  });
});
