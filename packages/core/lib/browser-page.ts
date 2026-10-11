import { compile, run } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import type { MDXContent } from "mdx/types";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import { VFile } from "vfile";
import { frontmatter } from "fumadocs-core/content/md/frontmatter";
import {
  rehypeCode,
  rehypeToc,
  remarkCodeTab,
  remarkGfm,
  remarkHeading,
  remarkImage,
  remarkNpm,
} from "fumadocs-core/mdx-plugins";
import type { TableOfContents } from "fumadocs-core/toc";
import { executableContent } from "./content-only";
import { pageFrontmatterSchema, type PageFrontmatter } from "./front-matter";
import { remarkChain } from "./remark-chain";
import { remarkSourceRange, sourceRangeCodeOptions } from "./remark-source-range";

/**
 * One page compiled in the browser from its text, the way a site's build compiles it.
 *
 * A canvas has no build to lean on: the studio hands it a page's text, and it
 * has to draw the same article the site would. So this runs the framework's
 * own remark chain and the same defaults `fumadocs-mdx` adds, refuses a page
 * that would run code before anything compiles it, and replaces the front
 * matter with as many blank lines as it took, so every source range still
 * names the line in the file.
 */

/** A compiled page: the article to render, its headings and its front matter. */
export type BrowserPage = { body: MDXContent; toc: TableOfContents; data: PageFrontmatter };

/**
 * Compiles a page's text, or says why it would not.
 *
 * `blocks` names the project's own blocks, whose children are stamped so the
 * prose between their tags is editable where it stands.
 *
 * @example const page = await compileInBrowser(text, ["Hero"]); if ("problem" in page) …; <page.body components={components} />
 */
export async function compileInBrowser(
  text: string,
  blocks: string[] = [],
): Promise<BrowserPage | { problem: string }> {
  const { matter, content, data } = frontmatter(text);
  const front = pageFrontmatterSchema.safeParse(data);
  if (!front.success) return { problem: `The front matter is not valid: ${front.error.issues[0]?.message}` };

  try {
    const [first] = executableContent(unified().use(remarkParse).use(remarkMdx).parse(content));
    if (first) return { problem: first.reason };

    const padded = "\n".repeat([...matter].filter((character) => character === "\n").length) + content;
    const file = new VFile({ value: padded, data: { frontmatter: front.data } });
    const code = await compile(file, {
      outputFormat: "function-body",
      remarkPlugins: [
        remarkGfm,
        [remarkHeading, { generateToc: false }],
        [remarkImage, { useImport: false, external: false, onError: "ignore" }],
        remarkCodeTab,
        remarkNpm,
        ...remarkChain,
        [remarkSourceRange, { inside: blocks }],
      ],
      rehypePlugins: [[rehypeCode, sourceRangeCodeOptions], rehypeToc],
    });

    const module = await run(code, { ...runtime, baseUrl: import.meta.url });
    return { body: module.default, toc: (module.toc as TableOfContents) ?? [], data: front.data };
  } catch (error) {
    return { problem: error instanceof Error ? error.message : "The page could not be compiled." };
  }
}
