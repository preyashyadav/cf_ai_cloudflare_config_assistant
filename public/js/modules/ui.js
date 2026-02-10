import { $, escapeHtml } from "./dom.js";
import { api } from "./api.js";
import { renderPlanHtml } from "./plan.js";
import { state, loadChats, upsertChat, getChatById, deleteChatById } from "./state.js";

export const toast = (title, msg) => {
  $("toastTitle").textContent = title;
  $("toastMsg").textContent = msg;
  $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 4200);
};

export const renderWelcome = () => {
  $("chatBody").innerHTML = `
    <div class="welcome">
      <div class="title">What help do you need?</div>
      <div class="subtitle">Ask anything about Cloudflare, or pick a quick start.</div>
      <div class="suggestions">
        <button data-suggest="Secure my /api/login">Secure my /api/login</button>
        <button data-suggest="What is Cloudflare?">What is Cloudflare?</button>
        <button data-suggest="Speed up my site with caching">Speed up my site with caching</button>
        <button data-suggest="Set up DNS for my domain">Set up DNS for my domain</button>
        <button data-suggest="Protect against bots">Protect against bots</button>
      </div>
    </div>
  `;
  $("chatBody").querySelectorAll("[data-suggest]").forEach((btn) => {
    btn.onclick = () => {
      $("input").value = btn.getAttribute("data-suggest") || "";
      $("btnSend").click();
    };
  });
};

export const logSkeleton = (msg) => {
  if (!msg) return;
  state.skeleton.push({ at: Date.now(), msg: String(msg) });
  if (state.skeleton.length > 50) state.skeleton = state.skeleton.slice(-50);
  renderDrawer();
};

export const setBusy = (busy) => {
  state.busy = busy;
  $("btnSeed").disabled = busy;
  $("btnNewGoal").disabled = busy;
  $("btnPlan").disabled = busy || !state.goalSet;
  $("btnCopy").disabled = busy || !state.lastPlan;
  const hasMsgs = state.messages.length > 0;
  if ($("btnShareChat")) $("btnShareChat").disabled = busy || !hasMsgs;
  if ($("btnDownloadChat")) $("btnDownloadChat").disabled = busy || !hasMsgs;
  $("btnSend").disabled = busy;
  $("btnMic").disabled = busy;
  $("input").disabled = busy;
  $("btnNewChat").disabled = busy;
};

export const scrollToBottom = () => {
  const el = $("chatBody");
  el.scrollTop = el.scrollHeight;
};

export const showTyping = () => {
  if ($("typingRow")) return;
  const row = document.createElement("div");
  row.className = "typingRow";
  row.id = "typingRow";
  row.innerHTML = `
    <div class="typingBubble">
      <span class="dotPulse"></span>
      <span class="dotPulse"></span>
      <span class="dotPulse"></span>
    </div>
  `;
  $("chatBody").appendChild(row);
  scrollToBottom();
};

export const hideTyping = () => {
  const row = $("typingRow");
  if (row) row.remove();
};

export const persistCurrentChat = () => {
  const firstUser = state.messages.find((m) => m.role === "user");
  const title = firstUser ? firstUser.text : "New chat";
  upsertChat({ id: state.chatId, title, updatedAt: Date.now(), messages: state.messages });
  renderChatList();
};

export const addMsg = (role, text, meta, opts = {}) => {
  const row = document.createElement("div");
  row.className = "msgRow " + (role === "user" ? "user" : "assistant");

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (opts.html) bubble.innerHTML = text;
  else bubble.textContent = text;

  if (meta) {
    const m = document.createElement("div");
    m.className = "metaLine";
    m.textContent = meta;
    bubble.appendChild(m);
  }

  row.appendChild(bubble);
  $("chatBody").appendChild(row);
  scrollToBottom();

  state.messages.push({ role, text, html: !!opts.html });
  persistCurrentChat();
};

const isHtmlMessage = (text) =>
  typeof text === "string" &&
  (text.includes('class="planTitle"') ||
    text.includes('class="planSection"') ||
    text.includes('class="planHeading"') ||
    text.includes('class="planChecklist"'));

export const renderMessageRow = (msg) => {
  const row = document.createElement("div");
  row.className = "msgRow " + (msg.role === "user" ? "user" : "assistant");
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const useHtml = msg.html || (msg.role === "assistant" && isHtmlMessage(msg.text));
  if (useHtml) bubble.innerHTML = msg.text;
  else bubble.textContent = msg.text;
  row.appendChild(bubble);
  $("chatBody").appendChild(row);
  scrollToBottom();
};

const setDot = (id, cls) => {
  const el = $(id);
  el.className = "pDot " + cls;
};

export const setStatus = async () => {
  if (!state.isAuthed) {
    $("pillW").textContent = "Worker: login";
    $("pillDO").textContent = "DO: login";
    $("pillDiag").textContent = "Bindings: login";
    setDot("dotW", "warn");
    setDot("dotDO", "warn");
    setDot("dotDiag", "warn");
    return;
  }

  try {
    const w = await api("/ping");
    $("pillW").textContent = "Worker: " + (w.ok ? "ok" : "bad");
    setDot("dotW", w.ok ? "ok" : "bad");
  } catch {
    $("pillW").textContent = "Worker: error";
    setDot("dotW", "bad");
  }

  try {
    const d = await api("/api/ping");
    $("pillDO").textContent = "DO: " + (d.ok ? "ok" : "bad");
    setDot("dotDO", d.ok ? "ok" : "bad");
  } catch {
    $("pillDO").textContent = "DO: error";
    setDot("dotDO", "bad");
  }

  try {
    const diag = await api("/api/diag");
    const ok = !!(diag.hasAI && diag.hasVectorize && diag.hasDO);
    $("pillDiag").textContent = "Bindings: " + (ok ? "ok" : "check");
    setDot("dotDiag", ok ? "ok" : "warn");
  } catch {
    $("pillDiag").textContent = "Bindings: error";
    setDot("dotDiag", "bad");
  }
};

export const renderDrawer = () => {
  $("planJson").textContent = JSON.stringify(state.lastPlan || {}, null, 2);

  const srcs = Array.isArray(state.lastSources) ? state.lastSources : [];
  if (!srcs.length) {
    $("sourcesList").textContent = "—";
  } else {
    $("sourcesList").innerHTML = srcs
      .map((u) => `<div><a href="${u}" target="_blank" rel="noreferrer">${u}</a></div>`)
      .join("");
  }

  if (!state.skeleton.length) {
    $("skeletonLog").textContent = "—";
  } else {
    $("skeletonLog").innerHTML = state.skeleton
      .slice(-12)
      .map((e) => `<div>${new Date(e.at).toLocaleTimeString()} · ${escapeHtml(e.msg)}</div>`)
      .join("");
  }
};

export const renderChatList = () => {
  const chats = loadChats();
  const list = $("chatList");
  list.innerHTML = "";

  if (!chats.length) {
    list.innerHTML = `<div class="tiny">No chats yet. Click “New”.</div>`;
    $("chatMeta").textContent = "—";
    const titleEl = $("chatTitle");
    if (titleEl) titleEl.textContent = "New chat";
    return;
  }

  for (const c of chats) {
    const div = document.createElement("div");
    div.className = "chatItem" + (c.id === state.chatId ? " active" : "");
    div.innerHTML = `
      <div class="t" data-title>${(c.title || "New chat").slice(0, 60)}</div>
      <div class="m">${new Date(c.updatedAt || Date.now()).toLocaleString()}</div>
      <div class="actions">
        <button class="btnIcon" data-act="rename" title="Rename" aria-label="Rename">
          <i data-lucide="pen-line"></i>
        </button>
        <button class="danger btnIcon" data-act="delete" title="Delete" aria-label="Delete">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    `;
    div.onclick = async () => {
      if (state.busy) return;
      await switchChat(c.id);
    };
    div.querySelector('[data-act="rename"]').onclick = (e) => {
      e.stopPropagation();
      const titleEl = div.querySelector("[data-title]");
      if (!titleEl) return;
      const input = document.createElement("input");
      input.type = "text";
      input.value = c.title || "New chat";
      input.style.width = "100%";
      input.style.fontSize = "12px";
      input.style.fontWeight = "900";
      input.style.border = "1px solid var(--border)";
      input.style.background = "rgba(255,255,255,0.05)";
      input.style.color = "var(--text)";
      input.style.borderRadius = "8px";
      input.style.padding = "4px 6px";

      const commit = () => {
        const next = input.value.trim();
        if (next) {
          upsertChat({ ...c, title: next, updatedAt: Date.now() });
          renderChatList();
        } else {
          renderChatList();
        }
      };

      const cancel = () => renderChatList();

      input.onkeydown = (ev) => {
        if (ev.key === "Enter") commit();
        if (ev.key === "Escape") cancel();
      };
      input.onblur = commit;

      titleEl.replaceWith(input);
      input.focus();
      input.select();
    };
    div.querySelector('[data-act="delete"]').onclick = (e) => {
      e.stopPropagation();
      deleteChatById(c.id);
      if (state.chatId === c.id) {
        const remaining = loadChats();
        if (remaining.length) {
          switchChat(remaining[0].id);
        } else {
          state.chatId = "demo";
          state.messages = [];
          $("chatBody").innerHTML = "";
          $("hint").textContent = "Say a goal to start.";
        }
      } else {
        renderChatList();
      }
    };
    list.appendChild(div);
  }

  $("chatMeta").textContent = `Active: ${state.chatId}`;
  const active = chats.find((c) => c.id === state.chatId);
  const titleEl = $("chatTitle");
  if (titleEl) titleEl.textContent = (active?.title || "New chat").slice(0, 60);
  window.lucide?.createIcons?.();
};

export const replayMessages = (msgs) => {
  $("chatBody").innerHTML = "";
  state.messages = [];
  for (const m of msgs) renderMessageRow(m);
};

export const loadChatMessages = (chatId) => {
  const c = getChatById(chatId);
  return Array.isArray(c?.messages) ? c.messages : [];
};

export const switchChat = async (chatId) => {
  state.chatId = chatId;
  sessionStorage.setItem("cf_active_chat_id", chatId);
  state.pending = [];
  state.lastPlan = null;
  state.lastSources = [];
  renderDrawer();

  const msgs = loadChatMessages(chatId);
  state.messages = msgs.slice();
  $("chatBody").innerHTML = "";
  for (const m of msgs) renderMessageRow(m);
  if (!msgs.length) renderWelcome();
  scrollToBottom();

  state.goalSet = msgs.some((m) => m?.role === "user");

  if (state.goalSet && (state.isAuthed || state.isGuest)) {
    try {
      const pending = await api("/api/pending-questions");
      state.pending = Array.isArray(pending?.questions) ? pending.questions : [];
    } catch {
      state.pending = [];
    }
  }

  if (state.pending.length) {
    $("hint").textContent = `Answer the next question (${state.pending[0].key}).`;
  } else if (state.goalSet) {
    $("hint").textContent = "Ask a follow-up or click Generate plan to refresh.";
  } else {
    $("hint").textContent = "Say a goal to start.";
  }
  setBusy(state.busy);
  renderChatList();
  await setStatus();
};

export const openDrawer = () => {
  $("drawerMask").classList.add("show");
  $("drawer").classList.add("show");
};
export const closeDrawer = () => {
  $("drawerMask").classList.remove("show");
  $("drawer").classList.remove("show");
};
export const openDrawerSources = () => {
  openDrawer();
  setTimeout(() => {
    const el = $("sourcesList");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 10);
};

export const renderPlanMessage = (plan) => renderPlanHtml(plan);
