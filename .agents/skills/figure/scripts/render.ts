/**
 * Renders the figures of a docs page to PNG, in the project's own colours, dark and light.
 *
 * Each `<figure className="jd-fig">` in the page is turned from JSX back into
 * HTML, painted with the figure palette worked out from the project's theme,
 * and screenshotted with agent-browser into a folder named after the page. Prints the path of
 * every image it wrote.
 *
 * @example bun .agents/skills/figure/scripts/render.ts docs/index.mdx      // every figure
 * @example bun .agents/skills/figure/scripts/render.ts docs/index.mdx 2    // the second one
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

type Mode = "dark" | "light";
type Palette = Record<string, string>;

/** The framework's default colours, the ones a project without a theme wears. */
const DEFAULTS: Record<Mode, Palette> = {
  light: {
    background: "#ffffff",
    foreground: "#09090b",
    card: "#fafafa",
    primary: "#18181b",
    "muted-foreground": "#71717a",
    border: "#e4e4e7",
    "chart-1": "#e76e50",
    "chart-2": "#2a9d90",
    "chart-3": "#274754",
  },
  dark: {
    background: "#09090b",
    foreground: "#fafafa",
    card: "#111113",
    primary: "#fafafa",
    "muted-foreground": "#a1a1aa",
    border: "#27272a",
    "chart-1": "#2662d9",
    "chart-2": "#2eb88a",
    "chart-3": "#e88c30",
  },
};

/** The colours a theme works out from its core ones when it does not set them itself. */
const DERIVED: Palette = {
  card: "color-mix(in oklab, var(--foreground) 3%, var(--background))",
  "muted-foreground": "color-mix(in oklab, var(--foreground) 66%, var(--background))",
  border: "color-mix(in oklab, var(--foreground) 13%, var(--background))",
};

/** SVG's own attribute names that are camelCase in the markup too, so they stay as written. */
const CAMEL_IN_SVG = new Set([
  "viewBox",
  "preserveAspectRatio",
  "markerWidth",
  "markerHeight",
  "markerUnits",
  "refX",
  "refY",
  "gradientUnits",
  "gradientTransform",
  "spreadMethod",
  "patternUnits",
  "patternContentUnits",
  "patternTransform",
  "clipPathUnits",
  "maskUnits",
  "maskContentUnits",
  "filterUnits",
  "primitiveUnits",
  "baseFrequency",
  "numOctaves",
  "stitchTiles",
  "stdDeviation",
  "tableValues",
  "kernelMatrix",
  "surfaceScale",
  "diffuseConstant",
  "specularConstant",
  "specularExponent",
  "xChannelSelector",
  "yChannelSelector",
  "pathLength",
  "textLength",
  "lengthAdjust",
  "startOffset",
  "edgeMode",
]);

const [pagePath, only] = process.argv.slice(2);
if (!pagePath) throw new Error("Usage: bun render.ts <page.mdx> [figure number]");

const page = resolve(pagePath);
const project = findProject(dirname(page));
const config = JSON.parse(await readFile(join(project, ".jotdown/config.json"), "utf8"));
const figures = [...(await readFile(page, "utf8")).matchAll(/<figure className="jd-fig[^"]*">[\s\S]*?<\/figure>/g)].map(
  (match) => toHtml(match[0]),
);

const out = join("/tmp", "figures", basename(page, ".mdx"));
await mkdir(out, { recursive: true });

for (const [index, figure] of figures.entries()) {
  const number = index + 1;
  if (only && Number(only) !== number) continue;

  for (const mode of ["dark", "light"] as const) {
    const html = join(out, `figure-${number}-${mode}.html`);
    const png = join(out, `figure-${number}-${mode}.png`);
    await writeFile(html, documentFor(figure, mode));
    await run(["agent-browser", "open", `file://${html}`]);
    await run(["agent-browser", "set", "viewport", "1040", "200"]);
    await run(["agent-browser", "screenshot", "--full", png]);
    console.log(png);
  }
}

/** The folder holding `.jotdown/config.json`, walking up from the page. */
function findProject(from: string): string {
  if (existsSync(join(from, ".jotdown/config.json"))) return from;
  const parent = dirname(from);
  if (parent === from) throw new Error("No .jotdown/config.json above the page.");
  return findProject(parent);
}

/**
 * One mode's colours: the defaults when the theme leaves the mode out, else the theme's own.
 *
 * @example palette("dark", { dark: { primary: "#b9acff" } }).primary; // "#b9acff"
 */
function palette(mode: Mode, theme?: Partial<Record<Mode, Palette>>): Palette {
  const given = theme?.[mode];
  if (!given) return DEFAULTS[mode];
  return { ...DEFAULTS[mode], ...DERIVED, ...given };
}

/**
 * Turns a figure's JSX back into the HTML the browser would get.
 *
 * @example toHtml('<rect strokeWidth="1.5" />'); // '<rect stroke-width="1.5" />'
 */
function toHtml(jsx: string) {
  return jsx
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/<style>\{`([\s\S]*?)`\}<\/style>/g, "<style>$1</style>")
    .replaceAll("className=", "class=")
    .replace(/ ([a-z]+[A-Z][A-Za-z]*)=/g, (_, name: string) => ` ${kebab(name)}=`);
}

/** SVG presentation attributes are kebab-case in HTML, except the ones SVG itself spells in camelCase. */
function kebab(name: string) {
  if (CAMEL_IN_SVG.has(name)) return name;
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** One page holding the figure, with the palette and frame the site paints a figure with. */
function documentFor(figure: string, mode: Mode) {
  const colours = Object.entries(palette(mode, config.theme)).map(([token, value]) => `--${token}: ${value};`);

  return `<!doctype html>
<html class="${mode}">
<head>
<style>
  :root {
    ${colours.join("\n    ")}
    --font-sans: "Inter", "Segoe UI", system-ui, sans-serif;
    --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Consolas, monospace;
    --line-strong: color-mix(in srgb, var(--border) 55%, var(--foreground));
    --jd-fig-ink: var(--foreground);
    --jd-fig-muted: var(--muted-foreground);
    --jd-fig-line: var(--line-strong);
    --jd-fig-line-soft: var(--border);
    --jd-fig-surface: color-mix(in srgb, var(--foreground) 4%, var(--card));
    --jd-fig-accent: var(--primary);
    --jd-fig-accent-soft: color-mix(in srgb, var(--primary) 12%, var(--jd-fig-surface));
    --jd-fig-p-ink: var(--chart-1);
    --jd-fig-p-bg: color-mix(in srgb, var(--chart-1) 14%, var(--jd-fig-surface));
    --jd-fig-d-ink: var(--chart-2);
    --jd-fig-d-bg: color-mix(in srgb, var(--chart-2) 14%, var(--jd-fig-surface));
    --jd-fig-i-ink: var(--chart-3);
    --jd-fig-i-bg: color-mix(in srgb, var(--chart-3) 14%, var(--jd-fig-surface));
  }
  body { margin: 0; padding: 24px; width: 960px; background: var(--background); color: var(--foreground); font-family: var(--font-sans); }
  .jd-fig-frame { background: var(--card); border: 1px solid var(--border); border-radius: 0.375rem; padding: 1.35rem 1.25rem; }
  .jd-fig svg { display: block; width: 100%; height: auto; }
  .jd-fig svg text { font-family: var(--font-mono); }
  .jd-fig figcaption { margin-top: 0.75rem; font-size: 0.8125rem; line-height: 1.55; color: var(--muted-foreground); }
</style>
</head>
<body>${figure}</body>
</html>`;
}

function run([command, ...args]: string[]) {
  return new Promise<void>((done, fail) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "inherit"] });
    child.on("exit", (code) => (code === 0 ? done() : fail(new Error(`${command} ${args.join(" ")} failed`))));
  });
}
