import { describe, expect, it } from "vitest";
import { IMAGE_WIDTHS, scaledAddress, scaledOriginal } from "./images";

describe("scaled copies", () => {
  it("are found again from the address the loader writes, at every width offered", () => {
    for (const width of IMAGE_WIDTHS) {
      expect(scaledOriginal(scaledAddress("img/docs/a b.png", width))).toEqual({ original: "img/docs/a b.png", width });
    }
  });

  it("keep a query after the copy's extension", () => {
    expect(scaledAddress("/img/docs/a.png?v=2#top", 960)).toBe("/img/docs/a.png.w960.webp?v=2#top");
  });

  it("refuse a width nobody asks for, so a server cannot be made to scale at any size", () => {
    expect(scaledOriginal("img/docs/a.png.w961.webp")).toBeNull();
  });

  it("refuse an original the scaler cannot read", () => {
    expect(scaledOriginal("img/docs/a.svg.w960.webp")).toBeNull();
    expect(scaledOriginal("img/docs/a.gif.w960.webp")).toBeNull();
  });
});
