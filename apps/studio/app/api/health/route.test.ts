import { expect, test } from "vitest";
import { GET } from "./route";

test("says ok and asks nobody to cache it", async () => {
  const response = await GET();

  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ status: "ok" });
});
