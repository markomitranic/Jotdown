/**
 * A page's markdown twin address, `/llms.mdx/…` under the project's base.
 *
 * @example markdownUrl("/you/notes", ["guides", "setup"]); // "/you/notes/llms.mdx/guides/setup"
 */
export function markdownUrl(base: string, slugs: string[]) {
  return [`${base}/llms.mdx`, ...slugs].join("/");
}
