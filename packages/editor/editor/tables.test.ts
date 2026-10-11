/**
 * Rearranging a table has to be safe in two ways at once: the header row cannot
 * be dragged out of the top slot, and a column has to keep the alignment that is
 * spread across its cells. These cases are both of those promises, over the JSON
 * the commands hand to ProseMirror.
 */

import { describe, expect, test } from "vitest";
import type { JSONContent } from "@tiptap/core";
import { reorderColumns, reorderRows } from "./tables";

const cell = (text: string, align: string | null = null): JSONContent => ({
  type: "tableCell",
  attrs: { align },
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const header = (text: string, align: string | null = null): JSONContent => ({
  ...cell(text, align),
  type: "tableHeader",
});

/** Four rows, and a second column that is centred so a move can be traced. */
const table = (): JSONContent => ({
  type: "table",
  content: [
    { type: "tableRow", content: [header("Role"), header("The job", "center")] },
    { type: "tableRow", content: [cell("Gateway"), cell("One vendor", "center")] },
    { type: "tableRow", content: [cell("Adapter"), cell("One endpoint", "center")] },
    { type: "tableRow", content: [cell("Worker"), cell("One queue", "center")] },
  ],
});

/** The leftmost cell of every row, so a test can read order off a table. */
function firstColumn(node: JSONContent) {
  return (node.content ?? []).map((row) => row.content?.[0]?.content?.[0]?.content?.[0]?.text);
}

function aligns(node: JSONContent) {
  return (node.content ?? []).map((row) => (row.content ?? []).map((cell) => cell.attrs?.align));
}

describe("reorderRows", () => {
  test("a row dropped lower ends up where it was let go", () => {
    const original = table();

    expect(firstColumn(reorderRows(original, 1, 3))).toEqual(["Role", "Adapter", "Worker", "Gateway"]);
    expect(firstColumn(original)).toEqual(["Role", "Gateway", "Adapter", "Worker"]);
  });

  test("a row dragged back up sits above the row it was dropped on", () => {
    expect(firstColumn(reorderRows(table(), 3, 1))).toEqual(["Role", "Worker", "Gateway", "Adapter"]);
  });

  test("the header row will not move", () => {
    const original = table();
    expect(reorderRows(original, 0, 2)).toBe(original);
  });

  test("nothing can be dropped above the header row", () => {
    const original = table();
    expect(reorderRows(original, 2, 0)).toBe(original);
  });

  test("a row dropped back on its own index hands the table straight back", () => {
    const original = table();
    expect(reorderRows(original, 2, 2)).toBe(original);
  });

  test("an index past the last row is refused", () => {
    const original = table();
    expect(reorderRows(original, 1, 9)).toBe(original);
  });
});

describe("reorderColumns", () => {
  test("a column carries its alignment across to its new place", () => {
    const swapped = reorderColumns(table(), 1, 0);

    expect(firstColumn(swapped)).toEqual(["The job", "One vendor", "One endpoint", "One queue"]);
    expect(aligns(swapped)).toEqual([
      ["center", null],
      ["center", null],
      ["center", null],
      ["center", null],
    ]);
  });

  test("a column dropped back on its own index hands the table straight back", () => {
    const original = table();
    expect(reorderColumns(original, 1, 1)).toBe(original);
  });

  test("an index past the last column is refused", () => {
    const original = table();
    expect(reorderColumns(original, 0, 2)).toBe(original);
  });
});
