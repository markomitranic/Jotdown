import { fetchJson, postJson } from "@jotdown/core/lib/fetch-json";

/** One folder of this machine as the folder browser lists it, and the folders inside it. */
export type FolderListing = {
  path: string;
  display: string;
  title: string | null;
  parent: string | null;
  entries: { name: string; path: string; title: string | null }[];
};

/**
 * The folders inside one folder of this machine, as a local studio lists them.
 *
 * @example await browseFolder("~/Sites"); // { display: "~/Sites", entries: [{ name: "handbook", title: "Handbook", … }], … }
 */
export function browseFolder(path: string) {
  return fetchJson<FolderListing>(`/api/folders?${new URLSearchParams({ path })}`, { cache: "no-store" });
}

/**
 * Bookmarks a folder that holds a `.jotdown/config.json`, answering the key it is served under.
 *
 * @example await addFolder("/Users/ada/Sites/handbook"); // { key: "local/handbook", title: "Handbook" }
 */
export function addFolder(path: string) {
  return postJson<{ key: string; title: string | null }>("/api/folders", { path });
}

/**
 * Opens the app's native folder picker, answering the folder chosen, or a null path when it was cancelled.
 *
 * @example await pickFolder(); // { path: "/Users/ada/Sites/handbook", title: "Handbook" }
 */
export function pickFolder() {
  return postJson<{ path: string | null; title: string | null }>("/api/folders/pick", {});
}

/**
 * Whether the studio runs inside the Jotdown app, which has a native folder picker.
 *
 * @example inApp(); // true in the app, false in a browser tab
 */
export function inApp() {
  return document.documentElement.hasAttribute("data-app");
}
