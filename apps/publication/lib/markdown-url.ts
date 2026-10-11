const ROOT = "__root";

/**
 * The route segments of a page's markdown twin, with the landing page as `__root`.
 *
 * @example twinPath(["guides", "setup"]); // ["guides", "setup.md"]
 * @example twinPath([]); // ["__root.md"]
 */
export function twinPath(slugs: string[]) {
  const path = slugs.length ? [...slugs] : [ROOT];
  path[path.length - 1] += ".md";
  return path;
}

/**
 * The page a twin's route segments name, or null when they are not a twin's.
 *
 * @example twinPage(["guides", "setup.md"]); // ["guides", "setup"]
 * @example twinPage(["__root.md"]); // []
 */
export function twinPage(path: string[]) {
  const last = path.at(-1);
  if (!last?.endsWith(".md")) return null;

  const slugs = [...path.slice(0, -1), last.slice(0, -3)];
  return slugs.length === 1 && slugs[0] === ROOT ? [] : slugs;
}

/**
 * A page's markdown twin address, `/markdown/<page>.md`.
 *
 * @example markdownUrl(["guides", "setup"]); // "/markdown/guides/setup.md"
 * @example markdownUrl([]); // "/markdown/__root.md"
 */
export function markdownUrl(slugs: string[]) {
  return `/markdown/${twinPath(slugs).join("/")}`;
}
