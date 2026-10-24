import type { ImageLoaderProps } from "next/image";
import { optimizable, scaledAddress } from "./images";

/**
 * The studio's image loader: the WebP copy of a picture at the width Next picked, or the original when it has none.
 *
 * @example imageLoader({ src: "/img/docs/a.png", width: 960 }); // "/img/docs/a.png.w960.webp"
 */
export default function imageLoader({ src, width }: ImageLoaderProps) {
  return optimizable(src) ? scaledAddress(src, width) : src;
}
