import { flatten, isComplete, restoreState } from "./start-model.js";

export const recordsKey = "heart-isle-long-term-records-v1";

export function emptyRecords() {
  return { version: 1, records: [], draft: null, drafts: {} };
}

export function makeRecord(title, note = "", next = "") {
  return {
    id: crypto.randomUUID(),
    title,
    note,
    next,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function validRecord(record) {
  return (
    record &&
    ["id", "title", "note", "next"].every(
      (key) => typeof record[key] === "string",
    ) &&
    ["active", "paused", "completed"].includes(record.status) &&
    Number.isFinite(Date.parse(record.createdAt)) &&
    Number.isFinite(Date.parse(record.updatedAt))
  );
}

export function restoreRecords(value) {
  if (
    value?.version !== 1 ||
    !Array.isArray(value.records) ||
    !value.records.every(validRecord)
  )
    return null;
  const ids = new Set(value.records.map((record) => record.id));
  if (ids.size !== value.records.length) return null;
  const draft = value.draft ?? null;
  if (
    draft &&
    (!(draft.id === null || ids.has(draft.id)) ||
      !["title", "note", "next"].every((key) => typeof draft[key] === "string"))
  )
    return null;
  const drafts = value.drafts ?? {};
  if (!drafts || typeof drafts !== "object" || Array.isArray(drafts))
    return null;
  for (const [key, entry] of Object.entries(drafts)) {
    if (
      !entry ||
      !(key === "new" || ids.has(key)) ||
      entry.id !== (key === "new" ? null : key) ||
      !["title", "note", "next"].every(
        (field) => typeof entry[field] === "string",
      )
    )
      return null;
  }
  if (draft) drafts[draft.id ?? "new"] = draft;
  return { ...value, draft, drafts };
}

// Import the earlier multi-goal prototype, keeping its complete task tree for recovery.
export function importNotebook(value) {
  if (value?.version !== 4 || !Array.isArray(value.goals)) return null;
  const store = emptyRecords();
  for (const goal of value.goals) {
    const session = restoreState(goal.session);
    if (
      !session ||
      typeof goal.reason !== "string" ||
      typeof goal.title !== "string"
    )
      return null;
    const leaves = flatten(session.nodes).filter(
      (item) => !item.children.length,
    );
    const completed = leaves.filter(isComplete).map((item) => item.title);
    const next = leaves.find((item) => !isComplete(item));
    const note = [goal.reason, ...completed.map((title) => "已完成 · " + title)]
      .filter(Boolean)
      .join("\n");
    const record = {
      ...goal,
      note,
      next: next?.title ?? "",
      legacySession: session,
    };
    delete record.session;
    store.records.push(record);
  }
  return restoreRecords(store);
}

export function loadRecords(storage, demo = false) {
  const key = demo ? recordsKey + "-demo" : recordsKey;
  const saved = storage.getItem(key);
  if (saved !== null) {
    const restored = restoreRecords(JSON.parse(saved));
    if (!restored) throw new Error("Invalid saved records");
    return restored;
  }
  const previousKey = demo
    ? "heart-isle-long-goals-demo"
    : "heart-isle-small-start-v1";
  const previous = storage.getItem(previousKey);
  if (previous) {
    const migrated = importNotebook(JSON.parse(previous));
    if (migrated) {
      storage.setItem(key, JSON.stringify(migrated));
      return migrated;
    }
  }
  return emptyRecords();
}
