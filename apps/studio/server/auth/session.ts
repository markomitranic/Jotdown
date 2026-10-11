import { localEditor } from "../local";
import { githubToken } from "./token";

export type Editor = { login: string; name: string; email: string };

/** Who the studio edits as, and the GitHub token it reads and commits with. */
export type Session = { token: string; editor: Editor };

/**
 * The studio's one editor: whoever git names on this machine, with the GitHub token they signed in with.
 *
 * The token is empty when nobody has signed in, and then only folders open.
 *
 * @example (await localSession()).editor.email; // "ada@example.com"
 */
export async function localSession(): Promise<Session> {
  return { token: await githubToken(), editor: localEditor() };
}
