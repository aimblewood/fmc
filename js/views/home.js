/* Member home — greeting + widget layout. */
import { el, icon, pageHead } from "../ui.js";
import { store, loadSampleData } from "../store.js";
import { RATES_ASOF } from "../rates.js";
import { renderLayout } from "../widgets.js";

export function renderHome({ session, rerender }) {
  const counts = store.counts();
  const isEmpty = Object.values(counts).every(n => n === 0);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (session.name || "").split(" ")[0] || "there";

  const wrap = el("div", { class: "stagger" },
    ...pageHead({
      crumb: "Member area",
      title: `${greet}, ${firstName}.`,
      sub: "Here's where your fleet stands today.",
      actions: [el("span", { class: "rates-stamp" }, el("span", { class: "dot" }), "Rates current as of " + RATES_ASOF)]
    })
  );

  if (isEmpty) {
    wrap.append(el("div", { class: "card pad-lg", style: "text-align:center;margin-bottom:16px" },
      el("div", { style: "font-size:34px;margin-bottom:6px" }, "🗂️"),
      el("h2", {}, "Let's get your fleet in"),
      el("p", { class: "page-sub", style: "margin:0 auto 18px" },
        "Add vehicles by hand, import your spreadsheet, or explore with a realistic sample fleet first."),
      el("div", { style: "display:flex;gap:10px;justify-content:center;flex-wrap:wrap" },
        el("a", { class: "btn primary", href: "#/fleet" }, icon("car"), "Open My Fleet"),
        el("button", { class: "btn", onclick: () => { loadSampleData(); rerender(); } }, "Load sample fleet")
      )
    ));
  }

  wrap.append(renderLayout("home"));
  return wrap;
}
