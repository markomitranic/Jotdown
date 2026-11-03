import { describe, expect, it } from "vitest";
import { defineBlock, defineLayout, type ProjectLayout } from "@jotdown/kit";
import { layoutInserts } from "./inserts";

const Role = defineBlock(() => null, { title: "Role", props: { title: { default: "Engineer" } } });
const Jot = defineBlock(() => null, { title: "Jot" });

describe("a layout's inserts", () => {
  it("offers the framework blocks and project blocks it lists, in its order", () => {
    const profile = defineLayout(() => null, { blocks: [Role, "heading", Jot] });
    const inserts = layoutInserts("profile", profile, { Jot, Role });

    expect([...inserts.framework]).toEqual(["heading"]);
    expect(inserts.project.map((insert) => insert.source)).toEqual(['<Role title="Engineer" />', "<Jot />"]);
  });

  it("refuses a layout exported without a list", () => {
    const bare = (() => null) as unknown as ProjectLayout;

    expect(() => layoutInserts("board", bare, { Jot })).toThrow(".jotdown/layouts/board.tsx lists no blocks");
  });

  it("refuses a listed block that no component file exports", () => {
    const board = defineLayout(() => null, { blocks: [Jot] });

    expect(() => layoutInserts("board", board, { Role })).toThrow('lists the block "Jot"');
  });
});
