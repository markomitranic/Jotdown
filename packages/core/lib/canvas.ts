import { z } from "zod";

/**
 * The messages between the studio and a site's `/_edit` canvas, the page the studio frames to edit a project in its own look.
 *
 * The canvas announces itself with `hello`. The studio answers with `load`,
 * the page to draw and everything around it, and the canvas sends every
 * request its editor makes as a `request`, which the studio answers from its
 * own editing endpoints as a `response`. Either side can `navigate`, the
 * studio sets the colour mode with `theme`, and the canvas hands back the
 * studio's own shortcuts as `shortcut`.
 *
 * Every site ever built speaks this, so a change to a message's shape is a new
 * `CANVAS_PROTOCOL`, and the studio names the version it can talk to.
 */

/** The version of these messages, which the canvas announces and the studio checks. */
export const CANVAS_PROTOCOL = 1;

/** Where a canvas lives in a site build. */
export const CANVAS_PATH = "/_edit";

/** The canvas announcing itself: the protocol, the framework it was built with, and the project it belongs to. */
const hello = z.object({
  type: z.literal("hello"),
  protocol: z.number().int(),
  framework: z.string(),
  project: z.object({ title: z.string(), repository: z.string().optional() }),
});

/** One request the canvas's editor makes, for the studio to answer. */
const request = z.object({
  type: z.literal("request"),
  id: z.string(),
  url: z.string(),
  method: z.string(),
  headers: z.record(z.string(), z.string()),
  body: z.unknown().optional(),
});

/** Asks for another page, in either direction, by its address inside the project. */
const navigate = z.object({ type: z.literal("navigate"), url: z.string() });

/** A key the studio answers, pressed inside the canvas. */
const shortcut = z.object({
  type: z.literal("shortcut"),
  key: z.string(),
  meta: z.boolean(),
  ctrl: z.boolean(),
  shift: z.boolean(),
  alt: z.boolean(),
});

/** One page of the project as the canvas draws it: its text, its place in the tree, and the editor's settings. */
const load = z.object({
  type: z.literal("load"),
  url: z.string(),
  path: z.string(),
  text: z.string(),
  tree: z.unknown(),
  config: z.unknown(),
  target: z.object({
    path: z.string(),
    localPath: z.string(),
    title: z.string(),
    markdownUrl: z.string(),
    githubUrl: z.string(),
    publicUrl: z.string(),
    generated: z.boolean().optional(),
  }),
});

/** The studio's answer to one `request`, with the status and body its endpoint gave. */
const response = z.object({ type: z.literal("response"), id: z.string(), status: z.number().int(), body: z.unknown() });

/** The colour mode the studio is in. */
const theme = z.object({ type: z.literal("theme"), mode: z.enum(["light", "dark"]) });

/** Anything a canvas may send. */
export const fromCanvas = z.discriminatedUnion("type", [hello, request, navigate, shortcut]);

/** Anything the studio may send. */
export const fromStudio = z.discriminatedUnion("type", [load, response, navigate, theme]);

export type FromCanvas = z.infer<typeof fromCanvas>;
export type FromStudio = z.infer<typeof fromStudio>;
export type CanvasLoad = z.infer<typeof load>;
export type CanvasHello = z.infer<typeof hello>;

/**
 * Whether an origin is this machine, the only place a studio runs.
 *
 * The app's port changes, so the canvas accepts any loopback origin rather
 * than one it was told about.
 *
 * @example isLoopback("http://127.0.0.1:53041"); // true
 * @example isLoopback("https://evil.example"); // false
 */
export function isLoopback(origin: string) {
  try {
    const { hostname } = new URL(origin);
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
  } catch {
    return false;
  }
}
