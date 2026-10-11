/**
 * What the setup wizard writes into a repository.
 *
 * The config names only what differs from the defaults, a file already there
 * is never overwritten, the skills are replaced the way `npx skills add`
 * replaces them, and the agent note lands in the instructions the repository
 * already has, once.
 */

import { expect, test } from "vitest";
import type { Inspection, SetupAnswers } from "../../lib/setup";
import { planSetup, type Sources, type Write } from "./plan";

const answers: SetupAnswers = {
  target: { kind: "github", key: "you/site" },
  content: "",
  title: "Web",
  description: "",
  url: "",
  palette: "neutral",
  icon: null,
  pages: "home",
  skills: false,
  agentNote: false,
  publishing: "none",
  moveOld: false,
};

const inspection: Inspection = {
  target: answers.target,
  name: "you/site",
  title: "Web",
  description: "",
  branch: "main",
  repository: "https://github.com/you/site",
  agentFile: null,
  problem: null,
};

const sources: Sources = {
  skills: [],
  deployment: [],
  icon: null,
  notes: {},
  existing: new Set(),
  standing: new Set(),
  moves: [],
};

function find(writes: Write[], path: string) {
  const write = writes.find((each) => each.path === path);
  if (!write) throw new Error(`${path} is not in the plan`);
  return write;
}

function text(write: Write) {
  return "content" in write && typeof write.content === "string" ? write.content : "";
}

test("the config names only what was answered, and the docs sit in the folder it names", () => {
  const writes = planSetup(
    { ...answers, content: "apps/docs", palette: "ocean", icon: "iVBORw0KGgo=", publishing: "vercel" },
    inspection,
    { ...sources, icon: new Uint8Array([0x89]) },
  );
  const config = JSON.parse(text(find(writes, ".jotdown/config.json")));

  expect(config).toMatchObject({
    version: 1,
    title: "Web",
    repository: "https://github.com/you/site",
    content: "apps/docs",
    favicon: "/uploads/icon.png",
  });
  expect(config.theme.dark.primary).toBe("#7fb2ff");
  expect(config).not.toHaveProperty("description");
  expect(find(writes, "apps/docs/docs/index.mdx").change).toBe("new");
  expect(find(writes, "apps/docs/docs/_uploads/icon.png").change).toBe("new");

  const plain = JSON.parse(text(find(planSetup(answers, inspection, sources), ".jotdown/config.json")));
  expect(plain).not.toHaveProperty("theme");
  expect(plain).not.toHaveProperty("content");
});

test("a file already there is kept, and a skill already there is replaced", () => {
  const skill = { path: ".agents/skills/authoring/SKILL.md", content: "# Authoring" };
  const writes = planSetup({ ...answers, skills: true }, inspection, {
    ...sources,
    skills: [skill],
    existing: new Set(["docs/index.mdx", skill.path]),
  });

  expect(find(writes, "docs/index.mdx").change).toBe("kept");
  expect(find(writes, skill.path).change).toBe("replaced");
  expect(find(writes, ".claude/skills/authoring/SKILL.md")).toMatchObject({
    change: "new",
    link: "../../../.agents/skills/authoring/SKILL.md",
  });
});

test("the agent note goes into the instructions the repository has, once", () => {
  const appended = planSetup({ ...answers, agentNote: true }, inspection, {
    ...sources,
    notes: { "CLAUDE.md": "# Rules\n" },
  });
  expect(find(appended, "CLAUDE.md").change).toBe("appended");
  expect(text(find(appended, "CLAUDE.md"))).toMatch(/^# Rules\n\n## Documentation\n/);

  const again = planSetup({ ...answers, agentNote: true }, inspection, {
    ...sources,
    notes: { "CLAUDE.md": text(find(appended, "CLAUDE.md")) },
  });
  expect(find(again, "CLAUDE.md").change).toBe("kept");

  const fresh = planSetup({ ...answers, agentNote: true }, inspection, sources);
  expect(text(find(fresh, "AGENTS.md"))).toContain("## Documentation");
  expect(text(find(fresh, "CLAUDE.md"))).toBe("@AGENTS.md\n");
});

test("a skill folder that is a link in the repository is deleted first, so the skill can be written in its place", () => {
  const skill = { path: ".agents/skills/blocks/SKILL.md", content: "# Blocks" };
  const writes = planSetup({ ...answers, skills: true }, inspection, {
    ...sources,
    skills: [skill],
    standing: new Set([".agents/skills/blocks", ".agents/skills/blocks/SKILL.md"]),
  });

  expect(find(writes, ".agents/skills/blocks")).toMatchObject({ change: "deleted", remove: true });
  expect(
    writes.filter((write) => write.path.startsWith(".agents/skills/blocks/")).map((write) => write.change),
  ).toEqual(["new"]);
});

test("what the content folder held moves first, and a page under it is written anew rather than kept", () => {
  const writes = planSetup({ ...answers, content: "apps/docs", moveOld: true }, inspection, {
    ...sources,
    moves: [{ from: "apps/docs/docs", to: "apps/docs/_old/docs" }],
    existing: new Set(["apps/docs/docs/index.mdx"]),
  });

  expect(find(writes, "apps/docs/_old/docs")).toMatchObject({ change: "moved", from: "apps/docs/docs" });
  expect(find(writes, "apps/docs/docs/index.mdx").change).toBe("new");
});

test("a host's files go into .jotdown beside the config, whatever the content folder", () => {
  const writes = planSetup({ ...answers, content: "apps/handbook", publishing: "vercel" }, inspection, {
    ...sources,
    deployment: [{ path: ".jotdown/vercel.json", content: "{}" }],
  });
  expect(find(writes, ".jotdown/vercel.json").change).toBe("new");
  expect(find(writes, ".jotdown/config.json").change).toBe("new");
});
