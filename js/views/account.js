/* Account & security. */
import { el, pageHead, toast, confirmDialog, downloadText } from "../ui.js";
import { auth } from "../auth.js";
import { store } from "../store.js";

export function renderAccount({ session, navigate }) {
  const mode = auth.mode;
  return el("div", { class: "stagger" },
    ...pageHead({ crumb: "Member area", title: "Account & security" }),
    el("div", { class: "grid cols-2", style: "align-items:start" },
      el("div", { class: "card" },
        el("h3", {}, "Your membership"),
        row("Name", session.name || "—"),
        row("Email", session.email),
        row("Company", session.company || "—"),
        row("Tier", "Club (demo)"),
        row("Auth mode", mode === "demo" ? "Demo — browser-local accounts" : "Supabase — hosted auth"),
        el("div", { style: "margin-top:14px;display:flex;gap:10px;flex-wrap:wrap" },
          el("button", { class: "btn", onclick: () => { auth.signOut(); toast("Signed out."); navigate("login"); } }, "Sign out"))),
      el("div", { class: "card" },
        el("h3", {}, "Your data"),
        el("p", { class: "small" }, "Lock-in should come from value, not hostage-taking — your data leaves with you, any time."),
        el("div", { style: "display:flex;gap:10px;flex-wrap:wrap" },
          el("button", { class: "btn", onclick: () => { downloadText("fleet-data-export.json", store.exportJson(), "application/json"); toast("Full data export downloaded."); } }, "Export everything (JSON)"),
          el("button", { class: "btn danger", onclick: () => confirmDialog("Delete ALL fleet data stored for this account? This cannot be undone.", () => { store.wipe(); toast("All fleet data deleted."); navigate("home"); }) }, "Delete all fleet data")),
        el("hr", { class: "roadline" }),
        el("h3", {}, "Security notes"),
        el("ul", { style: "margin:0;padding-left:18px;font-size:13px;color:var(--ink-2);display:grid;gap:6px" },
          el("li", {}, mode === "demo"
            ? "Demo build: your account and data live only in this browser. Passwords are salted and hashed (PBKDF2-SHA256, 150k rounds); sessions expire after 12 hours; repeated failed sign-ins are throttled."
            : "Live mode: hosted authentication via Supabase with email confirmation and secure password reset."),
          el("li", {}, "Going live adds: server-side accounts, email confirmation, row-level security so members only ever see their own fleet, and encrypted storage for MID credentials."),
          el("li", {}, "UK GDPR posture (retention, export, deletion) is designed in from the start — the buttons above are the first piece."))))
  );
}

const row = (k, v) => el("div", { style: "display:flex;justify-content:space-between;gap:14px;padding:8px 0;border-bottom:1px solid var(--line);font-size:14px" },
  el("span", { style: "color:var(--muted);font-weight:600" }, k), el("span", {}, v));
