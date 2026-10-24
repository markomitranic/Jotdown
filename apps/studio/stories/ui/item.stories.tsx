import { ArrowUpRight, Check, Globe } from "lucide-react";
import preview from "@/.storybook/preview";
import { Button } from "@jotdown/core/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@jotdown/core/components/ui/item";

const meta = preview.meta({
  title: "UI/Item",
  component: Item,
  parameters: { layout: "padded" },
  render: () => (
    <ItemGroup className="max-w-md gap-2">
      <Item variant="muted" size="sm">
        <ItemMedia variant="icon">
          <Check className="text-primary" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>You can commit to it</ItemTitle>
          <ItemDescription>Setup lands as one commit on main.</ItemDescription>
        </ItemContent>
      </Item>
      <Item variant="outline" size="sm">
        <ItemContent>
          <ItemTitle>Icon</ItemTitle>
          <ItemDescription>Drop a square image here.</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" size="sm">
            Choose an image
          </Button>
        </ItemActions>
      </Item>
      <Item asChild variant="outline" size="sm">
        <a href="#publishing">
          <ItemMedia variant="icon">
            <Globe />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Publish it as a site</ItemTitle>
            <ItemDescription>A site for readers, deployed on Vercel</ItemDescription>
          </ItemContent>
          <ArrowUpRight className="size-4 text-muted-foreground" />
        </a>
      </Item>
    </ItemGroup>
  ),
});

export const Default = meta.story();
