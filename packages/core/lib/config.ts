import { z } from "zod";
import { themeSchema } from "@jotdown/core/lib/theme";
import { DOCS_ROOT, UPLOADS_FOLDER } from "@jotdown/core/lib/paths";

const uploadUrl = z
  .string()
  .regex(/^\/(?:uploads|img|files|whiteboards)\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*$/);
const folderPath = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/);
const uploadsFolder = z
  .string()
  .regex(/^[A-Za-z0-9_][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_][A-Za-z0-9._-]*)*$/)
  .refine(
    (path) => path.split("/")[0] !== DOCS_ROOT || path.split("/").some((segment) => segment.startsWith("_")),
    `Uploads under ${DOCS_ROOT}/ go in a folder whose name starts with _, since every other folder there holds pages.`,
  );

/** Where a project's config is, from the repository root: the one file every Jotdown project has, in the one folder that is Jotdown's. */
export const CONFIG_FILE = ".jotdown/config.json";

/** The shape of `.jotdown/config.json`, plain data so nothing in a project runs code. */
export const projectConfigSchema = z.object({
  version: z.literal(1).default(1),
  jotdown: z.string().min(1).optional(),
  content: folderPath.optional(),
  uploads: uploadsFolder.default(UPLOADS_FOLDER),
  title: z.string().min(1).default("Documentation"),
  description: z.string().default(""),
  repository: z.string().url().optional(),
  url: z.string().url().optional(),
  branch: z.string().min(1).optional(),
  theme: themeSchema.optional(),
  /** A wide wordmark, for the places that fit one. A square icon slot draws it fitted when there is no `favicon`. */
  logo: z.object({ alt: z.string(), src: uploadUrl, srcDark: uploadUrl.optional() }).optional(),
  /** The project's square icon: the browser tab, the sidebar's corner, the switcher and the app. */
  favicon: uploadUrl.optional(),
  /** The layout a page is drawn in when its front matter names none. */
  layout: z.string().min(1).default("docs"),
});

export type ProjectConfig = z.infer<typeof projectConfigSchema>;

/** The config as it is written, before defaults: every key optional, and only the ones somebody set. */
export type ProjectConfigInput = z.input<typeof projectConfigSchema>;
