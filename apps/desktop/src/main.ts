/**
 * Jotdown's main process: starts the studio's server and opens the window onto it.
 *
 * The server is the studio's own standalone Next build, run with the Bun that
 * ships in the app. It listens on loopback only, and the window opens with a
 * per-launch secret the server trades for a cookie. Quitting stops the server;
 * closing the window does not.
 */

import Electrobun, { ApplicationMenu, BrowserWindow, Utils } from "electrobun/bun";
import { startBridge } from "./bridge";
import { setMenu } from "./menu";
import { startStudio } from "./studio";

const data = Utils.paths.userData;
const bridge = startBridge();
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

let open: BrowserWindow | null = null;
openWindow();

Electrobun.events.on("reopen", () => {
  if (!open) openWindow();
});

ApplicationMenu.on("application-menu-clicked", (event) => {
  const { action } = (event as { data: { action: string } }).data;
  if (action === "reload") open?.webview.executeJavascript("location.reload()");
});

/**
 * Opens the studio's window, the one the app keeps open at a time, its links to the web going to the browser.
 *
 * Closing it leaves the app and its server running, so the Dock icon brings it
 * straight back, signed in and where the studio left off.
 *
 * @example openWindow();
 */
function openWindow() {
  const window = new BrowserWindow({
    title: "Jotdown",
    url: `${studio.origin}/?launch=${studio.secret}`,
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
 * Hands a web or mail link to the default browser or mail app; anything else is dropped.
 *
 * @example openOutside("https://github.com/you/notes"); // opens in Safari
 */
function openOutside(url: string) {
  if (/^(https?|mailto):/.test(url)) Utils.openExternal(url);
}
