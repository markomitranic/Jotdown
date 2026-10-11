import { describe, expect, it } from "vitest";
import { themeSchema, themeStylesheet } from "./theme";

describe("themeStylesheet", () => {
  it("writes the colours a mode sets and works out the rest, keeping each mode to itself", () => {
    const css = themeStylesheet({ light: { background: "#ffffff", card: "#f7f6fc" }, dark: { background: "#0d0c1b" } });
    const [light, dark] = css.split("\n.dark");

    expect(light).toContain("--background: #ffffff;");
    expect(light).toContain("--card: #f7f6fc;");
    expect(dark).toContain("--background: #0d0c1b;");
    expect(dark).toContain("--card: color-mix(in oklab, var(--foreground) 3%, var(--background));");
    expect(dark).not.toContain("#f7f6fc");
  });

  it("leaves a core colour the theme does not name to the default palette", () => {
    expect(themeStylesheet({ light: { primary: "#433a86" } })).not.toContain("--background:");
  });

  it("paints a section with the token it names, and leaves the default palette whole", () => {
    const css = themeStylesheet({ sections: { manual: "chart-4" } });

    expect(css).toContain("--jd-section-manual: var(--chart-4);");
    expect(css).not.toContain("--card:");
  });

  it("writes nothing for a project without a theme", () => {
    expect(themeStylesheet(undefined)).toBe("");
  });
});

describe("themeSchema", () => {
  it("refuses a value that would close the rule it sits in", () => {
    expect(themeSchema.safeParse({ light: { primary: "red; } body { display: none" } }).success).toBe(false);
  });

  it("refuses a token shadcn does not have", () => {
    expect(themeSchema.safeParse({ light: { brand: "#ff47cd" } }).success).toBe(false);
  });
});

describe("theme fonts", () => {
  it("names a typeface with a fallback, and loads its file from under the project's base", () => {
    const css = themeStylesheet(
      { fonts: { sans: { family: "Geist", src: "/uploads/fonts/geist.woff2" } } },
      "/you/notes",
    );

    expect(css).toContain('src: url("/you/notes/uploads/fonts/geist.woff2");');
    expect(css).toContain('--font-sans: "Geist", system-ui');
    expect(css).toContain('--font-label: "Geist"');
  });

  it("refuses a family or a file that could break out of the stylesheet", () => {
    expect(themeSchema.safeParse({ fonts: { sans: { family: 'Inter"; } body {' } } }).success).toBe(false);
    expect(themeSchema.safeParse({ fonts: { mono: { family: "Mono", src: '/uploads/x.woff2") ; x' } } }).success).toBe(
      false,
    );
  });
});
