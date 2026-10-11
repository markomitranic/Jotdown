import preview from "@/.storybook/preview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@jotdown/core/components/ui/tabs";

const meta = preview.meta({
  title: "UI/Tabs",
  component: Tabs,
  parameters: { layout: "padded" },
  render: () => (
    <Tabs defaultValue="changes" className="max-w-md">
      <TabsList>
        <TabsTrigger value="changes">Changes</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
        <TabsTrigger value="settings" disabled>
          Settings
        </TabsTrigger>
      </TabsList>
      <TabsContent value="changes">Three blocks read differently from the file.</TabsContent>
      <TabsContent value="history">Every commit that touched this page.</TabsContent>
    </Tabs>
  ),
});

export const Default = meta.story();
