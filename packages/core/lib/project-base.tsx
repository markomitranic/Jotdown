import type { ComponentType } from "react";
import { uploadFile } from "@jotdown/core/server/uploads";
import type { Project } from "@jotdown/core/server/project";

/** Where the open project serves its pages, its uploads when they are kept by content, and the folder they are in. */
type Served = Pick<Project, "base" | "uploads"> & { config: Pick<Project["config"], "uploads"> };

/**
 * A site-absolute address as the open project serves it, under its `/owner/repo` in the studio.
 *
 * A page is written for a site at the root, so `/manual/sections` and
 * `/img/docs/a.png` mean the project's own page and upload. An upload the
 * project keeps by content goes to that address instead. Anything else, a
 * relative path, a fragment or another origin, is already right.
 *
 * @example atBase(handbook, "/manual/sections"); // "/you/notes/manual/sections"
 * @example atBase({ ...handbook, uploads: { "docs/_uploads/img/a.png": "/api/blobs/you/notes/3f1c…/a.png" } }, "/img/a.png"); // "/api/blobs/you/notes/3f1c…/a.png"
 * @example atBase(publication, "/manual/sections"); // "/manual/sections"
 * @example atBase(handbook, "https://x.test"); // "https://x.test"
 */
export function atBase({ base, uploads, config }: Served, address: string) {
  if (!address.startsWith("/") || address.startsWith("//")) return address;

  return uploads?.[uploadFile(address, config.uploads)] ?? base + address;
}

/**
 * A page's path inside the project, from route params that may still carry the project's own segments.
 *
 * On Vercel an optional catch-all is matched against the address as it arrived,
 * before the proxy took `/owner/repo` off it, so the page route can be handed
 * the key as its first two segments.
 *
 * @example slugInside("/you/notes", ["you", "notes", "manual"]); // ["manual"]
 * @example slugInside("/you/notes", ["manual"]); // ["manual"]
 */
export function slugInside(base: string, slug: string[] = []) {
  const prefix = base.split("/").slice(1);
  const carried = prefix.length > 0 && prefix.every((segment, at) => slug[at] === segment);
  return carried ? slug.slice(prefix.length) : slug;
}

/**
 * A page component whose address prop is moved under the project's base before it renders.
 *
 * @example underBase(project, "href", Card); // <Card href="/manual" /> links to /you/notes/manual
 */
export function underBase<P extends Partial<Record<"href" | "src", unknown>>>(
  project: Served,
  prop: "href" | "src",
  Component: ComponentType<P>,
) {
  return function UnderBase(props: P) {
    const address = props[prop];
    const moved = typeof address === "string" ? { [prop]: atBase(project, address) } : {};
    return <Component {...props} {...moved} />;
  };
}
