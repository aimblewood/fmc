/* Tools — the moat. Live tools plus the roadmap as locked cards. */
import { el, icon, pageHead, toast } from "../ui.js";

const LIVE = [
  { href: "#/tools/tax", ico: "pound", title: "Company Car Tax Calculator", desc: "What a car costs a driver per month — every tax year through 2029/30, with the employer's Class 1A bill alongside.", badge: "LIVE" },
  { href: "#/tools/wlc", ico: "calc", title: "Whole Life Cost Calculator", desc: "The true cost per vehicle and per mile: funding, SMR, energy, insurance, VED and NIC — compared side by side.", badge: "LIVE" },
  { href: "#/fleet", ico: "car", title: "My Fleet", desc: "Your vehicles, contracts, drivers and key dates in one place — with renewal alerts and spreadsheet import.", badge: "LIVE" }
];

const SOON = [
  { ico: "chart", title: "Salary Sacrifice Modeller", desc: "Driver and employer savings on a salsac EV, net of NIC and pension effects." },
  { ico: "calc", title: "Funding Method Comparator", desc: "Contract hire vs outright vs salary sacrifice on the same vehicle, VAT-aware." },
  { ico: "bolt", title: "EV Suitability Checker", desc: "Which of your drivers could go electric tomorrow, from mileage and journey patterns." },
  { ico: "pound", title: "Fuel & AER Reimbursement Calculator", desc: "Actual cost per mile vs HMRC advisory rates, per vehicle." },
  { ico: "cart", title: "Disposal Value Tracker", desc: "What your outright-purchase vehicles are worth now, and the best moment to sell." }
];

export function renderTools() {
  return el("div", { class: "stagger" },
    ...pageHead({
      crumb: "Member area",
      title: "Tools",
      sub: "Working tools, not documents — the reason the club exists. Fast, accurate, and updated the day rates change."
    }),
    el("div", { class: "grid cols-3" },
      ...LIVE.map(t => el("a", { class: "card tool-card", href: t.href },
        el("div", { class: "tc-ico" }, icon(t.ico, 22)),
        el("h3", {}, t.title),
        el("p", {}, t.desc),
        el("div", { class: "tc-foot" }, el("span", { class: "badge green" }, t.badge), icon("arrow", 16))))
    ),
    el("h2", { style: "margin:26px 0 4px" }, "On the bench"),
    el("p", { class: "page-sub" }, "Built next, in member-priority order. Tell us which one you need first."),
    el("div", { class: "grid cols-3" },
      ...SOON.map(t => el("div", { class: "card tool-card soon", role: "button", tabindex: "0", onclick: () => toast("On the roadmap — coming to your membership soon."), onkeydown: e => { if (e.key === "Enter") toast("On the roadmap — coming to your membership soon."); } },
        el("div", { class: "tc-ico" }, icon(t.ico, 22)),
        el("h3", {}, t.title),
        el("p", {}, t.desc),
        el("div", { class: "tc-foot" }, el("span", { class: "badge grey" }, "COMING SOON"), icon("lock", 16))))
    )
  );
}
