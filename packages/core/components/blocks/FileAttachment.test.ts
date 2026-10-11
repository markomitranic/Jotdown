import { describe, expect, test } from "vitest";
import { extensionOf, fileKind, formatBytes, formatDate } from "./FileAttachment";

describe("extensionOf", () => {
  test.each([
    ["harness.zip", "zip"],
    ["Q3 Report.PDF", "pdf"],
    ["archive.tar.gz", "gz"],
    ["Makefile", ""],
    [".gitignore", ""],
  ])("%s is %s", (name, expected) => {
    expect(extensionOf(name)).toBe(expected);
  });
});

describe("fileKind", () => {
  test("names the formats the editor can upload", () => {
    expect(fileKind("harness.zip")).toBe("Zip archive");
    expect(fileKind("deck.pptx")).toBe("PowerPoint deck");
  });

  test("falls back to the extension for anything hand-written", () => {
    expect(fileKind("dump.sql")).toBe("SQL file");
    expect(fileKind("Makefile")).toBe("File");
  });
});

describe("formatBytes", () => {
  test.each([
    ["0", "0 bytes"],
    ["512", "512 bytes"],
    ["248193", "248 KB"],
    ["1400000", "1.4 MB"],
  ])("%s reads as %s", (size, expected) => {
    expect(formatBytes(size)).toBe(expected);
  });

  test("says nothing rather than guessing", () => {
    expect(formatBytes(undefined)).toBe(null);
    expect(formatBytes("")).toBe(null);
    expect(formatBytes("a lot")).toBe(null);
    expect(formatBytes("-1")).toBe(null);
  });
});

describe("formatDate", () => {
  test("prints the day that was written, in any timezone", () => {
    expect(formatDate("2026-08-22")).toBe("22 Aug 2026");
    expect(formatDate("2026-01-01")).toBe("1 Jan 2026");
  });

  test("says nothing rather than guessing", () => {
    expect(formatDate(undefined)).toBe(null);
    expect(formatDate("yesterday")).toBe(null);
    expect(formatDate("2026-08-22T10:00:00Z")).toBe(null);
    expect(formatDate("2026-13-01")).toBe(null);
  });
});
