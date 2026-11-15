import {
  emptyRecords,
  loadRecords,
  makeRecord,
  recordsKey,
} from "./long-term-model.js";

const $ = (id) => document.getElementById(id);
const demo = new URLSearchParams(location.search).get("demo") === "1";
const storageKey = demo ? recordsKey + "-demo" : recordsKey;
let store = emptyRecords();
let readFailed = false;
try {
  store = loadRecords(localStorage, demo);
} catch {
  readFailed = true;
  $("record-status").textContent =
    "记录暂时无法读取，请保留浏览器数据，稍后重新打开。";
  $("record-status").classList.add("error");
}
if (demo && !store.records.length && !readFailed) {
  store.records = [
    makeRecord(
      "准备考研",
      "已看完第一章，整理了这一章的笔记。",
      "读第二章的第一小节",
    ),
    makeRecord(
      "准备换工作",
      "已经找到旧简历，最近一段工作经历还需要补充。",
      "写下最近做过的一件工作",
    ),
    makeRecord(
      "做一个自己的项目",
      "先把想到的几个方向记下来了。",
      "选一个最想试的想法",
    ),
  ];
}

function persist(message = "已自动保存") {
  try {
    localStorage.setItem(storageKey, JSON.stringify(store));
    $("record-status").textContent = message;
    $("record-status").classList.remove("error");
    return true;
  } catch {
    $("record-status").textContent =
      "保存失败，请保持页面打开，记录暂时保留在这里。";
    $("record-status").classList.add("error");
    return false;
  }
}

function element(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text) item.textContent = text;
  return item;
}

function editRecord(record = null) {
  if (readFailed) return;
  const key = record?.id ?? "new";
  store.draft =
    store.drafts[key] ??
    (record
      ? {
          id: record.id,
          title: record.title,
          note: record.note,
          next: record.next,
        }
      : { id: null, title: "", note: "", next: "" });
  store.drafts[key] = store.draft;
  renderEditor();
  persist("正在编辑，草稿已保存");
  $("record-title").focus();
}

function renderEditor() {
  const draft = store.draft;
  $("record-form").hidden = !draft;
  if (!draft) return;
  $("editor-title").textContent = draft.id
    ? "更新这件事的记录"
    : "记一件长期想做的事";
  $("record-title").value = draft.title;
  $("record-note").value = draft.note;
  $("record-next").value = draft.next;
  $("form-error").textContent = "";
}

function renderRecords() {
  const labels = { active: "已记录", paused: "暂时放下", completed: "已完成" };
  const records = store.records.toSorted(
    (a, b) =>
      Number(a.status === "completed") - Number(b.status === "completed"),
  );
  $("empty-records").hidden = records.length > 0 || readFailed;
  $("demo-notice").hidden = !demo;
  $("add-record").disabled = readFailed;
  $("records").replaceChildren(
    ...records.map((record) => {
      const card = element("article", "record-card");
      const meta = element("div", "record-meta");
      meta.append(element("span", "", labels[record.status]));
      const time = element(
        "time",
        "",
        new Intl.DateTimeFormat("zh-CN", {
          month: "long",
          day: "numeric",
          timeZone: "Asia/Hong_Kong",
        }).format(new Date(record.updatedAt)) + " 更新",
      );
      time.dateTime = record.updatedAt;
      meta.append(time);
      card.append(meta, element("h3", "", record.title));
      if (record.note) card.append(element("p", "record-note", record.note));
      if (record.next)
        card.append(element("p", "record-next", "下一步 · " + record.next));
      const actions = element("div", "actions");
      const edit = element("button", "secondary", "更新记录");
      edit.type = "button";
      edit.addEventListener("click", () => {
        editRecord(record);
      });
      const done = element(
        "button",
        "quiet",
        record.status === "completed" ? "重新记录" : "标记完成",
      );
      done.type = "button";
      done.addEventListener("click", () => {
        record.status = record.status === "completed" ? "active" : "completed";
        record.updatedAt = new Date().toISOString();
        persist();
        renderRecords();
      });
      actions.append(edit, done);
      card.append(actions);
      return card;
    }),
  );
}

$("add-record").addEventListener("click", () => editRecord());
$("close-editor").addEventListener("click", () => {
  $("record-form").hidden = true;
  persist("草稿已保存，下次可以接着写");
});
for (const field of ["title", "note", "next"]) {
  $("record-" + field).addEventListener("input", (event) => {
    store.draft[field] = event.target.value;
    $("form-error").textContent = "";
    persist();
  });
}
$("record-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const draft = store.draft;
  if (!draft.title.trim()) {
    $("form-error").textContent = "写下想做的一件事就可以。";
    $("record-title").focus();
    return;
  }
  const existing = store.records.find((record) => record.id === draft.id);
  if (existing) {
    existing.title = draft.title.trim();
    existing.note = draft.note.trim();
    existing.next = draft.next.trim();
    existing.updatedAt = new Date().toISOString();
  } else {
    store.records.unshift(
      makeRecord(draft.title.trim(), draft.note.trim(), draft.next.trim()),
    );
  }
  delete store.drafts[draft.id ?? "new"];
  store.draft = null;
  persist("记录已保存");
  renderEditor();
  renderRecords();
});
renderRecords();
renderEditor();
