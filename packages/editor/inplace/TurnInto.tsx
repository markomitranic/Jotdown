"use client";

/**
 * The "Turn into" choices, shared by the grip's menu and the selection menu so the two never disagree.
 *
 * Each choice shows its block beside the menu while it is highlighted, by the
 * pointer or by the arrow keys, which is how somebody new learns what a
 * callout is before they make one.
 */

import { useState } from "react";
import {
  Check,
  Code,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  ListTodo,
  MessageSquareText,
  TextQuote,
  Type,
} from "lucide-react";
import { DropdownMenuItem } from "@jotdown/core/components/ui/dropdown-menu";
import { BlockPreview } from "./previews";
import { TURN_KINDS, type TurnChoice, type TurnKind } from "./turn";

export const TURN_ICONS: Record<TurnKind, typeof Type> = {
  paragraph: Type,
  heading2: Heading2,
  heading3: Heading3,
  heading4: Heading4,
  bulletList: List,
  orderedList: ListOrdered,
  taskList: ListTodo,
  codeBlock: Code,
  blockquote: TextQuote,
  callout: MessageSquareText,
};

type Previewing = { kind: TurnKind; row: HTMLElement };

type Props = {
  current: TurnKind | null;
  /** The kinds the page's layout lets a block become. */
  kinds: TurnChoice[];
  onTurn(kind: TurnKind): void;
};

/**
 * One menu item per kind, the current one ticked, for inside a dropdown's content or sub-content.
 *
 * @example <TurnIntoItems current="paragraph" kinds={turnKinds(page.framework)} onTurn={(kind) => ops.turnInto?.(kind)} />
 */
export function TurnIntoItems({ current, kinds, onTurn }: Props) {
  const [previewing, setPreviewing] = useState<Previewing | null>(null);

  return (
    <>
      {kinds.map(({ kind, title }) => {
        const Icon = TURN_ICONS[kind];

        return (
          <DropdownMenuItem
            key={kind}
            onSelect={() => onTurn(kind)}
            onFocus={(event) => setPreviewing({ kind, row: event.currentTarget })}
            onBlur={() => setPreviewing(null)}
          >
            <Icon />
            {title}
            {kind === current && <Check className="ml-auto" />}
          </DropdownMenuItem>
        );
      })}

      <BlockPreview kind={previewing?.kind ?? null} row={previewing?.row ?? null} />
    </>
  );
}

/**
 * What a kind is called in the menu.
 *
 * @example turnTitle("heading2"); // "Heading 2"
 */
export function turnTitle(kind: TurnKind) {
  return TURN_KINDS.find((each) => each.kind === kind)?.title ?? "Text";
}
