import { $ } from "./modules/dom.js";
import { api } from "./modules/api.js";
import { initAuth, login, logout, getUser, isAuthenticated, getAuthConfig } from "./modules/auth.js";
import { state, uuid, loadChats, upsertChat, setStorageKey, getChatById } from "./modules/state.js";
import {
  addMsg,
  closeDrawer,
  logSkeleton,
  openDrawer,
  openDrawerSources,
  renderMessageRow,
  renderDrawer,
  renderChatList,
  renderPlanMessage,
  renderWelcome,
  setBusy,
  setStatus,
  showTyping,
  hideTyping,
  switchChat,
  toast,
} from "./modules/ui.js";

const refreshIcons = () => window.lucide?.createIcons?.();

const stripHtml = (html) => {
  const el = document.createElement("div");
  el.innerHTML = String(html || "");
  return el.textContent || "";
};

const buildChatPayload = () => {
  const title = ($("chatTitle")?.textContent || "Chat").trim();
  const messages = state.messages
    .map((m) => ({
      role: m?.role || "user",
      text: m?.html ? stripHtml(m?.text || "") : String(m?.text || ""),
    }))
    .filter((m) => m.text.trim().length > 0);
  return { title, messages };
};

const downloadChatTxt = () => {
  const { title, messages } = buildChatPayload();
  const lines = messages.map((m) => `${m.role.toUpperCase()}:\n${m.text}`);
  const body = lines.join("\n\n");
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const safeTitle =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "chat";

  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeTitle}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const ensureIcons = () =>
  new Promise((resolve) => {
    if (window.lucide?.createIcons) return resolve(true);
    const existing = document.querySelector('script[data-lucide="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/lucide@latest/dist/umd/lucide.min.js";
    script.async = true;
    script.dataset.lucide = "true";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

const pullPlan = async () => {
  logSkeleton("Generating plan");
  showTyping();
  const plan = await api("/api/plan");
  state.lastPlan = plan;
  state.lastSources = Array.isArray(plan.sources) ? plan.sources : [];
  state.pending = Array.isArray(plan.follow_up_questions) ? plan.follow_up_questions : [];
  renderDrawer();

  if (state.pending.length) {
    const qs = state.pending.map((q, i) => `${i + 1}. ${q.question}`).join("\n");
    addMsg("assistant", "I need two quick details:\n" + qs);
    $("hint").textContent = `Answer the next question (${state.pending[0].key}).`;
  } else {
    addMsg("assistant", renderPlanMessage(plan), null, { html: true });
    $("hint").textContent = "Ask a follow-up or click Generate plan to refresh.";
  }

  hideTyping();
};

const clearChatUI = () => {
  $("chatBody").innerHTML = "";
  state.messages = [];
};

const startNewGoalFlow = () => {
  state.goalSet = false;
  state.pending = [];
  state.lastPlan = null;
  state.lastSources = [];
  renderDrawer();
  $("btnPlan").disabled = true;
  $("btnCopy").disabled = true;
  $("hint").textContent = "Say a goal to start.";
  renderWelcome();
};

const newChat = async () => {
  const id = uuid();
  state.chatId = id;
  sessionStorage.setItem("cf_active_chat_id", id);

  state.goalSet = false;
  state.pending = [];
  state.lastPlan = null;
  state.lastSources = [];
  renderDrawer();

  clearChatUI();
  renderWelcome();
  $("hint").textContent = "Say a goal to start.";

  upsertChat({ id: state.chatId, title: "New chat", updatedAt: Date.now(), messages: [] });
};

const ensureAccess = async () => {
  const allowGuest = getAuthConfig()?.allowGuest !== false;
  if (state.isAuthed || state.isGuest) return true;
  if (allowGuest) {
    state.isGuest = true;
    state.isAuthed = false;
    state.user = null;
    setStorageKey("guest");
    await updateAuthUI();
    return true;
  }
  toast("Login required", "Please log in to use the assistant.");
  await login();
  return false;
};

const handleUserText = async (text) => {
  const t = (text || "").trim();
  if (!t) return;

  if (!(await ensureAccess())) return;

  if (!state.messages.length) $("chatBody").innerHTML = "";
  addMsg("user", t);

  // If there are pending follow-up questions, treat next user message as the next answer
  if (state.goalSet && state.pending.length) {
    const next = state.pending[0];
    try {
      setBusy(true);
      logSkeleton(`Answered ${next.key}`);
      showTyping();
      await api("/api/answer", { method: "POST", body: JSON.stringify({ key: next.key, value: t }) });
      state.pending.shift();
      setBusy(false);

      // Re-plan immediately so the UI feels interactive
      await pullPlan();
    } catch (e) {
      hideTyping();
      setBusy(false);
      toast("Answer failed", String(e.message || e));
    }
    return;
  }

  // Otherwise, treat as a goal if goal isn't set
  if (!state.goalSet) {
    try {
      setBusy(true);
      logSkeleton("Goal set");
      showTyping();
      await api("/api/set-goal", { method: "POST", body: JSON.stringify({ goal: t }) });
      state.goalSet = true;
      $("btnPlan").disabled = false;
      setBusy(false);
      await pullPlan();
    } catch (e) {
      hideTyping();
      setBusy(false);
      toast("Set goal failed", String(e.message || e));
    }
    return;
  }

  // If goal is set and no pending followups, treat as follow-up context
  try {
    setBusy(true);
    logSkeleton("Follow-up added");
    showTyping();
    await api("/api/answer", { method: "POST", body: JSON.stringify({ key: "followup", value: t }) });
    setBusy(false);
    await pullPlan();
  } catch (e) {
    hideTyping();
    setBusy(false);
    toast("Follow-up failed", String(e.message || e));
  }
};

// Voice input
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let listening = false;

const startVoice = (onText) => {
  if (!SpeechRecognition) {
    toast("Voice not supported", "This browser does not support Web Speech API.");
    return;
  }
  if (listening || state.busy) return;

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;

  let finalText = "";

  recognition.onstart = () => {
    listening = true;
    $("btnMic").classList.add("listening");
    toast("Listening…", "Speak now.");
  };

  recognition.onresult = (event) => {
    let text = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      text += event.results[i][0].transcript;
      if (event.results[i].isFinal) finalText = text;
    }
    onText(text.trim());
  };

  recognition.onerror = (e) => {
    toast("Voice error", e.error || "Unknown error");
  };

  recognition.onend = () => {
    listening = false;
    $("btnMic").classList.remove("listening");
    if (finalText.trim()) onText(finalText.trim());
  };

  recognition.start();
};

// Drawer + buttons
const topSettingsBtn = $("btnSettings");
if (topSettingsBtn) topSettingsBtn.onclick = () => openDrawer();
$("btnCloseDrawer").onclick = () => closeDrawer();
$("drawerMask").onclick = () => closeDrawer();

$("btnNewChat").onclick = async () => {
  if (state.busy) return;
  await newChat();
  renderChatList();
  await setStatus();
};

$("btnSeed").onclick = async () => {
  if (!(await ensureAccess())) return;
  try {
    setBusy(true);
    logSkeleton("Seeding knowledge");
    const out = await api("/api/ingest-bootstrap", { method: "POST", body: "{}" });
    state.seeded = true;
    addMsg("assistant", `Seeded KB: upserted ${out.count ?? out.vectors ?? "?"} docs.`);
    setBusy(false);
    await setStatus();
  } catch (e) {
    setBusy(false);
    toast("Seed failed", String(e.message || e));
  }
};

$("btnNewGoal").onclick = async () => {
  startNewGoalFlow();
};

$("btnPlan").onclick = async () => {
  if (!(await ensureAccess())) return;
  try {
    setBusy(true);
    await pullPlan();
    setBusy(false);
  } catch (e) {
    setBusy(false);
    toast("Plan failed", String(e.message || e));
  }
};

$("btnCopy").onclick = async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(state.lastPlan || {}, null, 2));
    toast("Copied", "Plan JSON copied to clipboard.");
  } catch {
    toast("Copy failed", "Clipboard permission blocked.");
  }
};

$("btnChatSettings").onclick = () => {
  renderDrawer();
  openDrawerSources();
};

$("btnShareChat").onclick = async () => {
  if (state.busy) return;
  if (!state.messages.length) {
    toast("Nothing to share", "Start a chat first.");
    return;
  }
  try {
    setBusy(true);
    const payload = buildChatPayload();
    const res = await api("/share", { method: "POST", body: JSON.stringify(payload) });
    if (res?.url) {
      await navigator.clipboard.writeText(res.url);
      toast("Share link copied", "Anyone can open it for 24 hours.");
    } else {
      throw new Error("No share link returned");
    }
  } catch (e) {
    toast("Share failed", String(e.message || e));
  } finally {
    setBusy(false);
  }
};

$("btnDownloadChat").onclick = async () => {
  if (state.busy) return;
  if (!state.messages.length) {
    toast("Nothing to download", "Start a chat first.");
    return;
  }
  downloadChatTxt();
};

$("btnSend").onclick = async () => {
  const t = $("input").value;
  $("input").value = "";
  await handleUserText(t);
};

$("input").addEventListener("keydown", async (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("btnSend").click();
  }
});

$("btnMic").onclick = () => {
  startVoice((t) => {
    $("input").value = t;
  });
};

const updateAuthUI = async () => {
  const authed = await isAuthenticated();
  state.isAuthed = authed;
  state.user = authed ? await getUser() : null;
  const allowGuest = getAuthConfig()?.allowGuest !== false;
  state.isGuest = !authed && allowGuest;
  if (state.user?.sub) setStorageKey(state.user.sub);
  else if (state.isGuest) setStorageKey("guest");
  else setStorageKey(null);

  const name = state.user?.name || state.user?.email || "User";
  $("userGreeting").textContent = authed ? `Hi, ${name}` : "";
  $("userGreeting").style.display = authed ? "inline-flex" : "none";
  $("guestBadge").style.display = state.isGuest ? "inline-flex" : "none";
  $("btnLogin").style.display = authed ? "none" : "inline-flex";
  $("btnLogout").style.display = authed ? "inline-flex" : "none";
};

$("btnLogin").onclick = async () => {
  toast("Login", "Redirecting to Auth0...");
  logSkeleton("Login click");
  try {
    await login();
  } catch (e) {
    toast("Login failed", String(e.message || e));
  }
};

$("btnLogout").onclick = async () => {
  await logout();
  await updateAuthUI();
  renderChatList();
  await setStatus();
};

// Boot
(async () => {
  state.voiceSupported = !!SpeechRecognition;
  $("subline").textContent = state.voiceSupported ? "Chat UI · RAG · Voice input" : "Chat UI · RAG";
  setBusy(false);
  await ensureIcons();
  refreshIcons();

  try {
    await initAuth();
  } catch (e) {
    toast("Auth setup failed", String(e.message || e));
  }

  await updateAuthUI();

  // open a fresh chat per tab/session, without creating duplicates on reload
  let sessionChatId = sessionStorage.getItem("cf_active_chat_id");
  if (sessionChatId) {
    const existing = getChatById(sessionChatId);
    if (existing) {
      await switchChat(existing.id);
      return;
    }
  }

  // No active chat for this session: always start a new one
  sessionChatId = uuid();
  sessionStorage.setItem("cf_active_chat_id", sessionChatId);
  state.chatId = sessionChatId;
  state.messages = [];
  upsertChat({ id: state.chatId, title: "New chat", updatedAt: Date.now(), messages: [] });
  startNewGoalFlow();

  renderChatList();
  await setStatus();
})();
