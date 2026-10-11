import { COLOUR, FAMILY, TOKEN_NAMES, type Theme, type ThemeToken } from "@jotdown/core/lib/theme";

/**
 * A theme read out of shadcn's CSS variables, as ui.shadcn.com and tweakcn export them.
 *
 * Jotdown's colour tokens carry shadcn's own names, so a `:root { … }` and a
 * `.dark { … }` block map straight across. Anything else in the paste, shadows,
 * spacing or tracking, is counted as skipped rather than guessed at.
 */

type Mode = NonNullable<Theme["light"]>;

/** What a paste turned into, and the variables it left out. */
export type PastedTheme = { theme: Theme; applied: number; skipped: string[] };

const TOKENS = new Set<string>(TOKEN_NAMES);
const BARE_HSL = /^-?\d*\.?\d+(deg)?\s+\d*\.?\d+%\s+\d*\.?\d+%$/;
const RADIUS = /^\d*\.?\d+(rem|px)$/;
const GENERIC_FAMILIES = new Set([
  "system-ui",
  "sans-serif",
  "serif",
  "monospace",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
  "-apple-system",
  "blinkmacsystemfont",
]);

/**
 * Reads pasted CSS into a theme, or null when nothing in it is a shadcn variable.
 *
 * Old shadcn themes write colours as bare HSL, `222 84% 5%`, which is read as
 * `hsl(222 84% 5%)`. A font names its first family, without a file, since a
 * paste carries none.
 *
 * @example parsePastedTheme(":root { --primary: oklch(0.5 0.2 270); }")?.theme; // { light: { primary: "oklch(0.5 0.2 270)" } }
 */
export function parsePastedTheme(css: string): PastedTheme | null {
  const light: Mode = {};
  const dark: Mode = {};
  const theme: Theme = {};
  const skipped = new Set<string>();
  let applied = 0;

  for (const [, selector = "", body = ""] of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const isDark = /\.dark\b/.test(selector);
    const isLight = !isDark && /:root\b/.test(selector);
    if (!isDark && !isLight) continue;

    for (const [, name = "", raw = ""] of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);?/g)) {
      const value = raw.trim();

      if (TOKENS.has(name)) {
        const colour = BARE_HSL.test(value) ? `hsl(${value})` : value;
        if (!COLOUR.test(colour)) {
          skipped.add(`--${name}`);
          continue;
        }
        (isDark ? dark : light)[name as ThemeToken] = colour;
        applied++;
        continue;
      }

      if (name === "radius" && isLight && RADIUS.test(value)) {
        theme.radius = value;
        applied++;
        continue;
      }

      const role = /^font-(sans|serif|mono)$/.exec(name)?.[1] as "sans" | "serif" | "mono" | undefined;
      const family = role && firstFamily(value);
      if (role && family && isLight) {
        theme.fonts = { ...theme.fonts, [role]: { family } };
        applied++;
        continue;
      }

      skipped.add(`--${name}`);
    }
  }

  if (applied === 0) return null;
  if (Object.keys(light).length > 0) theme.light = light;
  if (Object.keys(dark).length > 0) theme.dark = dark;
  return { theme, applied, skipped: [...skipped] };
}

/**
 * The first named family in a font stack, or null when it starts with a generic one.
 *
 * @example firstFamily('"Geist", ui-sans-serif, sans-serif'); // "Geist"
 */
function firstFamily(stack: string) {
  const first =
    stack
      .split(",")[0]
      ?.trim()
      .replace(/^["']|["']$/g, "") ?? "";
  return FAMILY.test(first) && !GENERIC_FAMILIES.has(first.toLowerCase()) ? first : null;
}
