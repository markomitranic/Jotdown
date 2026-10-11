/**
 * How big an upload may be, which the browser asks about and the upload endpoint enforces.
 *
 * `max` stops well under GitHub's own warning at 50 MB a file. Past `large` a
 * file goes up only once somebody has been told it is better kept in Drive:
 * the repository is cloned with every file ever committed to it.
 */
export const UPLOAD_LIMITS = {
  compressOver: 2_000_000,
  large: 4_000_000,
  max: 25_000_000,
};

/**
 * What a picture is made into when somebody asks for it to be compressed.
 *
 * Wide enough for the widest the page draws a picture, twice over for a sharp
 * screen, and never scaled up.
 */
export const COMPRESSION = {
  type: "image/webp",
  edge: 1920,
  quality: 0.8,
};

/**
 * A byte count as people say it.
 *
 * @example megabytes(6_240_000); // "6.2 MB"
 */
export function megabytes(bytes: number) {
  return `${(bytes / 1_000_000).toFixed(1).replace(/\.0$/, "")} MB`;
}
