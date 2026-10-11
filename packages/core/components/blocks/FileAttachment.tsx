/**
 * A file committed alongside a page and offered as a download.
 *
 * Any page can write `<FileAttachment … />` with no import, in `.md` and
 * `.mdx` alike. Everything shown comes off the tag, so the card costs no request and
 * no build-time lookup, and a reader on a slow connection sees what they are
 * about to download before they ask for it.
 *
 * The file itself lives under `uploads/files/docs/` named after a hash of its own
 * bytes, which is why `name` exists: the hash is the URL, and this is what the
 * browser saves it as.
 *
 * @example <FileAttachment href="/files/docs/9f2c1a.zip" name="harness.zip" size="248193" />
 */

type FileAttachmentProps = {
  /** Site-absolute path the upload landed at, `/files/docs/<hash>.zip`. */
  href: string;
  /** The filename a reader downloads it as, and the card's title. */
  name?: string;
  /** Bytes, as a decimal string. Printed as `242 KB`. */
  size?: string;
  /** `YYYY-MM-DD`. Anything else is left off the card rather than guessed at. */
  uploadedAt?: string;
  /** Up to 200 characters saying what this is and why it is here. */
  note?: string;
};

/**
 * What each extension is called in plain words.
 *
 * The keys double as what the editor's file picker offers, so a format added
 * here becomes uploadable once the endpoint's own allowlist agrees.
 */
export const FILE_KINDS: Record<string, string> = {
  pdf: "PDF document",
  zip: "Zip archive",
  csv: "CSV spreadsheet",
  json: "JSON file",
  txt: "Text file",
  docx: "Word document",
  xlsx: "Excel spreadsheet",
  pptx: "PowerPoint deck",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The extension of a filename, lowercased, or an empty string when it has none.
 *
 * The dot has to follow something, so a dotfile is read as having no extension
 * rather than as being one: `.gitignore` is not a Gitignore file.
 *
 * @example extensionOf("Q3 report.PDF"); // "pdf"
 */
export function extensionOf(name: string): string {
  return name.toLowerCase().match(/[^.]\.([a-z0-9]+)$/)?.[1] ?? "";
}

/**
 * Plain words for what kind of file this is.
 *
 * @example fileKind("harness.zip"); // "Zip archive"
 */
export function fileKind(name: string): string {
  const extension = extensionOf(name);
  return FILE_KINDS[extension] ?? (extension === "" ? "File" : `${extension.toUpperCase()} file`);
}

/**
 * A byte count as the operating system would have shown it, or null.
 *
 * Thousands rather than 1024s, because the number a reader recognises is the
 * one Finder and Explorer put next to the file before they dragged it in.
 *
 * @example formatBytes("248193"); // "248 KB"
 */
export function formatBytes(size: string | undefined): string | null {
  if (size === undefined || size.trim() === "") return null;

  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes < 0) return null;

  if (bytes < 1000) return `${Math.round(bytes)} bytes`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/**
 * `2026-08-22` as `22 Aug 2026`, or null for anything that is not a date.
 *
 * Formatted by hand rather than through `Date`, which would read the string as
 * UTC midnight and print the day before in every timezone west of London, and
 * would print a different day on the server than in the browser.
 *
 * @example formatDate("2026-08-22"); // "22 Aug 2026"
 */
export function formatDate(uploadedAt: string | undefined): string | null {
  const parts = uploadedAt?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return null;

  const month = MONTHS[Number(parts[2]) - 1];
  if (month === undefined) return null;

  return `${Number(parts[3])} ${month} ${parts[1]}`;
}

/** The last segment of a path, for a tag that never got a name. */
function fileNameOf(href: string): string {
  return href.split("/").pop() ?? href;
}

export default function FileAttachment({ href, name, size, uploadedAt, note }: FileAttachmentProps) {
  const filename = name?.trim() || fileNameOf(href);
  const facts = [fileKind(filename), formatBytes(size), formatDate(uploadedAt)];

  return (
    <a className="jd-file" href={href} download={filename}>
      <span className="jd-file-kind">{extensionOf(filename) || "file"}</span>
      <span className="jd-file-body">
        <span className="jd-file-name">{filename}</span>
        <span className="jd-file-meta">{facts.filter(Boolean).join(" · ")}</span>
        {note ? <span className="jd-file-note">{note}</span> : null}
      </span>
      <span className="jd-file-go" aria-hidden="true">
        &darr;
      </span>
    </a>
  );
}
