/**
 * The size rules for an upload: a small one goes up unasked, a big picture is
 * offered compression, a big file is sent only after the Drive warning, and
 * nothing past the studio's limit goes up as it is.
 */

import { describe, expect, test } from "vitest";
import { intake, type Answer, type Question } from "./intake";

const MB = 1_000_000;

const sized = (bytes: number, name: string, type: string) => new File([new Uint8Array(bytes)], name, { type });
const picture = (bytes: number) => sized(bytes, "welcome.png", "image/png");
const attachment = (bytes: number) => sized(bytes, "handbook.pdf", "application/pdf");

/** An asker that presses `answer` and keeps every question it was shown. */
function pressing(answer: Answer) {
  const asked: Question[] = [];
  const ask = async (question: Question) => {
    asked.push(question);
    return answer;
  };
  return { ask, asked, offered: () => asked[0]?.choices.map((choice) => choice.answer) };
}

describe("a picture", () => {
  test("under 2 MB goes up as it is, unasked", async () => {
    const file = picture(1.5 * MB);
    const asker = pressing("cancel");

    expect(await intake(file, "image", asker.ask)).toEqual({ send: file });
    expect(asker.asked).toHaveLength(0);
  });

  test("over 2 MB is offered compression, and goes up as it is when the original is chosen", async () => {
    const file = picture(3 * MB);
    const asker = pressing("original");

    expect(await intake(file, "image", asker.ask)).toEqual({ send: file });
    expect(asker.offered()).toEqual(["compress", "original"]);
  });

  test("past the limit can only be compressed or left out", async () => {
    const asker = pressing("cancel");

    expect(await intake(picture(30 * MB), "image", asker.ask)).toEqual({ cancelled: true });
    expect(asker.offered()).toEqual(["compress", "cancel"]);
  });
});

describe("an attachment", () => {
  test("under 4 MB goes up as it is, unasked", async () => {
    const asker = pressing("cancel");

    expect(await intake(attachment(3 * MB), "file", asker.ask)).toHaveProperty("send");
    expect(asker.asked).toHaveLength(0);
  });

  test("over 4 MB goes up once the Drive warning is answered", async () => {
    const asker = pressing("send");

    expect(await intake(attachment(10 * MB), "file", asker.ask)).toHaveProperty("send");
    expect(asker.asked[0]?.says).toContain("Drive");
  });

  test("past the limit is turned away with only a dismissal", async () => {
    const asker = pressing("cancel");

    expect(await intake(attachment(30 * MB), "file", asker.ask)).toEqual({ cancelled: true });
    expect(asker.offered()).toEqual(["cancel"]);
  });
});
