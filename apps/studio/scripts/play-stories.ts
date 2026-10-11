/**
 * Runs every story's play function in Chromium and WebKit, the engines of the browser and the app.
 *
 * Serves a built Storybook from a folder, or tests one already running at an
 * address, and opens each story on its own page. A story fails when Storybook
 * says its render or play threw; errors a story causes on purpose, such as an
 * image that never loads, stay out of it. A failure is tried once more, since a
 * cold start can be slow. A story tagged `no-webkit` is skipped in WebKit.
 *
 * @example bun scripts/play-stories.ts storybook-static
 * @example bun scripts/play-stories.ts http://localhost:6006 webkit blocks-text
 */

import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join } from "node:path";
import { type Browser, chromium, webkit } from "playwright";

type Entry = { id: string; type: string; tags?: string[] };
type Outcome = { done: boolean; error: string };

const [where = "storybook-static", only, filter = ""] = process.argv.slice(2);
const server = where.startsWith("http") ? null : await serveFolder(where);
const base = server ? `http://localhost:${(server.address() as AddressInfo).port}` : where;

const index: { entries: Record<string, Entry> } = await (await fetch(`${base}/index.json`)).json();
const stories = Object.values(index.entries).filter((entry) => entry.type === "story" && entry.id.includes(filter));

const engines = { chromium, webkit };
let failed = 0;

for (const [name, engine] of Object.entries(engines)) {
  if (only && only !== name) continue;

  const browser = await engine.launch();
  const runnable = stories.filter((story) => !(name === "webkit" && story.tags?.includes("no-webkit")));
  const failures: string[] = [];

  for (const story of runnable) {
    const error = (await play(browser, story.id)) && (await play(browser, story.id));
    if (!error) continue;
    failures.push(story.id);
    console.log(`${name} ✗ ${story.id}: ${error}`);
  }

  console.log(`${name}: ${runnable.length - failures.length} of ${runnable.length} stories passed`);
  failed += failures.length;
  await browser.close();
}

server?.close();
process.exit(failed ? 1 : 0);

/**
 * Opens one story and waits for Storybook to say how its render and play went.
 *
 * @example await play(browser, "blocks-text--editing"); // "" when it passed
 */
async function play(browser: Browser, id: string) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(listenToStorybook);
  await page.goto(`${base}/iframe.html?id=${id}&viewMode=story`);

  const outcome = await page
    .waitForFunction(() => (window as unknown as { storyOutcome: Outcome }).storyOutcome.done, null, {
      timeout: 30_000,
    })
    .then(() => page.evaluate(() => (window as unknown as { storyOutcome: Outcome }).storyOutcome))
    .catch(() => ({ done: false, error: "timed out" }));

  await page.close();
  return outcome.error;
}

/** Runs in the story's page: records Storybook's verdict on the window for the runner to read. */
function listenToStorybook() {
  const outcome: Outcome = { done: false, error: "" };
  Object.assign(window, { storyOutcome: outcome });

  type Channel = { on(event: string, listener: (detail: unknown) => void): void };
  const attach = () => {
    const channel = (window as unknown as { __STORYBOOK_ADDONS_CHANNEL__?: Channel }).__STORYBOOK_ADDONS_CHANNEL__;
    if (!channel) return setTimeout(attach, 5);

    channel.on("storyRendered", () => {
      outcome.done = true;
    });
    for (const event of ["storyThrewException", "playFunctionThrewException", "storyErrored", "storyMissing"]) {
      channel.on(event, (detail) => {
        outcome.error = `${event}: ${JSON.stringify(detail).slice(0, 300)}`;
        outcome.done = true;
      });
    }
  };
  attach();
}

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

/**
 * Serves a built Storybook from a folder on a free port.
 *
 * @example (await serveFolder("storybook-static")).address(); // { port: 52011, … }
 */
async function serveFolder(folder: string) {
  const server = createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    const file = join(folder, path.endsWith("/") ? `${path}index.html` : path);
    const body = await readFile(file).catch(() => null);
    response.writeHead(body ? 200 : 404, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    response.end(body);
  });
  await new Promise<void>((listening) => server.listen(0, listening));
  return server;
}
