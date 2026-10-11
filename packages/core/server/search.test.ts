import { expect, test } from "vitest";
import { extractSearchText } from "./search";

const words = (data: ReturnType<typeof extractSearchText>) => JSON.stringify(data);

test("keeps a page's prose and figure captions, and leaves its code, Mermaid, drawings and component props out", () => {
  const page = [
    "---",
    "title: Guide",
    "---",
    "",
    "## Setup",
    "",
    "Run the installer first.",
    "",
    "```ts",
    "const secretSauce = 1;",
    "```",
    "",
    "```mermaid",
    "graph TD; Quokka --> Wombat",
    "```",
    "",
    '<figure className="jd-fig"><svg><text>Platypus label</text></svg><figcaption>Echidna caption</figcaption></figure>',
    "",
    ":::note",
    "Mind the gap.",
    ":::",
    "",
    '<Banner type={{ numbat: { description: "Marsupial" } }} />',
  ].join("\n");

  const text = words(extractSearchText("guide.mdx", page));
  expect(text).toContain("Setup");
  expect(text).toContain("Run the installer first.");
  expect(text).toContain("Mind the gap.");
  expect(text).toContain("Echidna caption");
  for (const junk of ["secretSauce", "Quokka", "Platypus", "numbat"]) expect(text).not.toContain(junk);
});

test("leaves a changelog out of search", () => {
  expect(
    extractSearchText("changelog.md", "---\ntitle: Changelog\nchangelog: true\n---\n\n## [1.0.0] (2026-01-01)\n"),
  ).toBeNull();
});
