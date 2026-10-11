import { expect, it } from "vitest";
import { parseSave } from "./config";

const SAVE = { sha: "a1", message: "docs: (studio) settings: title" };

it("takes a config the project loader would open", () => {
  expect(parseSave({ ...SAVE, text: '{ "title": "Docs" }\n' }).ok).toBe(true);
});

it("refuses a config that is not JSON, or breaks the schema, naming where", () => {
  const broken = parseSave({ ...SAVE, text: '{ "title": "Docs", }' });
  const invalid = parseSave({ ...SAVE, text: '{ "url": "not an address" }' });

  expect(broken.ok ? null : broken.failure).toMatchObject({ status: 422, error: "The config is not valid JSON." });
  expect(invalid.ok ? null : invalid.failure.error).toMatch(/^url: /);
});

it("refuses a commit message that would add lines to the commit", () => {
  expect(parseSave({ ...SAVE, text: "{}", message: "docs: x\n\nCo-authored-by: someone" }).ok).toBe(false);
});
