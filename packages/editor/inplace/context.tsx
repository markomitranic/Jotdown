"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useDocTarget, useLiveEditConfig } from "../client/api";
import { useIdentity } from "../client/identity";
import { useUploads } from "../client/useUploads";
import type { Uploading, UploadStatus } from "../editor/uploads";
import { isMdx } from "@jotdown/core/lib/paths";
import { wrapAt } from "../markdown/wrap";
import { createRecovery, type Recovery } from "./recovery";
import { createDraft, type Draft } from "./draft";
import { createFields, type Fields } from "./fieldState";
import { createHistory, type History } from "./history";
import { createRoster, type Roster } from "./roster";
import { gapClicks } from "./gap";
import { selectBlocks } from "./selectBlocks";
import { createBlockSelection, type BlockSelection } from "./blockSelection";
import { createHandles, type Handles } from "./handles";
import { createEditors, type Editors } from "./editors";
import { createSelectionTracker, type SelectionTracker } from "./selection";
import { InplaceBlockHandle } from "./BlockHandle";
import { InplaceSelectionTint } from "./SelectionTint";
import { InplaceGutterInsert } from "./GutterInsert";
import { InplaceFileDrop } from "./FileDrop";
import { InplaceLinkPopover } from "./LinkPopover";
import { InplaceTableHandles } from "./TableHandles";
import { InplaceToolbar } from "./Toolbar";
import { DrawingProvider } from "./drawing";
import { WhiteboardWorkspace } from "../whiteboard/Workspace";
import { UploadNotice } from "./UploadNotice";
import { useStills } from "./useEditable";
import type { SlashInsert } from "./slash";
import { useProjectInserts } from "../project/inserts";

/** The page as every editable block on it sees it. */
export type Inplace = {
  /** Text whose line ranges the mounted block editors use. */
  source: string;
  /** Saved page text that the normal save must still match before replacing it. */
  baseline: string;
  recovery: Recovery;
  draft: Draft;
  /** The page's own front matter, which is a block of the file like any other. */
  fields: Fields;
  roster: Roster;
  history: History;
  /** Every top-level block's grip: duplicate, delete, and a place to drop one arriving from elsewhere. */
  handles: Handles;
  /** Every mounted editor, for the controls that float over the article rather than living in a block. */
  editors: Editors;
  /** Whichever body editor currently holds a real text selection, for the selection menu. */
  selection: SelectionTracker;
  /** Whole blocks selected together, once a selection has run past the block it started in. */
  blocks: BlockSelection;
  /** Whether the file renders JSX, which decides what the slash menu offers. */
  mdx: boolean;
  /** The column this file's author wraps prose at, or null for a file nobody wraps. */
  wrap: number | null;
  /** The project's own blocks, offered in the `/` menu. */
  inserts: SlashInsert[];
  uploading: Uploading;
};

const InplaceContext = createContext<Inplace | null>(null);

const QUIET: UploadStatus = { busy: 0, total: 0, error: null };

/**
 * Shares the deployed source, draft, recovery and editor services with the page's blocks.
 *
 * Draft writes notify subscribers outside the article. Upload handlers use a ref
 * so signing in does not replace mounted editors. A null source disables editing.
 *
 * @example <InplaceEditing source={source}>{children}</InplaceEditing>
 */
export function InplaceEditing({ source, children }: { source: string | null; children: ReactNode }) {
  const { path } = useDocTarget();
  const { apiBase } = useLiveEditConfig();
  const { identity } = useIdentity();
  const { uploadImage, uploadFile } = useUploads(identity);
  const [status, setStatus] = useState(QUIET);
  const inserts = useProjectInserts();

  const live = useRef({ uploadImage, uploadFile });
  useEffect(() => {
    live.current = { uploadImage, uploadFile };
  }, [uploadImage, uploadFile]);

  const state = useMemo(() => {
    const draft = createDraft();
    return { draft, recovery: createRecovery(`${apiBase}:${path}`, source ?? "", draft) };
  }, [apiBase, path, source]);
  const revision = useSyncExternalStore(state.draft.subscribe, state.draft.revision, () => 0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: revision rebuilds the page when the draft is replaced, which the memo reads through a getter
  const page = useMemo<Inplace | null>(() => {
    if (source === null) return null;
    const text = state.draft.replacement() ?? source;
    const handles = createHandles();
    return {
      source: text,
      baseline: source,
      ...state,
      fields: createFields(text, state.draft),
      roster: createRoster(),
      history: createHistory(),
      handles,
      editors: createEditors(),
      selection: createSelectionTracker(),
      blocks: createBlockSelection(handles),
      mdx: isMdx(path),
      wrap: wrapAt(text),
      inserts,
      uploading: {
        uploadImage: (file) => live.current.uploadImage(file),
        uploadFile: (file) => live.current.uploadFile(file),
        mdx: isMdx(path),
        onStatus: setStatus,
      },
    };
  }, [source, state, revision, path, inserts]);

  useEffect(() => {
    void page?.recovery.start();
  }, [page]);

  const container = useRef<HTMLDivElement>(null);
  useStills(container, state.draft.replacement() === null ? page : null);

  useEffect(() => {
    const box = container.current;
    if (box === null || page === null) return;

    const stopGaps = gapClicks(box, page.roster);
    const stopSelecting = selectBlocks(box, page);

    return () => {
      stopGaps();
      stopSelecting();
    };
  }, [page]);

  return (
    <InplaceContext.Provider value={page}>
      <DrawingProvider key={path}>
        <div ref={container} className="relative">
          {children}
          <InplaceSelectionTint container={container} />
          <InplaceBlockHandle container={container} />
          <InplaceFileDrop container={container} />
          <InplaceGutterInsert container={container} />
          <InplaceTableHandles container={container} />
        </div>
        <UploadNotice status={status} onDismiss={() => setStatus(QUIET)} />
        <WhiteboardWorkspace container={container} />
        <InplaceToolbar />
        <InplaceLinkPopover />
      </DrawingProvider>
    </InplaceContext.Provider>
  );
}

/** The page's source, draft, roster, history and upload handlers, or null outside a page. */
export function useInplace() {
  return useContext(InplaceContext);
}

/**
 * How many blocks on this page read differently from the file they came from.
 *
 * Read through the draft's own subscription rather than React state, because
 * every editable block writes to that draft and a store that rerendered would
 * rerender the very elements ProseMirror has taken over. Only this number ever
 * reaches React, so a hundred keystrokes in one block rerender nothing.
 *
 * @example const changes = useChanges(); // 3
 */
export function useChanges() {
  const inplace = useInplace();
  const draft = inplace?.draft;
  const [changes, setChanges] = useState(0);

  useEffect(() => {
    if (!draft) return;
    const read = () => setChanges(draft.edits().size + (draft.replacement() === null ? 0 : 1));
    read();
    return draft.subscribe(read);
  }, [draft]);

  return changes;
}

const EMPTY_RECOVERY = { current: false, error: null, conflicts: [] };
const quietSubscribe = () => () => {};
const emptyRecovery = () => EMPTY_RECOVERY;

/** Reads comparison and recovery notices without updating the article. */
export function useRecovery() {
  const recovery = useInplace()?.recovery;
  return useSyncExternalStore(recovery?.subscribe ?? quietSubscribe, recovery?.get ?? emptyRecovery, emptyRecovery);
}

const nothingSelected = () => null;

/**
 * Whichever editor's selection is current anywhere on the page, or null where there is none or its editor is gone.
 *
 * @example const where = useTrackedSelection(); // { editor, from: 4, to: 9, empty: false, text: true }
 */
export function useTrackedSelection() {
  const tracker = useInplace()?.selection;
  const where = useSyncExternalStore(
    tracker?.subscribe ?? quietSubscribe,
    tracker?.get ?? nothingSelected,
    nothingSelected,
  );

  return where === null || where.editor.isDestroyed ? null : where;
}

/** Shows deployed content without attaching draft editors while comparing a whole-page draft. */
export function ReadOnlyPage({ children }: { children: ReactNode }) {
  return <InplaceContext.Provider value={null}>{children}</InplaceContext.Provider>;
}
