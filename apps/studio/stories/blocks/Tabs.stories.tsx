import preview from "@/.storybook/preview";
import { PageStory } from "@/.storybook/page";
import * as page from "./Tabs.mdx";

const meta = preview.meta({
  title: "Blocks/Tabs",
  args: { editing: false },
  render: ({ editing }) => <PageStory page={page} editing={editing} />,
});

export const Reading = meta.story();

export const Editing = meta.story({ args: { editing: true } });
