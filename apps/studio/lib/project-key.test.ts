import { describe, expect, it } from "vitest";
import { formatProjectKey, parseProjectId, parseProjectKey, projectId, projectMount } from "./project-key";

describe("project keys", () => {
  it("reads a repository, typed or as its GitHub address", () => {
    expect(parseProjectKey("you/notes")).toEqual({ owner: "you", repo: "notes" });
    expect(parseProjectKey("https://github.com/you/notes/")).toEqual({ owner: "you", repo: "notes" });
    expect(parseProjectKey("github.com/you/notes")).toEqual({ owner: "you", repo: "notes" });
    expect(parseProjectKey("git@github.com:you/notes.git")).toEqual({ owner: "you", repo: "notes" });
  });

  it("refuses anything that is not one repository", () => {
    expect(parseProjectKey("you")).toBeNull();
    expect(parseProjectKey("you/site/apps/docs")).toBeNull();
    expect(parseProjectKey("you/..")).toBeNull();
  });

  it("reads the project off the first two segments of a studio address", () => {
    expect(projectMount("/you/notes")).toEqual({ key: "you/notes", rest: "/" });
    expect(projectMount("/you/notes/manual/sections")).toEqual({ key: "you/notes", rest: "/manual/sections" });
    expect(projectMount("/you")).toBeNull();
    expect(projectMount("/api/projects")).toBeNull();
    expect(projectMount("/img/docs/a.png")).toBeNull();
    expect(projectMount("/llms.mdx/manual")).toBeNull();
  });

  it("round-trips through a URL segment", () => {
    expect(projectId("you/site")).toBe("you~site");
    expect(formatProjectKey(parseProjectId(projectId("you/site"))!)).toBe("you/site");
  });
});
