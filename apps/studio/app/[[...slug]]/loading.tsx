/**
 * The page's outline while it compiles, drawn inside the sidebar that is already there.
 *
 * Plain blocks in the page's own frame rather than the docs page itself, which
 * needs a project's tree, so it also stands on its own when no project is open.
 * Still blocks rather than a shimmer, so a slow compile costs nothing to look at.
 */
export default function Loading() {
  return (
    <main className="grid justify-items-center [grid-area:main]">
      <article
        role="status"
        aria-label="Loading the page"
        className="flex w-full min-w-0 max-w-[900px] flex-col gap-3 px-4 py-6 md:px-6 md:pt-8 xl:px-8 xl:pt-14"
      >
        <div className="h-9 w-2/3 rounded-md bg-muted" />
        <div className="h-5 w-1/2 rounded-md bg-muted" />
        <div className="space-y-2.5 pt-6">
          <div className="h-4 rounded bg-muted" />
          <div className="h-4 rounded bg-muted" />
          <div className="h-4 w-5/6 rounded bg-muted" />
          <div className="h-4 w-3/4 rounded bg-muted" />
        </div>
      </article>
    </main>
  );
}
