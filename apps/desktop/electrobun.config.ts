import type { ElectrobunConfig } from "electrobun";
import manifest from "../../package.json";

/**
 * Jotdown's desktop app: the studio's standalone server in a WebKit window, run by the Bun the app ships with.
 *
 * `preBuild` builds and stages the studio, `postBuild` and `postWrap` sign the
 * bundles ad hoc so macOS offers Open Anyway rather than calling them damaged,
 * and `postPackage` builds the installer DMG. Closing the window leaves the app
 * running, as a Mac app does, and the Dock icon opens it again.
 */
export default {
  app: {
    name: "Jotdown",
    identifier: "com.markomitranic.jotdown",
    version: manifest.version,
    urlSchemes: ["jotdown"],
  },
  scripts: {
    preBuild: "scripts/preBuild.ts",
    postBuild: "scripts/postBuild.ts",
    postWrap: "scripts/postWrap.ts",
    postPackage: "scripts/postPackage.ts",
  },
  build: {
    mainProcess: "bun",
    bun: { entrypoint: "src/main.ts" },
    copy: { studio: "studio" },
    mac: { bundleCEF: false, icons: "icon.iconset" },
  },
  runtime: { exitOnLastWindowClosed: false },
  release: { generatePatch: false },
} satisfies ElectrobunConfig;
