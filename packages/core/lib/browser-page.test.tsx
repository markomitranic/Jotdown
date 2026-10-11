import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getMDXComponents } from "@jotdown/core/components/mdx";
import { compileInBrowser } from "./browser-page";

const PAGE = `---
title: Setup
description: Getting it running.
---

## Install

Run the installer.

:::warning
Careful.
:::
`;

describe("compileInBrowser", () => {
  it("draws the page the build would, with its headings and the lines its blocks came from", async () => {
    const page = await compileInBrowser(PAGE);
    if ("problem" in page) throw new Error(page.problem);

    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <page.body components={getMDXComponents()} />
      </QueryClientProvider>,
    );

    expect(page.data.title).toBe("Setup");
    expect(page.toc.map((item) => item.url)).toEqual(["#install"]);
    expect(html).toContain("Run the installer.");
    expect(html).toContain('<h2 id="install" data-src-range="6:');
  });

  it("refuses a page that would run code", async () => {
    const page = await compileInBrowser("---\ntitle: X\ndescription: Y\n---\n\n{new Date().getFullYear()}\n");
    expect("problem" in page && page.problem).toMatch(/expression/i);
  });
});
