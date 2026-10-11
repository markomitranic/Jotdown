import { Utils } from "electrobun/bun";
import type { Updates } from "./updates";

/**
 * A loopback address the studio's server calls for what only the app can do: the native folder picker and updates.
 *
 * The path carries a random secret, so nothing but the server the app started
 * can call it.
 *
 * @example const bridge = startBridge(updates); bridge.address; // "http://127.0.0.1:52901/9f3c…"
 */
export function startBridge(updates: Updates) {
  const secret = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("hex");

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    routes: {
      [`/${secret}/pick-folder`]: { POST: pickFolder },
      [`/${secret}/update`]: {
        GET: () => Response.json({ version: updates.ready() }),
        POST: () => {
          setTimeout(updates.restart, 100);
          return Response.json({ ok: true });
        },
      },
    },
    fetch: () => new Response(null, { status: 404 }),
  });

  return { address: `http://127.0.0.1:${server.port}/${secret}`, stop: () => server.stop(true) };
}

/**
 * Asks for a folder with the system's own picker, answering its path, or null when it was cancelled.
 *
 * @example await pickFolder(); // Response { path: "/Users/ada/Sites/handbook" }
 */
async function pickFolder() {
  const [path] = await Utils.openFileDialog({
    canChooseFiles: false,
    canChooseDirectory: true,
    allowsMultipleSelection: false,
  });
  return Response.json({ path: path || null });
}
