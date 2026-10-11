import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { env as core } from "@jotdown/core/env";

/**
 * The studio's environment, checked when the build starts and again when the server does.
 *
 * The `JOTDOWN_*` variables are set by the desktop app that starts the studio:
 * that it runs inside the app, the secret its window opens with, where the
 * app keeps its data, and the address of the app's own bridge for what only
 * the app can do, such as the folder picker. `SKIP_ENV_VALIDATION` skips the
 * check.
 */
export const env = createEnv({
  extends: [core],
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    STUDIO_DEV_TOKEN: z.string().optional(),
    STUDIO_STANDALONE: z.string().optional(),
    JOTDOWN_APP: z.literal("1").optional(),
    JOTDOWN_LAUNCH_SECRET: z.string().min(32).optional(),
    JOTDOWN_DATA_DIR: z.string().optional(),
    JOTDOWN_BRIDGE: z.url().optional(),
  },
  experimental__runtimeEnv: {},
  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
  emptyStringAsUndefined: true,
});
