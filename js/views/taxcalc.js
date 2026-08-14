/* Company Car Tax Calculator — BiK through 2029/30. */
import { el, field, pageHead } from "../ui.js";
import { bikPercent, TAX_YEARS, CURRENT_TAX_YEAR, TAX_BANDS, CLASS_1A_NIC, FUEL_BENEFIT_MULTIPLIER, RATES_ASOF, SOURCES, gbp } from "../rates.js";

export function renderTaxCalc() {
  const state = {
    p11d: 40000, co2: 0, fuel: "electric", evRange: 250,
    region: "rUK", bandIdx: 1, capital: 0, privateUse: 0, fuelBenefit: false
  };

  const out = el("div", {});

  const p11d = numInput("p11d", state.p11d);
  const co2 = numInput("co2", state.co2);
  const evRange = numInput("evRange", state.evRange);
  const capital = numInput("capital", state.capital);
  const privateUse = numInput("privateUse", state.privateUse);
  const fuel = el("select", { id: "fuel" },
    opt("electric", "Electric"), opt("petrol", "Petrol"), opt("hybrid", "Hybrid / Plug-in hybrid"),
    opt("diesel", "Diesel (RDE2)"), opt("diesel-non-rde2", "Diesel (non-RDE2, +4%)"));
  const region = el("select", { id: "region" }, opt("rUK", "England, Wales & NI"), opt("scotland", "Scotland"));
  const band = el("select", { id: "band" });
  const fuelBen = el("input", { type: "checkbox", id: "fuelben" });

  function refreshBands() {
    band.replaceChildren(...TAX_BANDS[region.value].map((b, i) => opt(String(i), b.label)));
    band.value = String(Math.min(state.bandIdx, TAX_BANDS[region.value].length - 1));
  }
  refreshBands();
  band.value = "1";

  const evRangeField = field({ label: "Electric range (miles)", input: evRange, hint: "Only affects hybrids at 1–50 g/km, until range bands end in April 2028." });
  const fuelBenRow = el("div", { class: "field" },
    el("label", { style: "display:flex;gap:8px;align-items:center;cursor:pointer" }, fuelBen,
      "Employer pays for private fuel (fuel benefit)"),
    el("div", { class: "hint" }, `Adds ${gbp(FUEL_BENEFIT_MULTIPLIER)} × BiK % to the taxable benefit. Rarely worth it — the tool will tell you.`));

  function read() {
    state.p11d = +p11d.value || 0;
    state.co2 = +co2.value || 0;
    state.fuel = fuel.value;
    state.evRange = +evRange.value || 0;
    state.region = region.value;
    state.bandIdx = +band.value || 0;
    state.capital = Math.min(+capital.value || 0, 5000);
    state.privateUse = +privateUse.value || 0;
    state.fuelBenefit = fuelBen.checked;
    if (state.fuel === "electric") { state.co2 = 0; co2.value = 0; }
    evRangeField.style.display = (state.fuel !== "electric" && state.co2 > 0 && state.co2 <= 50) ? "" : "none";
    fuelBenRow.style.display = state.fuel === "electric" ? "none" : "";
    render();
  }

  [p11d, co2, evRange, capital, privateUse, fuel, band, fuelBen].forEach(i => i.addEventListener("input", read));
  region.addEventListener("input", () => { refreshBands(); read(); });

  function render() {
    const rate = TAX_BANDS[state.region][state.bandIdx].rate;
    const priceBase = Math.max(0, state.p11d - Math.min(state.capital, 5000));
    const years = TAX_YEARS.map(y => {
      const p = bikPercent(y, state.co2, state.fuel, state.evRange);
      const carBenefit = Math.max(0, priceBase * p / 100 - state.privateUse * 12);
      const fuelBenefit = state.fuelBenefit && state.fuel !== "electric" ? FUEL_BENEFIT_MULTIPLIER * p / 100 : 0;
      const benefit = carBenefit + fuelBenefit;
      return { y, p, benefit, tax: benefit * rate, nic: benefit * CLASS_1A_NIC };
    });
    const now = years.find(x => x.y === CURRENT_TAX_YEAR);
    const total4 = years.reduce((s, x) => s + x.tax, 0);

    out.replaceChildren(
      el("div", { class: "result-hero" },
        el("span", { class: "rh-num", id: "tax-monthly" }, gbp(now.tax / 12)),
        el("span", { class: "rh-cap" }, "per month for the driver in " + CURRENT_TAX_YEAR,
          el("br"), gbp(now.tax) + "/year at your marginal rate")),
      el("div", { class: "year-cards" },
        ...years.map(x => el("div", { class: "year-card" + (x.y === CURRENT_TAX_YEAR ? " current" : "") },
          el("div", { class: "yc-yr" }, x.y),
          el("div", { class: "yc-pct" }, x.p + "%"),
          el("div", { class: "yc-line" }, el("span", {}, "Benefit"), el("span", {}, gbp(x.benefit))),
          el("div", { class: "yc-line" }, el("span", {}, "Driver"), el("strong", {}, gbp(x.tax / 12) + "/mo")),
          el("div", { class: "yc-line" }, el("span", {}, "Employer"), el("span", {}, gbp(x.nic)))))),
      el("div", { style: "display:flex;gap:18px;flex-wrap:wrap;margin-top:16px;align-items:center" },
        el("div", { class: "badge green" }, "4-year driver total: " + gbp(total4)),
        el("div", { class: "badge grey" }, "Employer Class 1A over 4 years: " + gbp(years.reduce((s, x) => s + x.nic, 0))),
        state.fuelBenefit && state.fuel !== "electric" ? el("div", { class: "badge amber" }, "Fuel benefit costs the driver " + gbp(now.p / 100 * FUEL_BENEFIT_MULTIPLIER * rate) + "/yr — worth it only above " + Math.round((now.p / 100 * FUEL_BENEFIT_MULTIPLIER * rate) / 0.14 / 0.55) + " private miles/yr on typical petrol costs") : null
      ),
      el("p", { class: "small", style: "margin-top:14px" },
        "Assumes a car first registered after 6 April 2020, available all year. Capital contributions capped at £5,000. ",
        state.region === "scotland" ? "Scottish income tax bands applied. " : "",
        "BiK percentages are the published HMRC rates for each year.")
    );
  }

  const formCard = el("div", { class: "card" },
    el("h3", {}, "The car"),
    field({ label: "P11D value", input: p11d, hint: "List price incl. VAT & options, ex first-reg fee and VED." }),
    el("div", { class: "form-row" },
      field({ label: "Fuel type", input: fuel }),
      field({ label: "CO2 (g/km, WLTP)", input: co2 })),
    evRangeField,
    el("hr", { class: "roadline" }),
    el("h3", {}, "The driver"),
    el("div", { class: "form-row" },
      field({ label: "Tax region", input: region }),
      field({ label: "Marginal tax band", input: band })),
    el("div", { class: "form-row" },
      field({ label: "Capital contribution", input: capital, hint: "One-off, reduces the taxable price (max £5,000)." }),
      field({ label: "Private use payment (monthly)", input: privateUse, hint: "Regular payments reduce the benefit." })),
    fuelBenRow
  );

  const wrap = el("div", { class: "stagger" },
    ...pageHead({
      crumb: "Tools",
      title: "Company Car Tax Calculator",
      sub: "What a company car costs the driver — and the employer — for every tax year through 2029/30.",
      actions: [el("span", { class: "rates-stamp" }, el("span", { class: "dot" }), "Rates current as of " + RATES_ASOF)]
    }),
    el("div", { class: "grid cols-2", style: "align-items:start" },
      formCard,
      el("div", { class: "card" }, el("h3", {}, "The answer"), out)),
    el("details", { class: "card", style: "margin-top:16px" },
      el("summary", { style: "cursor:pointer;font-weight:600" }, "Rate sources"),
      el("ul", { style: "margin:10px 0 0;padding-left:18px;font-size:13px" },
        ...SOURCES.map(s => el("li", {}, el("a", { href: s.url, target: "_blank", rel: "noopener" }, s.label)))))
  );

  read();
  return wrap;
}

const opt = (v, t) => el("option", { value: v }, t);
const numInput = (id, val) => el("input", { type: "number", id, value: String(val), min: "0", step: "any", inputmode: "decimal" });
