import { z } from "zod";
import type { Session } from "../auth/session";
import { errorResponse, readJsonBody } from "../live-edit/_contract";
import { commitBrandFile, fontKind } from "./uploads";

/**
 * Google Fonts, listed for the picker and copied into the project when one is chosen.
 *
 * A chosen family is downloaded once and committed among the uploads, so a
 * publication serves its own copy and no reader's browser ever asks Google.
 */

const TIMEOUT_MS = 10_000;
const LIST_URL = "https://fonts.google.com/metadata/fonts";
const CSS_URL = "https://fonts.googleapis.com/css2";

/** A browser Google answers with WOFF2, since it shapes the stylesheet by user agent. */
const WOFF2_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

/** One family as the picker lists it. */
export type GoogleFont = { family: string; category: string; weights: string | null };

const listSchema = z.object({
  familyMetadataList: z.array(
    z.object({
      family: z.string(),
      category: z.string(),
      popularity: z.number().optional(),
      axes: z.array(z.object({ tag: z.string(), min: z.number(), max: z.number() })).default([]),
    }),
  ),
});

/** A family name the theme's schema takes, which is also what keeps it out of the stylesheet's syntax. */
const FAMILY = /^[A-Za-z0-9][A-Za-z0-9 _-]*$/;

let listed: Promise<GoogleFont[]> | null = null;

/**
 * Every Google family the theme can name, most popular first, read once per server.
 *
 * @example (await googleFonts())[0]; // { family: "Roboto", category: "Sans Serif", weights: "100..900" }
 */
export function googleFonts() {
  listed ??= fetch(LIST_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    .then((response) => {
      if (!response.ok) throw new Error(`Google Fonts answered ${response.status}.`);
      return response.text();
    })
    .then((text) => {
      const families = listSchema.parse(JSON.parse(text.slice(text.indexOf("{")))).familyMetadataList;
      return families
        .filter(({ family }) => FAMILY.test(family))
        .sort((a, b) => (a.popularity ?? 1e9) - (b.popularity ?? 1e9))
        .map(({ family, category, axes }) => {
          const weight = axes.find(({ tag }) => tag === "wght");
          return { family, category, weights: weight ? `${weight.min}..${weight.max}` : null };
        });
    })
    .catch((error) => {
      listed = null;
      throw error;
    });
  return listed;
}

/** `GET settings/fonts`: the families the picker offers. */
export async function listFonts() {
  try {
    return Response.json(await googleFonts(), { headers: { "cache-control": "private, max-age=86400" } });
  } catch {
    return errorResponse({ status: 502, error: "Google Fonts could not be reached. Upload a font file instead." });
  }
}

/**
 * `POST settings/font` with `{ family }`: copies a Google family's Latin file into the uploads.
 *
 * A variable family comes as one file covering every weight. A family with no
 * weight axis comes at its regular weight, which the browser emboldens itself.
 */
export async function installFont(request: Request, session: Session) {
  const { family } = ((await readJsonBody(request)) ?? {}) as { family?: unknown };
  const font =
    typeof family === "string" ? (await googleFonts().catch(() => [])).find((each) => each.family === family) : null;
  if (!font) return errorResponse({ status: 404, error: "Google Fonts has no family by that name." });

  try {
    const bytes = await download(font);
    if (fontKind(bytes) === null) throw new Error("Google sent something that is not a font.");

    const saved = await commitBrandFile(bytes, { kind: "font", extension: "woff2" }, font.family, session);
    return saved.ok ? Response.json({ family: font.family, src: saved.value.url }) : errorResponse(saved.failure);
  } catch {
    return errorResponse({ status: 502, error: `${font.family} could not be downloaded from Google Fonts.` });
  }
}

/** The family's Latin WOFF2, the subset every Western page needs. */
async function download(font: GoogleFont) {
  const axis = font.weights ? `:wght@${font.weights}` : "";
  const query = `family=${encodeURIComponent(font.family).replace(/%20/g, "+")}${axis}&display=swap`;
  const css = await fetch(`${CSS_URL}?${query}`, {
    headers: { "user-agent": WOFF2_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).then((response) => (response.ok ? response.text() : Promise.reject(new Error(`${response.status}`))));

  const latin = css.split("/* latin */")[1] ?? css;
  const url = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/.exec(latin)?.[1];
  if (!url) throw new Error("No WOFF2 in Google's stylesheet.");

  const file = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!file.ok) throw new Error(`${file.status}`);
  return new Uint8Array(await file.arrayBuffer());
}
