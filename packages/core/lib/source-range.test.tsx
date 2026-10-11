import { describe, expect, it } from "vitest";
import { compile, run } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  rehypeCode,
  rehypeToc,
  remarkDirectiveAdmonition,
  remarkGfm,
  remarkHeading,
  remarkImage,
  remarkStructure,
} from "fumadocs-core/mdx-plugins";
import remarkDirective from "remark-directive";
import { getMDXComponents } from "@jotdown/core/components/mdx";
import { rangeIn, SOURCE_RANGE } from "./source-range";
import { remarkMermaid } from "./remark-mermaid";
import { remarkSourceRange, sourceRangeCodeOptions } from "./remark-source-range";

const FILE = `---
title: Stamped
description: A page with front matter in front of it.
---

# Title

A paragraph of prose.

:::warning[Required]

Careful.

:::

- one
- two

3. third
4. fourth

> A quote.
>
> Still quoting.

\`\`\`ts title="lib/source.ts"
const x = 1;
\`\`\`

<figure className="jd-fig"><svg /></figure>

| a | b |
| --- | --- |
| 1 | 2 |

\`\`\`mermaid
graph LR
  A-->B
\`\`\`
`;

/**
 * Compiles the way a page is really compiled: our plugins, then the Fumadocs
 * defaults, with front matter replaced by as many blank lines as it occupied.
 *
 * The padding is upstream's (`"\n".repeat(...) + content`) and is why the stamp
 * carries lines rather than offsets. The default stack is here because two of
 * its members rewrite the nodes we stamp: `remarkHeading` adds an `id` to every
 * heading, and Shiki hands back a brand new `<pre>`.
 */
function compileFile(file: string, outputFormat: "program" | "function-body") {
  const matter = /^---\r?\n(.+?)\r?\n---\r?\n?/s.exec(file)?.[0] ?? "";
  const padded = "\n".repeat([...matter].filter((c) => c === "\n").length) + file.slice(matter.length);

  return compile(padded, {
    outputFormat,
    jsx: outputFormat === "program",
    remarkPlugins: [
      remarkDirective,
      [remarkDirectiveAdmonition, { types: { warning: "warning" } }],
      remarkMermaid,
      remarkSourceRange,
      remarkGfm,
      [remarkHeading, { generateToc: false }],
      [remarkImage, { useImport: false, external: false, onError: "ignore" }],
      [remarkStructure, { exportAs: "structuredData" }],
    ],
    rehypePlugins: [[rehypeCode, sourceRangeCodeOptions], rehypeToc],
  });
}

/** Every stamp the compiler wrote, in the order the blocks appear. */
async function stampsIn(file: string) {
  const out = String(await compileFile(file, "program"));
  const pattern = new RegExp(`${SOURCE_RANGE}[="':\\s]+([\\d:-]+)`, "g");
  return [...out.matchAll(pattern)].map((match) => match[1]!);
}

/** The page's HTML, rendered through the component map and query client a real page renders with. */
async function renderFile(file: string) {
  const compiled = await compileFile(file, "function-body");
  const { default: MDX } = await run(compiled, {
    ...runtime,
    baseUrl: import.meta.url,
  });
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <MDX components={getMDXComponents()} />
    </QueryClientProvider>,
  );
}

describe("remarkSourceRange", () => {
  it("cuts every block back out of the file it was written in", async () => {
    const slices = (await stampsIn(FILE)).map((stamp) => {
      const range = rangeIn(FILE, stamp)!;
      return FILE.slice(range.start, range.end);
    });

    expect(slices).toEqual([
      "# Title",
      "A paragraph of prose.",
      ":::warning[Required]\n\nCareful.\n\n:::",
      "- one\n- two",
      "3. third\n4. fourth",
      "> A quote.\n>\n> Still quoting.",
      '```ts title="lib/source.ts"\nconst x = 1;\n```',
      '<figure className="jd-fig"><svg /></figure>',
      "| a | b |\n| --- | --- |\n| 1 | 2 |",
      "```mermaid\ngraph LR\n  A-->B\n```",
    ]);
  });
});

describe("rangeIn", () => {
  it("reads a stamp against the original file", () => {
    expect(rangeIn("---\nt: x\n---\n\n# Hi\n", "5:1-5:5")).toEqual({
      start: 14,
      end: 18,
    });
  });

  it("refuses a stamp it cannot trust", () => {
    expect(rangeIn("# Hi\n", "nonsense")).toBeNull();
    expect(rangeIn("# Hi\n", "99:1-99:5")).toBeNull();
  });
});

describe("a stamp in the browser", () => {
  it.each([
    ["https://www.youtube.com/watch?v=NvkZaWLe0Sk", "div"],
    ["https://example.com/video", "p"],
  ])("keeps the video block's source range on its outer element for %s", async (url, tag) => {
    const source = `<VideoEmbed url="${url}" />`;
    const html = await renderFile(source);
    const [stamp] = await stampsIn(source);

    expect(html).toMatch(new RegExp(`^<${tag}[^>]*${SOURCE_RANGE}="${stamp}"`));
    const range = rangeIn(source, stamp!)!;
    expect(source.slice(range.start, range.end)).toBe(source);
  });

  it("reaches the DOM of every block the reader's own components draw", async () => {
    const html = await renderFile(FILE);
    const stamps = [...html.matchAll(new RegExp(`${SOURCE_RANGE}="([\\d:-]+)"`, "g"))];

    /**
     * One per block, and each on the outermost element of its block: the
     * heading, the paragraph, the callout's own box, the code block's frame,
     * the table. Nothing between the compile and the DOM swallows the prop.
     */
    expect(stamps.map((match) => match[1])).toEqual(await stampsIn(FILE));
  });
});
