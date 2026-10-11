/**
 * The folders a local studio bookmarks, and the address each keeps.
 *
 * A folder is added once however often it is asked for, two folders of the
 * same name never share an address, and a folder that is not a Jotdown
 * project is refused rather than listed as a project that cannot open.
 */

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { forgetFavorite } from "../favorites";
import { addFolder, folderAt, readFolders } from "./folders";

let root = "";

async function project(path: string) {
  await mkdir(join(root, path), { recursive: true });
  await mkdir(join(root, path, ".jotdown"), { recursive: true });
  await writeFile(join(root, path, ".jotdown/config.json"), JSON.stringify({ title: path }));
  return join(root, path);
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "jotdown-folders-"));
  vi.stubEnv("XDG_CONFIG_HOME", join(root, "config"));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

test("a folder added twice keeps the one address", async () => {
  const handbook = await project("sites/handbook");

  const first = await addFolder(handbook);
  const again = await addFolder(handbook);

  expect(first).toEqual({ key: "local/handbook", path: handbook });
  expect(again).toEqual(first);
  expect(await readFolders()).toHaveLength(1);
});

test("two folders of the same name get addresses of their own", async () => {
  const mine = await addFolder(await project("mine/docs"));
  const theirs = await addFolder(await project("theirs/docs"));

  expect(mine.key).toBe("local/docs");
  expect(theirs.key).toBe("local/docs-2");
  expect((await folderAt("local/docs-2"))?.path).toBe(join(root, "theirs/docs"));
});

test("a folder that is not a Jotdown project is refused", async () => {
  await mkdir(join(root, "downloads"));

  await expect(addFolder(join(root, "downloads"))).rejects.toThrow(/no \.jotdown\/config\.json/);
  expect(await readFolders()).toEqual([]);
});

test("forgetting a folder takes only its bookmark", async () => {
  const handbook = await addFolder(await project("sites/handbook"));

  await forgetFavorite(handbook.key);

  expect(await folderAt(handbook.key)).toBeNull();
  expect(existsSync(handbook.path)).toBe(true);
});
