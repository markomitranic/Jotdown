import { expect, userEvent, waitFor, within } from "storybook/test";
import preview from "@/.storybook/preview";
import { ThemeSwitch } from "@jotdown/core/components/ThemeSwitch";

const meta = preview.meta({
  title: "UI/Theme switch",
  component: ThemeSwitch,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="flex w-[268px] items-center border bg-card p-2 text-muted-foreground">
        <Story />
      </div>
    ),
  ],
  args: { className: "ms-auto" },
});

/** Light chosen: the pill sits under the sun. */
export const Light = meta.story({
  play: async ({ canvasElement }) => {
    const light = within(canvasElement).getByRole("radio", { name: "Light" });
    await userEvent.click(light);
    await waitFor(() => expect(light).toBeChecked());
  },
});

/** Following the system: the pill sits in the middle, and the mode the system picked is lit. */
export const System = meta.story({
  play: async ({ canvasElement }) => {
    const system = within(canvasElement).getByRole("radio", { name: "Match system" });
    await userEvent.click(system);
    await waitFor(() => expect(system).toBeChecked());
  },
});

/** Dark chosen, reached from the middle with the arrow key. */
export const Dark = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("radio", { name: "Match system" }));
    await userEvent.keyboard("{ArrowRight>}");
    await userEvent.keyboard("{/ArrowRight}");
    await waitFor(() => expect(canvas.getByRole("radio", { name: "Dark" })).toBeChecked());
  },
});
