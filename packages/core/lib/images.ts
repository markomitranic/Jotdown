import type { NextConfig } from "next";

/**
 * How wide a picture on a page is drawn at most: the text column and the margin it bleeds into.
 *
 * The width describes the layout, never the file. Next scales each picture to
 * the width asked for, twice that on a sharp screen, keeps its aspect ratio,
 * and never scales one up, so a small picture comes back at its own size.
 */
export const IMAGE = {
  column: 932,
};

/**
 * Next's image settings for an app that draws pages.
 *
 * Every optimized picture is encoded at quality 80, the one quality offered,
 * so no component has to ask for it. An optimized picture is kept for a year
 * in the browser and the CDN, because every address it is made from names
 * fixed contents.
 *
 * @example const config: NextConfig = { images: imageConfig };
 */
export const imageConfig = {
  qualities: [80],
  minimumCacheTTL: 31_536_000,
} satisfies NextConfig["images"];

/**
 * Whether Next's optimizer can fetch and scale a picture at this address.
 *
 * Only a picture this site serves itself qualifies. A vector needs no scaling,
 * an upload still in the browser has no address on the server, and another
 * site's picture is served as that site serves it.
 *
 * @example optimizable("/img/docs/a.png"); // true
 * @example optimizable("/img/docs/logo.svg"); // false
 * @example optimizable("https://x.test/a.png"); // false
 */
export function optimizable(url: string) {
  const [path = ""] = url.split(/[?#]/);
  return url.startsWith("/") && !url.startsWith("//") && !path.toLowerCase().endsWith(".svg");
}
