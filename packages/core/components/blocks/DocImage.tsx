"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import Image from "next/image";
import clsx from "clsx";
import { Check, Copy, Download, Maximize2 } from "lucide-react";
import { IMAGE, optimizable } from "@jotdown/core/lib/images";
import { imageFileName } from "@jotdown/core/lib/image-file";
import MissingImage from "./MissingImage";

/** An `<img>` as markdown writes one, and the controls an editor adds to its toolbar. */
type Props = ComponentProps<"img"> & { tools?: ReactNode };

/**
 * An image in a document, as wide as the text it sits in and never taller than the window.
 *
 * A picture is drawn at its own size up to the text column, and on a wide
 * screen a little past it, into the margin. `--jd-shot-height` caps it down,
 * so a tall export cannot take the whole viewport. It scales rather than
 * crops, so nothing in the picture is decided on the reader's behalf, and
 * clicking it opens the original file on the fullscreen stage a diagram gets,
 * at its own pixel size, with pan, zoom and Fit.
 *
 * Pointing at it shows a toolbar: expand, copy the original to the clipboard
 * and download it. An editor puts its own controls at the front with `tools`.
 *
 * The markdown title becomes a caption:
 *
 *     ![The blocks of a page](/img/docs/editor.png "A grip in the left margin moves a block.")
 *
 * `alt` is what a screen reader announces and stays the image's own
 * description. An image written with no alt text at all — `![](…)` — is given
 * `alt=""`, which marks it decorative and skips it, because the alternative is
 * the browser falling back to reading out the file name.
 *
 * The wrapper is a <span>, not a <figure>. MDX leaves a lone image inside the
 * paragraph it was written in, and a <figure> there is invalid HTML: the browser
 * closes the <p> early, the DOM stops matching what the server rendered, and
 * hydration throws. `role="figure"` buys the semantics without the parse, and
 * `aria-label` hands it the caption as its name, which is the one thing the role
 * does not get for free the way a real <figcaption> would.
 *
 * The image sits in a bare button, so the keyboard reaches it too. The clicks
 * on it and on the toolbar are heard once for the whole article, which is what
 * lets a copy of the image, carrying only its markup, work exactly like the
 * original.
 *
 * React types an `<img src>` as a URL or a Blob; markdown only ever writes the
 * first, and a Blob would be a broken image anyway.
 *
 * The picture is drawn through Next's optimizer at the column's width. The
 * stage, the copy and the download all take the original from `data-src`, the
 * address the page asked for, which an editor drawing the same image reads back
 * too. Nothing past the optimizer's scaled copy is fetched until somebody asks.
 *
 * An image with no address at all, `![alt]()`, draws the placeholder for one
 * a paste could not download, and an address that answers with no picture
 * draws the same placeholder saying it could not be loaded. A new address is
 * given its own chance, so an upload swapping in for its local preview is not
 * held to the preview's failure.
 */
export default function DocImage({ title, className, alt, src, width, height, tools, ...props }: Props) {
  const url = typeof src === "string" ? src : undefined;
  const [failed, setFailed] = useState<string | null>(null);

  if (url === undefined || url === "") return <MissingImage alt={alt ?? ""} reason="downloaded" />;
  if (failed === url) return <MissingImage alt={alt ?? ""} reason="loaded" />;

  const image = (
    <span className="jd-shot__frame">
      <button type="button" className="jd-shot__open" aria-label={alt ? `Expand: ${alt}` : "Expand image"}>
        <Image
          alt={alt ?? ""}
          src={url}
          width={Number(width) || IMAGE.column}
          height={Number(height) || 0}
          unoptimized={!optimizable(url)}
          {...props}
          data-src={url}
          ref={(element) => brokenAlready(element, () => setFailed(url))}
          onError={() => setFailed(url)}
          className={clsx("jd-shot-img", className)}
        />
      </button>
      <ImageTools url={url}>{tools}</ImageTools>
    </span>
  );

  if (!title) return <span className="jd-shot">{image}</span>;

  return (
    // biome-ignore lint/a11y/useSemanticElements: a <figure> inside a <p> breaks hydration
    <span className="jd-shot" role="figure" aria-label={title}>
      {image}
      <span className="jd-shot-caption">{title}</span>
    </span>
  );
}

/**
 * The toolbar over a picture: an editor's own controls, then expand, copy and download.
 *
 * Expand and copy are plain buttons the article listens for, so a copy of the
 * markup works too; the download is a link to the original file.
 */
function ImageTools({ url, children }: { url: string; children?: ReactNode }) {
  return (
    <span className="not-prose jd-shot__tools" contentEditable={false}>
      {children}
      {children && <span className="jd-shot__rule" aria-hidden="true" />}
      <button type="button" className="jd-shot__expand" title="Expand" aria-label="Expand image">
        <Maximize2 aria-hidden="true" />
      </button>
      <button type="button" className="jd-copy" data-copy-image={url} title="Copy image" aria-label="Copy image">
        <Copy className="jd-copy__idle" aria-hidden="true" />
        <Check className="jd-copy__done" aria-hidden="true" />
      </button>
      <a href={url} download={imageFileName(url)} title="Download original" aria-label="Download original">
        <Download aria-hidden="true" />
      </a>
    </span>
  );
}

/**
 * Tells `broken` about an image that failed before the page could listen, as a page served whole does.
 *
 * Only a finished image with no size is asked, and decoding it settles the
 * question, because a picture drawn from a vector may have no size and still
 * be fine. An image waiting to be scrolled to is not finished, so it is left alone.
 *
 * @example <img ref={(element) => brokenAlready(element, () => setFailed(url))} />
 */
function brokenAlready(element: HTMLImageElement | null, broken: () => void) {
  if (element === null || !element.complete || element.naturalWidth > 0) return;
  element.decode().catch(broken);
}
