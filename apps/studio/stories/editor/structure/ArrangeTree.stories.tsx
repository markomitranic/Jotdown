import type * as PageTree from "fumadocs-core/page-tree";
import { expect, within } from "storybook/test";
import preview from "@/.storybook/preview";
import { STUDIO } from "@/.storybook/page";
import { LiveEditConfigProvider } from "@jotdown/editor/client/config";
import ArrangeTree from "@jotdown/editor/structure/ArrangeTree";
import { StructureProvider } from "@jotdown/editor/structure/useStructure";

const DOCS = {
  "/welcome": { source: "docs/welcome.mdx", title: "Welcome" },
  "/guides": { source: "docs/guides/index.mdx", title: "Guides" },
  "/guides/install": { source: "docs/guides/install.mdx", title: "Install" },
  "/guides/deploy": { source: "docs/guides/deploy.mdx", title: "Deploy", unlisted: true },
  "/billing": { source: "docs/billing/index.mdx", title: "Billing", unlisted: true },
  "/billing/invoices": { source: "docs/billing/invoices.mdx", title: "Invoices" },
  "/subscriber": { source: "docs/subscriber.mdx", title: "Subscriber" },
  "/reference": { source: "docs/reference/index.mdx", title: "API reference", generated: true },
  "/reference/client": { source: "docs/reference/client.mdx", title: "Client", generated: true },
};

const page = (url: keyof typeof DOCS): PageTree.Item => ({ type: "page", name: DOCS[url].title, url });

const folder = (url: keyof typeof DOCS, children: PageTree.Node[], defaultOpen = false): PageTree.Folder => ({
  type: "folder",
  name: DOCS[url].title,
  index: page(url),
  children,
  defaultOpen,
});

const TREE: PageTree.Node[] = [
  page("/welcome"),
  folder("/guides", [page("/guides/install"), page("/guides/deploy")], true),
  folder("/billing", [page("/billing/invoices")]),
  page("/subscriber"),
  folder("/reference", [page("/reference/client")]),
];

/**
 * The sidebar as an editor arranges it: pages, pages holding pages, open and shut, unlisted, and generated ones.
 */
const meta = preview.meta({
  title: "Studio/Arrange tree",
  decorators: [
    (Story) => (
      <LiveEditConfigProvider config={{ ...STUDIO, docs: DOCS }}>
        <StructureProvider>
          <div className="w-72 p-4 text-sm">
            <Story />
          </div>
        </StructureProvider>
      </LiveEditConfigProvider>
    ),
  ],
});

export const Default = meta.story({ render: () => <ArrangeTree tree={TREE} /> });

/** An unlisted page's menu offers Publish, committed the moment it is picked. */
export const PublishFromTheMenu = meta.story({
  render: () => <ArrangeTree tree={TREE} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole("button", { name: "Change Deploy" }));
    await expect(await within(document.body).findByRole("menuitem", { name: "Publish" })).toBeVisible();
  },
});
