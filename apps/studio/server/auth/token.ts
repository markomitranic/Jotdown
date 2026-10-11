import { env } from "@/env";

/**
 * The GitHub token the studio reads and commits with, kept in the macOS Keychain.
 *
 * `STUDIO_DEV_TOKEN` wins when it is set, so `bun run dev` can run as anyone.
 * Otherwise the token is the one GitHub's device flow handed over at sign-in,
 * read from the Keychain once and kept in memory until it changes.
 */

type Secrets = {
  get: (item: { service: string; name: string }) => Promise<string | null>;
  set: (item: { service: string; name: string; value: string }) => Promise<void>;
  delete: (item: { service: string; name: string }) => Promise<boolean>;
};

const ITEM = { service: "com.markomitranic.jotdown", name: "github-token" };

const keychain = (globalThis as { Bun?: { secrets?: Secrets } }).Bun?.secrets;
const memory = globalThis as { jotdownToken?: Promise<string> };

/** Where the token came from: the environment, the Keychain, or nowhere yet. */
export type TokenSource = "environment" | "keychain" | null;

/**
 * The token, or an empty string when nobody has signed in.
 *
 * @example await githubToken(); // "gho_…"
 */
export function githubToken() {
  if (env.STUDIO_DEV_TOKEN) return Promise.resolve(env.STUDIO_DEV_TOKEN);
  memory.jotdownToken ??= (keychain?.get(ITEM) ?? Promise.resolve(null)).then((token) => token ?? "").catch(() => "");
  return memory.jotdownToken;
}

/**
 * Where the token in use came from.
 *
 * @example await tokenSource(); // "keychain"
 */
export async function tokenSource(): Promise<TokenSource> {
  if (env.STUDIO_DEV_TOKEN) return "environment";
  return (await githubToken()) ? "keychain" : null;
}

/**
 * Keeps a freshly granted token in the Keychain and starts using it.
 *
 * @example await keepToken("gho_…");
 */
export async function keepToken(token: string) {
  if (!keychain) throw new Error("This studio has no Keychain to keep a token in. Set STUDIO_DEV_TOKEN instead.");
  await keychain.set({ ...ITEM, value: token });
  memory.jotdownToken = Promise.resolve(token);
}

/**
 * Takes the token out of the Keychain, which signs the studio out of GitHub.
 *
 * @example await forgetToken();
 */
export async function forgetToken() {
  await keychain?.delete(ITEM).catch(() => false);
  memory.jotdownToken = Promise.resolve("");
}
