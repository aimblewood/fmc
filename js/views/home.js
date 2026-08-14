/* Member home — greeting, fleet snapshot, latest briefing, quick links. */
import { el, icon, pageHead, fmtDate } from "../ui.js";
import { store, collectAlerts, loadSampleData, displayTitle } from "../store.js";
import { RATES_ASOF } from "../rates.js";
import { gbp } from "../rates.js";

export function renderHome({ session, rerender }) {
  const counts = store.counts();
  const isEmpty = Object.values(counts).every(n => n === 0);
  const vehicles = store.list("vehicles");
  const contracts = store.list("contracts");
  const alerts = collectAlerts().slice(0, 5);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (session.name || "").split(" ")[0] || "there";

  const evCount = vehicles.filter(v => v.fuelType === "Electric").length;
  const monthly = contracts.reduce((s, c) => s + (+c.financeRental || 0) + (+c.serviceRental || 0), 0);

  const wrap = el("div", { class: "stagger" },
    ...pageHead({
      crumb: "Member area",
      title: `${greet}, ${firstName}.`,
      sub: "Here's where your fleet stands today.",
      actions: [el("span", { class: "rates-stamp" }, el("span", { class: "dot" }), "Rates current as of " + RATES_ASOF)]
    })
  );

  if (isEmpty) {
    wrap.append(el("div", { class: "card pad-lg", style: "text-align:center" },
      el("div", { style: "font-size:34px;margin-bottom:6px" }, "🗂️"),
      el("h2", {}, "Let's get your fleet in"),
      el("p", { class: "page-sub", style: "margin:0 auto 18px" },
        "Add vehicles by hand, import your spreadsheet, or explore with a realistic sample fleet first."),
      el("div", { style: "display:flex;gap:10px;justify-content:center;flex-wrap:wrap" },
        el("a", { class: "btn primary", href: "#/fleet" }, icon("car"), "Open My Fleet"),
        el("button", { class: "btn", onclick: () => { loadSampleData(); rerender(); } }, "Load sample fleet")
      )
    ));
  } else {
    wrap.append(el("div", { class: "tiles" },
      tile("Vehicles", String(vehicles.length), "across your fleet"),
      tile("Renewals & MOTs due", String(collectAlerts().length), "within 30 days", collectAlerts().some(a => a.status.level === "red") ? "alert-red" : (collectAlerts().length ? "alert" : "")),
      tile("Electric share", vehicles.length ? Math.round(100 * evCount / vehicles.length) + "%" : "—", evCount + " of " + vehicles.length + " vehicles"),
      tile("Contracted rentals", gbp(monthly), "per month, ex VAT")
    ));
  }

  const briefing = el("div", { class: "card" },
    el("div", { style: "display:flex;align-items:center;gap:10px;margin-bottom:8px" },
      icon("news"), el("h3", { style: "margin:0" }, "This month in fleet — August 2026"),
      el("span", { class: "badge gold" }, "SAMPLE")),
    el("p", { class: "small", style: "margin-bottom:10px" }, "The monthly member briefing: what changed, and what to do about it."),
    el("ul", { style: "margin:0;padding-left:18px;font-size:13.5px;color:var(--ink-2);display:grid;gap:6px" },
      el("li", {}, "Advisory fuel rates moved on 1 June — petrol up to 14–26p/mile by engine size. If you reimburse at a flat rate, re-check it."),
      el("li", {}, "Pump prices have climbed this summer; a 12k-mile diesel van now costs roughly £180/month in fuel alone."),
      el("li", {}, "BiK on EVs is 4% this year and stays cheap through the decade — locked through 2029/30. The salary-sacrifice window is still wide open."),
      el("li", {}, "Reminder: the expensive-car VED supplement threshold for new EVs moved to £50,000 in April.")),
    el("div", { style: "margin-top:12px" }, el("a", { class: "btn sm", href: "#/resources" }, "Read the full briefing"))
  );

  const alertCard = el("div", { class: "card" },
    el("div", { style: "display:flex;align-items:center;gap:10px;margin-bottom:8px" },
      icon("flag"), el("h3", { style: "margin:0" }, "Needs your attention")),
    alerts.length === 0
      ? el("p", { class: "small", style: "margin:0" }, isEmpty ? "Nothing yet — add your fleet and key dates will surface here." : "Nothing due in the next 30 days. Enjoy the quiet.")
      : el("div", {}, alerts.map(a =>
          el("div", { class: "res-row", style: "padding:10px 2px" },
            el("span", { class: "due " + a.status.level }, el("span", { class: "d" }), a.status.text),
            el("div", { class: "r-body" },
              el("div", { class: "r-title" }, a.label + " — " + a.title),
              el("div", { class: "r-meta" }, fmtDate(a.rec[a.field]))),
            el("a", { class: "btn ghost sm", href: "#/fleet/" + a.entity }, "View")
          ))),
    el("div", { style: "margin-top:10px" }, el("a", { class: "btn sm", href: "#/fleet" }, "Open My Fleet"))
  );

  const quick = el("div", { class: "card" },
    el("div", { style: "display:flex;align-items:center;gap:10px;margin-bottom:10px" },
      icon("bolt"), el("h3", { style: "margin:0" }, "Quick answers")),
    el("div", { style: "display:grid;gap:8px" },
      quickLink("#/tools/tax", "What will this car cost a driver?", "Company car tax through 2029/30"),
      quickLink("#/tools/wlc", "What does a vehicle really cost us?", "Whole life cost, pence per mile"),
      quickLink("#/resources", "Need a policy or handbook?", "Ready-to-deploy template suite")
    )
  );

  wrap.append(el("div", { class: "grid cols-2", style: "align-items:start" },
    el("div", { class: "grid" }, briefing),
    el("div", { class: "grid" }, alertCard, quick)));
  return wrap;
}

function tile(label, value, foot, cls = "") {
  return el("div", { class: "tile " + cls },
    el("div", { class: "t-label" }, label),
    el("div", { class: "t-value" }, value),
    el("div", { class: "t-foot" }, foot));
}
function quickLink(href, title, sub) {
  return el("a", { href, style: "display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;color:inherit;text-decoration:none;transition:border-color .15s", onmouseenter: e => e.currentTarget.style.borderColor = "var(--brand)", onmouseleave: e => e.currentTarget.style.borderColor = "var(--line)" },
    el("div", {}, el("div", { style: "font-weight:600;font-size:13.5px" }, title), el("div", { class: "small" }, sub)),
    icon("arrow", 16));
}
