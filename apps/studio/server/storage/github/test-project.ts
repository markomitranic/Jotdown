/**
 * The repository every GitHub test pretends to edit, as the editing route would pin it.
 *
 * Tests replace the editing context module with this, so a store call finds a
 * project and a token without a request or a session around it.
 */
export const testEditing = {
  editingContext: {
    getStore: () => ({
      remote: { owner: "test-owner", repo: "test-repo", subfolder: "", uploads: "docs/_uploads", branch: "main" },
      session: { token: "test-token" },
    }),
  },
};
