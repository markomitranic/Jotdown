/** Finishes the built app before it is compressed: its version stamped and an ad-hoc signature. */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { buildEnv, finishBundle } from "./bundle";

const folder = buildEnv("ELECTROBUN_BUILD_DIR");
const app = readdirSync(folder).find((name) => name.endsWith(".app"));
if (!app) throw new Error(`Electrobun built no app into ${folder}.`);
finishBundle(join(folder, app));
