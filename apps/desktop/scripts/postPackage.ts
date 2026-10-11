/**
 * Replaces Electrobun's plain DMG with Jotdown's installer window, built by dmgbuild.
 *
 * dmgbuild writes Finder's window layout straight into the image, so this runs
 * the same on a build machine with no screen. It is installed once into a
 * virtual environment kept beside the build. A dev build ships no installer,
 * so it is skipped there.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { buildEnv } from "./bundle";

const folder = buildEnv("ELECTROBUN_BUILD_DIR");
if (basename(folder).startsWith("dev-")) process.exit(0);

const artifacts = buildEnv("ELECTROBUN_ARTIFACT_DIR");
const built = readdirSync(folder).find((name) => name.endsWith(".app"));
const app = process.env.ELECTROBUN_WRAPPER_BUNDLE_PATH ?? (built && join(folder, built));
if (!app) throw new Error(`Electrobun built no app into ${folder}.`);
const desktop = process.cwd();
const venv = join(desktop, "build", ".dmgbuild");
const version = buildEnv("ELECTROBUN_APP_VERSION");

if (!existsSync(join(venv, "bin", "dmgbuild"))) {
  execFileSync("python3", ["-m", "venv", venv], { stdio: "inherit" });
  execFileSync(join(venv, "bin", "pip"), ["install", "--quiet", "dmgbuild==1.6.5"], { stdio: "inherit" });
}

for (const name of readdirSync(artifacts)) if (name.endsWith(".dmg")) rmSync(join(artifacts, name));

execFileSync(
  join(venv, "bin", "dmgbuild"),
  ["-s", join(desktop, "dmg", "settings.py"), "-D", `app=${app}`, "Jotdown", join(artifacts, `Jotdown-${version}.dmg`)],
  { stdio: "inherit" },
);
