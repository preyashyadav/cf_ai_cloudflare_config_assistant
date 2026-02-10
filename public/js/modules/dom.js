export const $ = (id) => document.getElementById(id);

export const escapeHtml = (s) =>
  String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const linkify = (s) => {
  const safe = escapeHtml(s);
  return safe.replace(/(https?:\/\/[^\s<]+)/gi, (m) => {
    const href = m.replace(/&amp;/g, "&");
    return `<a href="${href}" target="_blank" rel="noreferrer">${m}</a>`;
  });
};

export const listHtml = (items) =>
  `<ul>${items.map((i) => `<li>${linkify(i)}</li>`).join("")}</ul>`;
