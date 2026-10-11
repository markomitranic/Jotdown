/** Finishes the self-extracting wrapper the DMG ships: its version stamped and an ad-hoc signature. */
import { buildEnv, finishBundle } from "./bundle";

finishBundle(buildEnv("ELECTROBUN_WRAPPER_BUNDLE_PATH"));
