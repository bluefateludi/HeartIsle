import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  initialState,
  buildPlan,
  flatten,
  isComplete,
  openDraft,
  applySplit,
  restoreState,
  deleteTask,
  deleteChecklist,
  undoDelete,
} from "../public/start-model.js";

function writingState() {
  const state = initialState();
  state.nodes = buildPlan("准备论文开题报告");
  state.screen = "tasks";
  return state;
}

test("preview and draft edits leave the task tree unchanged until confirmation", () => {
  const state = writingState();
  const original = structuredClone(state.nodes);
  const parent = state.nodes[0];
  openDraft(state, parent.id);
  assert.deepEqual(state.nodes, original);
  state.drafts[parent.id].items = ["记录关心的领域", "确定研究范围"];
  assert.deepEqual(state.nodes, original);
  assert.equal(applySplit(state, parent.id), "");
  assert.equal(parent.children.length, 2);
  assert.equal(state.nodes.length, original.length);
  assert.equal(state.drafts[parent.id], undefined);
  assert.ok(applySplit(state, parent.id));
  assert.equal(parent.children.length, 2);
});

test("canceling preview leaves the parent and other tasks intact", () => {
  const state = writingState();
  const original = structuredClone(state.nodes);
  openDraft(state, state.nodes[0].id);
  delete state.drafts[state.nodes[0].id];
  assert.deepEqual(state.nodes, original);
});

test("repeated, near-identical, parent and existing sibling titles are rejected atomically", () => {
  for (const text of [
    "先写一个词\n写一个词",
    "确定论文要回答的研究问题\n记录材料",
    "列出论文提纲\n记录材料",
    "只有一步",
  ]) {
    const state = writingState();
    const parent = state.nodes[0];
    openDraft(state, parent.id);
    state.drafts[parent.id].items = text.split("\n");
    assert.ok(applySplit(state, parent.id));
    assert.equal(parent.children.length, 0);
    assert.deepEqual(state.drafts[parent.id].items, text.split("\n"));
  }
});

test("all children determine completion and unchecking reopens the parent", () => {
  const state = writingState();
  const parent = state.nodes[0];
  openDraft(state, parent.id);
  assert.equal(applySplit(state, parent.id), "");
  parent.children[0].done = true;
  assert.equal(isComplete(parent), false);
  parent.children.forEach((item) => (item.done = true));
  assert.equal(isComplete(parent), true);
  parent.children[0].done = false;
  assert.equal(isComplete(parent), false);
});

test("concrete child actions lead to help instead of another automatic split", () => {
  const state = writingState();
  const parent = state.nodes[0];
  openDraft(state, parent.id);
  applySplit(state, parent.id);
  const child = parent.children[0];
  openDraft(state, child.id);
  assert.equal(state.drafts[child.id].mode, "help");
  assert.equal(child.children.length, 0);
  assert.ok(applySplit(state, child.id));
});

test("input, selection, multiple unfinished drafts and collapsed drafts survive reload", () => {
  const state = writingState();
  state.input = "正在输入的另一句话";
  state.mood = "energy";
  state.clarification = "还没写完";
  openDraft(state, state.nodes[0].id);
  openDraft(state, state.nodes[1].id);
  state.drafts[state.nodes[1].id].items = ["改到一半的第一项", ""];
  assert.deepEqual(restoreState(JSON.parse(JSON.stringify(state))), state);
  state.selectedId = null;
  assert.deepEqual(restoreState(JSON.parse(JSON.stringify(state))), state);
});

test("old flat preparation chains retain their unfinished parents and deduplicate repeats", () => {
  const state = restoreState({
    version: 2,
    goal: "写作",
    completed: ["打开文档"],
    pending: [
      { title: "先写一个词", detail: "", trail: ["写一句话"] },
      { title: "先写一个词", detail: "", trail: ["写一句话"] },
      { title: "写一句话", detail: "", trail: [] },
    ],
  });
  assert.equal(state.nodes[0].title, "写一句话");
  assert.equal(state.nodes[0].children.length, 2);
  assert.equal(isComplete(state.nodes[0]), false);
  assert.equal(
    flatten(state.nodes).filter((item) => item.title === "先写一个词").length,
    1,
  );
  assert.equal(state.nodes.at(-1).done, true);
  assert.ok(restoreState(state));
});

test("legacy countdown sessions migrate and malformed saved states are rejected", () => {
  const legacy = {
    version: 1,
    goal: "写作",
    steps: [
      ["打开文档", ""],
      ["写一句话", ""],
    ],
    index: 1,
    completed: ["打开文档"],
  };
  assert.equal(restoreState(legacy).nodes[0].title, "写一句话");
  assert.equal(restoreState({ ...legacy, index: 100 }), null);
  assert.equal(restoreState({ ...initialState(), nodes: [null] }), null);
});

test("manual nested splits preserve groups and cannot repeat an ancestor", () => {
  const state = writingState();
  const parent = state.nodes[0];
  openDraft(state, parent.id);
  applySplit(state, parent.id);
  const child = parent.children[0];
  openDraft(state, child.id);
  state.drafts[child.id].mode = "split";
  state.drafts[child.id].items = [parent.title, "补充想法"];
  assert.ok(applySplit(state, child.id));
  state.drafts[child.id].items = ["查看课程目录", "在纸上记下感兴趣的领域"];
  assert.equal(applySplit(state, child.id), "");
  assert.equal(child.children.length, 2);
});

test("completion entry points do not require starting a timer", () => {
  const script = readFileSync(
    new URL("../public/start.js", import.meta.url),
    "utf8",
  );
  const html = readFileSync(
    new URL("../public/start.html", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(script, /setInterval|startedAt|elapsedTime|startTimer/);
  assert.doesNotMatch(html, /role="timer"|开始这一小步|id="clock"/);
  assert.match(script, /checkbox\.addEventListener\(["']change["']/);
  assert.match(html, /data-save/);
});

test("legacy multiline drafts migrate to editable rows without losing unfinished content", () => {
  const state = writingState();
  const id = state.nodes[0].id;
  state.selectedId = id;
  state.drafts[id] = {
    mode: "split",
    text: "先阅读文章的摘要，提炼出一个关键词\r\n第二个小任务\r\n",
    difficulty: "",
    response: "",
  };
  const restored = restoreState(state);
  assert.deepEqual(restored.drafts[id].items, [
    "先阅读文章的摘要，提炼出一个关键词",
    "第二个小任务",
    "",
  ]);
  assert.equal(restored.selectedId, id);
  assert.equal("text" in restored.drafts[id], false);
  assert.equal(state.drafts[id].text.endsWith("\r\n"), true);
});

test("added, deleted and blank rows survive saving and only valid rows can be applied", () => {
  const state = writingState();
  const parent = state.nodes[0];
  openDraft(state, parent.id);
  const draft = state.drafts[parent.id];
  draft.items.splice(1, 1);
  draft.items.push("");
  const restored = restoreState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored.drafts[parent.id].items, draft.items);
  assert.match(applySplit(restored, parent.id), /第 3 项还没填写/);
  assert.equal(restored.nodes[0].children.length, 0);
  restored.drafts[parent.id].items[2] = "记录暂定的研究范围";
  assert.equal(applySplit(restored, parent.id), "");
  assert.deepEqual(
    restored.nodes[0].children.map((item) => item.title),
    [...draft.items.slice(0, 2), "记录暂定的研究范围"],
  );
});

test("deleting a task group removes its children and drafts, and undo survives reload", () => {
  const state = writingState();
  const parent = state.nodes[0];
  openDraft(state, parent.id);
  applySplit(state, parent.id);
  openDraft(state, parent.children[0].id);
  state.drafts[parent.children[0].id].difficulty = "还有一点没想清楚";
  const original = structuredClone(state.nodes);
  const drafts = structuredClone(state.drafts);
  assert.equal(deleteTask(state, parent.id), true);
  assert.equal(
    flatten(state.nodes).some((item) => item.id === parent.id),
    false,
  );
  assert.deepEqual(state.drafts, {});
  const restored = restoreState(JSON.parse(JSON.stringify(state)));
  assert.ok(restored);
  assert.equal(undoDelete(restored), true);
  assert.deepEqual(restored.nodes, original);
  assert.deepEqual(restored.drafts, drafts);
  assert.equal(restored.lastDeleted, null);
});

test("undoing a child deletion preserves subsequent edits to its siblings", () => {
  const state = writingState();
  const parent = state.nodes[0];
  openDraft(state, parent.id);
  applySplit(state, parent.id);
  const removed = parent.children[1];
  deleteTask(state, removed.id);
  parent.children[0].done = true;
  assert.equal(undoDelete(state), true);
  assert.equal(parent.children[1].id, removed.id);
  assert.equal(parent.children[0].done, true);
});

test("deleting and restoring a whole checklist preserves completed work and unfinished drafts", () => {
  const state = writingState();
  state.goal = "准备论文";
  state.nodes[0].done = true;
  openDraft(state, state.nodes[1].id);
  const original = structuredClone(state);
  deleteChecklist(state);
  assert.deepEqual(state.nodes, []);
  assert.deepEqual(state.drafts, {});
  assert.equal(state.goal, "");
  const restored = restoreState(JSON.parse(JSON.stringify(state)));
  assert.equal(undoDelete(restored), true);
  assert.deepEqual(restored, original);
});

test("deleting the last child returns its parent to an actionable task", () => {
  const state = writingState();
  const parent = state.nodes[0];
  openDraft(state, parent.id);
  applySplit(state, parent.id);
  while (parent.children.length) deleteTask(state, parent.children[0].id);
  assert.equal(isComplete(parent), false);
  assert.equal(undoDelete(state), true);
  assert.equal(parent.children.length, 1);
  assert.ok(restoreState(state));
});

test("invalid delete requests do not discard the last undo record", () => {
  const state = writingState();
  deleteTask(state, state.nodes[0].id);
  const deleted = structuredClone(state.lastDeleted);
  assert.equal(deleteTask(state, "missing"), false);
  assert.deepEqual(state.lastDeleted, deleted);
  state.lastDeleted.snapshot.nodes = [null];
  assert.equal(restoreState(state), null);
});
