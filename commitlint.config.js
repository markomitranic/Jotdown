/**
 * Checks every commit subject against the conventional-commit grammar.
 *
 * The release reads these subjects to decide the next version and to write the
 * changelog page, so a subject typed `feature:` or `feat (auth):` is not a
 * style slip: it lands in the hidden pile, and a release that should have moved
 * the minor moves the patch instead, silently, in every site that syncs it.
 */
export default { extends: ["@commitlint/config-conventional"] };
