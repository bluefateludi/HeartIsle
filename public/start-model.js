const recipes = {
  question: [
    "写下一个感兴趣的研究方向",
    "列出这个方向里想弄清楚的问题",
    "选一个问题，写成一句问句",
  ],
  sources: [
    "从研究问题里提取两个关键词",
    "用关键词找到三篇相关文献",
    "读摘要，记下每篇与问题的关系",
  ],
  outline: [
    "写下文章要表达的核心观点",
    "列出支持观点的三个小标题",
    "给每个小标题留一句内容提示",
  ],
  draft: [
    "对照提纲写第一部分的草稿",
    "补上其余部分的主要内容",
    "通读草稿，标出需要补充的位置",
  ],
  resume: [
    "记录最近一段工作的职责",
    "补充一件工作成果和具体细节",
    "把这些内容放入简历并保存",
  ],
  tidy: [
    "拿走这一小块地方的垃圾",
    "把常用物品放回固定位置",
    "把暂时拿不准的物品集中放好",
  ],
  learn: ["读这一小节的第一段", "接着读完这一小节", "用自己的话记下一个要点"],
};

export function node(title, detail = "", recipe = null) {
  return {
    id: crypto.randomUUID(),
    title,
    detail,
    recipe,
    done: false,
    children: [],
  };
}

export function initialState() {
  return {
    version: 3,
    screen: "input",
    input: "",
    mood: "",
    goal: "",
    nodes: [],
    selectedId: null,
    drafts: {},
    clarification: "",
    needsClarification: false,
    lastDeleted: null,
  };
}

export function buildPlan(text) {
  if (/论文|开题/.test(text))
    return [
      node(
        "确定论文要回答的研究问题",
        "先找到一个想弄清楚的问题。",
        "question",
      ),
      node("找到并整理相关文献", "围绕研究问题收集有用的资料。", "sources"),
      node("列出论文提纲", "把想说的内容安排成几个部分。", "outline"),
      node("写出一版论文草稿", "对照提纲留下一个可以修改的版本。", "draft"),
    ];
  if (/邮件|消息/.test(text))
    return [
      node("打开需要回复的那条消息", "先读一遍对方的问题。"),
      node("写一句最想回复的话", "先留在草稿里。"),
      node("检查回复，确认信息后发送", "由你决定合适的发送时机。"),
    ];
  if (/简历|求职|换工作/.test(text))
    return [
      node("找到并打开旧简历"),
      node("更新最近一段工作经历", "记录职责与具体成果。", "resume"),
      node("检查联系方式并保存简历"),
    ];
  if (/房间|收拾|打扫/.test(text))
    return [
      node("选眼前的一小块地方", "桌面的一角或一张椅子都可以。"),
      node("收拾选好的这一小块地方", "让这块位置可以使用。", "tidy"),
      node("看一眼整理后的空间", "这一小块完成就可以停。"),
    ];
  if (/学习|复习|考试|课|读书/.test(text))
    return [
      node("打开今天要看的学习材料"),
      node("学完一个小节", "先选眼前的一个小节。", "learn"),
      node("标记下次开始的位置"),
    ];
  if (/写|文章|报告|方案|汇报/.test(text))
    return [
      node("打开一个空白文档", "起一个临时名字，保存下来。"),
      node("列出内容提纲", "整理要表达的内容。", "outline"),
      node("写出一版草稿", "先留一个可以修改的版本。", "draft"),
    ];
  return [node(text, "可以勾选完成，或点击这一项说明你卡在哪里。")];
}

export function needsClarification(text) {
  return /不知道.*做什么|没.*想清楚|好多事|很多事|没.*目标/.test(text);
}
export function flatten(nodes) {
  return nodes.flatMap((item) => [item, ...flatten(item.children)]);
}
export function findNode(state, id) {
  return flatten(state.nodes).find((item) => item.id === id);
}
function findPosition(nodes, id, parentId = null) {
  for (let index = 0; index < nodes.length; index++) {
    if (nodes[index].id === id) return { siblings: nodes, index, parentId };
    const found = findPosition(nodes[index].children, id, nodes[index].id);
    if (found) return found;
  }
  return null;
}

export function deleteTask(state, id) {
  const position = findPosition(state.nodes, id);
  if (!position) return false;
  const removed = position.siblings[position.index];
  const removedIds = new Set(flatten([removed]).map((item) => item.id));
  const snapshot = initialState();
  snapshot.nodes = [structuredClone(removed)];
  snapshot.drafts = Object.fromEntries(
    Object.entries(state.drafts).filter(([key]) => removedIds.has(key)),
  );
  snapshot.selectedId = removedIds.has(state.selectedId)
    ? state.selectedId
    : removed.id;
  state.lastDeleted = {
    kind: "task",
    snapshot: structuredClone(snapshot),
    parentId: position.parentId,
    index: position.index,
  };
  position.siblings.splice(position.index, 1);
  for (const key of removedIds) delete state.drafts[key];
  if (removedIds.has(state.selectedId)) state.selectedId = position.parentId;
  return true;
}

export function deleteChecklist(state) {
  const snapshot = structuredClone({ ...state, lastDeleted: null });
  state.lastDeleted = { kind: "list", snapshot, parentId: null, index: 0 };
  state.nodes = [];
  state.drafts = {};
  state.selectedId = null;
  state.goal = "";
  state.needsClarification = false;
  state.clarification = "";
}

export function undoDelete(state) {
  const deleted = state.lastDeleted;
  if (!deleted) return false;
  const snapshot = structuredClone(deleted.snapshot);
  if (deleted.kind === "list") {
    state.nodes = snapshot.nodes;
    state.drafts = snapshot.drafts;
    state.goal = snapshot.goal;
    state.clarification = snapshot.clarification;
    state.needsClarification = snapshot.needsClarification;
  } else {
    const parent = deleted.parentId ? findNode(state, deleted.parentId) : null;
    if (deleted.parentId && !parent) return false;
    const siblings = parent ? parent.children : state.nodes;
    siblings.splice(deleted.index, 0, snapshot.nodes[0]);
    Object.assign(state.drafts, snapshot.drafts);
  }
  state.selectedId = snapshot.selectedId;
  state.screen = "tasks";
  state.lastDeleted = null;
  return true;
}
export function isComplete(item) {
  return item.children.length ? item.children.every(isComplete) : item.done;
}
export function normalizeTitle(title) {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/^\s*\d+[.、)）]\s*/, "")
    .replace(/首先|先|一下|一个|一份|一张/g, "")
    .replace(/[\s\p{P}\p{S}]/gu, "");
}
export function openDraft(state, id) {
  const current = findNode(state, id);
  if (!current || current.children.length || current.done) return;
  state.selectedId = id;
  if (state.drafts[id]) return;
  const suggestions = recipes[current.recipe];
  state.drafts[id] = {
    mode: suggestions ? "split" : "help",
    items: suggestions ? [...suggestions] : [""],
    difficulty: "",
    response: "",
  };
}
export function applySplit(state, id) {
  const current = findNode(state, id);
  const draft = state.drafts[id];
  if (
    !current ||
    current.children.length ||
    current.done ||
    draft?.mode !== "split"
  )
    return "这一步的状态已经变化，请重新选择。";
  const titles = draft.items.map((title) => title.trim());
  const emptyIndex = titles.findIndex((title) => !title);
  if (emptyIndex !== -1)
    return "第 " + (emptyIndex + 1) + " 项还没填写，可以补上内容或删除这一项。";
  if (titles.length < 2) return "请添加至少两个能共同完成原步骤的小任务。";
  if (titles.some((title) => title.length > 200 || !normalizeTitle(title)))
    return "请把每个小步骤写成一句具体的动作，最多 200 字。";
  const existing = new Set(
    flatten(state.nodes).map((item) => normalizeTitle(item.title)),
  );
  for (const title of titles) {
    const normalized = normalizeTitle(title);
    if (existing.has(normalized))
      return "“" + title + "”与已有步骤或另一条建议重复，请修改后再确认。";
    existing.add(normalized);
  }
  // Apply the whole draft atomically. Generating suggestions never mutates the task tree.
  current.children = titles.map((title) => node(title));
  delete state.drafts[id];
  state.selectedId = current.children[0].id;
  return "";
}
export function helpFor(difficulty) {
  if (/找不到|文件|材料|资料/.test(difficulty))
    return "先确定缺的是哪一份材料，以及它可能在哪。可以在最近文件或聊天记录里搜索关键词；仍缺少的信息，记下可以询问的人。";
  if (/累|力气|休息|做不动/.test(difficulty))
    return "可以先暂存，给自己留一个休息的间隙。回来时，这个步骤和你写下的困难都会保留。";
  if (/不会|不懂|怎么|第一句/.test(difficulty))
    return "把问题缩到一个具体的未知点，例如“这部分需要说明什么”。可以先找一个相关示例，或把这个问题发给能帮助你的人。";
  return "试着补完“我需要知道或准备……，才能完成这一步”。如果已经知道可以分成哪几部分，可以自己写下拆解草稿，再确认应用。";
}
function validState(value) {
  if (
    value?.version !== 3 ||
    !["input", "tasks"].includes(value.screen) ||
    !["input", "mood", "goal", "clarification"].every(
      (key) => typeof value[key] === "string",
    ) ||
    typeof value.needsClarification !== "boolean" ||
    !Array.isArray(value.nodes) ||
    !value.drafts ||
    typeof value.drafts !== "object" ||
    Array.isArray(value.drafts)
  )
    return false;
  if (value.lastDeleted != null) {
    const deleted = value.lastDeleted;
    if (
      !["task", "list"].includes(deleted.kind) ||
      !(deleted.parentId === null || typeof deleted.parentId === "string") ||
      !Number.isInteger(deleted.index) ||
      deleted.index < 0 ||
      !deleted.snapshot ||
      deleted.snapshot.lastDeleted != null ||
      !validState(deleted.snapshot) ||
      (deleted.kind === "task" && deleted.snapshot.nodes.length !== 1)
    )
      return false;
  }
  const ids = new Set();
  function validNodes(items, depth) {
    if (depth > 30) return false;
    return items.every((item) => {
      if (
        !item ||
        typeof item.id !== "string" ||
        ids.has(item.id) ||
        typeof item.title !== "string" ||
        typeof item.detail !== "string" ||
        typeof item.done !== "boolean" ||
        !Array.isArray(item.children) ||
        !(item.recipe === null || Object.hasOwn(recipes, item.recipe))
      )
        return false;
      ids.add(item.id);
      return validNodes(item.children, depth + 1);
    });
  }
  return (
    validNodes(value.nodes, 0) &&
    (value.selectedId === null || ids.has(value.selectedId)) &&
    Object.entries(value.drafts).every(
      ([id, draft]) =>
        ids.has(id) &&
        draft &&
        ["split", "help"].includes(draft.mode) &&
        Array.isArray(draft.items) &&
        draft.items.every((title) => typeof title === "string") &&
        ["difficulty", "response"].every(
          (key) => typeof draft[key] === "string",
        ),
    )
  );
}
export function restoreState(value) {
  // Preserve old multiline drafts, including unfinished blank rows, in the row editor.
  if (
    value?.version === 3 &&
    value.drafts &&
    typeof value.drafts === "object"
  ) {
    value = structuredClone(value);
    for (const draft of Object.values(value.drafts)) {
      if (
        draft &&
        !Array.isArray(draft.items) &&
        typeof draft.text === "string"
      ) {
        draft.items = draft.text.split(/\r?\n/);
        delete draft.text;
      }
    }
  }
  if (validState(value))
    return {
      ...structuredClone(value),
      lastDeleted: value.lastDeleted ?? null,
    };
  if (
    ![1, 2].includes(value?.version) ||
    typeof value.goal !== "string" ||
    !Array.isArray(value.completed) ||
    !value.completed.every((title) => typeof title === "string")
  )
    return null;
  let pending;
  if (value.version === 1) {
    if (
      !Array.isArray(value.steps) ||
      !Number.isInteger(value.index) ||
      value.index < 0 ||
      value.index > value.steps.length ||
      !value.steps.every(
        (item) =>
          Array.isArray(item) &&
          item.length === 2 &&
          item.every((text) => typeof text === "string"),
      )
    )
      return null;
    pending = value.steps
      .slice(value.index)
      .map(([title, detail]) => ({ title, detail, trail: [] }));
  } else {
    if (
      !Array.isArray(value.pending) ||
      !value.pending.every(
        (item) =>
          item &&
          typeof item.title === "string" &&
          typeof item.detail === "string" &&
          Array.isArray(item.trail) &&
          item.trail.every((title) => typeof title === "string"),
      )
    )
      return null;
    pending = value.pending;
  }
  const state = initialState();
  state.goal = value.goal;
  state.input = value.goal;
  state.screen = "tasks";
  // Rebuild old preparation chains while preserving their still-unfinished parent action.
  const groups = new Map();
  for (const item of pending) {
    let siblings = state.nodes;
    let path = "";
    for (const title of item.trail) {
      path += "/" + normalizeTitle(title);
      if (!groups.has(path)) {
        const group = node(title);
        siblings.push(group);
        groups.set(path, group);
      }
      siblings = groups.get(path).children;
    }
    const normalized = normalizeTitle(item.title);
    const matchingGroup = groups.get(path + "/" + normalized);
    if (matchingGroup)
      matchingGroup.children.push(
        node("完成原步骤 · " + item.title, item.detail),
      );
    else if (
      !siblings.some(
        (existing) => normalizeTitle(existing.title) === normalized,
      )
    )
      siblings.push(node(item.title, item.detail));
  }
  state.nodes.push(
    ...value.completed.map((title) => ({ ...node(title), done: true })),
  );
  state.selectedId =
    flatten(state.nodes).find((item) => !item.children.length && !item.done)
      ?.id ?? null;
  return state;
}
