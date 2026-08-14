/* Resources — template suite, monthly briefing, guides.
 * Content entries are SAMPLE placeholders demonstrating the structure;
 * real member content replaces the bodies at launch. */
import { el, icon, pageHead, downloadText, modal } from "../ui.js";
import { RATES_ASOF } from "../rates.js";

const TEMPLATES = [
  { title: "Company Vehicle Policy", version: "v2.1 · Aug 2026", desc: "The core policy: eligibility, choice, private use, fines, EV charging at home, end-of-employment.", file: "fleet-policy" },
  { title: "Driver Handbook", version: "v2.0 · Jul 2026", desc: "Day-to-day rules for drivers: checks, servicing, accidents, fuel cards, phones and penalties.", file: "driver-handbook" },
  { title: "Driver Declaration & Licence Mandate", version: "v1.4 · Jul 2026", desc: "Annual declaration plus DVLA licence-check consent (D906 mandate wording).", file: "driver-declaration" },
  { title: "Accident / Incident Pack", version: "v1.2 · Jun 2026", desc: "Glovebox bump card and the incident report form your insurer actually wants filled in.", file: "incident-pack" },
  { title: "Grey Fleet Policy & Checklist", version: "v1.1 · Jun 2026", desc: "Own-car business use: insurance verification, MOT checks, mileage rates and approval flow.", file: "grey-fleet" }
];

const GUIDES = [
  { title: "Your First EVs: a pathway for SME fleets", mins: 12, tag: "Electrification", body: "Which roles suit EVs first · home vs workplace charging · what to put in the policy before the first delivery." },
  { title: "Company car tax, explained for HR and Finance", mins: 8, tag: "Tax", body: "How BiK actually works, why the P11D value matters, and the questions drivers will ask you." },
  { title: "AER & reimbursement: paying for electric miles", mins: 6, tag: "Electrification", body: "The 7p/15p advisory electric rates, when to pay actuals, and keeping HMRC comfortable." },
  { title: "Salary sacrifice: is it right for your fleet?", mins: 10, tag: "Funding", body: "The mechanics, the NIC saving, the risks (leavers, OpRA), and when it beats a traditional scheme." },
  { title: "ZEV mandate: what it means at 25–200 vehicles", mins: 7, tag: "Regulation", body: "What the mandate does to supply and discounts, and how to time your orders around it." }
];

const BRIEFING = {
  title: "This month in fleet — August 2026",
  body: [
    ["Advisory fuel rates", "HMRC's rates from 1 June: petrol 14–26p/mile, diesel 15–23p/mile by engine size; electric stays at 7p home / 15p public. If your reimbursement rates are older than June, they're wrong."],
    ["Fuel prices", "Pump prices have risen sharply this summer. Re-run your whole-life costs on current prices before approving new ICE orders — the EV gap has widened again."],
    ["Company car tax", "BiK for EVs is 4% in 2026/27, rising gently to 9% by 2029/30 — still a fraction of any petrol car. Rates are published through 2029/30, so multi-year driver quotes are safe to give."],
    ["VED", "Standard rate is £200 this year; the expensive-car supplement (£440, years 2–6) now catches new EVs over £50,000 registered since April."],
    ["Do this month", "Check every contract ending within 6 months and start replacement conversations now — factory lead times on popular EVs are back above 4 months."]
  ]
};

export function renderResources() {
  const wrap = el("div", { class: "stagger" },
    ...pageHead({
      crumb: "Member area",
      title: "Resources",
      sub: "Templates that are ready to deploy, briefings that tell you what changed, and guides with no van-shaped sales pitch at the end.",
      actions: [el("span", { class: "rates-stamp" }, el("span", { class: "dot" }), "Maintained · " + RATES_ASOF)]
    })
  );

  const search = el("input", { type: "text", placeholder: "Search resources…", style: "max-width:340px", oninput: e => filter(e.target.value) });
  wrap.append(el("div", { style: "margin-bottom:18px" }, search));

  const briefingCard = el("div", { class: "card", "data-search": BRIEFING.title.toLowerCase() },
    el("div", { style: "display:flex;align-items:center;gap:10px;margin-bottom:6px" },
      icon("news"), el("h3", { style: "margin:0" }, "Monthly briefing"), el("span", { class: "badge gold" }, "SAMPLE")),
    el("div", { class: "res-row" },
      el("div", { class: "r-ico" }, icon("news")),
      el("div", { class: "r-body" },
        el("div", { class: "r-title" }, BRIEFING.title),
        el("div", { class: "r-meta" }, "5 min read · what changed and what to do about it")),
      el("button", { class: "btn sm", onclick: openBriefing }, "Read"))
  );

  const tplCard = el("div", { class: "card" },
    el("div", { style: "display:flex;align-items:center;gap:10px;margin-bottom:6px" },
      icon("doc"), el("h3", { style: "margin:0" }, "Template suite"),
      el("span", { class: "badge green" }, "VERSIONED"), el("span", { class: "badge gold" }, "SAMPLE")),
    el("p", { class: "small" }, "Current, consistent and maintained — not a member-donation graveyard. Each download is a working draft to adapt to your company."),
    ...TEMPLATES.map(t =>
      el("div", { class: "res-row", "data-search": (t.title + " " + t.desc).toLowerCase() },
        el("div", { class: "r-ico" }, icon("doc")),
        el("div", { class: "r-body" },
          el("div", { class: "r-title" }, t.title),
          el("div", { class: "r-meta" }, el("span", { class: "badge grey" }, t.version), t.desc)),
        el("button", { class: "btn sm", onclick: () => downloadTemplate(t) }, icon("download", 15), "Download")))
  );

  const guideCard = el("div", { class: "card" },
    el("div", { style: "display:flex;align-items:center;gap:10px;margin-bottom:6px" },
      icon("book"), el("h3", { style: "margin:0" }, "Guides"), el("span", { class: "badge gold" }, "SAMPLE")),
    ...GUIDES.map(g =>
      el("div", { class: "res-row", "data-search": (g.title + " " + g.tag + " " + g.body).toLowerCase() },
        el("div", { class: "r-ico" }, icon("book")),
        el("div", { class: "r-body" },
          el("div", { class: "r-title" }, g.title),
          el("div", { class: "r-meta" }, el("span", { class: "badge blue" }, g.tag), g.mins + " min · " + g.body)),
        el("button", { class: "btn sm", onclick: () => modal({ title: g.title, body: el("div", {}, el("p", { class: "small" }, el("span", { class: "badge gold" }, "SAMPLE"), " Full guide content ships with the live content layer."), el("p", {}, g.body)) }) }, "Preview")))
  );

  wrap.append(el("div", { class: "grid" }, briefingCard, tplCard, guideCard));

  function filter(q) {
    q = q.trim().toLowerCase();
    wrap.querySelectorAll("[data-search]").forEach(n => {
      n.style.display = !q || n.dataset.search.includes(q) ? "" : "none";
    });
  }
  return wrap;
}

function openBriefing() {
  modal({
    title: BRIEFING.title,
    wide: true,
    body: el("div", {},
      el("p", { class: "small" }, el("span", { class: "badge gold" }, "SAMPLE"), " Illustrative content — the live briefing is written fresh each month."),
      ...BRIEFING.body.map(([h, p]) => el("div", { style: "margin-bottom:14px" }, el("h3", {}, h), el("p", { style: "margin:0;color:var(--ink-2)" }, p)))
    )
  });
}

function downloadTemplate(t) {
  const md = `# ${t.title}\n_${t.version} · fleetmanager.club template suite (SAMPLE)_\n\n> This is a sample scaffold from the demo build. The live template suite ships\n> complete, versioned documents maintained by the club.\n\n## Purpose\n${t.desc}\n\n## 1. Scope\n[Who this applies to]\n\n## 2. Policy\n[Body]\n\n## 3. Responsibilities\n[Roles]\n\n## 4. Review\nReviewed quarterly. Next review: November 2026.\n`;
  downloadText(t.file + ".md", md, "text/markdown");
}
