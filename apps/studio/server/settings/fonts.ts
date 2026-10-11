import { z } from "zod";
import { FAMILY } from "@jotdown/core/lib/theme";
import type { Session } from "../auth/session";
import { errorResponse, readJsonBody } from "../live-edit/_contract";
import { commitBrandFile, describeUpload } from "./uploads";

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
export type GoogleFont = { family: string; category: string; weights: string };

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

let listed: Promise<GoogleFont[]> | null = null;

/**
 * Every variable Google family the theme can name, most popular first, read once per server.
 *
 * A theme names one file per face and declares it for every weight, so only a
 * family with a weight axis can be one file without its bold coming out regular.
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
        .flatMap(({ family, category, axes }) => {
          const weight = axes.find(({ tag }) => tag === "wght");
          return weight ? [{ family, category, weights: `${weight.min}..${weight.max}` }] : [];
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
 * The family comes as one variable file covering every weight it has.
 */
export async function installFont(request: Request, session: Session) {
  const { family } = ((await readJsonBody(request)) ?? {}) as { family?: unknown };
  const listed = await googleFonts().catch(() => null);
  if (!listed)
    return errorResponse({ status: 502, error: "Google Fonts could not be reached. Try again in a moment." });

  const font = listed.find((each) => each.family === family);
  if (!font) return errorResponse({ status: 404, error: "Google Fonts has no family by that name." });

  const bytes = await download(font).catch(() => null);
  const described = bytes && describeUpload("font", bytes);
  if (!bytes || !described?.ok) {
    return errorResponse({ status: 502, error: `${font.family} could not be downloaded from Google Fonts.` });
  }

  const saved = await commitBrandFile(bytes, described.value, font.family, session);
  return saved.ok ? Response.json({ family: font.family, src: saved.value.url }) : errorResponse(saved.failure);
}

/** The family's Latin WOFF2, the subset every Western page needs. */
async function download(font: GoogleFont) {
  const query = `family=${encodeURIComponent(font.family).replace(/%20/g, "+")}:wght@${font.weights}&display=swap`;
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
