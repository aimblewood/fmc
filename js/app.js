/* App shell + hash router with auth guards. */
import { auth, authReady } from "./auth.js";
import { bindUser, store, collectAlerts } from "./store.js";
import { el, icon, toast } from "./ui.js";
import { renderAuth } from "./views/authviews.js";
import { renderHome } from "./views/home.js";
import { renderResources } from "./views/resources.js";
import { renderTools } from "./views/tools.js";
import { renderTaxCalc } from "./views/taxcalc.js";
import { renderWlc } from "./views/wlc.js";
import { renderFleet } from "./views/fleet.js";
import { renderAccount } from "./views/account.js";
import { renderSystem } from "./views/system.js";
import { applyCustom, isAdmin } from "./custom.js";

applyCustom();

const app = document.getElementById("app");

const PUBLIC_ROUTES = ["login", "register", "reset"];
const ROUTES = {
  home: renderHome,
  resources: renderResources,
  tools: renderTools,
  "tools/tax": renderTaxCalc,
  "tools/wlc": renderWlc,
  fleet: renderFleet,
  account: renderAccount
};

const NAV = [
  { group: "Member area" },
  { route: "home", label: "Home", ico: "home" },
  { route: "resources", label: "Resources", ico: "book" },
  { route: "tools", label: "Tools", ico: "tools" },
  { route: "fleet", label: "My Fleet", ico: "car" },
  { group: "Coming soon" },
  { route: null, label: "Community", ico: "users", locked: true },
  { route: null, label: "Learning", ico: "cap", locked: true },
];

export function navigate(route) { location.hash = "#/" + route; }

function currentRoute() {
  const h = location.hash.replace(/^#\/?/, "");
  return h || null;
}

function shell(session, route, content) {
  const initials = (session.name || session.email).split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const alerts = collectAlerts();
  const rail = el("nav", { class: "rail", id: "rail", "aria-label": "Main navigation" },
    el("div", { class: "rail-logo" }, el("span", { class: "mark" }, "F"), el("span", {}, "fleetmanager", el("span", { style: "color:var(--gold)" }, ".club"))),
    NAV.map(item => {
      if (item.group) return el("div", { class: "rail-group" }, item.group);
      if (item.locked) return el("a", { class: "nav", href: "#", onclick: e => { e.preventDefault(); toast(item.label + " is coming in a later phase."); } },
        icon(item.ico), item.label, el("span", { class: "lock" }, "SOON"));
      const active = route === item.route || (item.route !== "home" && route?.startsWith(item.route));
      const badge = item.route === "fleet" && alerts.length
        ? el("span", { class: "lock", style: "background:#FCF3DC;color:var(--warn-text)" }, String(alerts.length)) : null;
      return el("a", { class: "nav" + (active ? " active" : ""), href: "#/" + item.route, "aria-current": active ? "page" : null },
        icon(item.ico), item.label, badge);
    }),
    el("div", { class: "rail-spacer" }),
    isAdmin(session)
      ? el("a", { class: "nav" + (route?.startsWith("system") ? " active" : ""), href: "#/system", dataset: { test: "system-nav" } },
          icon("tools"), "System", el("span", { class: "lock", style: "background:var(--brand-tint);color:var(--brand-deep)" }, "ADMIN"))
      : null,
    el("a", { class: "nav" + (route === "account" ? " active" : ""), href: "#/account" }, icon("person"), "Account & security"),
    el("div", { class: "rail-user" },
      el("div", { class: "avatar" }, initials),
      el("div", { class: "who" },
        el("div", { class: "nm" }, session.name || "Member"),
        el("div", { class: "em" }, session.email)),
      el("button", { class: "btn ghost sm", title: "Sign out", "aria-label": "Sign out", onclick: doSignOut }, icon("logout"))
    )
  );

  const menuBtn = el("button", { class: "btn menu-btn", "aria-label": "Open menu", onclick: () => {
    rail.classList.add("open");
    const veil = el("div", { class: "rail-veil", onclick: () => { rail.classList.remove("open"); veil.remove(); } });
    document.body.append(veil);
  } }, "☰ Menu");

  return el("div", { class: "shell" }, rail, el("main", { class: "main" }, content), menuBtn);
}

function doSignOut() {
  auth.signOut();
  toast("Signed out.");
  navigate("login");
}

async function render() {
  await authReady;
  const session = auth.getSession();
  let route = currentRoute();

  if (!session) {
    if (!route || !PUBLIC_ROUTES.includes(route)) { location.replace("#/login"); route = "login"; }
    app.replaceChildren(renderAuth(route, { onAuthed: onAuthed }));
    return;
  }

  bindUser(session.userId);
  if (!route || PUBLIC_ROUTES.includes(route)) { location.replace("#/home"); route = "home"; }

  const renderer = ROUTES[route] || ROUTES[route?.split("/").slice(0, 2).join("/")] || null;
  const ctx = { session, navigate, rerender: render };
  let content;
  if (route.startsWith("system")) {
    if (isAdmin(session)) content = renderSystem(ctx, route);
    else { toast("The System area is for global admins."); location.replace("#/home"); return; }
  }
  else if (renderer) content = renderer(ctx, route);
  else if (route.startsWith("fleet")) content = renderFleet(ctx, route);
  else {
    content = el("div", {}, el("h1", {}, "Not found"), el("p", {}, "That page doesn't exist. ", el("a", { href: "#/home" }, "Back to home")));
  }
  app.replaceChildren(shell(session, route, content));
  window.scrollTo(0, 0);
}

function onAuthed(session) {
  bindUser(session.userId);
  // first sign-in: offer sample data via home view (it detects empty store)
  navigate("home");
  render();
}

window.addEventListener("hashchange", render);
render();
