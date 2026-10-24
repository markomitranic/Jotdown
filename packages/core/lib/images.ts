import type { NextConfig } from "next";

/**
 * How wide a picture is drawn, and how wide the stage opens it.
 *
 * `column` is a little past the text column, for a sharp edge. `sizes` tells
 * the browser a picture spans the window up to that column, so a phone takes a
 * narrower copy than a laptop. `stage` bounds the copy the fullscreen stage
 * opens, so even zoomed in nobody downloads the original by looking at it.
 */
export const IMAGE = {
  column: 932,
  sizes: "(max-width: 932px) 100vw, 932px",
  stage: 3840,
};

/** Every width a picture is scaled to: the page's at each screen size, then one for icons and logos. */
const PAGE_WIDTHS = [640, 960, 1280, 1920, 3840];
const ICON_WIDTHS = [128];
export const IMAGE_WIDTHS = [...PAGE_WIDTHS, ...ICON_WIDTHS];

/**
 * Next's image settings for an app that draws pages.
 *
 * A picture is scaled to a few fixed widths, the page's at each screen size and
 * one for icons, and encoded at quality 80, the one quality offered, so no
 * component has to ask for it. A scaled picture is kept for a year in the
 * browser and the CDN, because every address it is made from names fixed
 * contents.
 *
 * @example const config: NextConfig = { images: imageConfig };
 */
export const imageConfig = {
  deviceSizes: PAGE_WIDTHS,
  imageSizes: ICON_WIDTHS,
  qualities: [80],
  minimumCacheTTL: 31_536_000,
} satisfies NextConfig["images"];

/**
 * Whether a path names a picture the scaler reads on every platform: PNG, JPEG or WebP.
 *
 * A vector needs no scaling, and a GIF would lose its animation.
 *
 * @example scalable("img/docs/a.png"); // true
 * @example scalable("img/docs/a.gif"); // false
 */
export function scalable(path: string) {
  return SCALABLE.test(path.split(/[?#]/)[0] ?? "");
}

const SCALABLE = /\.(png|jpe?g|webp)$/i;

/**
 * Whether a picture at this address is drawn through a scaled copy.
 *
 * Only a picture this site serves itself qualifies. An upload still in the
 * browser has no address on the server, and another site's picture is served
 * as that site serves it.
 *
 * @example optimizable("/img/docs/a.png"); // true
 * @example optimizable("/img/docs/logo.svg"); // false
 * @example optimizable("https://x.test/a.png"); // false
 */
export function optimizable(url: string) {
  return url.startsWith("/") && !url.startsWith("//") && scalable(url);
}

/**
 * The address of a picture's WebP copy at a width, beside the original and keeping its query.
 *
 * @example scaledAddress("/img/docs/a.png", 960); // "/img/docs/a.png.w960.webp"
 * @example scaledAddress("/img/docs/a.png?v=2", 960); // "/img/docs/a.png.w960.webp?v=2"
 */
export function scaledAddress(url: string, width: number) {
  const [, path, rest] = url.match(/^([^?#]*)(.*)$/s) ?? [];
  return `${path}.w${width}.webp${rest}`;
}

/**
 * The original and the width a scaled copy's path asks for, or null when it names no copy offered.
 *
 * @example scaledOriginal("img/docs/a.png.w960.webp"); // { original: "img/docs/a.png", width: 960 }
 * @example scaledOriginal("img/docs/a.png.w961.webp"); // null
 * @example scaledOriginal("img/docs/a.png"); // null
 */
export function scaledOriginal(path: string) {
  const [, original = "", width] = path.match(/^(.+)\.w(\d+)\.webp$/) ?? [];
  if (!scalable(original) || !IMAGE_WIDTHS.includes(Number(width))) return null;

  return { original, width: Number(width) };
}
