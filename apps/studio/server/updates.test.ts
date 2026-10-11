import { expect, test } from "vitest";
import { isNewer } from "./updates";

test("versions compare by number, not by text", () => {
  expect(isNewer("0.10.0", "0.9.2")).toBe(true);
  expect(isNewer("0.2.0", "0.2.0")).toBe(false);
  expect(isNewer("1.0.0", "0.99.0")).toBe(true);
  expect(isNewer("0.1.9", "0.2.0")).toBe(false);
});
