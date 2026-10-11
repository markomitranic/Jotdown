import { Utils } from "electrobun/bun";

/**
 * A loopback address the studio's server calls for what only the app can do, such as the native folder picker.
 *
 * The path carries a random secret, so nothing but the server the app started
 * can call it.
 *
 * @example const bridge = startBridge(); bridge.address; // "http://127.0.0.1:52901/9f3c…"
 */
export function startBridge() {
  const secret = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("hex");

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const { pathname } = new URL(request.url);
      if (request.method !== "POST" || pathname !== `/${secret}/pick-folder`)
        return new Response(null, { status: 404 });

      const [path] = await Utils.openFileDialog({
        canChooseFiles: false,
        canChooseDirectory: true,
        allowsMultipleSelection: false,
      });
      return Response.json({ path: path || null });
    },
  });

  return { address: `http://127.0.0.1:${server.port}/${secret}`, stop: () => server.stop(true) };
}
