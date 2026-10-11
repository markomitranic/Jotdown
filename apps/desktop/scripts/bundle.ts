import { execFileSync } from "node:child_process";
import { join } from "node:path";

/**
 * One variable Electrobun hands a build hook, or a thrown error naming the one that is missing.
 *
 * @example buildEnv("ELECTROBUN_BUILD_DIR"); // "/…/apps/desktop/build/stable-macos-arm64"
 */
export function buildEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Electrobun did not set ${name} for this build step.`);
  return value;
}

/**
 * Names the app's version where Finder and the About panel read it, then signs the bundle ad hoc.
 *
 * Electrobun writes only the build number. Ad-hoc signing is what lets macOS
 * offer Open Anyway instead of calling the app damaged, and it comes last,
 * since any change to the bundle breaks the signature.
 *
 * @example finishBundle("/…/build/stable-macos-arm64/Jotdown.app");
 */
export function finishBundle(app: string) {
  const plist = join(app, "Contents", "Info.plist");
  execFileSync("plutil", [
    "-replace",
    "CFBundleShortVersionString",
    "-string",
    buildEnv("ELECTROBUN_APP_VERSION"),
    plist,
  ]);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
}
