import type { Theme, ThemeToken } from "@jotdown/core/lib/theme";

/**
 * Colour arithmetic for the theme settings: reading a CSS colour, measuring contrast and deriving a dark mode.
 *
 * Everything is plain sRGB and OKLCH maths, so it runs the same in the browser
 * and in a test. A colour this cannot read, `lab()` say, reads as null, and
 * whatever needed it is skipped rather than guessed.
 */

type Rgb = { r: number; g: number; b: number };
type Oklch = { l: number; c: number; h: number };
type Mode = NonNullable<Theme["light"]>;

/** The framework's own colours for the tokens a theme leaves out, as the default palette states them. */
export const DEFAULT_COLOURS = {
  light: {
    background: "#ffffff",
    foreground: "#09090b",
    primary: "#18181b",
    destructive: "#dc2626",
    "chart-1": "#e76e50",
    "chart-2": "#2a9d90",
    "chart-3": "#274754",
    "chart-4": "#e8c468",
    "chart-5": "#f4a462",
  },
  dark: {
    background: "#09090b",
    foreground: "#fafafa",
    primary: "#fafafa",
    destructive: "#f87171",
    "chart-1": "#2662d9",
    "chart-2": "#2eb88a",
    "chart-3": "#e88c30",
    "chart-4": "#af57db",
    "chart-5": "#e23670",
  },
} satisfies Record<"light" | "dark", Mode>;

/**
 * A CSS colour as sRGB channels from 0 to 1, or null when it is not one this reads.
 *
 * @example parseColour("#433a86"); // { r: 0.26, g: 0.23, b: 0.53 }
 * @example parseColour("oklch(0.7 0.1 200)"); // { r: …, g: …, b: … }
 * @example parseColour("color(srgb 1 0 0)"); // { r: 1, g: 0, b: 0 }
 */
export function parseColour(css: string): Rgb | null {
  const text = css.trim().toLowerCase();

  const hex = /^#([0-9a-f]{3,8})$/.exec(text)?.[1];
  if (hex) return parseHex(hex);

  const srgb = /^color\(srgb\s+([^)]*)\)$/.exec(text)?.[1]?.split(/[\s/]+/);
  if (srgb && srgb.length >= 3)
    return { r: channel(srgb[0] ?? "", 1), g: channel(srgb[1] ?? "", 1), b: channel(srgb[2] ?? "", 1) };

  const call = /^(rgba?|hsla?|oklch|oklab)\(([^)]*)\)$/.exec(text);
  if (!call) return null;
  const [name = "", body = ""] = call.slice(1);
  const parts = body
    .split(/[\s,/]+/)
    .filter(Boolean)
    .slice(0, 3);
  if (parts.length < 3) return null;
  const [first = "", second = "", third = ""] = parts;

  if (name.startsWith("rgb")) {
    return { r: channel(first, 255), g: channel(second, 255), b: channel(third, 255) };
  }
  if (name.startsWith("hsl")) return hslToRgb(Number.parseFloat(first), channel(second, 100), channel(third, 100));
  if (name === "oklch") {
    return oklchToRgb({ l: channel(first, 1), c: Number.parseFloat(second), h: Number.parseFloat(third) || 0 });
  }
  return oklabToRgb(channel(first, 1), Number.parseFloat(second), Number.parseFloat(third));
}

function parseHex(hex: string): Rgb | null {
  const full = hex.length <= 4 ? [...hex].map((digit) => digit + digit).join("") : hex;
  if (full.length !== 6 && full.length !== 8) return null;
  const at = (index: number) => Number.parseInt(full.slice(index, index + 2), 16) / 255;
  return { r: at(0), g: at(2), b: at(4) };
}

/** One channel, read as a percentage of `scale` or as a number on it. */
function channel(text: string, scale: number) {
  return text.endsWith("%") ? Number.parseFloat(text) / 100 : Number.parseFloat(text) / scale;
}

function hslToRgb(hue: number, saturation: number, lightness: number): Rgb {
  const k = (n: number) => (n + hue / 30) % 12;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const f = (n: number) => lightness - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return { r: f(0), g: f(8), b: f(4) };
}

/**
 * sRGB channels as a six-digit hex colour, clipped into the gamut.
 *
 * @example toHex({ r: 1, g: 1, b: 1 }); // "#ffffff"
 */
export function toHex({ r, g, b }: Rgb) {
  const byte = (value: number) =>
    Math.round(Math.min(1, Math.max(0, value)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

/**
 * Any colour this reads as a six-digit hex, for the colour well, or null.
 *
 * @example hexOf("rgb(255 0 0)"); // "#ff0000"
 */
export function hexOf(css: string) {
  const rgb = parseColour(css);
  return rgb && toHex(rgb);
}

const linear = (value: number) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
const gamma = (value: number) => (value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055);

/** WCAG's relative luminance. */
function luminance({ r, g, b }: Rgb) {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/**
 * The WCAG contrast ratio between two colours, from 1 to 21, or null when either does not read.
 *
 * @example contrast("#ffffff", "#000000"); // 21
 */
export function contrast(one: string, other: string) {
  const a = parseColour(one);
  const b = parseColour(other);
  if (!a || !b) return null;

  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * The WCAG level a ratio reaches for body text.
 *
 * @example contrastLevel(4.8); // "AA"
 */
export function contrastLevel(ratio: number) {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "Large text";
  return "Low";
}

function toOklch({ r, g, b }: Rgb): Oklch {
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

function oklchToRgb({ l, c, h }: Oklch): Rgb {
  const radians = (h * Math.PI) / 180;
  return oklabToRgb(l, c * Math.cos(radians), c * Math.sin(radians));
}

function oklabToRgb(L: number, A: number, B: number): Rgb {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;

  return {
    r: gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

/** A colour moved to a lightness, its chroma capped, keeping its hue. */
function shifted(css: string, lightness: number, maxChroma: number) {
  const rgb = parseColour(css);
  if (!rgb) return null;
  const colour = toOklch(rgb);
  return toHex(oklchToRgb({ l: lightness, c: Math.min(colour.c, maxChroma), h: colour.h }));
}

/**
 * A dark mode worked out from a light one: dark ground, light ink, and accents lifted so they read on it.
 *
 * Hues stay as they are and chroma comes down a little, which is how a hand-made
 * dark palette usually differs from its light one. The ground takes a faint
 * tint of the primary's hue, so the two modes feel like one brand.
 *
 * @example deriveDark({ primary: "#433a86" }).primary; // "#b5b2ff"
 */
export function deriveDark(light: Mode): Mode {
  const read = (token: keyof typeof DEFAULT_COLOURS.light) => light[token] ?? DEFAULT_COLOURS.light[token];
  const primary = parseColour(read("primary"));
  const tint = primary ? toOklch(primary) : { c: 0, h: 0 };
  const tinted = tint.c > 0.03;

  const dark: Mode = {};
  const set = (token: ThemeToken, value: string | null) => {
    if (value) dark[token] = value;
  };

  const ground = (lightness: number, chroma: number) =>
    toHex(oklchToRgb({ l: lightness, c: tinted ? chroma : 0, h: tint.h }));

  set("background", ground(0.16, 0.025));
  set("foreground", ground(0.94, 0.012));
  set("primary", tinted ? shifted(read("primary"), 0.8, 0.14) : shifted(read("primary"), 0.96, 0));
  set("destructive", shifted(read("destructive"), 0.72, 0.16));
  for (const chart of ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const) {
    set(chart, shifted(read(chart), 0.76, 0.15));
  }
  if (light.card) set("card", ground(0.195, 0.03));
  if (light.popover) set("popover", ground(0.215, 0.03));
  if (light.ring) set("ring", shifted(light.ring, 0.8, 0.14));

  for (const [token, value] of Object.entries(light) as [ThemeToken, string][]) {
    if (token in dark) continue;
    const rgb = parseColour(value);
    if (!rgb) continue;
    const colour = toOklch(rgb);
    set(
      token,
      toHex(oklchToRgb({ l: Math.min(0.96, Math.max(0.14, 1.14 - colour.l)), c: colour.c * 0.8, h: colour.h })),
    );
  }

  return dark;
}
