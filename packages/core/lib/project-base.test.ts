import { describe, expect, it } from "vitest";
import { atBase, slugInside } from "./project-base";

describe("slugInside", () => {
  it("takes the project's own segments off a slug the platform matched against the whole address", () => {
    expect(slugInside("/you/notes", ["you", "notes"])).toEqual([]);
    expect(slugInside("/you/notes", ["you", "notes", "manual"])).toEqual(["manual"]);
  });

  it("leaves a slug that is already inside the project", () => {
    expect(slugInside("/you/notes", ["manual"])).toEqual(["manual"]);
    expect(slugInside("", ["manual"])).toEqual(["manual"]);
    expect(slugInside("/you/notes", undefined)).toEqual([]);
  });
});

describe("atBase", () => {
  const handbook = { base: "/you/notes", config: { uploads: "docs/_uploads" } };
  const uploads = { "docs/_uploads/img/a.png": "/api/blobs/you/notes/aaa/a.png" };

  it("points an upload the project keeps by content at its blob", () => {
    expect(atBase({ ...handbook, uploads }, "/img/a.png")).toBe("/api/blobs/you/notes/aaa/a.png");
  });

  it("moves anything else site-absolute under the base", () => {
    expect(atBase({ ...handbook, uploads }, "/img/missing.png")).toBe("/you/notes/img/missing.png");
    expect(atBase(handbook, "/manual/sections")).toBe("/you/notes/manual/sections");
    expect(atBase(handbook, "https://x.test")).toBe("https://x.test");
  });
});
