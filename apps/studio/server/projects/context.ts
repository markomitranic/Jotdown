import { cookies, headers } from "next/headers";
import { cache } from "react";
import { z } from "zod";
import { themeSchema, themeStylesheet } from "@jotdown/core/lib/theme";
import { localSession } from "../auth/session";
import { storage } from "../storage";
import { PROJECT_HEADER, formatProjectKey, parseProjectKey, projectBase, type ProjectKey } from "../../lib/project-key";

/** The cookie holding the look the switcher last tried on, so the reload that follows wears it too. */
export const LOOK_COOKIE = "docs-project-look";

/** The cookie naming the project the switcher downloaded a moment ago, so the reload that follows carries on from there. */
export const OPENED_COOKIE = "docs-project-opened";

const studioAddress = z.string().regex(/^\/[^/]/);

/** What the look cookie holds: the project it belongs to, the commit it was read at, its title, logo and theme. */
const lookSchema = z.object({
  key: z.string(),
  branch: z.string(),
  head: z.string().regex(/^[0-9a-f]{40}$/),
  title: z.string(),
  logo: z.object({ alt: z.string(), src: studioAddress, srcDark: studioAddress }).nullable(),
  theme: themeSchema.optional(),
});

/**
 * How a cold start looks while it opens a project, when the look cookie belongs to that project.
 *
 * Nothing comes back for a cookie that is missing, unreadable or left over from
 * another project. `opened` says the switcher downloaded this project a moment
 * ago, so only the compile is left.
 *
 * @example await rememberedLook(parseProjectKey("you/notes")!); // { title: "Handbook", logo, theme: ".dark { … }", found, opened: true }
 */
export async function rememberedLook(key: ProjectKey) {
  const jar = await cookies();
  const look = lookSchema.safeParse(safeJson(jar.get(LOOK_COOKIE)?.value ?? ""));
  const name = formatProjectKey(key);
  if (!look.success || look.data.key !== name) return null;

  const { branch, head, title, logo, theme } = look.data;
  return {
    title,
    logo,
    theme: themeStylesheet(theme, projectBase(key)),
    found: { branch, head },
    opened: jar.get(OPENED_COOKIE)?.value === name,
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** The project the address names, `/owner/repo/…`, as the proxy passed it on, or null at the studio's own addresses. */
export const currentProjectKey = cache(async () => parseProjectKey((await headers()).get(PROJECT_HEADER) ?? ""));

/** The project the address names, opened as the editor, or null at the studio's own addresses. */
export const currentProject = cache(async () => {
  const key = await currentProjectKey();
  return key ? storage.openProject(key, await localSession()) : null;
});
