const plans = {
  resume: [
    [
      "找到并打开旧简历",
      "在电脑或聊天记录里找到最近的一版。打开它，这一步就完成了。",
    ],
    ["写下一件最近做过的工作", "用一句话记录发生了什么，先把内容留下来。"],
    [
      "给这件工作补一个具体细节",
      "可以是你的职责、一次成果，或一个你记得的数字。",
    ],
    ["保存这份简历草稿", "把这次的修改保存好，给文件加一个你能找到的名字。"],
  ],
  room: [
    ["只选眼前的一小块地方", "桌面的一角或一张椅子都可以。选定就完成这一步。"],
    [
      "拿走这一小块地方的三个杂物",
      "先处理你确定去处的物品，拿走三个就可以停。",
    ],
    ["把一件常用物品放回原位", "选一件有固定位置的东西，放回去。"],
    [
      "看看刚才清出来的位置",
      "确认这一小块已经可以使用，今天的这一轮就完成了。",
    ],
  ],
  writing: [
    ["打开一个空白文档", "给它起一个临时名字，保存下来。"],
    ["写下最想说的一句话", "用你平时说话的方式写就好，这句话之后可以修改。"],
    ["给这句话加一个例子", "写一件你见过、经历过或想到的小事。"],
    ["读一遍，标记下次想接着写的地方", "留下一句提示，保存这份草稿。"],
  ],
  study: [
    ["把要学的材料放到眼前", "打开一份课件、一本书或一个学习页面，只选一份。"],
    ["只看一个小节", "找到一个标题，读它下面的第一段，或看一分钟视频。"],
    ["写下一个记住的点", "用自己的话写一句，也可以写下一个还没懂的问题。"],
    ["标记下一次开始的位置", "做个书签或记录页码，保存这次的一点进展。"],
  ],
  general: [
    [
      "写下一个具体的小结果",
      "补完这句话“这次我想先完成……”。选一个能看出是否完成的结果。",
    ],
    [
      "找出实现它需要的一样东西",
      "可以是一个文件、一件工具或一条资料，先把它放到眼前。",
    ],
    [
      "做一个能留下痕迹的动作",
      "围绕你选的小结果，写一句、整理一件，或完成一个最小操作。",
    ],
    ["记下做到哪里了", "留一句进度和下次要接着做的动作，保存下来。"],
  ],
};

const $ = (id) => document.getElementById(id);
const storageKey = "heart-isle-small-start-v1";
let state = null;
let saved = null;
let mood = "";
let storageAvailable = true;

function step(title, detail, kind = "action", trail = []) {
  return { title, detail, kind, trail };
}

function makeSteps(text) {
  let type = "general";
  if (/简历|求职|换工作/.test(text)) type = "resume";
  else if (/房间|收拾|打扫|整理桌/.test(text)) type = "room";
  else if (/写|文章|论文|报告|方案|汇报/.test(text)) type = "writing";
  else if (/学习|复习|考试|课|读书/.test(text)) type = "study";
  if (/邮件|消息/.test(text))
    return [
      step("打开需要回复的那条消息", "找到对方的问题，先读一遍。"),
      step("写一句最想回复的话", "先留在草稿里，可以之后再调整。"),
      step(
        "检查这句回复是否说清楚了",
        "读一遍，确认信息正确，再由你决定什么时候发送。",
      ),
    ];
  const result = plans[type].map(([title, detail]) => step(title, detail));
  if (type === "general")
    result[0] = step(
      "写下一件挂在心里的事",
      "想到的第一件就可以，写一个具体的动作，比如“回复昨天的邮件”。",
      "clarify",
    );
  return result;
}

function validState(value) {
  return (
    value?.version === 2 &&
    typeof value.goal === "string" &&
    Array.isArray(value.pending) &&
    value.pending.length <= 200 &&
    value.pending.every(
      (item) =>
        typeof item.title === "string" &&
        typeof item.detail === "string" &&
        ["action", "clarify"].includes(item.kind) &&
        Array.isArray(item.trail) &&
        item.trail.every((title) => typeof title === "string"),
    ) &&
    Array.isArray(value.completed) &&
    value.completed.every((title) => typeof title === "string") &&
    Number.isFinite(value.elapsed) &&
    value.elapsed >= 0 &&
    (value.startedAt === null ||
      (Number.isFinite(value.startedAt) && value.startedAt > 0)) &&
    typeof value.begun === "boolean"
  );
}

function migrate(value) {
  if (validState(value)) return value;
  if (
    value?.version !== 1 ||
    typeof value.goal !== "string" ||
    !Array.isArray(value.steps) ||
    !value.steps.every(
      (item) =>
        Array.isArray(item) &&
        item.length === 2 &&
        item.every((text) => typeof text === "string"),
    ) ||
    !Number.isInteger(value.index) ||
    value.index < 0 ||
    value.index > value.steps.length ||
    !Array.isArray(value.completed) ||
    !value.completed.every((title) => typeof title === "string")
  )
    return null;
  // Old countdown sessions resume as paused count-up sessions, preserving completed work.
  const elapsed =
    [1, 5].includes(value.minutes) && Number.isFinite(value.remaining)
      ? Math.max(0, value.minutes * 60000 - value.remaining)
      : 0;
  return {
    version: 2,
    goal: value.goal,
    pending: value.steps
      .slice(value.index)
      .map(([title, detail]) => step(title, detail)),
    completed: value.completed,
    elapsed,
    startedAt: null,
    begun: elapsed > 0,
  };
}

try {
  saved = migrate(JSON.parse(localStorage.getItem(storageKey) || "null"));
} catch {
  storageAvailable = false;
}

function storageMessage() {
  const message = storageAvailable
    ? "进度已保存在当前浏览器，回来可以接着做。"
    : "浏览器暂时无法保存，进度仅在本次页面停留期间有效。";
  for (const id of ["storage-note", "input-storage", "finish-storage"])
    $(id).textContent = message;
}

function persist() {
  saved = structuredClone(state);
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  storageMessage();
}

function show(stage) {
  for (const name of ["input", "action", "finish"])
    $(name + "-panel").hidden = name !== stage;
  document.querySelectorAll("[data-stage]").forEach((element) => {
    element.removeAttribute("aria-current");
    if (element.dataset.stage === (stage === "finish" ? "action" : stage))
      element.setAttribute("aria-current", "step");
  });
  $(stage + "-title").focus({ preventScroll: true });
}

function updateResume() {
  $("resume").hidden = !saved;
  if (saved)
    $("resume-text").textContent = saved.pending.length
      ? "上次想推进 · " + saved.goal
      : "上次的小步已经完成，回来看看进展。";
  storageMessage();
}

function elapsedTime() {
  return (
    state.elapsed +
    (state.startedAt ? Math.max(0, Date.now() - state.startedAt) : 0)
  );
}

function updateClock() {
  if (!state) return;
  const seconds = Math.floor(elapsedTime() / 1000);
  $("clock").textContent =
    String(Math.floor(seconds / 60)).padStart(2, "0") +
    ":" +
    String(seconds % 60).padStart(2, "0");
  $("pause").textContent = state.startedAt ? "暂停计时" : "继续计时";
}

function pauseTimer() {
  state.elapsed = elapsedTime();
  state.startedAt = null;
}

function resetTimer() {
  state.elapsed = 0;
  state.startedAt = null;
  state.begun = false;
}

function renderCompleted(id) {
  $(id).replaceChildren(
    ...state.completed.map((title) => {
      const item = document.createElement("li");
      item.textContent = title;
      return item;
    }),
  );
}

function renderPlan() {
  $("plan-list").replaceChildren(
    ...state.pending.map((item, index) => {
      const row = document.createElement("li");
      const title = document.createElement("span");
      title.textContent = item.title;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quiet";
      button.textContent = "帮我拆开";
      button.setAttribute("aria-label", "拆开" + item.title);
      button.addEventListener("click", () => splitStep(index));
      row.append(title, button);
      return row;
    }),
  );
  renderCompleted("completed-list");
}

function renderAction(message = "") {
  if (!state.pending.length) {
    renderCompleted("finish-list");
    show("finish");
    return;
  }
  const current = state.pending[0];
  $("goal-summary").textContent = "这次想推进 · " + state.goal;
  $("step-label").textContent = current.trail.length
    ? "为了完成 · " + current.trail.join(" → ")
    : "眼前的一小步";
  $("step-title").textContent = current.title;
  $("step-detail").textContent = current.detail;
  $("outcome-form").hidden = current.kind !== "clarify";
  $("outcome-error").textContent = "";
  $("outcome").value = "";
  $("start").hidden = state.begun;
  $("done").hidden = !state.begun;
  $("timer-panel").hidden = !state.begun;
  $("pause").hidden = !state.begun;
  $("edit-form").hidden = true;
  $("stuck-help").hidden = true;
  $("extras").open = false;
  $("action-status").textContent = message;
  updateClock();
  renderPlan();
  show("action");
}

function smallerStep(current, difficulty) {
  const trail = [...current.trail, current.title];
  if (/找不到|缺|没有材料|需要别人/.test(difficulty))
    return step(
      "写下缺少的一样东西",
      "在备忘录写下缺的文件、信息或工具，以及可以向谁询问。写一项就完成。",
      "action",
      trail,
    );
  if (/不会|不知道怎么|太难|不懂/.test(difficulty))
    return step(
      "写下一个最具体的问题",
      "补完“我不知道怎么……”。先把一个问题写清楚，之后可以拿着它找资料或询问。",
      "action",
      trail,
    );
  if (/累|没力气|做不动/.test(difficulty))
    return step(
      "把要用的一样东西放到手边",
      "只准备一件东西就可以。也可以点“今天先到这里”保存进度。",
      "action",
      trail,
    );
  if (current.trail.length >= 3) return null;
  if (/打开|找到.*简历/.test(current.title))
    return step(
      "找到文件或应用的入口",
      "只找到图标、文件夹或聊天记录的位置。找到就完成。",
      "action",
      trail,
    );
  if (/入口/.test(current.title))
    return step(
      "把手放到鼠标或手机上",
      "只做这个准备动作就好，接下来再找入口。",
      "action",
      trail,
    );
  if (/三个/.test(current.title))
    return step(
      "只拿起一件确定去处的东西",
      "找到它要去的位置，放过去，一件就够。",
      "action",
      trail,
    );
  if (/一个词/.test(current.title))
    return step(
      "打开备忘录或拿一张纸",
      "把可以写字的地方准备好，这一步就完成。",
      "action",
      trail,
    );
  if (/写|补|例子/.test(current.title))
    return step(
      "先写一个词",
      "在纸上或备忘录里，写下与这件事有关的第一个词。之后可以修改。",
      "action",
      trail,
    );
  if (/选|看|读|学/.test(current.title))
    return step(
      "把目光放到一个具体的位置",
      "只找到一个物品、一行文字或一个标题，看到它就完成。",
      "action",
      trail,
    );
  return step(
    "把要用的一样东西放到手边",
    "准备一个文件、一件工具或一张纸。只准备一样。",
    "action",
    trail,
  );
}

function splitStep(index, difficulty = "") {
  const current = state.pending[index];
  const child = smallerStep(current, difficulty);
  if (index === 0) pauseTimer();
  if (!child || child.title === current.title || state.pending.length >= 200) {
    persist();
    renderAction("先停一下也可以。补一句具体困难，我们再找一个入口。");
    $("stuck-help").hidden = false;
    return;
  }
  // Insert the preparation before its parent so completing it never discards the original task.
  state.pending.splice(index, 0, child);
  if (index === 0) resetTimer();
  persist();
  renderAction("先试这个更轻的动作，原来的步骤已保留。");
  $("stuck-help").hidden = false;
  if (index > 0) $("extras").open = true;
}

function completeStep() {
  if (!state.pending.length) return;
  if (state.pending[0].kind === "clarify") {
    $("outcome-error").textContent = "留下一件想到的事，就可以围绕它继续拆。";
    $("outcome").focus();
    return;
  }
  const completed = state.pending.shift();
  state.completed.push(completed.title);
  resetTimer();
  persist();
  renderAction("已完成“" + completed.title + "”。下一步已经放在这里。");
}

document.querySelectorAll("[data-mood]").forEach((button) =>
  button.addEventListener("click", () => {
    mood = mood === button.dataset.mood ? "" : button.dataset.mood;
    document
      .querySelectorAll("[data-mood]")
      .forEach((item) =>
        item.setAttribute("aria-pressed", String(item.dataset.mood === mood)),
      );
  }),
);
$("task").addEventListener("input", () => {
  $("count").textContent = $("task").value.length + " / 1000";
  $("input-error").textContent = "";
});
document.querySelectorAll("[data-example]").forEach((button) =>
  button.addEventListener("click", () => {
    $("task").value = button.dataset.example;
    $("task").dispatchEvent(new Event("input"));
    $("task").focus();
  }),
);
$("task-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const goal = $("task").value.trim();
  if (!goal) {
    $("input-error").textContent = "写一句挂在心里的事就可以。";
    return;
  }
  state = {
    version: 2,
    goal,
    pending: makeSteps(goal),
    completed: [],
    elapsed: 0,
    startedAt: null,
    begun: false,
  };
  if (mood === "energy" || (!mood && /累|没力气/.test(goal))) {
    const first = smallerStep(state.pending[0], "");
    if (first) state.pending.unshift(first);
  }
  if (mood === "overwhelmed" && state.pending[0].kind !== "clarify") {
    state.pending.unshift(
      step(
        "写下一件现在想先碰的事",
        "从刚才提到的事情里，写下一件你愿意先推进的小事。",
        "clarify",
      ),
    );
  }
  if (mood === "fear")
    state.pending[0].detail += " 先做一个可以修改的版本就好。";
  persist();
  renderAction();
});
$("start").addEventListener("click", () => {
  state.begun = true;
  state.startedAt = Date.now();
  persist();
  renderAction();
});
$("pause").addEventListener("click", () => {
  if (state.startedAt) pauseTimer();
  else state.startedAt = Date.now();
  persist();
  updateClock();
});
$("done").addEventListener("click", completeStep);
$("skip-step").addEventListener("click", completeStep);
$("stuck").addEventListener("click", () => splitStep(0));
$("apply-difficulty").addEventListener("click", () => {
  const difficulty = $("difficulty").value.trim();
  if (!difficulty) {
    $("action-status").textContent = "写一句现在遇到的困难就可以。";
    $("difficulty").focus();
    return;
  }
  splitStep(0, difficulty);
  $("difficulty").value = "";
});
$("outcome-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const outcome = $("outcome").value.trim();
  if (!outcome) {
    $("outcome-error").textContent = "写下此刻想到的一件事就可以。";
    $("outcome").focus();
    return;
  }
  state.completed.push("明确一个小结果 · " + outcome);
  state.goal = outcome;
  const next = makeSteps(outcome);
  // A specific but unrecognized task gets a concrete preparation step instead of another clarification loop.
  if (next[0].kind === "clarify") next.shift();
  state.pending = next;
  resetTimer();
  persist();
  renderAction();
});
$("edit").addEventListener("click", () => {
  pauseTimer();
  persist();
  updateClock();
  $("edit-form").hidden = false;
  $("custom-step").value = state.pending[0].title;
  $("custom-step").focus();
});
$("cancel-edit").addEventListener("click", () => {
  $("edit-form").hidden = true;
});
$("edit-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const title = $("custom-step").value.trim();
  if (!title) {
    $("custom-step").setCustomValidity("写一个你愿意做的动作。");
    $("custom-step").reportValidity();
    return;
  }
  state.pending[0] = step(
    title,
    "按你选的动作来，做完就完成这一步。",
    "action",
    state.pending[0].trail,
  );
  resetTimer();
  persist();
  renderAction();
});
$("custom-step").addEventListener("input", () =>
  $("custom-step").setCustomValidity(""),
);
$("save-exit").addEventListener("click", () => {
  pauseTimer();
  persist();
  updateResume();
  show("input");
});
$("resume-button").addEventListener("click", () => {
  state = structuredClone(saved);
  renderAction();
});
$("new-task").addEventListener("click", () => {
  $("task").value = "";
  $("task").dispatchEvent(new Event("input"));
  updateResume();
  show("input");
});
$("discard").addEventListener("click", () => {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    $("input-error").textContent = "浏览器暂时无法清除保存记录。";
    return;
  }
  state = null;
  saved = null;
  updateResume();
});
setInterval(updateClock, 1000);
updateResume();
