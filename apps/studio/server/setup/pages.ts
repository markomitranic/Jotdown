/**
 * The pages a new project starts with: a home page, and the starter set of sections beside it.
 *
 * Each is a page an agent can read and replace. None claims anything about the
 * project it lands in, since nothing here has read its code.
 */

/**
 * The home page, titled and described as the wizard was told, linking to the starter sections when there are any.
 *
 * @example homePage("Checkout", "How checkout works", true); // "---\ntitle: Checkout\n…"
 */
export function homePage(title: string, description: string, starter: boolean) {
  const sections = starter
    ? `
Start with [Getting started](./getting-started/index.mdx) to run the project, read
[Architecture](./architecture/index.mdx) for how it fits together, and the
[Decision records](./decision-records/index.mdx) for why it is built the way it is.
`
    : `
Add a page beside this one, or ask your agent to write one from the code.
`;

  return `---
title: ${yamlString(title)}
icon: House
description: ${yamlString(description || `The documentation of ${title}.`)}
---

This is the documentation of ${title}, kept in the same repository as its code
and updated in the same change.
${sections}`;
}

/** The main section's `meta.json`, listing the starter sections in reading order when there are any. */
export function mainMeta(title: string, starter: boolean) {
  const pages = starter ? ["index", "getting-started", "architecture", "decision-records", "..."] : ["index", "..."];
  return json({ title, pages });
}

/** Every page and `meta.json` of the starter set, by path under `docs/`. */
export function starterPages(): Record<string, string> {
  return {
    "getting-started/meta.json": json({
      title: "Getting started",
      icon: "Rocket",
      description: "What you need, and how to run the project on your machine.",
      pages: ["..."],
    }),
    "getting-started/index.mdx": `---
title: Getting started
icon: Rocket
description: What you need, and how to run the project on your machine.
---

What a developer installs, the commands that start the project, and how to
tell it works. Write it as numbered steps a newcomer can follow on a clean
machine.
`,
    "architecture/meta.json": json({
      title: "Architecture",
      icon: "Boxes",
      description: "How the parts of the project fit together, and why.",
      pages: ["..."],
    }),
    "architecture/index.mdx": `---
title: Architecture
icon: Boxes
description: How the parts of the project fit together, and why.
---

One page per part worth explaining: a flow across several modules, an
invariant a newcomer would break, a boundary that is easy to cross by accident.

<DocCardList />
`,
    "decision-records/meta.json": json({
      title: "Decision records",
      icon: "ScrollText",
      description: "The significant technical choices, and the context behind them.",
      pages: ["0001-record-architecture-decisions", "..."],
    }),
    "decision-records/index.mdx": `---
title: Decision records
icon: ScrollText
description: The significant technical choices, and the context behind them.
---

A decision record is one page per significant choice: the context, the
decision, and its consequences. Records are numbered, never rewritten, and a
later record replaces an earlier one by saying so.

<DocCardList />
`,
    "decision-records/0001-record-architecture-decisions.mdx": `---
title: "ADR 0001: Record architecture decisions"
icon: ScrollText
description: Why significant technical choices are written down as numbered records beside the code.
---

**Accepted**

## Context

Choices about how the project is built get made in meetings, pull requests and
chat, and the reasons are gone by the time somebody asks why.

## Decision

Every significant technical choice is a numbered page in this section:
the context it was made in, the decision, and what follows from it. A record is
never rewritten once accepted. A later record replaces it and says which.

## Consequences

- A newcomer, or an agent, reads why the project is the way it is before changing it.
- Reversing a decision means writing down why, which is cheap and keeps the history honest.
`,
  };
}

/**
 * A string as YAML front matter takes it, quoted only when it has to be.
 *
 * @example yamlString("Checkout: the flow"); // "\"Checkout: the flow\""
 */
function yamlString(text: string) {
  return /^[\w][\w .,()'/&-]*$/.test(text) ? text : JSON.stringify(text);
}

function json(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
