let LS_KEY = "cf_config_assistant_chats_v1";

export const state = {
  busy: false,
  seeded: false,
  goalSet: false,
  pending: [],
  lastPlan: null,
  lastSources: [],
  voiceSupported: false,
  skeleton: [],
  user: null,
  isAuthed: false,
  chatId: "demo",
  messages: [], // {role, text}
};

export const setStorageKey = (suffix) => {
  LS_KEY = suffix ? `cf_config_assistant_chats_v1:${suffix}` : "cf_config_assistant_chats_v1";
};

export const uuid = () =>
  crypto?.randomUUID?.() || "chat_" + Math.random().toString(16).slice(2) + Date.now();

export const loadChats = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

export const saveChats = (chats) => localStorage.setItem(LS_KEY, JSON.stringify(chats));

export const upsertChat = (chat) => {
  const chats = loadChats();
  const idx = chats.findIndex((c) => c.id === chat.id);
  if (idx >= 0) chats[idx] = { ...chats[idx], ...chat };
  else chats.unshift(chat);
  saveChats(chats.slice(0, 50));
};

export const getChatById = (id) => loadChats().find((c) => c.id === id);

export const deleteChatById = (id) => {
  const chats = loadChats().filter((c) => c.id !== id);
  saveChats(chats);
};
