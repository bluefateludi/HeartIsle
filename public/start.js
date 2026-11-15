import {
  initialState,
  buildPlan,
  needsClarification,
  flatten,
  isComplete,
  openDraft,
  applySplit,
  helpFor,
  restoreState,
  deleteTask,
  deleteChecklist,
  undoDelete,
} from "./start-model.js";

const $ = (id) => document.getElementById(id);
const storageKey = "heart-isle-small-start-v1";
let state = initialState();
let storageError = false;
try {
  const raw = localStorage.getItem(storageKey);
  if (raw) {
    const restored = restoreState(JSON.parse(raw));
    if (restored) state = restored;
    else storageError = true;
  }
} catch {
  storageError = true;
}

function save(explicit = false) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    storageError = false;
    $("save-status").textContent = explicit
      ? "已暂存，回来会恢复到这里。"
      : "已自动暂存";
  } catch {
    storageError = true;
    $("save-status").textContent =
      "暂存失败，浏览器存储不可用。请保持页面打开。";
  }
  $("save-status").classList.toggle("error", storageError);
}
function element(tag, className, text) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text) result.textContent = text;
  return result;
}
function button(text, className, handler) {
  const result = element("button", className, text);
  result.type = "button";
  result.addEventListener("click", handler);
  return result;
}
function announce(message) {
  $("task-status").textContent = message;
}
function selectTask(id) {
  state.selectedId = state.selectedId === id ? null : id;
  save();
  renderTasks();
  document.getElementById("select-" + id)?.focus({ preventScroll: true });
}
function draftList(draft, taskId, onEdit) {
  const container = element("div", "draft-list-editor");
  const list = element("ol", "draft-list");
  const add = button("＋ 添加小任务", "add-task", () =>
    insertRow(draft.items.length),
  );

  function changed(focusIndex) {
    save();
    onEdit();
    renderRows();
    list.querySelectorAll("input")[focusIndex]?.focus();
  }
  function insertRow(index) {
    draft.items.splice(index, 0, "");
    changed(index);
  }
  function renderRows() {
    list.replaceChildren(
      ...draft.items.map((title, index) => {
        const row = element("li", "draft-row");
        const number = element("span", "draft-number", String(index + 1));
        number.setAttribute("aria-hidden", "true");
        const input = element("input");
        input.type = "text";
        input.id = "draft-" + taskId + "-" + index;
        input.setAttribute("aria-label", "小任务 " + (index + 1));
        input.placeholder = "写一个具体的小动作";
        input.maxLength = 200;
        input.value = title;
        input.addEventListener("input", () => {
          draft.items[index] = input.value;
          onEdit();
          save();
        });
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter" && !event.isComposing) {
            event.preventDefault();
            insertRow(index + 1);
          }
        });
        const remove = button("删除", "remove-task", () => {
          draft.items.splice(index, 1);
          if (!draft.items.length) draft.items.push("");
          changed(Math.min(index, draft.items.length - 1));
        });
        remove.setAttribute("aria-label", "删除小任务 " + (index + 1));
        row.append(number, input, remove);
        return row;
      }),
    );
  }
  renderRows();
  container.append(list, add);
  return container;
}
function renderEditor(item) {
  const editor = element("div", "step-editor");
  editor.id = "editor-" + item.id;
  const heading = element("div", "editor-heading");
  heading.append(element("p", "editing-label", "正在处理 · " + item.title));
  const remove = button(
    item.children.length ? "删除任务组" : "删除任务",
    "quiet danger",
    () => {
      deleteTask(state, item.id);
      save();
      render();
      $("undo-delete").focus({ preventScroll: true });
    },
  );
  remove.title = item.children.length
    ? "删除这一组及其子任务，可撤销"
    : "删除这项任务，可撤销";
  heading.append(remove);
  editor.append(heading);
  if (item.detail) editor.append(element("p", "description", item.detail));
  if (item.children.length || item.done) {
    editor.append(
      element(
        "p",
        "description",
        item.children.length
          ? "勾选下面的小任务后，这一组会自动完成。"
          : "这一步已完成，可以取消勾选继续调整。",
      ),
    );
    return editor;
  }
  const draft = state.drafts[item.id];
  if (!draft) {
    return editor;
  }
  if (draft.mode === "split") {
    editor.append(element("h3", "", "这样拆开，可以吗？"));
    const description = element(
      "p",
      "description",
      "可以修改、添加或删除小任务，确认它们合起来能完成这件事。",
    );
    const error = element("p", "status error");
    error.setAttribute("role", "status");
    const rows = draftList(draft, item.id, () => {
      error.textContent = "";
    });
    const actions = element("div", "actions");
    actions.append(
      button("暂存", "secondary", () => save(true)),
      button("确认拆解", "primary", () => {
        const message = applySplit(state, item.id);
        if (message) {
          error.textContent = message;
          return;
        }
        save();
        renderTasks();
        announce("已确认拆解，子任务全部完成后，这一组会自动完成。");
        document
          .getElementById("select-" + state.selectedId)
          ?.focus({ preventScroll: true });
      }),
      button("取消拆解", "quiet", () => {
        delete state.drafts[item.id];
        save();
        renderTasks();
        announce("已取消这份拆解草稿。");
      }),
      button("收起", "quiet", () => selectTask(item.id)),
    );
    editor.append(description, rows, actions, error);
  } else {
    editor.append(element("h3", "", "具体卡在哪里？"));
    editor.append(
      element("p", "description", "写下现在遇到的困难，我们一起找个办法。"),
    );
    const label = element("label", "", "遇到的困难");
    label.htmlFor = "difficulty-" + item.id;
    const input = element("textarea");
    input.id = label.htmlFor;
    input.maxLength = 1000;
    input.placeholder = "比如，找不到文件，或不知道应该写什么……";
    input.value = draft.difficulty;
    input.addEventListener("input", () => {
      draft.difficulty = input.value;
      save();
    });
    const response = element("p", "help-response", draft.response);
    response.setAttribute("role", "status");
    const actions = element("div", "actions");
    actions.append(
      button("暂存", "secondary", () => save(true)),
      button("帮我想个办法", "primary", () => {
        if (!draft.difficulty.trim()) {
          response.textContent = "写一句现在遇到的困难就可以。";
          input.focus();
          return;
        }
        draft.response = helpFor(draft.difficulty);
        response.textContent = draft.response;
        save();
      }),
      button("自己写拆解", "quiet", () => {
        draft.mode = "split";
        save();
        renderTasks();
      }),
      button("收起", "quiet", () => selectTask(item.id)),
    );
    editor.append(label, input, actions, response);
  }
  return editor;
}
function taskList(items, nested = false) {
  const list = element("ul", nested ? "task-children" : "task-list");
  for (const item of items) {
    const selected = state.selectedId === item.id;
    const complete = isComplete(item);
    const row = element("li", "task-item");
    row.classList.toggle("selected", selected);
    row.classList.toggle("complete", complete);
    const header = element("div", "task-row");
    const checkbox = element("input");
    checkbox.type = "checkbox";
    checkbox.checked = complete;
    checkbox.disabled = item.children.length > 0;
    checkbox.setAttribute(
      "aria-label",
      (item.children.length ? "分组完成状态 · " : "完成 · ") + item.title,
    );
    checkbox.addEventListener("change", () => {
      item.done = checkbox.checked;
      if (item.done)
        state.selectedId =
          flatten(state.nodes).find(
            (next) => !next.children.length && !next.done,
          )?.id ?? null;
      save();
      renderTasks();
      announce(
        item.done
          ? "已完成“" + item.title + "”。"
          : "已恢复“" + item.title + "”。",
      );
      document
        .getElementById("select-" + (state.selectedId ?? item.id))
        ?.focus({ preventScroll: true });
    });
    const title = button(item.title, "task-select", () => selectTask(item.id));
    title.id = "select-" + item.id;
    title.setAttribute("aria-expanded", String(selected));
    if (selected) title.setAttribute("aria-controls", "editor-" + item.id);
    header.append(checkbox, title);
    if (!complete && !item.children.length) {
      const stuck = button("我卡住了", "stuck-button", () => {
        openDraft(state, item.id);
        save();
        renderTasks();
      });
      stuck.setAttribute("aria-label", "我卡住了 · " + item.title);
      header.append(stuck);
    }
    row.append(header);
    if (selected) row.append(renderEditor(item));
    if (item.children.length) row.append(taskList(item.children, true));
    list.append(row);
  }
  return list;
}
function renderTasks() {
  $("task-status").textContent = "";
  $("goal-summary").textContent = state.goal;
  $("task-tree").replaceChildren(taskList(state.nodes));
  const leaves = flatten(state.nodes).filter((item) => !item.children.length);
  const completed = leaves.filter(isComplete).length;
  $("progress").textContent = leaves.length
    ? "已完成 " + completed + " / " + leaves.length
    : "";
  $("all-done").hidden = !leaves.length || completed !== leaves.length;
  $("clarify-form").hidden = !state.needsClarification;
  $("clarification").value = state.clarification;
  $("task-tree").hidden = state.needsClarification;
  $("empty-list").hidden = state.nodes.length > 0 || state.needsClarification;
  $("delete-list").hidden = !state.nodes.length && !state.needsClarification;
  $("deleted-notice").hidden = !state.lastDeleted;
  if (state.lastDeleted) {
    const deleted = state.lastDeleted;
    const title =
      deleted.kind === "list"
        ? deleted.snapshot.goal || "当前清单"
        : deleted.snapshot.nodes[0].title;
    $("deleted-message").textContent =
      "已删除“" + title + "”。可以撤销最近一次删除。";
  }
}
function render() {
  $("input-panel").hidden = state.screen !== "input";
  $("tasks-panel").hidden = state.screen !== "tasks";
  $("task").value = state.input;
  $("count").textContent = state.input.length + " / 1000";
  $("resume").hidden = !state.nodes.length && !state.needsClarification;
  document
    .querySelectorAll("[data-mood]")
    .forEach((item) =>
      item.setAttribute(
        "aria-pressed",
        String(item.dataset.mood === state.mood),
      ),
    );
  renderTasks();
}
$("task").addEventListener("input", () => {
  state.input = $("task").value;
  $("count").textContent = state.input.length + " / 1000";
  save();
});
document.querySelectorAll("[data-mood]").forEach((item) =>
  item.addEventListener("click", () => {
    state.mood = state.mood === item.dataset.mood ? "" : item.dataset.mood;
    save();
    render();
  }),
);
document.querySelectorAll("[data-example]").forEach((item) =>
  item.addEventListener("click", () => {
    state.input = item.dataset.example;
    save();
    render();
    $("task").focus();
  }),
);
$("task-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const goal = state.input.trim();
  if (!goal) {
    $("input-error").textContent = "写一句想推进的事情就可以。";
    return;
  }
  state.goal = goal;
  state.lastDeleted = null;
  state.nodes = [];
  state.drafts = {};
  state.selectedId = null;
  state.clarification = "";
  state.needsClarification = needsClarification(goal);
  if (!state.needsClarification) state.nodes = buildPlan(goal);
  state.selectedId = state.nodes[0]?.id ?? null;
  if (state.mood === "energy" && state.nodes.length)
    state.nodes[0].detail += " 今天先碰这一项就可以，随时可以暂存。";
  if (state.mood === "fear" && state.nodes.length)
    state.nodes[0].detail += " 先留一个可以修改的版本。";
  state.screen = "tasks";
  save();
  render();
  $("tasks-title").focus();
});
$("clarification").addEventListener("input", () => {
  state.clarification = $("clarification").value;
  save();
});
$("clarify-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const goal = state.clarification.trim();
  if (!goal) {
    $("clarify-error").textContent = "写下一件此刻想到的小事。";
    return;
  }
  state.goal = goal;
  state.nodes = buildPlan(goal);
  state.needsClarification = false;
  state.selectedId = state.nodes[0]?.id ?? null;
  save();
  render();
  $("tasks-title").focus();
});
document
  .querySelectorAll("[data-save]")
  .forEach((item) => item.addEventListener("click", () => save(true)));
$("resume").addEventListener("click", () => {
  state.screen = "tasks";
  save();
  render();
});
$("back-input").addEventListener("click", () => {
  state.screen = "input";
  save();
  render();
});
$("delete-list").addEventListener("click", () => {
  deleteChecklist(state);
  save();
  render();
  $("undo-delete").focus({ preventScroll: true });
});
$("undo-delete").addEventListener("click", () => {
  if (!undoDelete(state)) return;
  save();
  render();
  announce("已恢复删除的任务和草稿。");
});
window.addEventListener("storage", (event) => {
  if (event.key !== storageKey || !event.newValue) return;
  try {
    const restored = restoreState(JSON.parse(event.newValue));
    if (restored) {
      state = restored;
      render();
      $("save-status").textContent = "已同步另一页面暂存的进度。";
    }
  } catch {
    /* Keep the current draft when another tab writes invalid data. */
  }
});
render();
if (state.screen === "tasks" && state.selectedId) {
  requestAnimationFrame(() => {
    document
      .getElementById("select-" + state.selectedId)
      ?.scrollIntoView({ block: "center" });
  });
}
$("save-status").textContent = storageError
  ? "上次的暂存暂时无法读取，请保持原浏览器数据。"
  : "随时暂存，回来接着做。";
