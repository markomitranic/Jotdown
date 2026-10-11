import { remarkRuntimePositions } from "./lib/remark-runtime-positions";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { pageFrontmatterSchema } from "@jotdown/core/lib/front-matter";
import { DOCS_ROOT } from "@jotdown/core/lib/paths";
import { remarkSourceRange, sourceRangeCodeOptions } from "@jotdown/core/lib/remark-source-range";
import { remarkChain } from "@jotdown/core/lib/remark-chain";

/**
 * The content collection: every `.md`/`.mdx` under the docs root, ordered by
 * one `meta.json` per folder.
 *
 * `meta.files` is pinned to `meta.json` because the folder also holds
 * `moved.json`, which is an array and would fail the meta schema.
 *
 * The schema is the page front matter schema, validated before the page compiles.
 */
export const docs = defineDocs({
  dir: DOCS_ROOT,
  docs: { schema: pageFrontmatterSchema },
  meta: { files: ["**/meta.json"] },
});

export default defineConfig({
  mdxOptions: {
    /**
     * A markdown image stays an `<img>` with the path the author wrote.
     *
     * Left to itself the image plugin rewrites every local image into a
     * Next.js static import, which hands the component an object instead of a
     * URL and makes the build fail on a file that has not landed yet. Uploads
     * arrive from the in-page editor, so that is a page breaking the site
     * rather than showing one broken picture. `external: false` keeps the build
     * off the network: nothing here points at an image we do not host.
     */
    remarkImageOptions: { useImport: false, external: false, onError: "ignore" },

    /** Keeps a code fence's source range, which the Shiki pass would otherwise rebuild away. */
    rehypeCodeOptions: sourceRangeCodeOptions,
    remarkPlugins: (defaults) => [...remarkChain, remarkRuntimePositions, remarkSourceRange, ...defaults],
  },
});
