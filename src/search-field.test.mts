import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSearchFieldState,
  editSearchField,
  reconcileSearchField,
  submitSearchField,
} from "./components/search-field-state.ts";

test("editing a search draft does not change the applied query", () => {
  const state = editSearchField(createSearchFieldState("applied"), "draft");
  assert.equal(state.appliedQuery, "applied");
  assert.equal(state.draft, "draft");
  assert.deepEqual(state.pendingSubmissions, []);
});

test("submission trims the draft and resets no URL state itself", () => {
  const result = submitSearchField(
    editSearchField(createSearchFieldState("old"), "  new query  "),
  );
  assert.equal(result.query, "new query");
  assert.equal(result.state.appliedQuery, "old");
  assert.deepEqual(result.state.pendingSubmissions, ["new query"]);
});

test("an acknowledged navigation never overwrites a newer draft", () => {
  let state = createSearchFieldState("");
  state = editSearchField(state, "abc");
  state = submitSearchField(state).state;
  state = editSearchField(state, "abcdef");

  state = reconcileSearchField(state, "abc");
  assert.equal(state.appliedQuery, "abc");
  assert.equal(state.draft, "abcdef");
  assert.deepEqual(state.pendingSubmissions, []);
});

test("successive submissions ignore intermediate acknowledgements", () => {
  let state = createSearchFieldState("");
  state = editSearchField(state, "A");
  state = submitSearchField(state).state;
  state = editSearchField(state, "B");
  state = submitSearchField(state).state;

  state = reconcileSearchField(state, "A");
  assert.equal(state.draft, "B");
  assert.deepEqual(state.pendingSubmissions, ["B"]);

  state = reconcileSearchField(state, "B");
  assert.equal(state.draft, "B");
  assert.deepEqual(state.pendingSubmissions, []);
});

test("a stale acknowledgement after a later submission is acknowledged does not replace the draft", () => {
  let state = createSearchFieldState("");
  state = editSearchField(state, "A");
  state = submitSearchField(state).state;
  state = editSearchField(state, "B");
  state = submitSearchField(state).state;
  state = editSearchField(state, "newer draft");

  state = reconcileSearchField(state, "B");
  assert.deepEqual(state.staleAcknowledgements, ["A"]);
  assert.equal(state.draft, "newer draft");

  state = reconcileSearchField(state, "A");
  assert.equal(state.appliedQuery, "B");
  assert.equal(state.draft, "newer draft");
  assert.deepEqual(state.staleAcknowledgements, []);
});

test("history restores a previously submitted query instead of treating it as a stale acknowledgement", () => {
  let state = createSearchFieldState("");
  state = editSearchField(state, "A");
  state = submitSearchField(state).state;
  state = editSearchField(state, "B");
  state = submitSearchField(state).state;
  state = editSearchField(state, "newer draft");

  state = reconcileSearchField(state, "B");
  state = reconcileSearchField(state, "A", { isHistoryNavigation: true });

  assert.equal(state.appliedQuery, "A");
  assert.equal(state.draft, "A");
  assert.deepEqual(state.pendingSubmissions, []);
  assert.deepEqual(state.staleAcknowledgements, []);
});

test("empty submissions clear the applied query and repeated pending submissions do not navigate", () => {
  let state = createSearchFieldState("active");
  state = editSearchField(state, "");
  const clear = submitSearchField(state);
  assert.equal(clear.query, "");

  const duplicate = submitSearchField(clear.state);
  assert.equal(duplicate.query, null);

  const acknowledged = reconcileSearchField(clear.state, "");
  assert.equal(acknowledged.draft, "");
  assert.equal(acknowledged.appliedQuery, "");
});

test("history and explicit resets replace the draft after pending submissions settle", () => {
  let state = createSearchFieldState("current");
  state = editSearchField(state, "unsubmitted");
  assert.equal(reconcileSearchField(state, "current").draft, "unsubmitted");

  state = reconcileSearchField(state, "history");
  assert.equal(state.draft, "history");
  assert.deepEqual(state.pendingSubmissions, []);
});

test("composition Enter and a blocked submission do not navigate or queue a later search", () => {
  const state = editSearchField(createSearchFieldState(""), "draft");

  const composing = submitSearchField(state, {
    disabled: false,
    isComposing: true,
  });
  assert.equal(composing.query, null);
  assert.deepEqual(composing.state.pendingSubmissions, []);

  const blocked = submitSearchField(state, {
    disabled: true,
    isComposing: false,
  });
  assert.equal(blocked.query, null);
  assert.deepEqual(blocked.state.pendingSubmissions, []);
});
