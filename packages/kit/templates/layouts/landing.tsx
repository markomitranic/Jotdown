import { Link, type LayoutProps } from "@jotdown/kit";

/**
 * A landing page: the site's name across the top and the page below it, wide and without a sidebar.
 *
 * @example layout: landing
 */
export default function Landing({ site, children }: LayoutProps) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href={`${site.base}/`} className="font-semibold">
          {site.title}
        </Link>
      </header>
      <main className="prose mx-auto max-w-5xl px-6 pb-24">{children}</main>
    </div>
  );
}
