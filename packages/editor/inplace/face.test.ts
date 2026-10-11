import { describe, expect, it } from "vitest";
import { faceOf, type Standing } from "./face";

const RESTING: Standing = {
  saving: { at: "resting" },
  changes: 1,
  deployed: true,
  local: false,
};

describe("faceOf", () => {
  it("offers a save as soon as a page has changes", () => {
    expect(faceOf(RESTING).doing).toBe("save");
    expect(faceOf({ ...RESTING, local: true }).doing).toBe("save");
  });

  it("says a folder save is saved rather than published", () => {
    expect(faceOf({ ...RESTING, local: true, saving: { at: "published" } }).says).toBe("Saved");
    expect(faceOf({ ...RESTING, saving: { at: "published" } }).says).toBe("Published");
  });

  it("counts the changed blocks rather than judging them", () => {
    expect(faceOf({ ...RESTING, changes: 0 }).says).toBe("No changes");
    expect(faceOf({ ...RESTING, changes: 1 }).says).toBe("1 change");
    expect(faceOf({ ...RESTING, changes: 4 }).says).toBe("4 changes");
  });

  it("offers markdown when the deployment cannot commit", () => {
    expect(faceOf({ ...RESTING, deployed: false }).doing).toBe("copy");
  });

  it("lets a commit in flight outrank the offer to save", () => {
    expect(faceOf({ ...RESTING, saving: { at: "sending" } }).busy).toBe(true);
    expect(faceOf({ ...RESTING, saving: { at: "published" } }).doing).toBe("reload");
  });

  it("says what went wrong rather than making the reader guess", () => {
    const face = faceOf({ ...RESTING, saving: { at: "failed", why: "GitHub said no." } });

    expect(face.says).toBe("GitHub said no.");
    expect(face.doing).toBe("save");
  });
});
