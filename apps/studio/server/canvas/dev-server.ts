import { execFile, spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer, type AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { CANVAS_PATH } from "@jotdown/core/lib/canvas";
import { readProjectConfig } from "@jotdown/core/server/config";

const JOTDOWN_REPOSITORY = "https://github.com/markomitranic/Jotdown.git";

/**
 * The dev servers of folder projects, started by the studio so a folder can be edited in its own site's look.
 *
 * Each one is the site's own `next dev` with the project injected, the same as
 * `jotdown dev`, serving its canvas at `/_edit` and rebuilding as the folder's
 * files change. It runs from this checkout of Jotdown when the studio runs
 * from one, and otherwise from a copy cloned into the project's
 * `.jotdown/framework` at the version its config pins. `bun` and `git` are
 * found through the login shell, since an app opened from the Dock has none of
 * the shell's `PATH`. A server nobody has asked for in a while is stopped, and
 * so is every one when the studio stops.
 */

/** Where a folder's dev server is: on its way, serving at an address, or stopped with why. */
export type DevServerState =
  | { state: "starting"; log: string[] }
  | { state: "ready"; url: string; log: string[] }
  | { state: "failed"; problem: string; log: string[] };

type Server = { status: DevServerState; child?: ChildProcess; lastAsked: number };

const IDLE = 15 * 60_000;
const READY_WITHIN = 4 * 60_000;
const LOG_LINES = 40;

const memory = globalThis as { jotdownDevServers?: Map<string, Server>; jotdownDevSweep?: NodeJS.Timeout };
memory.jotdownDevServers ??= new Map();
const servers = memory.jotdownDevServers;

const run = promisify(execFile);

/**
 * The folder's dev server as it stands, started on the first ask, and once more after a failure when asked to retry.
 *
 * @example devServer("/Users/ada/Sites/notes"); // { state: "starting", log: ["Cloning Jotdown v0.3.1…"] }
 */
export function devServer(folder: string, retry = false): DevServerState {
  const known = servers.get(folder);
  if (known && (known.status.state !== "failed" || !retry)) {
    known.lastAsked = Date.now();
    return known.status;
  }

  const server: Server = { status: { state: "starting", log: [] }, lastAsked: Date.now() };
  servers.set(folder, server);
  start(folder, server).catch((error: Error) => {
    server.status = { state: "failed", problem: error.message, log: server.status.log };
  });
  watchIdle();
  return server.status;
}

/**
 * Starts the dev server for a folder, writing what it does into its log as it goes.
 */
async function start(folder: string, server: Server) {
  const note = (line: string) => remember(server, line);
  const path = await shellPath();
  const framework = await frameworkFor(folder, path, note);
  const port = await freePort();

  note(`Starting the site on port ${port}.`);
  const child = spawn("bun", ["run", "--bun", "next", "dev", "-p", String(port)], {
    cwd: join(framework, "apps/publication"),
    env: { ...process.env, PATH: path, JOTDOWN_PROJECT: folder, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.child = child;

  for (const stream of [child.stdout, child.stderr])
    stream?.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString().split("\n")) if (line.trim()) note(line);
    });
  child.on("exit", (code) => {
    server.status = { state: "failed", problem: `The dev server stopped with code ${code}.`, log: server.status.log };
  });

  const url = `http://localhost:${port}${CANVAS_PATH}`;
  const deadline = Date.now() + READY_WITHIN;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("The dev server stopped before it was ready.");
    const answered = await fetch(url)
      .then((response) => response.ok)
      .catch(() => false);
    if (answered) {
      server.status = { state: "ready", url, log: server.status.log };
      return;
    }
    await new Promise((wait) => setTimeout(wait, 1000));
  }
  child.kill();
  throw new Error("The dev server did not answer within four minutes.");
}

/**
 * The checkout of Jotdown a folder's site runs from: this one when the studio runs from a checkout, else a clone in the folder.
 *
 * A clone is made once, at the version the project's config pins.
 */
async function frameworkFor(folder: string, path: string, note: (line: string) => void) {
  const checkout = resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  if (existsSync(join(checkout, "apps/publication/package.json")) && existsSync(join(checkout, "node_modules/next")))
    return checkout;

  const framework = join(folder, ".jotdown/framework");
  if (!existsSync(framework)) {
    const ref = readProjectConfig(folder).jotdown ?? "main";
    note(`Cloning Jotdown ${ref} into .jotdown/framework.`);
    await run("git", ["clone", "--quiet", "--depth", "1", "--branch", ref, JOTDOWN_REPOSITORY, framework], {
      env: { ...process.env, PATH: path },
    });
  }

  note("Installing the site's packages.");
  await run("bun", ["install", "--frozen-lockfile", "--ignore-scripts", "--filter", "@jotdown/publication"], {
    cwd: framework,
    env: { ...process.env, PATH: path },
    maxBuffer: 16 * 1024 * 1024,
  });
  return framework;
}

/**
 * The `PATH` a login shell sets up, where `bun` and `git` are found.
 *
 * @example await shellPath(); // "/Users/ada/.bun/bin:/opt/homebrew/bin:/usr/bin:/bin"
 */
async function shellPath() {
  const shell = process.env.SHELL || "/bin/zsh";
  const { stdout } = await run(shell, ["-lc", 'printf %s "$PATH"']).catch(() => ({ stdout: "" }));
  return stdout || process.env.PATH || "/usr/bin:/bin";
}

/** A port nothing on this machine is listening on. */
function freePort() {
  return new Promise<number>((found, failed) => {
    const probe = createServer();
    probe.once("error", failed);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => found(port));
    });
  });
}

function remember(server: Server, line: string) {
  server.status = { ...server.status, log: [...server.status.log, line].slice(-LOG_LINES) };
}

/** Stops dev servers nobody asked for in a while, and every one when the studio itself stops. */
function watchIdle() {
  if (memory.jotdownDevSweep) return;
  memory.jotdownDevSweep = setInterval(() => {
    for (const [folder, server] of servers)
      if (Date.now() - server.lastAsked > IDLE) {
        server.child?.kill();
        servers.delete(folder);
      }
  }, 60_000);

  const stopAll = () => {
    for (const server of servers.values()) server.child?.kill();
  };
  process.once("exit", stopAll);
  process.once("SIGTERM", () => {
    stopAll();
    process.exit(0);
  });
}
