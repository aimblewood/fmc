/* Tiny UI helpers — no framework, direct DOM. */

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (v === true) node.setAttribute(k, "");
    else node.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(c));
  }
  return node;
}

export function toast(msg, isErr = false) {
  const t = el("div", { class: "toast" + (isErr ? " err" : "") }, msg);
  document.getElementById("toasts").append(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .3s"; setTimeout(() => t.remove(), 320); }, 3400);
}

export function modal({ title, body, footer, wide = false, onClose }) {
  const veil = el("div", { class: "modal-veil", onclick: e => { if (e.target === veil) close(); } });
  const close = () => { veil.remove(); document.removeEventListener("keydown", esc); onClose?.(); };
  const esc = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", esc);
  const m = el("div", { class: "modal" + (wide ? " wide" : ""), role: "dialog", "aria-modal": "true", "aria-label": title },
    el("div", { class: "m-head" }, el("h2", {}, title), el("button", { class: "btn ghost sm", onclick: close, "aria-label": "Close" }, "✕")),
    el("div", { class: "m-body" }, body),
    footer ? el("div", { class: "m-foot" }, footer) : null
  );
  veil.append(m);
  document.body.append(veil);
  return { close, node: m };
}

export function confirmDialog(message, onYes) {
  const { close } = modal({
    title: "Are you sure?",
    body: el("p", {}, message),
    footer: [
      el("button", { class: "btn", onclick: () => close() }, "Cancel"),
      el("button", { class: "btn danger", onclick: () => { close(); onYes(); } }, "Delete")
    ]
  });
}

/* inline SVG icon set (stroke style, 24 viewbox) */
const PATHS = {
  home: "M3 11.5 12 4l9 7.5M5.5 9.8V20h13V9.8",
  book: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21zM4 18.5V21M8 7h8M8 10.5h5",
  tools: "M14.7 6.3a4 4 0 0 0-5.4 5L4 16.6V20h3.4l5.3-5.3a4 4 0 0 0 5-5.4l-2.8 2.8-2.4-2.4z",
  car: "M5 13l1.6-4.4A2 2 0 0 1 8.5 7h7a2 2 0 0 1 1.9 1.6L19 13M5 13h14M5 13v5h2.2v-1.6h9.6V18H19v-5M7.8 15.6h.7M15.5 15.6h.7",
  users: "M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.8 19a5.7 5.7 0 0 1 11.4 0M15.5 10.6a2.6 2.6 0 1 0-1.2-5M16 14.5a5 5 0 0 1 5.2 4.5",
  cap: "M3 9.5 12 5l9 4.5-9 4.5zM7 12v4.4c0 .9 2.2 2.1 5 2.1s5-1.2 5-2.1V12M21 9.5V15",
  person: "M12 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 12 11zM5.5 20a6.5 6.5 0 0 1 13 0",
  building: "M4 20V5.5A1.5 1.5 0 0 1 5.5 4h8A1.5 1.5 0 0 1 15 5.5V20M15 9h3.5A1.5 1.5 0 0 1 20 10.5V20M2.8 20h18.4M7 8h2M7 11.5h2M7 15h2M11 8h1.5M11 11.5h1.5M11 15h1.5",
  flag: "M5 21V4.5M5 5c2.3-1.4 4.4-1.5 7 0s4.7 1.4 7 0v8.5c-2.3 1.4-4.4 1.5-7 0s-4.7-1.4-7 0",
  shield: "M12 3l7.5 3v5.6c0 4.6-3.1 7.8-7.5 9.4-4.4-1.6-7.5-4.8-7.5-9.4V6zM9 11.8l2.2 2.2 4-4.2",
  doc: "M6.5 3h7L18 7.5V21h-11.5zM13 3v5h5M9 12h6M9 15.5h6",
  cart: "M4 5h2l2.2 10.4a1.5 1.5 0 0 0 1.5 1.1h7.4a1.5 1.5 0 0 0 1.4-1.1L20.5 8H7M10 20.4a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8zM17 20.4a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8z",
  calc: "M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8.5 6.5h7v3.5h-7zM8.5 13.5h.6M11.7 13.5h.6M14.9 13.5h.6M8.5 17h.6M11.7 17h.6M14.9 17h.6",
  pound: "M15.5 8.2A3.2 3.2 0 0 0 12.3 5C10.5 5 9.2 6.4 9.2 8.4c0 3.2.4 4.5-1.4 7.4-.5.7-.6 1.2-.6 1.2h9.8M7.5 12.5h6",
  upload: "M12 15.5V4.8M8.2 8.4 12 4.6l3.8 3.8M4.5 15.5v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3",
  download: "M12 4.5v10.7M8.2 11.6l3.8 3.8 3.8-3.8M4.5 15.5v3A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-3",
  plus: "M12 5v14M5 12h14",
  search: "M10.8 17.6a6.8 6.8 0 1 0 0-13.6 6.8 6.8 0 0 0 0 13.6zM15.8 15.8 21 21",
  bolt: "M13 2.5 4.8 13.5H11L9.8 21.5 18.6 10H12.3z",
  chart: "M4 20h16M7 16.5v-4M11.5 16.5v-8M16 16.5V6.5",
  arrow: "M5 12h14M13 6l6 6-6 6",
  logout: "M14.5 8V5.5A1.5 1.5 0 0 0 13 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H13a1.5 1.5 0 0 0 1.5-1.5V16M9 12h11.5M17.5 9l3 3-3 3",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13V20h-13zM12 14.5v2",
  news: "M4 6.5h13V19H5.5A1.5 1.5 0 0 1 4 17.5zM17 9.5h1.5A1.5 1.5 0 0 1 20 11v6.3a1.7 1.7 0 0 1-3 1.1M7 10h7M7 13h7M7 16h4"
};
export function icon(name, size = 18) {
  const span = el("span", { class: "ico", "aria-hidden": "true" });
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${PATHS[name] || PATHS.doc}"/></svg>`;
  return span;
}

export function pageHead({ crumb, title, sub, actions = [] }) {
  return [
    el("div", { class: "page-head" },
      el("div", {},
        crumb ? el("div", { class: "crumb" }, crumb) : null,
        el("h1", {}, title),
        sub ? el("p", { class: "page-sub" }, sub) : null
      ),
      actions.length ? el("div", { class: "actions" }, actions) : null
    ),
    el("hr", { class: "roadline" })
  ];
}

export function field({ label, hint, input, error }) {
  return el("div", { class: "field" },
    el("label", { for: input.id }, label),
    input,
    hint ? el("div", { class: "hint" }, hint) : null,
    error ? el("div", { class: "error" }, error) : null
  );
}

export function downloadText(filename, content, type = "text/plain") {
  const a = el("a", {
    href: URL.createObjectURL(new Blob([content], { type })),
    download: filename
  });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
}

export const fmtDate = s => {
  if (!s) return "";
  const d = new Date(s + (s.length === 10 ? "T00:00:00" : ""));
  return isNaN(d) ? s : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
