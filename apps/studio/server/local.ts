import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import type { Editor } from "./auth/session";

let editor: Editor | undefined;

/**
 * Whoever uses this machine, as git knows them, read once.
 *
 * Falls back to the account signed in to the machine when git has no name or
 * email, since saving a folder writes files and needs no author at all.
 *
 * @example localEditor(); // { login: "ada", name: "Ada Lovelace", email: "ada@example.com" }
 */
export function localEditor(): Editor {
  if (editor) return editor;

  const login = process.env.USER ?? process.env.USERNAME ?? "editor";
  const name = gitConfig("user.name") || login;
  const email = gitConfig("user.email") || `${login}@localhost`;

  editor = { login, name, email };
  return editor;
}

function gitConfig(key: string) {
  try {
    return execFileSync("git", ["config", "--global", key], {
      cwd: homedir(),
      encoding: "utf8",
      timeout: 2_000,
    }).trim();
  } catch {
    return "";
  }
}
