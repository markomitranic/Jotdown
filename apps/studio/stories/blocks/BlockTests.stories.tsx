import preview from "@/.storybook/preview";
import { PageStory } from "@/.storybook/page";
import * as page from "../../../../docs/examples/every-block.mdx";

/** The Every block example page itself: one of every block, so a styling change is checked in one scroll. */
const meta = preview.meta({
  title: "Pages/Every block",
  args: { editing: false },
  render: ({ editing }) => <PageStory page={page} editing={editing} />,
});

export const Reading = meta.story();

export const Editing = meta.story({ args: { editing: true } });
