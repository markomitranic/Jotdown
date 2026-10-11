import { describe, expect, it } from "vitest";
import { createHistory, type Change } from "./history";

/** A change that writes its own name down, so an entry's order is readable. */
function noted(log: string[], name: string): Change {
  return {
    undo: () => log.push(`-${name}`),
    redo: () => log.push(`+${name}`),
  };
}

/** A clock the test moves by hand, so grouping does not depend on how fast it runs. */
function clock() {
  let at = 0;
  return { now: () => at, pass: (ms: number) => (at += ms) };
}

describe("createHistory", () => {
  it("undoes one change at a time, newest first", () => {
    const log: string[] = [];
    const history = createHistory();

    history.did(noted(log, "one"));
    history.did(noted(log, "two"));

    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(false);
    expect(log).toEqual(["-two", "-one"]);
  });

  it("puts back what an undo reversed, oldest first", () => {
    const log: string[] = [];
    const history = createHistory();

    history.did(noted(log, "one"));
    history.did(noted(log, "two"));
    history.undo();
    history.undo();
    log.length = 0;

    history.redo();
    history.redo();
    expect(history.redo()).toBe(false);
    expect(log).toEqual(["+one", "+two"]);
  });

  it("forgets the redos once something new happens", () => {
    const history = createHistory();

    history.did(noted([], "one"));
    history.undo();
    history.did(noted([], "two"));

    expect(history.redo()).toBe(false);
  });

  it("grows one entry while the same editor keeps typing", () => {
    const log: string[] = [];
    const time = clock();
    const history = createHistory(time.now);
    const editor = {};

    history.did({ undo: () => log.push("-first"), redo: () => log.push("+first") }, editor);
    time.pass(100);
    history.did({ undo: () => log.push("-second"), redo: () => log.push("+second") }, editor);

    history.undo();
    expect(log).toEqual(["-first"]);

    history.redo();
    expect(log).toEqual(["-first", "+second"]);
  });

  it("starts a new entry once the reader has paused", () => {
    const log: string[] = [];
    const time = clock();
    const history = createHistory(time.now);
    const editor = {};

    history.did(noted(log, "one"), editor);
    time.pass(5000);
    history.did(noted(log, "two"), editor);

    history.undo();
    expect(log).toEqual(["-two"]);
  });

  it("keeps two editors' typing apart", () => {
    const log: string[] = [];
    const history = createHistory(() => 0);

    history.did(noted(log, "here"), {});
    history.did(noted(log, "there"), {});

    history.undo();
    expect(log).toEqual(["-there"]);
  });

  it("undoes everything a batch did as one, in reverse", () => {
    const log: string[] = [];
    const history = createHistory();

    history.batch(() => {
      history.did(noted(log, "tail"));
      history.did(noted(log, "block"));
    });

    expect(history.undo()).toBe(true);
    expect(log).toEqual(["-block", "-tail"]);

    log.length = 0;
    history.redo();
    expect(log).toEqual(["+tail", "+block"]);
  });

  it("fences a batch off from the typing on either side of it", () => {
    const log: string[] = [];
    const history = createHistory(() => 0);
    const editor = {};

    history.did(noted(log, "typed"), editor);
    history.batch(() => history.did(noted(log, "split"), editor));
    history.did(noted(log, "typed again"), editor);

    history.undo();
    expect(log).toEqual(["-typed again"]);

    history.undo();
    expect(log).toEqual(["-typed again", "-split"]);

    history.undo();
    expect(log).toEqual(["-typed again", "-split", "-typed"]);
  });

  it("records nothing that an undo itself causes", () => {
    const log: string[] = [];
    const history = createHistory();

    history.did({
      undo: () => {
        log.push("-echo");
        history.did(noted(log, "caused"));
      },
      redo: () => log.push("+echo"),
    });

    history.undo();
    expect(log).toEqual(["-echo"]);
    expect(history.undo()).toBe(false);
  });

  it("records nothing for a batch that did nothing", () => {
    const history = createHistory();

    history.batch(() => {});
    expect(history.undo()).toBe(false);
  });

  it("folds a batch even when its body throws", () => {
    const log: string[] = [];
    const history = createHistory();

    expect(() =>
      history.batch(() => {
        history.did(noted(log, "half"));
        throw new Error("picker went away");
      }),
    ).toThrow("picker went away");

    history.undo();
    expect(log).toEqual(["-half"]);
    expect(history.undo()).toBe(false);
  });
});
