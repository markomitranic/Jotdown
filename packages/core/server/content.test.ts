import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { projectSource, sourceProblems } from "./content";
import { readProjectConfig } from "./config";

test("renders project MDX with editable source positions and picks up changed files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "docs-content-"));
  try {
    await mkdir(join(directory, "docs"));
    const original = "---\ntitle: Handbook\ndescription: External content\n---\n\n## Welcome\n\nOriginal paragraph.\n";
    await writeFile(join(directory, "docs/index.mdx"), original);
    const project = { id: "local", base: "", directory, config: readProjectConfig(directory) };
    const source = await projectSource(project);
    const page = source.getPage([]);
    if (!page) throw new Error("Missing home page");
    expect(await page.data.getText("raw")).toBe(original);
    expect(renderToStaticMarkup((await page.data.load()).body({}))).toContain('data-src-range="6:1-6:11"');
    await writeFile(join(directory, "docs/index.mdx"), original.replace("Original paragraph", "Changed on disk"));
    await writeFile(join(directory, "docs/new.mdx"), "---\ntitle: New page\n---\n\nNewly added content.\n");
    const refreshed = await projectSource(project);
    expect(
      refreshed
        .getPages()
        .map((page) => page.data.title)
        .sort(),
    ).toEqual(["Handbook", "New page"]);
    const updated = refreshed.getPage([]);
    if (!updated) throw new Error("Missing refreshed page");
    expect(renderToStaticMarkup((await updated.data.load()).body({}))).toContain("Changed on disk");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("refuses a page that runs code when it compiles, while the rest of the project opens", async () => {
  const directory = await mkdtemp(join(tmpdir(), "docs-content-only-"));
  try {
    await mkdir(join(directory, "docs"));
    await writeFile(join(directory, "docs/index.mdx"), "---\ntitle: Home\n---\n\nFine.\n");
    await writeFile(join(directory, "docs/bad.mdx"), "---\ntitle: Bad\n---\n\n{globalThis.ran = true}\n");
    const source = await projectSource({
      id: "content-only",
      base: "",
      directory,
      config: readProjectConfig(directory),
    });
    await expect(source.getPage(["bad"])!.data.load()).rejects.toThrow("docs/bad.mdx");
    expect("ran" in globalThis).toBe(false);
    expect(renderToStaticMarkup((await source.getPage([])!.data.load()).body({}))).toContain("Fine.");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("keeps the project open past a page with no title and a meta.json that is not JSON, naming both", async () => {
  const directory = await mkdtemp(join(tmpdir(), "docs-broken-"));
  try {
    await mkdir(join(directory, "docs/guides"), { recursive: true });
    await writeFile(join(directory, "docs/index.mdx"), "---\ntitle: Home\n---\n\nFine.\n");
    await writeFile(join(directory, "docs/guides/setup.mdx"), "---\ndescription: No title\n---\n\nBody.\n");
    await writeFile(join(directory, "docs/guides/meta.json"), "{ pages: [] }");
    const source = await projectSource({ id: "broken", base: "", directory, config: readProjectConfig(directory) });

    expect(renderToStaticMarkup((await source.getPage([])!.data.load()).body({}))).toContain("Fine.");
    expect(source.getPage(["guides", "setup"])!.data.title).toBe("setup");
    await expect(source.getPage(["guides", "setup"])!.data.load()).rejects.toThrow("docs/guides/setup.mdx");
    expect(sourceProblems(source).map(({ file, url }) => ({ file, url }))).toEqual([
      { file: "docs/guides/setup.mdx", url: "/guides/setup" },
      { file: "docs/guides/meta.json", url: null },
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("gives a page naming no layout the one its nearest folder names", async () => {
  const directory = await mkdtemp(join(tmpdir(), "docs-layouts-"));
  try {
    await mkdir(join(directory, "docs/blog/drafts"), { recursive: true });
    await mkdir(join(directory, "docs/z"), { recursive: true });
    await writeFile(join(directory, "docs/meta.json"), '{ "layout": "home" }');
    await writeFile(join(directory, "docs/index.mdx"), "---\ntitle: Home\n---\n");
    await writeFile(join(directory, "docs/z/meta.json"), '{ "layout": "zine" }');
    await writeFile(join(directory, "docs/z/issue.mdx"), "---\ntitle: Issue\n---\n");
    await writeFile(join(directory, "docs/blog/meta.json"), '{ "title": "Writing", "layout": "post" }');
    await writeFile(join(directory, "docs/blog/hello.mdx"), "---\ntitle: Hello\n---\n");
    await writeFile(join(directory, "docs/blog/about.mdx"), "---\ntitle: About\nlayout: profile\n---\n");
    await writeFile(join(directory, "docs/blog/drafts/meta.json"), '{ "layout": "draft" }');
    await writeFile(join(directory, "docs/blog/drafts/next.mdx"), "---\ntitle: Next\n---\n");
    const source = await projectSource({ id: "layouts", base: "", directory, config: readProjectConfig(directory) });
    const layoutOf = (...slug: string[]) => {
      const data = source.getPage(slug)?.data;
      return data?.layout ?? data?.folderLayout;
    };

    expect(layoutOf()).toBe("home");
    expect(layoutOf("z", "issue")).toBe("zine");
    expect(layoutOf("blog", "hello")).toBe("post");
    expect(layoutOf("blog", "about")).toBe("profile");
    expect(layoutOf("blog", "drafts", "next")).toBe("draft");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
