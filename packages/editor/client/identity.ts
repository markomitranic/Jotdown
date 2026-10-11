/**
 * Who is editing, from the studio's GitHub sign-in.
 *
 * The server reads the editor off the sealed session and hands their name and
 * email to the page, which puts them on every page lock and commit trailer.
 */

import { useLiveEditConfig } from "./api";

export type EditorIdentity = {
  name: string;
  email: string;
};

/** The signed-in editor, or null in a preview or export where nobody edits. */
export function useIdentity() {
  const { identity } = useLiveEditConfig();
  return { identity };
}
