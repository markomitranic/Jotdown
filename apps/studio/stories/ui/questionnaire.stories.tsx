import { useState } from "react";
import preview from "@/.storybook/preview";
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireTitle,
} from "@jotdown/core/components/ui/questionnaire";

/** Two questions, one picked from and one with a written answer, driven by the keyboard as well as the mouse. */
function Playground() {
  const [item, setItem] = useState("host");
  const [host, setHost] = useState("vercel");

  return (
    <Questionnaire
      item={item}
      onItemChange={setItem}
      shortcuts="letters"
      onSubmit={(event) => event.preventDefault()}
      className="max-w-lg"
    >
      <QuestionnaireProgress />
      <QuestionnaireItem name="host">
        <QuestionnaireTitle>Will anyone else read them?</QuestionnaireTitle>
        <QuestionnaireDescription>This only prepares the files a host needs.</QuestionnaireDescription>
        <QuestionnaireChoices>
          <QuestionnaireChoice value="none" checked={host === "none"} onChange={() => setHost("none")}>
            <span className="font-medium">Not yet</span>
            <QuestionnaireChoiceDescription>Publishing can come later.</QuestionnaireChoiceDescription>
          </QuestionnaireChoice>
          <QuestionnaireChoice value="vercel" checked={host === "vercel"} onChange={() => setHost("vercel")}>
            <span className="font-medium">Vercel</span>
            <QuestionnaireChoiceDescription>Builds a read-only site on every push.</QuestionnaireChoiceDescription>
          </QuestionnaireChoice>
        </QuestionnaireChoices>
      </QuestionnaireItem>
      <QuestionnaireItem name="folder">
        <QuestionnaireTitle>Which folder holds the docs?</QuestionnaireTitle>
        <QuestionnaireChoices>
          <QuestionnaireChoice value="root" defaultChecked>
            The repository root
          </QuestionnaireChoice>
          <QuestionnaireInput aria-label="Another folder" placeholder="Another folder, like apps/handbook" />
        </QuestionnaireChoices>
      </QuestionnaireItem>
      <QuestionnaireActions>
        <QuestionnairePrevious>Back</QuestionnairePrevious>
        <QuestionnaireNext>Next</QuestionnaireNext>
      </QuestionnaireActions>
    </Questionnaire>
  );
}

const meta = preview.meta({
  title: "UI/Questionnaire",
  component: Playground,
  parameters: { layout: "padded" },
});

export const Default = meta.story();
