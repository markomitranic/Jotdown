import { Extension, InputRule, type Editor } from "@tiptap/core";
import { Plugin, type EditorState } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/** The class a list item with a checkbox wears, the same one GFM's own HTML gives it. */
export const TASK_ITEM = "task-list-item";

/**
 * A list item that is a to-do, the way GFM writes one: `- [ ]` and `- [x]`.
 *
 * GFM has no task list, only a list item that happens to carry a checkbox, and
 * the schema follows it. A `checked` of null is a plain item, false an open
 * to-do and true a done one, so every list command, Tab, Turn into and the
 * page's own Enter work on to-dos without having heard of them, and a list can
 * mix the two exactly as the markdown can.
 *
 * The box is drawn by the stylesheet in the item's marker gutter, so a click
 * that lands on the item itself rather than on its words is a click on the box.
 * Enter on a to-do starts another open one, and `[ ] ` or `[x] ` typed at the
 * start of an item makes it a to-do.
 */
export const taskItem = Extension.create({
  name: "taskItem",
  priority: 200,

  addGlobalAttributes() {
    return [
      {
        types: ["listItem"],
        attributes: {
          checked: {
            default: null,
            keepOnSplit: false,
            parseHTML: (element) => (element.classList.contains(TASK_ITEM) ? element.dataset.checked === "true" : null),
            renderHTML: ({ checked }) =>
              checked === null ? {} : { class: TASK_ITEM, "data-checked": String(checked === true) },
          },
        },
      },
    ];
  },

  addKeyboardShortcuts() {
    return { Enter: ({ editor }) => splitTask(editor) };
  },

  addInputRules() {
    return [
      new InputRule({
        find: /^\[([ xX]?)\]\s$/,
        handler: ({ state, range, match }) => {
          const { $from } = state.selection;
          const item = $from.depth - 1;
          if (item < 1 || $from.node(item).type.name !== "listItem" || $from.index(item) !== 0) return null;

          state.tr
            .delete(range.from, range.to)
            .setNodeAttribute($from.before(item), "checked", match[1]?.toLowerCase() === "x");
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    return [new Plugin({ props: { handleDOMEvents: { mousedown: toggleOnBox } } })];
  },
});

/**
 * Enter in a to-do, which starts another open one and leaves every tick on the words it was on.
 *
 * Splitting keeps the first half where it stands, so Enter at the very start of
 * a done to-do would leave its tick on the empty item above and move the words
 * down unticked. There the words take the tick along and the new item is the open one.
 */
function splitTask(editor: Editor): boolean {
  const { $from } = editor.state.selection;
  const item = $from.depth - 1;
  if (item < 1 || $from.node(item).type.name !== "listItem") return false;

  const checked = $from.node(item).attrs.checked;
  if (checked === null) return false;

  const pushedDown = $from.parentOffset === 0 && $from.parent.content.size > 0;
  if (!pushedDown) return editor.commands.splitListItem("listItem", { checked: false });

  const above = $from.before(item);
  return editor
    .chain()
    .splitListItem("listItem", { checked })
    .command(({ tr }) => {
      tr.setNodeAttribute(above, "checked", false);
      return true;
    })
    .run();
}

/**
 * Ticks or unticks the to-do whose box was pressed, and keeps the caret where it was.
 *
 * The box is the item's own `::before`, so the event's target is the `<li>`
 * itself. A press on the words lands on the paragraph inside it instead and is
 * left to place the caret as usual.
 */
function toggleOnBox(view: EditorView, event: MouseEvent): boolean {
  const target = event.target;
  if (!(target instanceof HTMLLIElement) || !target.classList.contains(TASK_ITEM)) return false;
  if (!view.editable) return false;

  const at = itemAt(view.state, view.posAtDOM(target, 0));
  if (at === null) return false;

  event.preventDefault();
  view.dispatch(view.state.tr.setNodeAttribute(at.pos, "checked", at.checked !== true));
  return true;
}

function itemAt(state: EditorState, inside: number): { pos: number; checked: unknown } | null {
  const $pos = state.doc.resolve(inside);

  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === "listItem") return { pos: $pos.before(depth), checked: node.attrs.checked };
  }

  return null;
}
