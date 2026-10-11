import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PATHS } from "electrobun/bun";

/** The studio's server inside the app: where it is, the port it keeps, and the process once started. */
export type Studio = { origin: string; secret: string; stop: () => void };

const SERVER = join(PATHS.RESOURCES_FOLDER, "app/studio/apps/studio/server.js");

/**
 * Starts the studio's server on this install's own port, with the app's data folder, and waits for it to answer.
 *
 * The port is picked once and kept, because WebKit keeps a page's drafts per
 * origin and a new port every launch would leave them behind. A port taken by
 * something else is given up for a new one. The server's output goes to
 * `logs/studio.log` in the data folder, emptied at every launch.
 *
 * @example const studio = await startStudio(dataFolder, bridge); studio.origin; // "http://127.0.0.1:52817"
 */
export async function startStudio(data: string, bridge: string): Promise<Studio> {
  const port = await keptPort(data);
  const origin = `http://127.0.0.1:${port}`;
  const secret = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");

  mkdirSync(join(data, "logs"), { recursive: true });
  const log = join(data, "logs/studio.log");
  writeFileSync(log, "");

  const server = Bun.spawn([process.execPath, SERVER], {
    env: {
      ...process.env,
      PATH: `${process.env.PATH ?? ""}:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin`,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      JOTDOWN_APP: "1",
      JOTDOWN_LAUNCH_SECRET: secret,
      JOTDOWN_DATA_DIR: data,
      JOTDOWN_BRIDGE: bridge,
      DOCS_DATA_DIR: join(data, "cache"),
    },
    stdout: Bun.file(log),
    stderr: Bun.file(log),
  });

  await answering(origin, server);
  return { origin, secret, stop: () => server.kill() };
}

/**
 * This install's port, or a new free one saved for next time when it is gone or taken.
 *
 * @example await keptPort("/Users/ada/Library/Application Support/com.markomitranic.jotdown/stable"); // 52817
 */
async function keptPort(data: string) {
  const file = Bun.file(join(data, "port"));
  const kept = Number(await file.text().catch(() => ""));
  if (kept && free(kept)) return kept;

  const port = freePort();
  await Bun.write(file, String(port));
  return port;
}

/** Whether nothing on this machine listens on a loopback port. */
function free(port: number) {
  try {
    Bun.listen({ hostname: "127.0.0.1", port, socket: { data() {} } }).stop(true);
    return true;
  } catch {
    return false;
  }
}

/** A port nothing listens on, picked by the system. */
function freePort() {
  const probe = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
  const { port } = probe;
  probe.stop(true);
  return port;
}

/** Waits for the studio's health check, failing when the server exits or takes over a minute. */
async function answering(origin: string, server: Bun.Subprocess) {
  for (let tries = 0; tries < 1200; tries++) {
    if (server.exitCode !== null) throw new Error(`The studio stopped with code ${server.exitCode}.`);
    const up = await fetch(`${origin}/api/health`).then(
      (response) => response.ok,
      () => false,
    );
    if (up) return;
    await Bun.sleep(50);
  }
  throw new Error("The studio did not answer within a minute.");
}
