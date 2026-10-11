/**
 * A video embedded in a page. YouTube only.
 *
 * Any page can write `<VideoEmbed url="…" />` with no import, in `.md` and
 * `.mdx` alike. The player is served from `youtube-nocookie.com` and loads lazily, so
 * a page carrying a video that nobody scrolls to costs nothing.
 *
 * A link that is not YouTube renders as a plain link instead of failing the
 * build. A wrong paste should be visible on the page, not a deploy that stops.
 *
 * @example <VideoEmbed url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />
 */

import { SOURCE_RANGE } from "@jotdown/core/lib/source-range";

type VideoEmbedProps = {
  /** Any YouTube link: watch, youtu.be, embed, shorts or live. */
  url: string;
  [SOURCE_RANGE]?: string;
};

/**
 * Every YouTube link shape, ending at the eleven-character video id.
 *
 * The lookahead stops a longer id-like run from being cut down to its first
 * eleven characters, which would silently embed the wrong video.
 */
const YOUTUBE_URL =
  /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|live\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/;

/**
 * The video id in a YouTube link, or null for anything else.
 *
 * Shared with the browser editor, which uses it to decide whether a pasted link
 * is one this block can show.
 *
 * @example youtubeId("https://youtu.be/dQw4w9WgXcQ"); // "dQw4w9WgXcQ"
 */
export function youtubeId(url: string): string | null {
  return YOUTUBE_URL.exec(url.trim())?.[1] ?? null;
}

/**
 * Renders a video or fallback link, preserving its source range for block controls.
 * @example <VideoEmbed url="https://youtu.be/dQw4w9WgXcQ" />
 */
export default function VideoEmbed({ url, [SOURCE_RANGE]: stamp }: VideoEmbedProps) {
  const id = youtubeId(url);

  if (id === null) {
    return (
      <p data-src-range={stamp}>
        <a href={url} target="_blank" rel="noreferrer">
          {url}
        </a>
      </p>
    );
  }

  return (
    <div className="jd-video" data-src-range={stamp}>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title="YouTube video"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
