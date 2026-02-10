import { escapeHtml, linkify, listHtml } from "./dom.js";

const isHttpsUrl = (u) => typeof u === "string" && /^https:\/\/\S+$/i.test(u);

export const renderPlanHtml = (plan) => {
  const parts = [];
  const title = plan?.chat_response?.title || "Plan";
  const summary = plan?.chat_response?.summary || plan?.summary || "Here’s a plan.";
  parts.push(`<div class="planTitle">${escapeHtml(title)}</div>`);
  parts.push(`<div class="planSummary">${linkify(summary)}</div>`);

  const sections = Array.isArray(plan?.chat_response?.sections) ? plan.chat_response.sections : [];
  for (const s of sections) {
    const heading = s?.heading ? `<div class="planHeading">${escapeHtml(s.heading)}</div>` : "";
    let html = `<div class="planSection">${heading}`;

    const bullets = Array.isArray(s?.bullets) ? s.bullets.filter(Boolean) : [];
    if (bullets.length) html += listHtml(bullets);

    const checklist = Array.isArray(s?.checklist) ? s.checklist : [];
    if (checklist.length) {
      const items = checklist
        .map(
          (c) =>
            `<li><input type="checkbox" disabled ${c?.done_by_user ? "checked" : ""}>${linkify(
              c?.text || ""
            )}</li>`
        )
        .join("");
      html += `<ul class="planChecklist">${items}</ul>`;
    }

    const steps = Array.isArray(s?.steps) ? s.steps : [];
    if (steps.length) {
      const items = steps
        .map((st) => {
          const title = st?.title ? escapeHtml(st.title) : "Step";
          const details = Array.isArray(st?.details) ? st.details.filter(Boolean) : [];
          const detailsHtml = details.length ? listHtml(details) : "";
          return `<li><strong>${title}</strong>${detailsHtml}</li>`;
        })
        .join("");
      html += `<ol>${items}</ol>`;
    }

    const actions = Array.isArray(s?.actions) ? s.actions : [];
    if (actions.length) {
      const links = actions
        .map((a) => {
          const url = a?.url;
          if (!isHttpsUrl(url)) return "";
          const href = escapeHtml(url);
          return `<div><a href="${href}" target="_blank" rel="noreferrer">Link: ${href}</a></div>`;
        })
        .filter(Boolean)
        .join("");
      html += `<div class="planActions">${links}</div>`;
    }

    html += `</div>`;
    parts.push(html);
  }

  if (Array.isArray(plan?.rollout) && plan.rollout.length) {
    parts.push(`<div class="planSection"><div class="planHeading">Rollout</div>${listHtml(plan.rollout)}</div>`);
  }
  if (Array.isArray(plan?.metrics) && plan.metrics.length) {
    parts.push(`<div class="planSection"><div class="planHeading">Metrics</div>${listHtml(plan.metrics)}</div>`);
  }

  return parts.join("");
};
