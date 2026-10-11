/** What a page compiled for a story exports beside its article. */
declare module "*.mdx" {
  export const source: string;
  export const frontmatter: { title?: string; description?: string; icon?: string };
}

/** A stylesheet as its text, for a story to put on the page and take off again. */
declare module "*.css?inline" {
  const css: string;
  export default css;
}

/** A markdown page compiled for a story, the same shape as an `.mdx` one. */
declare module "*.md" {
  import type { MDXContent } from "mdx/types";
  const Page: MDXContent;
  export default Page;
  export const source: string;
  export const frontmatter: { title?: string; description?: string; icon?: string };
}
