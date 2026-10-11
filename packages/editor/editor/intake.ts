/**
 * What goes up for each file somebody drops, decided before anything leaves the browser.
 *
 * A picture under 2 MB and a file under 4 MB go up as they are. Past that the
 * person who dropped it is asked, in the block where it will land: a picture
 * can be compressed or sent as it is, a big file can still be sent from a
 * studio on this machine, and anything past what the studio takes is turned
 * away with the reason and what to do instead. Nothing is ever compressed
 * without being asked.
 */

import { COMPRESSION, UPLOAD_LIMITS, megabytes } from "../limits";
import { compressPicture } from "./compress";

/** One button under a question, and what pressing it answers. */
export type Choice = { label: string; answer: Answer; primary?: boolean };

export type Answer = "compress" | "original" | "send" | "cancel";

/**
 * What the block says about one file while it waits: one short line, a warning or not, and the small print.
 *
 * @example { says: "2.8 MB. Compress before uploading?", note: "WebP · 1920 px · quality 80", choices }
 */
export type Question = { says: string; warning?: boolean; note?: string; choices: Choice[] };

/** Puts a question to the person who dropped the file and waits for the button they press. */
export type Ask = (question: Question) => Promise<Answer>;

/** The file to send, which may be a compressed copy, or why nothing goes up. */
export type Intake = { send: File } | { cancelled: true } | { error: string };

/**
 * Decides what to send for one picture or attachment, asking first when it is big.
 *
 * @example await intake(file, "image", ask); // { send: file } for a 600 KB screenshot
 */
export function intake(file: File, kind: "image" | "file", ask: Ask): Promise<Intake> {
  return kind === "image" ? intakePicture(file, ask) : intakeFile(file, ask);
}

/**
 * Answers every question with its primary button, for a file arriving where there is no block to ask in.
 *
 * @example await intake(file, "image", primaryAnswer); // compressed, unasked
 */
export const primaryAnswer: Ask = async ({ choices }) =>
  (choices.find((choice) => choice.primary) ?? choices[0])?.answer ?? "cancel";

/** A picture over 2 MB is offered compression; one past the limit can only be compressed or left out. */
async function intakePicture(file: File, ask: Ask): Promise<Intake> {
  if (file.size <= UPLOAD_LIMITS.compressOver) return { send: file };

  const limit = UPLOAD_LIMITS.max;
  const fits = file.size <= limit;
  const size = megabytes(file.size);

  const answer = await ask({
    says: fits ? `${size}. Compress before uploading?` : `${size}, over the ${megabytes(limit)} the studio takes.`,
    warning: !fits,
    note: `WebP · ${COMPRESSION.edge} px · quality ${COMPRESSION.quality * 100}${file.type === "image/gif" ? " · first frame only" : ""}`,
    choices: [
      { label: "Compress", answer: "compress", primary: true },
      fits ? { label: "Upload original", answer: "original" } : { label: "Cancel", answer: "cancel" },
    ],
  });

  if (answer === "cancel") return { cancelled: true };
  if (answer !== "compress") return { send: file };

  const compressed = await compressPicture(file);
  if (compressed === null) return { error: `${file.name} could not be read as a picture.` };
  if (compressed.size > limit) return { error: `${file.name} is still over ${megabytes(limit)} compressed.` };

  return { send: compressed };
}

/** A file over 4 MB is sent only once its sender has heard about Drive, and never past the limit. */
async function intakeFile(file: File, ask: Ask): Promise<Intake> {
  if (file.size <= UPLOAD_LIMITS.large) return { send: file };

  const limit = UPLOAD_LIMITS.max;
  const size = megabytes(file.size);

  if (file.size > limit) {
    await ask({
      says: `${size}, over the ${megabytes(limit)} the studio takes. Commit it with git, or link it from Drive.`,
      warning: true,
      choices: [{ label: "Dismiss", answer: "cancel" }],
    });
    return { cancelled: true };
  }

  const answer = await ask({
    says: `${size}. Large files are better linked from Drive than kept in git.`,
    warning: true,
    choices: [
      { label: "Upload anyway", answer: "send" },
      { label: "Cancel", answer: "cancel", primary: true },
    ],
  });

  return answer === "send" ? { send: file } : { cancelled: true };
}
