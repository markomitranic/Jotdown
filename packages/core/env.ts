import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * The environment the core reads, checked once when it is first imported.
 *
 * `DOCS_DATA_DIR` is where a project's scratch copy is compiled, the system's
 * temporary folder when unset. Each app extends this with its own variables.
 */
export const env = createEnv({
  server: {
    DOCS_DATA_DIR: z.string().optional(),
  },
  experimental__runtimeEnv: {},
  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
  emptyStringAsUndefined: true,
});
