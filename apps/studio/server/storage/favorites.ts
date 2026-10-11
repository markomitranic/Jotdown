import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * The studio's favorites: the GitHub projects and the folders listed in its project menu.
 *
 * They live in one file, in the app's data folder when the desktop app runs
 * the studio, or the machine's config folder otherwise, never in the browser.
 * A favorite is only where a project is: removing one never touches the project.
 * The same file remembers how each project is drawn, which never goes in the
 * project's own config.
 */

/** A folder on this machine kept as a project: its `local/<name>` key and where it is. */
export type Folder = { key: string; path: string };

/** A GitHub project kept as a favorite, with the title it had when it was kept. */
export type GitHubFavorite = { key: string; title: string };

/** How a project is drawn: through its site's canvas, a canvas at another address, a dev server the studio starts, or by the studio itself. */
export type Renderer = { mode: "site" } | { mode: "custom"; url: string } | { mode: "dev" } | { mode: "skinny" };

export type Favorites = { github: GitHubFavorite[]; folders: Folder[]; renderers: Record<string, Renderer> };

/**
 * Where the favorites file is.
 *
 * @example favoritesFile(); // "~/Library/Application Support/com.markomitranic.jotdown/stable/favorites.json"
 */
function favoritesFile() {
  const data =
    process.env.JOTDOWN_DATA_DIR ?? join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "jotdown");
  return join(data, "favorites.json");
}

/**
 * Every favorite, each kind in the order it was added. A missing or unreadable file is no favorites.
 *
 * @example await readFavorites(); // { github: [{ key: "you/notes", title: "Notes" }], folders: [], renderers: {} }
 */
export async function readFavorites(): Promise<Favorites> {
  const text = await readFile(favoritesFile(), "utf8").catch(() => "{}");
  try {
    const raw: { github?: unknown; folders?: unknown; renderers?: unknown } = JSON.parse(text);
    return {
      github: listOf(raw.github, (item): item is GitHubFavorite => typeof item?.title === "string"),
      folders: listOf(raw.folders, (item): item is Folder => typeof item?.path === "string"),
      renderers: renderersOf(raw.renderers),
    };
  } catch {
    return { github: [], folders: [], renderers: {} };
  }
}

/**
 * Replaces the favorites, written whole so a crash never leaves half a file.
 *
 * @example await writeFavorites({ github: [], folders: [], renderers: {} });
 */
export async function writeFavorites(favorites: Favorites) {
  const file = favoritesFile();
  await mkdir(dirname(file), { recursive: true });
  await writeFile(`${file}.tmp`, `${JSON.stringify(favorites, null, 2)}\n`);
  await rename(`${file}.tmp`, file);
}

/**
 * Keeps a GitHub project as a favorite, or renames it when it is one already.
 *
 * @example await keepFavorite("you/notes", "Notes");
 */
export async function keepFavorite(key: string, title: string) {
  const favorites = await readFavorites();
  const wanted = key.toLowerCase();
  const github = favorites.github.some((favorite) => favorite.key.toLowerCase() === wanted)
    ? favorites.github.map((favorite) => (favorite.key.toLowerCase() === wanted ? { key, title } : favorite))
    : [...favorites.github, { key, title }];
  await writeFavorites({ ...favorites, github });
}

/**
 * Takes a favorite off the list, a GitHub project or a folder alike.
 *
 * @example await forgetFavorite("local/handbook");
 */
export async function forgetFavorite(key: string) {
  const favorites = await readFavorites();
  const wanted = key.toLowerCase();
  await writeFavorites({
    ...favorites,
    github: favorites.github.filter((favorite) => favorite.key.toLowerCase() !== wanted),
    folders: favorites.folders.filter((folder) => folder.key.toLowerCase() !== wanted),
  });
}

/**
 * How a project was last chosen to be drawn, or null when nobody chose.
 *
 * @example await chosenRenderer("you/notes"); // { mode: "custom", url: "http://localhost:6193/_edit" }
 */
export async function chosenRenderer(key: string) {
  return (await readFavorites()).renderers[key.toLowerCase()] ?? null;
}

/**
 * Remembers how a project is drawn, for the next time it opens.
 *
 * @example await keepRenderer("you/notes", { mode: "skinny" });
 */
export async function keepRenderer(key: string, renderer: Renderer) {
  const favorites = await readFavorites();
  await writeFavorites({ ...favorites, renderers: { ...favorites.renderers, [key.toLowerCase()]: renderer } });
}

/** The renderers a file names, each one checked, the rest dropped. */
function renderersOf(raw: unknown): Record<string, Renderer> {
  if (typeof raw !== "object" || raw === null) return {};
  return Object.fromEntries(
    Object.entries(raw).filter(
      ([, renderer]) =>
        renderer?.mode === "site" ||
        renderer?.mode === "dev" ||
        renderer?.mode === "skinny" ||
        (renderer?.mode === "custom" && typeof renderer.url === "string"),
    ),
  );
}

function listOf<Item extends { key: string }>(raw: unknown, valid: (item: { [key: string]: unknown }) => boolean) {
  return Array.isArray(raw) ? (raw.filter((item) => typeof item?.key === "string" && valid(item)) as Item[]) : [];
}
