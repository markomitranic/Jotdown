/**
 * Jotdown's main process: starts the studio's server, opens the window onto it, and keeps the app up to date.
 *
 * The server is the studio's own standalone Next build, run with the Bun that
 * ships in the app. It listens on loopback only, and the window opens with a
 * per-launch secret the server trades for a cookie. Quitting stops the server;
 * closing the window does not. A `jotdown://open/<owner>/<repo>/<page>` link
 * opens that page in the window, the app started for it when it was not running.
 */

import Electrobun, { ApplicationMenu, BrowserWindow, Utils } from "electrobun/bun";
import { startBridge } from "./bridge";
import { setMenu } from "./menu";
import { startStudio } from "./studio";
import { keepUpdated } from "./updates";

let open: BrowserWindow | null = null;
let started = false;
let linked: string | null = null;

Electrobun.events.on("open-url", (event) => {
  const page = pageOf((event as { data: { url: string } }).data.url);
  if (!page) return;
  if (open) showPage(open, page);
  else if (started) openWindow(page);
  else linked = page;
});

const data = Utils.paths.userData;
const bridge = startBridge(keepUpdated());
const studio = await startStudio(data, bridge.address).catch((error: Error) => {
  Utils.showMessageBox({
    type: "error",
    title: "Jotdown could not start",
    message: `${error.message}\n\nThe studio's log is in ${data}/logs/studio.log.`,
  });
  Utils.quit(1);
  throw error;
});

Electrobun.events.on("before-quit", () => {
  studio.stop();
  bridge.stop();
});

setMenu();
started = true;
openWindow(linked ?? "/");

Electrobun.events.on("reopen", () => {
  if (!open) openWindow("/");
});

ApplicationMenu.on("application-menu-clicked", (event) => {
  const { action } = (event as { data: { action: string } }).data;
  if (action === "reload") open?.webview.executeJavascript("location.reload()");
});

/**
 * Opens the studio's window on a page, the one window the app keeps open at a time, its links to the web going to the browser.
 *
 * Closing it leaves the app and its server running, so the Dock icon brings it
 * straight back, signed in.
 *
 * @example openWindow("/you/notes/guides/setup");
 */
function openWindow(page: string) {
  const address = new URL(page, studio.origin);
  address.searchParams.set("launch", studio.secret);
  const window = new BrowserWindow({
    title: "Jotdown",
    url: address.href,
    titleBarStyle: "hiddenInset",
    frame: { width: 1440, height: 900, x: 120, y: 80 },
  });
  open = window;

  window.on("close", () => {
    if (open === window) open = null;
  });

  Electrobun.events.on(`new-window-open-${window.webview.id}`, (event: unknown) => {
    const { detail } = (event as { data: { detail: string | { url: string } } }).data;
    openOutside(typeof detail === "string" ? detail : detail.url);
  });
}

/**
 * Takes the open window to a page, as a click on a link to it would, so unsaved writing is asked about first.
 *
 * @example showPage(window, "/you/notes/guides/setup");
 */
function showPage(window: BrowserWindow, page: string) {
  window.focus();
  window.webview.executeJavascript(
    `{ const link = document.createElement("a"); link.href = ${JSON.stringify(page)}; document.body.append(link); link.click(); link.remove(); }`,
  );
}

/**
 * The studio page a `jotdown://open/…` link names, or null for any other link.
 *
 * @example pageOf("jotdown://open/you/notes/guides/setup#steps"); // "/you/notes/guides/setup#steps"
 * @example pageOf("jotdown://settings"); // null
 */
function pageOf(link: string) {
  const url = URL.parse(link);
  if (url?.protocol !== "jotdown:" || url.hostname !== "open") return null;
  const page = url.pathname.replace(/\/+$/, "");
  return /^\/[^/]+\/[^/]+/.test(page) ? `${page}${url.hash}` : null;
}

/**
 * Hands a web or mail link to the default browser or mail app; anything else is dropped.
 *
 * @example openOutside("https://github.com/you/notes"); // opens in Safari
 */
function openOutside(url: string) {
  if (/^(https?|mailto):/.test(url)) Utils.openExternal(url);
}
