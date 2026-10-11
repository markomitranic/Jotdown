import { describe, expect, it } from "vitest";
import { themeSchema } from "@jotdown/core/lib/theme";
import { contrast, deriveDark, hexOf } from "./colour";
import { changedPaths, commitMessage, tidy, valueAt, withValue } from "./config-draft";
import { parsePastedTheme } from "./paste";

describe("contrast", () => {
  it("measures black on white as the WCAG maximum", () => {
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21);
  });

  it("reads every colour syntax a theme may use", () => {
    expect(hexOf("rgb(255 0 0)")).toBe("#ff0000");
    expect(hexOf("hsl(0 100% 50%)")).toBe("#ff0000");
    expect(hexOf("oklch(1 0 0)")).toBe("#ffffff");
    expect(hexOf("color(srgb 1 0 0)")).toBe("#ff0000");
    expect(hexOf("lab(50 20 20)")).toBeNull();
  });
});

describe("deriveDark", () => {
  it("turns a light palette into a dark one that still reads", () => {
    const dark = deriveDark({ background: "#ffffff", foreground: "#1c1a33", primary: "#433a86" });

    expect(contrast(dark.foreground ?? "", dark.background ?? "")).toBeGreaterThan(12);
    expect(contrast(dark.primary ?? "", dark.background ?? "")).toBeGreaterThan(4.5);
    expect(themeSchema.safeParse({ dark }).success).toBe(true);
  });

  it("keeps a neutral palette neutral", () => {
    const dark = deriveDark({});
    expect(dark.background).toBe(hexOf(dark.background ?? ""));
    expect(new Set([dark.primary?.slice(1, 3), dark.primary?.slice(3, 5), dark.primary?.slice(5, 7)]).size).toBe(1);
  });
});

describe("parsePastedTheme", () => {
  it("maps shadcn's variables onto both modes, with radius and fonts", () => {
    const pasted = parsePastedTheme(`
      :root {
        --radius: 0.625rem;
        --background: oklch(1 0 0);
        --primary: oklch(0.205 0 0);
        --font-sans: "Geist", ui-sans-serif, sans-serif;
        --shadow-sm: 0 1px 2px black;
      }
      .dark { --primary: oklch(0.922 0 0); }
    `);

    expect(pasted?.theme).toEqual({
      radius: "0.625rem",
      fonts: { sans: { family: "Geist" } },
      light: { background: "oklch(1 0 0)", primary: "oklch(0.205 0 0)" },
      dark: { primary: "oklch(0.922 0 0)" },
    });
    expect(pasted?.skipped).toEqual(["--shadow-sm"]);
    expect(themeSchema.safeParse(pasted?.theme).success).toBe(true);
  });

  it("reads the bare HSL older shadcn themes write", () => {
    expect(parsePastedTheme(":root { --primary: 222.2 47.4% 11.2%; }")?.theme.light).toEqual({
      primary: "hsl(222.2 47.4% 11.2%)",
    });
  });

  it("answers null for CSS with no shadcn variables", () => {
    expect(parsePastedTheme("body { color: red; }")).toBeNull();
  });
});

describe("the settings draft", () => {
  it("names every leaf a draft changes, added and removed ones included", () => {
    const saved = { title: "Docs", theme: { light: { primary: "#433a86" }, radius: "0.5rem" } };
    const draft = { title: "Docs", url: "https://docs.dev", theme: { light: { primary: "#1f5fbf" } } };

    expect(changedPaths(saved, draft)).toEqual(["theme.light.primary", "theme.radius", "url"]);
  });

  it("writes one path without touching its neighbours, and drops what a cleared field leaves", () => {
    const config = { title: "Docs", theme: { light: { primary: "#433a86", background: "#fff" } } };

    expect(withValue(config, "theme.dark.primary", "#b9acff").theme).toEqual({
      light: { primary: "#433a86", background: "#fff" },
      dark: { primary: "#b9acff" },
    });
    expect(tidy(withValue(config, "theme.light", undefined))).toEqual({ title: "Docs" });
    expect(valueAt(config, "theme.light.primary")).toBe("#433a86");
  });

  it("says which settings a save touches in its commit subject", () => {
    expect(commitMessage(["title", "theme.light.primary", "theme.radius"])).toBe(
      "docs: (studio) settings: title, theme",
    );
  });
});
