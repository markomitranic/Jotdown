import { describe, expect, test } from "vitest";
import { youtubeId } from "./VideoEmbed";

describe("youtubeId", () => {
  test.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?app=desktop&v=dQw4w9WgXcQ&t=42s",
    "https://youtu.be/dQw4w9WgXcQ?si=abc123",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/live/dQw4w9WgXcQ",
    "  https://youtu.be/dQw4w9WgXcQ  ",
  ])("reads the id out of %s", (url) => {
    expect(youtubeId(url)).toBe("dQw4w9WgXcQ");
  });

  test.each([
    "https://vimeo.com/76979871",
    "https://example.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/@someone",
    "dQw4w9WgXcQ",
    "",
  ])("refuses %s", (url) => {
    expect(youtubeId(url)).toBeNull();
  });

  /** An id is eleven characters, so a longer run is a different thing. */
  test("does not shorten a longer id-like run", () => {
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQextra")).toBeNull();
  });
});
