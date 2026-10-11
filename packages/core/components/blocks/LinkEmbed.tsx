/**
 * A link drawn as a card: the page's title, description, site and picture.
 *
 * Any page can write `<LinkEmbed url="…" />` with no import, in `.md` and
 * `.mdx` alike. Everything shown comes off the tag, read once when the link was
 * pasted, so the card costs no request at build time and still reads well when
 * the site it points at has gone. The picture and the icon stay on that site,
 * and one that no longer loads leaves an empty tile rather than a broken image.
 *
 * Only `url` is required. A tag with nothing else draws the address as the
 * title and the host as the site, which is what a hand-written one gets.
 *
 * @example <LinkEmbed url="https://fumadocs.dev" title="Fumadocs" site="Fumadocs" />
 */

import { Globe } from "lucide-react";
import { SOURCE_RANGE } from "@jotdown/core/lib/source-range";
import { hostName, shortAddress, webAddress } from "@jotdown/core/lib/web-address";

type LinkEmbedProps = {
  /** The page the card opens, `http` or `https`. */
  url: string;
  /** The page's own title, its `og:title` or `<title>`. */
  title?: string;
  /** A sentence or two from the page, its `og:description`. */
  description?: string;
  /** The site's name, its `og:site_name`, shown beside the icon. */
  site?: string;
  /** The page's preview picture, its `og:image`. */
  image?: string;
  /** The site's icon. */
  favicon?: string;
  [SOURCE_RANGE]?: string;
};

/**
 * Renders the card in its frame, or the bare address as text when it is not one a card can open.
 *
 * The stamp sits on the frame rather than on the card, because the studio
 * mounts the block's editor inside the stamped element, and a card is a link
 * that cannot hold another.
 * @example <LinkEmbed url="https://fumadocs.dev" title="Fumadocs" />
 */
export default function LinkEmbed({ [SOURCE_RANGE]: stamp, ...card }: LinkEmbedProps) {
  if (webAddress(card.url) === null) {
    return <p data-src-range={stamp}>{card.url}</p>;
  }

  return (
    <div className="jd-link-frame" data-src-range={stamp}>
      <LinkCard {...card} />
    </div>
  );
}

/**
 * The card alone, the whole of it one link, for the studio's editor to draw inside a frame of its own.
 * @example <LinkCard url="https://fumadocs.dev" title="Fumadocs" />
 */
export function LinkCard({ url, title, description, site, image, favicon }: Omit<LinkEmbedProps, typeof SOURCE_RANGE>) {
  const address = webAddress(url);
  if (address === null) return null;

  const picture = webAddress(image);
  const icon = webAddress(favicon);
  const siteName = site?.trim() || hostName(address);
  const heading = title?.trim();

  return (
    <a className="jd-link" href={address.href} target="_blank" rel="noreferrer">
      <span className="jd-link-body">
        <span className="jd-link-title">{heading || shortAddress(address)}</span>
        {description ? <span className="jd-link-description">{description}</span> : null}
        <span className="jd-link-site">
          {icon ? (
            // biome-ignore lint/performance/noImgElement: another site's icon, which Next's optimiser has no allowlist for
            <img className="jd-link-icon" src={icon.href} alt="" referrerPolicy="no-referrer" loading="lazy" />
          ) : (
            <Globe className="jd-link-icon" aria-hidden="true" />
          )}
          <span className="jd-link-name">{siteName}</span>
          {heading ? <span className="jd-link-address">{shortAddress(address)}</span> : null}
        </span>
      </span>
      {picture ? (
        <span className="jd-link-image">
          {/* biome-ignore lint/performance/noImgElement: another site's picture, which Next's optimiser has no allowlist for */}
          <img src={picture.href} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
        </span>
      ) : null}
    </a>
  );
}
