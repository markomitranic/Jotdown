/**
 * The settings draft's arithmetic over a config as plain data: what changed, reading and writing one dotted path, and what a save says.
 */

/**
 * Every dotted path whose value differs between two configs, objects walked and anything else compared whole.
 *
 * @example changedPaths({ title: "A" }, { title: "B", url: "https://x.dev" }); // ["title", "url"]
 */
export function changedPaths(before: unknown, after: unknown, at = ""): string[] {
  const bothObjects = isObject(before) && isObject(after);
  if (!bothObjects) return JSON.stringify(before) === JSON.stringify(after) ? [] : [at];

  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].flatMap((key) => changedPaths(before[key], after[key], at ? `${at}.${key}` : key));
}

/**
 * The config without the empty objects and blank strings a cleared field leaves behind.
 *
 * @example tidy({ theme: { light: {} }, title: "A" }); // { title: "A" }
 */
export function tidy<T>(value: T): T {
  if (!isObject(value)) return value;
  const kept = Object.entries(value).flatMap(([key, child]) => {
    const tidied = tidy(child);
    if (tidied === undefined || tidied === "" || (isObject(tidied) && Object.keys(tidied).length === 0)) return [];
    return [[key, tidied] as const];
  });
  return Object.fromEntries(kept) as T;
}

/**
 * The commit subject for a settings save, naming the top-level settings it touches.
 *
 * @example commitMessage(["title", "theme.light.primary", "theme.radius"]); // "docs: (studio) settings: title, theme"
 */
export function commitMessage(changes: string[]) {
  const touched = [...new Set(changes.map((path) => path.split(".")[0]))].filter(Boolean);
  if (touched.length === 0) return "docs: (studio) settings: tidy the config";
  const listed = touched.length > 4 ? `${touched.slice(0, 4).join(", ")} and more` : touched.join(", ");
  return `docs: (studio) settings: ${listed}`;
}

/**
 * The value at a dotted path, or undefined when any step on the way is missing.
 *
 * @example valueAt({ theme: { radius: "0.5rem" } }, "theme.radius"); // "0.5rem"
 */
export function valueAt(config: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((at, key) => (isObject(at) ? at[key] : undefined), config);
}

/**
 * A copy of the config with one dotted path set, the objects on the way made as needed, or the key removed for undefined.
 *
 * @example withValue({}, "theme.light.primary", "#433a86"); // { theme: { light: { primary: "#433a86" } } }
 */
export function withValue<T extends object>(config: T, path: string, value: unknown): T {
  const [key = "", ...rest] = path.split(".");
  const record = config as Record<string, unknown>;
  const next = rest.length === 0 ? value : withValue(isObject(record[key]) ? record[key] : {}, rest.join("."), value);
  return { ...record, [key]: next } as T;
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
