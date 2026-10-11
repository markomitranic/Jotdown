import preview from "@/.storybook/preview";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@jotdown/core/components/ui/field";
import { Input } from "@jotdown/core/components/ui/input";

const meta = preview.meta({
  title: "UI/Field",
  component: Field,
  parameters: { layout: "padded" },
  render: () => (
    <FieldGroup className="max-w-md">
      <Field>
        <FieldLabel htmlFor="field-title">Title</FieldLabel>
        <Input id="field-title" defaultValue="Checkout web" />
      </Field>
      <Field>
        <FieldLabel htmlFor="field-description">Description</FieldLabel>
        <Input id="field-description" placeholder="How checkout works, end to end" />
        <FieldDescription>One sentence. It shows under the title and in search.</FieldDescription>
      </Field>
      <Field data-invalid>
        <FieldLabel htmlFor="field-url">Public address</FieldLabel>
        <Input id="field-url" defaultValue="docs.client" aria-invalid />
        <FieldError>Write the address in full, with https://.</FieldError>
      </Field>
    </FieldGroup>
  ),
});

export const Default = meta.story();
