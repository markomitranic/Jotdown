import { z } from "zod";

/**
 * A project's look, set in `.jotdown/config.json`: its colours with shadcn's own token names, its radius and its typefaces.
 *
 * A theme names a few core colours per mode and the rest of shadcn's palette
 * follows from them, unless it sets those too. A core colour it leaves out
 * keeps the framework's default for that mode. Everything on the site, the
 * shell, figures, charts, section accents and the stripe, paints from these.
 * The theme is the whole of a project's look: there is no stylesheet beside it.
 */

/** The colours a theme picks. Every other token is worked out from these. */
const CORE_TOKENS = [
  "background",
  "foreground",
  "primary",
  "destructive",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
] as const;

/** Every other shadcn colour token, as the CSS it takes when the theme leaves it out. */
const DERIVED_TOKENS = {
  card: "color-mix(in oklab, var(--foreground) 3%, var(--background))",
  "card-foreground": "var(--foreground)",
  popover: "var(--card)",
  "popover-foreground": "var(--foreground)",
  "primary-foreground": "var(--background)",
  secondary: "color-mix(in oklab, var(--foreground) 6%, var(--background))",
  "secondary-foreground": "var(--foreground)",
  muted: "color-mix(in oklab, var(--foreground) 6%, var(--background))",
  "muted-foreground": "color-mix(in oklab, var(--foreground) 66%, var(--background))",
  accent: "color-mix(in oklab, var(--foreground) 8%, var(--background))",
  "accent-foreground": "var(--foreground)",
  "destructive-foreground": "var(--background)",
  border: "color-mix(in oklab, var(--foreground) 13%, var(--background))",
  input: "var(--border)",
  ring: "var(--primary)",
  sidebar: "var(--card)",
  "sidebar-foreground": "var(--foreground)",
  "sidebar-primary": "var(--primary)",
  "sidebar-primary-foreground": "var(--primary-foreground)",
  "sidebar-accent": "var(--accent)",
  "sidebar-accent-foreground": "var(--foreground)",
  "sidebar-border": "var(--border)",
  "sidebar-ring": "var(--ring)",
} as const;

/**
 * The framework's own tints, worked out again from the theme.
 *
 * The default palette states these flat, so a theme restates them or it would
 * wear the default's headings and hairlines on its own ground.
 */
const FRAMEWORK_TINTS = {
  "jd-heading": "var(--foreground)",
  "jd-ink-soft": "color-mix(in oklab, var(--foreground) 78%, var(--background))",
  "jd-line-soft": "color-mix(in oklab, var(--border) 55%, var(--background))",
  "jd-line-strong": "color-mix(in oklab, var(--border) 55%, var(--foreground))",
  "jd-accent-soft": "color-mix(in oklab, var(--primary) 10%, transparent)",
  "jd-section-home": "var(--primary)",
} as const;

type DerivedToken = keyof typeof DERIVED_TOKENS;

const TOKEN_NAMES = [...CORE_TOKENS, ...(Object.keys(DERIVED_TOKENS) as DerivedToken[])] as [string, ...string[]];

/** A CSS colour that cannot close the rule it sits in: hex, or one colour function with plain arguments. */
const COLOUR = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\([0-9a-z.%\s,/+-]*\))$/i;

const colour = z.string().regex(COLOUR, "Write a colour as #hex, rgb(), hsl() or oklch().");
const mode = z.partialRecord(z.enum(TOKEN_NAMES), colour);

/** The roles a typeface can play, and what each falls back to while its file loads or when it has none. */
const FONT_ROLES = {
  sans: "system-ui, -apple-system, sans-serif",
  serif: "ui-serif, Georgia, serif",
  mono: 'ui-monospace, "SF Mono", Consolas, monospace',
} as const;

/** A typeface: its family name, and an uploaded variable font file when the reader's machine will not have it. */
const font = z
  .object({
    family: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9 _-]*$/, "Write the family as plain words, like Inter."),
    src: z
      .string()
      .regex(
        /^\/uploads\/[A-Za-z0-9_/.-]+\.(woff2|woff|ttf|otf)$/,
        "Point at a font among the uploads, like /uploads/fonts/inter.woff2.",
      )
      .optional(),
  })
  .strict();

/** The `theme` field of `.jotdown/config.json`. */
export const themeSchema = z
  .object({
    light: mode.optional(),
    dark: mode.optional(),
    radius: z
      .string()
      .regex(/^\d*\.?\d+(rem|px)$/, "Write the radius as rem or px, like 0.375rem.")
      .optional(),
    sections: z.record(z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/), z.enum(TOKEN_NAMES)).optional(),
    fonts: z.object({ sans: font, serif: font, mono: font }).partial().strict().optional(),
  })
  .strict();

export type Theme = z.infer<typeof themeSchema>;

/**
 * The stylesheet a theme becomes: its font files, a block per mode it sets, then its radius, typefaces and section accents.
 *
 * A mode the theme leaves out keeps the default palette whole, and light mode is
 * scoped away from dark, so a token set for one never shows up in the other.
 * A font file's address is served under `base`, where the project's pages are.
 * Nothing comes back for a project without a theme.
 *
 * @example themeStylesheet({ dark: { primary: "#b9acff" } }); // ".dark { --primary: #b9acff; … }"
 * @example themeStylesheet({ fonts: { sans: { family: "Geist" } } }); // ":root { --font-sans: \"Geist\", system-ui, … }"
 */
export function themeStylesheet(theme: Theme | undefined, base = "") {
  if (!theme) return "";

  const fonts = Object.entries(theme.fonts ?? {}) as [keyof typeof FONT_ROLES, z.infer<typeof font>][];
  const faces = fonts.flatMap(([, face]) =>
    face.src
      ? [
          `@font-face {\n  font-family: "${face.family}";\n  src: url("${base}${face.src}");\n  font-weight: 100 900;\n  font-display: swap;\n}`,
        ]
      : [],
  );
  const families = fonts.flatMap(([role, face]) => {
    const family = `--font-${role}: "${face.family}", ${FONT_ROLES[role]};`;
    return role === "sans" ? [family, `--font-label: "${face.family}", ${FONT_ROLES.sans};`] : [family];
  });
  const radius = theme.radius ? [`--radius: ${theme.radius};`] : [];
  const sections = Object.entries(theme.sections ?? {}).map(
    ([folder, token]) => `--jd-section-${folder}: var(--${token});`,
  );
  const shared = [...radius, ...families, ...sections];

  return [
    ...faces,
    theme.light && rule(":root:not(.dark)", declarations(theme.light)),
    theme.dark && rule(".dark", declarations(theme.dark)),
    shared.length > 0 && rule(":root", shared),
  ]
    .filter(Boolean)
    .join("\n");
}

/** One mode's tokens: the core colours it sets, every other token as set or worked out, and the framework's tints. */
function declarations(given: Partial<Record<string, string>>) {
  const core = CORE_TOKENS.filter((token) => given[token]).map((token) => `--${token}: ${given[token]};`);
  const derived = Object.entries(DERIVED_TOKENS).map(([token, fallback]) => `--${token}: ${given[token] ?? fallback};`);
  const tints = Object.entries(FRAMEWORK_TINTS).map(([token, value]) => `--${token}: ${value};`);
  return [...core, ...derived, ...tints];
}

function rule(selector: string, lines: string[]) {
  return `${selector} {\n${lines.map((line) => `  ${line}`).join("\n")}\n}`;
}
