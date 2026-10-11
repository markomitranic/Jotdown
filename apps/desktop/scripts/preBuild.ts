/**
 * Builds the studio as a standalone Next server and stages it where the app bundle copies it from.
 *
 * Symlinks are copied as the files they point at, because the app bundle
 * stores a symlink as an empty file.
 */
import { execFileSync } from "node:child_process";
import { cpSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const desktop = process.cwd();
const studio = resolve(desktop, "../studio");
const target = join(desktop, "studio");

execFileSync("bun", ["run", "--bun", "next", "build"], {
  cwd: studio,
  stdio: "inherit",
  env: { ...process.env, STUDIO_STANDALONE: "1", NEXT_TELEMETRY_DISABLED: "1" },
});

rmSync(target, { recursive: true, force: true });
cpSync(join(studio, ".next/standalone"), target, { recursive: true, dereference: true });
cpSync(join(studio, ".next/static"), join(target, "apps/studio/.next/static"), { recursive: true });
cpSync(join(studio, "public"), join(target, "apps/studio/public"), { recursive: true });
