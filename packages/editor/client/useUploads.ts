"use client";

import { useCallback, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { extensionOf } from "@jotdown/core/components/blocks/FileAttachment";
import type { Upload } from "../types";
import { useDocTarget, useLiveEditConfig, uploadAsset, type AssetUpload } from "./api";
import type { EditorIdentity } from "./identity";

/**
 * How a picture or a file picked in the browser gets into the repository.
 *
 * Both routes commit the file they are handed byte for byte; whether a big
 * picture is compressed first was asked before it got here. Both commit it on
 * its own, before any block pointing at it is written, so a page that is never saved still leaves the file behind rather
 * than a document referring to bytes nobody has. A reader with no identity gets
 * handlers that refuse, because the commit has nobody to sign it.
 *
 * @example const { uploadImage, uploadFile } = useUploads(identity);
 */
export function useUploads(identity: EditorIdentity | null) {
  const { apiBase } = useLiveEditConfig();
  const { path } = useDocTarget();
  const { mutateAsync: commit } = useMutation({ mutationFn: (upload: AssetUpload) => uploadAsset(apiBase, upload) });
  const send = useCallback(
    (upload: AssetUpload) =>
      commit(upload).then(
        ({ url }) => ({ ok: true as const, url }),
        (failure: Error) => ({ ok: false as const, error: failure.message }),
      ),
    [commit],
  );

  // The page being edited goes along only to name the commit.
  const uploadImage = useCallback<Upload>(
    async (file) => {
      if (identity === null) return unsigned;
      return send({ path, author: identity, file, kind: "image" });
    },
    [path, identity, send],
  );

  const uploadFile = useCallback<Upload>(
    async (file) => {
      if (identity === null) return unsigned;
      return send({ path, author: identity, file, kind: "file", ext: extensionOf(file.name) });
    },
    [path, identity, send],
  );

  return useMemo(() => ({ uploadImage, uploadFile }), [uploadImage, uploadFile]);
}

const unsigned = {
  ok: false as const,
  error: "Sign in with GitHub before adding a file, so the commit has an author.",
};
