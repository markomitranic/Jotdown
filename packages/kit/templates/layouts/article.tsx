import { Link, type LayoutProps } from "@jotdown/kit";

/**
 * A single article: its title and description over one column of prose, for a page that reads on its own.
 *
 * @example layout: article
 */
export default function Article({ page, site, children }: LayoutProps) {
  return (
    <div className="min-h-dvh bg-background px-6 py-16">
      <article className="prose mx-auto max-w-2xl">
        <p className="text-muted-foreground text-sm">
          <Link href={`${site.base}/`}>{site.title}</Link>
        </p>
        <h1>{page.title}</h1>
        {page.description && <p className="lead">{page.description}</p>}
        {children}
      </article>
    </div>
  );
}
