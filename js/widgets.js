/* Widget registry + layout-driven rendering.
 * Screens (Home, My Fleet dashboard) are composed from widgets on a
 * 12-column grid. Layouts come from the customisation engine; per-member
 * layouts plug into the same mechanism in a later phase. */
import { el, icon, fmtDate } from "./ui.js";
import { store, collectAlerts } from "./store.js";
import { ENTITIES, FUTURE } from "./schema.js";
import { gbp } from "./rates.js";
import { getCustom } from "./custom.js";

const tile = (label, value, foot, cls = "") =>
  el("div", { class: "tile " + cls },
    el("div", { class: "t-label" }, label),
    el("div", { class: "t-value" }, value),
    el("div", { class: "t-foot" }, foot));

const card = (icoName, title, ...body) =>
  el("div", { class: "card", style: "height:100%" },
    el("div", { style: "display:flex;align-items:center;gap:10px;margin-bottom:8px" },
      icon(icoName), el("h3", { style: "margin:0" }, title)),
    ...body);

function alertList(limit) {
  const alerts = collectAlerts().slice(0, limit);
  if (!alerts.length) return el("p", { class: "small", style: "margin:0" }, "Nothing due in the next 30 days.");
  return el("div", {}, alerts.map(a =>
    el("div", { class: "res-row", style: "padding:9px 2px" },
      el("span", { class: "due " + a.status.level }, el("span", { class: "d" }), a.status.text),
      el("div", { class: "r-body" },
        el("div", { class: "r-title", style: "font-size:13.5px" }, a.label + " — " + a.title),
        el("div", { class: "r-meta" }, fmtDate(a.rec[a.field]))),
      el("a", { class: "btn ghost sm", href: "#/fleet/" + a.entity }, "Open"))));
}

const quickLink = (href, title, sub) =>
  el("a", { href, class: "ql" },
    el("div", {}, el("div", { style: "font-weight:600;font-size:13.5px" }, title), el("div", { class: "small" }, sub)),
    icon("arrow", 16));

export const WIDGETS = {
  statVehicles: {
    label: "Stat: fleet size", span: 3,
    render: () => tile("Vehicles", String(store.list("vehicles").length), "on fleet")
  },
  statDue: {
    label: "Stat: due in 30 days", span: 3,
    render: () => {
      const alerts = collectAlerts();
      return tile("Due in 30 days", String(alerts.length), alerts.length ? "MOTs, renewals, expiries" : "all clear",
        alerts.some(a => a.status.level === "red") ? "alert-red" : (alerts.length ? "alert" : ""));
    }
  },
  statEv: {
    label: "Stat: electric share", span: 3,
    render: () => {
      const v = store.list("vehicles");
      const ev = v.filter(x => x.fuelType === "Electric").length;
      return tile("Electric share", v.length ? Math.round(100 * ev / v.length) + "%" : "—", ev + " electric");
    }
  },
  statRentals: {
    label: "Stat: contracted rentals", span: 3,
    render: () => {
      const monthly = store.list("contracts").reduce((s, c) => s + (+c.financeRental || 0) + (+c.serviceRental || 0), 0);
      return tile("Contracted rentals", gbp(monthly), "per month, ex VAT");
    }
  },
  fuelMix: {
    label: "Chart: fleet by fuel", span: 6,
    render: () => {
      const vehicles = store.list("vehicles");
      if (!vehicles.length) return card("chart", "Fleet by fuel", el("p", { class: "small", style: "margin:0" }, "Add vehicles to see the mix."));
      const mixMap = {};
      vehicles.forEach(v => { const k = v.fuelType || "Unknown"; mixMap[k] = (mixMap[k] || 0) + 1; });
      const entries = Object.entries(mixMap).sort((a, b) => b[1] - a[1]);
      const max = Math.max(...entries.map(e => e[1]));
      return card("chart", "Fleet by fuel",
        el("div", { class: "minibar", role: "img", "aria-label": "Fleet count by fuel type" },
          ...entries.map(([k, n]) => el("div", { class: "mb-row" },
            el("span", {}, k),
            el("div", { class: "mb-track" }, el("div", { class: "mb-fill", style: `width:${n / max * 100}%;background:var(--s1)` })),
            el("span", { class: "mb-val" }, String(n))))));
    }
  },
  alerts: {
    label: "Needs your attention", span: 6,
    render: () => card("flag", "Needs your attention", alertList(6),
      el("div", { style: "margin-top:10px" }, el("a", { class: "btn sm", href: "#/fleet" }, "Open My Fleet")))
  },
  briefing: {
    label: "Monthly briefing", span: 6,
    render: () => el("div", { class: "card", style: "height:100%" },
      el("div", { style: "display:flex;align-items:center;gap:10px;margin-bottom:8px" },
        icon("news"), el("h3", { style: "margin:0" }, "This month in fleet — August 2026"),
        el("span", { class: "badge gold" }, "SAMPLE")),
      el("p", { class: "small", style: "margin-bottom:10px" }, "The monthly member briefing: what changed, and what to do about it."),
      el("ul", { style: "margin:0;padding-left:18px;font-size:13.5px;color:var(--ink-2);display:grid;gap:6px" },
        el("li", {}, "Advisory fuel rates moved on 1 June — petrol up to 14–26p/mile by engine size. If you reimburse at a flat rate, re-check it."),
        el("li", {}, "Pump prices have climbed this summer; a 12k-mile diesel van now costs roughly £180/month in fuel alone."),
        el("li", {}, "BiK on EVs is 4% this year and stays cheap through the decade — locked through 2029/30."),
        el("li", {}, "Reminder: the expensive-car VED supplement threshold for new EVs moved to £50,000 in April.")),
      el("div", { style: "margin-top:12px" }, el("a", { class: "btn sm", href: "#/resources" }, "Read the full briefing")))
  },
  quickAnswers: {
    label: "Quick answers", span: 6,
    render: () => card("bolt", "Quick answers",
      el("div", { style: "display:grid;gap:8px" },
        quickLink("#/tools/tax", "What will this car cost a driver?", "Company car tax through 2029/30"),
        quickLink("#/tools/wlc", "What does a vehicle really cost us?", "Whole life cost, pence per mile"),
        quickLink("#/resources", "Need a policy or handbook?", "Ready-to-deploy template suite")))
  },
  recordsNav: {
    label: "Records shortcuts", span: 12,
    render: () => {
      const counts = store.counts();
      return el("div", {},
        el("h2", { style: "margin:4px 0 10px" }, "Records"),
        el("div", { class: "grid cols-4" },
          ...Object.entries(ENTITIES).map(([k, e]) =>
            el("a", { class: "card tool-card", href: "#/fleet/" + k, style: "padding:16px" },
              el("div", { class: "tc-ico", style: "width:36px;height:36px" }, icon(e.icon, 19)),
              el("h3", { style: "font-size:15px" }, e.name),
              el("div", { class: "tc-foot" },
                el("span", { class: "badge " + (counts[k] ? "green" : "grey") }, counts[k] + " record" + (counts[k] === 1 ? "" : "s")),
                icon("arrow", 15))))));
    }
  },
  futureAddons: {
    label: "Future add-ons strip", span: 12,
    render: () => el("div", {},
      el("h2", { style: "margin:4px 0 4px" }, "Future add-ons"),
      el("p", { class: "page-sub" }, "Structured and named, waiting on the roadmap."),
      el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" },
        ...FUTURE.map(f => el("span", { class: "badge grey", style: "font-size:12.5px;padding:7px 13px" }, f + " · soon"))))
  }
};

export const DEFAULT_LAYOUTS = {
  home: [
    { w: "statVehicles" }, { w: "statDue" }, { w: "statEv" }, { w: "statRentals" },
    { w: "briefing" }, { w: "alerts" }, { w: "quickAnswers" }
  ],
  fleet: [
    { w: "statVehicles" }, { w: "statDue" }, { w: "statEv" }, { w: "statRentals" },
    { w: "fuelMix" }, { w: "alerts" }, { w: "recordsNav" }, { w: "futureAddons" }
  ]
};

export function getLayout(page) {
  const custom = getCustom().layouts?.[page];
  const layout = (custom && custom.length ? custom : DEFAULT_LAYOUTS[page]) || [];
  return layout.filter(item => WIDGETS[item.w]);
}

export function renderLayout(page) {
  const grid = el("div", { class: "widget-grid" });
  for (const item of getLayout(page)) {
    const def = WIDGETS[item.w];
    const span = item.span || def.span;
    grid.append(el("div", { class: "wg-item s" + span, dataset: { widget: item.w } }, def.render()));
  }
  return grid;
}
