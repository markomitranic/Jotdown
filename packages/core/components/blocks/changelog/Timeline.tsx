import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { ChangelogFilter } from "@jotdown/core/components/blocks/changelog/Filter";
import { releaseId, written } from "@jotdown/core/lib/changelog";

/** What the filter looks the releases up by, and there is one timeline to a page. */
const LIST = "changelog-releases";

/** What `remarkChangelog` puts on every release it marks up. */
type ReleaseProps = {
  version: string;
  /** `YYYY-MM-DD`, which is what the filter's date range compares against. */
  date: string;
  compare?: string;
  children?: ReactNode;
};

/**
 * The release timeline: a pasted `CHANGELOG.md`, newest first, filtered in the browser.
 *
 * Never typed by hand. A page carrying `changelog: true` in its front matter
 * gets one of these wrapped around its releases while it compiles, which is
 * also where `<ChangelogRelease>` and `<ChangelogSection>` come from.
 *
 * Everything here stays on the server, releases included, and only the filter
 * beside them is a client component, given the list's id and a count and left
 * to find the rest in the DOM. So the release markup never reaches the browser
 * bundle, and the words the search box looks in are read from the page rather
 * than shipped as an attribute: on a hundred-release page that attribute
 * alone was 58KB gzipped, a third copy of every release's text.
 *
 * Every release is drawn, with no Load more in front of them, which is what
 * lets the browser's own find-in-page reach the whole changelog. A changelog
 * long enough to hurt gets split into a page per major version instead.
 */
export function ChangelogTimeline({ children }: { children?: ReactNode }) {
  const total = Children.toArray(children).filter(isRelease).length;

  return (
    <div className="mb-8 flex flex-col gap-6">
      <ChangelogFilter list={LIST} total={total} />
      <div id={LIST} className="flex flex-col border-border border-l ps-6">
        {children}
      </div>
    </div>
  );
}

/**
 * One release on the timeline: its dot, its self-linking version, its date and its body.
 *
 * The body is whatever the file put under the heading, prose and lists alike,
 * so a release is not limited to a list of commits. The dot lives inside the
 * heading rather than the article so it centres on the version's own line,
 * however the row beside it wraps.
 *
 * `data-version` and `data-date` are what the filter matches on, and
 * `data-body` scopes its search to the release's own words rather than the
 * version and date this draws above them.
 */
export function ChangelogRelease({ version, date, compare, children }: ReleaseProps) {
  const id = releaseId(version);

  return (
    <article data-version={version} data-date={date} className="pb-8 last:pb-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={id} className="relative mt-8 mb-4 scroll-mt-24 font-label font-semibold text-base text-foreground">
          <span
            aria-hidden="true"
            className="absolute top-1/2 -left-[1.8125rem] size-2.5 -translate-y-1/2 rounded-full border-2 border-background bg-primary"
          />
          <a href={`#${id}`} className="text-foreground no-underline">
            {version}
          </a>
        </h2>
        <time dateTime={date} className="text-1sm text-muted-foreground">
          {written(date)}
        </time>
        {compare && (
          <a href={compare} className="text-1sm text-muted-foreground">
            Compare
          </a>
        )}
      </div>
      <div data-body className="break-words [&_li]:text-sm [&_ul]:my-1">
        {children}
      </div>
    </article>
  );
}

/**
 * A release's `### Bug Fixes` line, as a label rather than a heading.
 *
 * Never typed by hand, and an element rather than an `<h3>` on purpose: a
 * heading here would put four hundred rows in the page's table of contents.
 */
export function ChangelogSection({ children }: { children?: ReactNode }) {
  return (
    <p className="mt-[1.25em] mb-1 font-label font-semibold text-1sm text-muted-foreground uppercase tracking-wide">
      {children}
    </p>
  );
}

/** True when a child is a release the plugin marked up, rather than stray whitespace. */
function isRelease(node: ReactNode): node is ReactElement<ReleaseProps> {
  return isValidElement(node) && typeof (node.props as ReleaseProps)?.version === "string";
}
