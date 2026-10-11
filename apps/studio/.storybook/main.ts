import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { StorybookConfig } from "@storybook/nextjs-vite";
import { mergeConfig, type Plugin } from "vite";
import tailwind from "@tailwindcss/vite";
import mdx from "fumadocs-mdx/vite";

/**
 * The component library: every block, primitive and studio screen, drawn in isolation.
 *
 * Pages compile through the core's `source.config.ts`, the same remark and
 * rehype chain the studio and a publication use, so a block story shows what a real page
 * would. Tailwind runs as its own Vite plugin, because Vite's PostCSS pass
 * trips over the comment block at the top of the global stylesheet.
 *
 * Uploads are served at the root, where a project's pages link them.
 */
const config: StorybookConfig = {
  framework: "@storybook/nextjs-vite",
  stories: ["../{components,src,stories}/**/*.stories.tsx"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-mcp"],
  staticDirs: ["./public", "../public", "../../../docs/_uploads"],
  viteFinal: (vite) =>
    mergeConfig(vite, {
      css: { postcss: { plugins: [] } },
      plugins: [
        tailwind(),
        mdx(undefined, {
          index: false,
          configPath: resolve(import.meta.dirname, "../../../packages/core/source.config.ts"),
          outDir: "node_modules/.cache/storybook-mdx",
        }),
        pageSource(),
      ],
    }),
};

/**
 * Adds the file's own text to every compiled page, as `export const source`.
 *
 * The in-place editor cuts each block out of the text the page was compiled
 * from, so a story that edits a page needs those exact bytes beside the
 * compiled article.
 *
 * @example import * as page from "./Callout.page.mdx"; page.source; // "---\ntitle: Callouts…"
 */
function pageSource(): Plugin {
  return {
    name: "storybook:page-source",
    enforce: "post",
    transform: {
      filter: { id: /\.mdx?$/ },
      async handler(code, id) {
        const text = await readFile(id, "utf8");
        return { code: `${code}\nexport const source = ${JSON.stringify(text)};`, map: null };
      },
    },
  };
}

export default config;
