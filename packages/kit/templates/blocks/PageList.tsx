import { Editable, Link, defineBlock, usePages } from "@jotdown/kit";

type Props = { title?: string; folder?: string; limit?: string };

/**
 * The pages of one folder as a grid of cards, newest additions included as soon as they exist.
 *
 * @example <PageList title="Guides" folder="guides" limit="6" />
 */
function PageListBlock({ title, folder, limit }: Props) {
  const pages = usePages({ folder, limit: limit ? Number(limit) : undefined });

  return (
    <section className="not-prose my-10">
      <Editable.Text prop="title" value={title} as="h2" className="block font-semibold text-xl" />
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {pages.map((page) => (
          <li key={page.url}>
            <Link
              href={page.url}
              className="block h-full rounded-xl p-4 ring-1 ring-border transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <span className="block font-medium">{page.title}</span>
              {page.description && <span className="mt-1 block text-muted-foreground text-sm">{page.description}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export const PageList = defineBlock(PageListBlock, {
  title: "Page list",
  description: "The pages of one folder, as cards",
  props: {
    title: { default: "Read next" },
    folder: { label: "Folder" },
    limit: { label: "How many" },
  },
});
