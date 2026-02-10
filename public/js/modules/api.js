import { state } from "./state.js";
import { getAccessToken } from "./auth.js";

export const api = async (path, opts = {}) => {
  const u = new URL(path, window.location.origin);
  u.searchParams.set("chatId", state.chatId);

  const token = await getAccessToken();
  const isGuest = !token && state.isGuest;
  if (!token && u.pathname.startsWith("/api/") && !isGuest) {
    throw new Error("Not authenticated");
  }

  const res = await fetch(u.toString(), {
    ...opts,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(isGuest ? { "x-guest": "1" } : {}),
      ...(opts.headers || {}),
    },
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { ok: false, raw: text };
  }

  if (!res.ok) {
    const msg = json?.error || json?.message || json?.raw || `HTTP ${res.status}`;
    const detail = json?.stack ? `\n\n${String(json.stack).slice(0, 600)}` : "";
    throw new Error(`${msg}${detail}`);
  }
  return json;
};
