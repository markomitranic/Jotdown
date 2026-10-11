import type { CSSProperties, ReactNode } from "react";
import type { LayoutTab } from "@jotdown/core/components/docs/tabs";
import { SidebarProvider } from "@jotdown/core/components/docs/sidebar";
import { Boxes, House, Wrench } from "lucide-react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import preview from "@/.storybook/preview";
import { SectionSwitcher } from "@jotdown/core/components/SectionSwitcher";

function Icon({ accent, children }: { accent: string; children: ReactNode }) {
  return (
    <span className="jd-section-icon" style={{ "--jd-section": accent } as CSSProperties}>
      {children}
    </span>
  );
}

const SHORT: LayoutTab[] = [
  {
    title: "Guide",
    description: "Writing pages",
    url: "/",
    icon: (
      <Icon accent="var(--primary)">
        <House />
      </Icon>
    ),
  },
  {
    title: "Reference",
    description: "Every block",
    url: "/reference",
    icon: (
      <Icon accent="#a8a29e">
        <Boxes />
      </Icon>
    ),
  },
];

const LONG: LayoutTab[] = [
  {
    title: "Customer portal",
    description: "Documentation for the customer portal, its accounts, invoices and the meter readings.",
    url: "/",
    icon: (
      <Icon accent="#4ade80">
        <House />
      </Icon>
    ),
  },
  {
    title: "Product Landscape",
    description: "K&L products and the IoT Platform",
    url: "/landscape",
    icon: (
      <Icon accent="#a8a29e">
        <Boxes />
      </Icon>
    ),
  },
  {
    title: "Engineering",
    description: "Systems, security and standards",
    url: "/engineering",
    icon: (
      <Icon accent="#a8a29e">
        <Wrench />
      </Icon>
    ),
  },
];

const meta = preview.meta({
  title: "UI/Section switcher",
  component: SectionSwitcher,
  parameters: { layout: "padded", nextjs: { navigation: { pathname: "/landscape" } } },
  decorators: [
    (Story) => (
      <SidebarProvider>
        <div className="flex h-[420px] w-[268px] flex-col border-e bg-card p-4">
          <Story />
        </div>
      </SidebarProvider>
    ),
  ],
  args: { sections: LONG },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
    await waitFor(() => expect(within(document.body).getByRole("dialog")).toBeVisible());
  },
});

/** Sections whose names fit the sidebar: the menu is as wide as the switcher. */
export const Short = meta.story({
  args: { sections: SHORT },
  parameters: { nextjs: { navigation: { pathname: "/reference" } } },
});

/** A blurb too long for the sidebar: the menu grows over the page, then wraps it to two lines. */
export const Long = meta.story();
