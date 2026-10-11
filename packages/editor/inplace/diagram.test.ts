import { expect, test } from "vitest";
import { applyDraft, createDraft } from "./draft";
import { createHistory } from "./history";
import { createDiagram } from "./diagram";

const source = "---\ntitle: Diagram\n---\n\n~~~mermaid title=example\ngraph LR\n  A-->B\n~~~\n\nUntouched.\n";
const stamp = "5:1-8:4";

test("opening a diagram is clean; editing preserves its fence metadata and surrounding source", () => {
  const draft = createDraft();
  const diagram = createDiagram(source, stamp, draft, createHistory())!;
  expect(diagram.get()).toBe("graph LR\n  A-->B");
  expect(draft.edits().size).toBe(0);
  diagram.write("graph LR\n  A-->C");
  const written = applyDraft(source, draft.edits());
  expect(written).toContain("mermaid title=example\ngraph LR\n  A-->C");
  expect(written).toMatch(/^---\ntitle: Diagram\n---\n\n/);
  expect(written).toMatch(/\n\nUntouched\.\n$/);
  diagram.write("graph LR\n  A-->B");
  expect(draft.edits().size).toBe(0);
});

test("diagram and prose changes share one undo order", () => {
  const draft = createDraft();
  const history = createHistory();
  const diagram = createDiagram(source, stamp, draft, history)!;
  diagram.write("graph LR\n  A-->C");
  draft.write("10:1-10:11", "Prose changed.");
  history.did({ undo: () => draft.write("10:1-10:11", null), redo: () => draft.write("10:1-10:11", "Prose changed.") });
  diagram.undo();
  expect(draft.edits().size).toBe(1);
  diagram.undo();
  expect(draft.edits().size).toBe(0);
  diagram.redo();
  expect(diagram.get()).toBe("graph LR\n  A-->C");
});

test("a recovered diagram can be undone to the original", () => {
  const draft = createDraft();
  const history = createHistory();
  draft.write(stamp, "```mermaid\ngraph LR\n  A-->Recovered\n```");
  const diagram = createDiagram(source, stamp, draft, history)!;
  expect(diagram.get()).toContain("Recovered");
  diagram.undo();
  expect(diagram.get()).toBe("graph LR\n  A-->B");
  diagram.redo();
  expect(diagram.get()).toContain("Recovered");
});

test("authored JSX and non-Mermaid fences do not become source editors", () => {
  expect(createDiagram('<Mermaid chart="graph LR" />', "1:1-1:29", createDraft(), createHistory())).toBeNull();
  expect(createDiagram("```js\nhi\n```", "1:1-3:4", createDraft(), createHistory())).toBeNull();
});

test("clearing a saved draft keeps its displayed diagram until the page reloads", () => {
  const draft = createDraft();
  const diagram = createDiagram(source, stamp, draft, createHistory())!;
  const unsubscribe = diagram.subscribe(() => {
    diagram.get();
  });
  diagram.write("graph LR\n  A-->Saved");
  draft.clear();
  expect(draft.edits().size).toBe(0);
  expect(diagram.get()).toBe("graph LR\n  A-->Saved");
  unsubscribe();
});
