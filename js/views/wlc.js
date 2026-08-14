/* Whole Life Cost Calculator — standard assumptions, two vehicles side by side. */
import { el, field, pageHead } from "../ui.js";
import { bikPercent, CURRENT_TAX_YEAR, CLASS_1A_NIC, VED, DEFAULTS, RATES_ASOF, gbp } from "../rates.js";

const FUELS = [
  ["electric", "Electric"], ["petrol", "Petrol"], ["diesel", "Diesel"], ["hybrid", "Hybrid / PHEV"]
];

function defaultVehicle(which) {
  return which === 0
    ? { label: "Vehicle A", make: "Škoda Enyaq 85 (example)", fuel: "electric", p11d: 44585, otr: 45280, co2: 0, evRange: 330, consumption: 3.6, funding: "lease", rental: 431, serviceRental: 49, initial: 1293, term: 48, miles: 12000 }
    : { label: "Vehicle B", make: "VW Tiguan 1.5 TSI (example)", fuel: "petrol", p11d: 39500, otr: 40105, co2: 138, evRange: 0, consumption: 44.1, funding: "lease", rental: 468, serviceRental: 46, initial: 1404, term: 48, miles: 12000 }
}

export function renderWlc() {
  const shared = {
    petrolPpl: DEFAULTS.petrolPencePerLitre, dieselPpl: DEFAULTS.dieselPencePerLitre,
    elecPpk: DEFAULTS.elecHomePencePerKwh, insurance: DEFAULTS.insurancePerYear,
    vatReg: true, residualPct: DEFAULTS.residualPct3yr * 100
  };
  const vehicles = [defaultVehicle(0), defaultVehicle(1)];
  const out = el("div", {});

  /* ---- calculation ---- */
  function costs(v) {
    const months = +v.term || 36;
    const miles = +v.miles || 0;
    const monthlyMiles = miles / 12;

    // funding
    let funding, fundingNote;
    if (v.funding === "lease") {
      // 50% VAT block on finance rental for cars with private use (if VAT registered)
      const financeNet = shared.vatReg ? (+v.rental || 0) * (1 - 0.5 * (0.20 / 1.20)) : (+v.rental || 0);
      const serviceNet = shared.vatReg ? (+v.serviceRental || 0) / 1.20 : (+v.serviceRental || 0);
      const initialSpread = (+v.initial || 0) / months;
      funding = financeNet + serviceNet + initialSpread;
      fundingNote = shared.vatReg ? "rentals net of recoverable VAT (50% block on finance)" : "gross rentals";
    } else {
      const residual = (+v.otr || 0) * (shared.residualPct / 100) * Math.pow(0.93, Math.max(0, months / 12 - 3)); // decay past 3yr
      funding = ((+v.otr || 0) - residual) / months;
      fundingNote = "straight-line depreciation to an assumed residual of " + gbp(residual);
      if (v.funding === "outright") funding += 0; // interest/opportunity cost excluded in v1 standard assumptions
    }

    // energy
    let energy;
    if (v.fuel === "electric") {
      energy = monthlyMiles / (+v.consumption || 3.5) * (shared.elecPpk / 100);
    } else {
      const ppl = v.fuel === "diesel" ? shared.dieselPpl : shared.petrolPpl;
      const mpg = +v.consumption || 45;
      energy = monthlyMiles / mpg * 4.546 * (ppl / 100);
    }

    // SMR — included in service rental if leased with maintenance
    const smrIncluded = v.funding === "lease" && (+v.serviceRental || 0) > 0;
    const smr = smrIncluded ? 0 : monthlyMiles * ((v.fuel === "electric" ? DEFAULTS.smrEvPencePerMile : DEFAULTS.smrCarPencePerMile) / 100);

    // VED — leases usually include it; charge it for owned vehicles
    let ved = 0;
    if (v.funding !== "lease") {
      const threshold = v.fuel === "electric" ? VED.expensiveThresholdEV : VED.expensiveThreshold;
      const expensive = (+v.otr || +v.p11d || 0) > threshold;
      ved = (VED.standard + (expensive ? VED.expensiveSupplement : 0)) / 12;
    }

    const insurance = shared.insurance / 12;

    // employer NIC on the BiK
    const p = bikPercent(CURRENT_TAX_YEAR, +v.co2 || 0, v.fuel === "hybrid" ? "hybrid" : v.fuel, +v.evRange || 0);
    const nic = (+v.p11d || 0) * p / 100 * CLASS_1A_NIC / 12;

    const total = funding + energy + smr + ved + insurance + nic;
    return {
      lines: [
        ["Funding", funding, fundingNote],
        ["Energy / fuel", energy, null],
        ["SMR", smr, smrIncluded ? "included in service rental" : "standard ppm assumption"],
        ["VED", ved, v.funding === "lease" ? "included in rental" : null],
        ["Insurance", insurance, null],
        ["Employer NIC", nic, "Class 1A on " + p + "% BiK"]
      ],
      total, ppm: miles ? total * 12 / miles * 100 : 0, months
    };
  }

  /* ---- inputs ---- */
  function vehicleCard(v, idx) {
    const mkIn = (key, label, opts = {}) => {
      const inp = opts.select
        ? el("select", {}, ...opts.select.map(([val, t]) => el("option", { value: val, selected: v[key] === val }, t)))
        : el("input", { type: opts.text ? "text" : "number", value: String(v[key] ?? ""), step: "any", min: "0", inputmode: opts.text ? null : "decimal" });
      inp.addEventListener("input", () => { v[key] = opts.text ? inp.value : inp.value; update(); });
      inp.id = "v" + idx + "-" + key;
      return field({ label, input: inp, hint: opts.hint });
    };
    const fundingSel = mkIn("funding", "Funding method", { select: [["lease", "Contract hire / lease"], ["outright", "Outright purchase"]] });
    const card = el("div", { class: "card" },
      el("h3", {}, v.label),
      mkIn("make", "Vehicle", { text: true }),
      el("div", { class: "form-row" },
        mkIn("fuel", "Fuel", { select: FUELS }),
        mkIn("co2", "CO2 (g/km)")),
      el("div", { class: "form-row" },
        mkIn("p11d", "P11D value"),
        mkIn("otr", "OTR / purchase price")),
      mkIn("consumption", "Efficiency", { hint: "mpg for petrol/diesel/hybrid · miles-per-kWh for electric" }),
      el("div", { class: "form-row" },
        mkIn("term", "Term (months)"),
        mkIn("miles", "Annual mileage")),
      fundingSel,
      el("div", { class: "form-row-3" },
        mkIn("rental", "Finance rental /mo"),
        mkIn("serviceRental", "Service rental /mo"),
        mkIn("initial", "Initial payment"))
    );
    return card;
  }

  const sharedCard = el("div", { class: "card" },
    el("h3", {}, "Shared assumptions"),
    el("p", { class: "small" }, "Standard assumptions — edit to match your fleet. Personalised assumptions from your own fleet data arrive in phase 2."),
    el("div", { class: "form-row-3" },
      assumption("Petrol (p/litre)", shared, "petrolPpl"),
      assumption("Diesel (p/litre)", shared, "dieselPpl"),
      assumption("Electricity (p/kWh)", shared, "elecPpk")),
    el("div", { class: "form-row-3" },
      assumption("Insurance (£/yr)", shared, "insurance"),
      assumption("3-yr residual (%)", shared, "residualPct"),
      el("div", { class: "field" },
        el("label", {}, "VAT registered"),
        checkbox(shared, "vatReg"))
    ));

  function assumption(label, obj, key) {
    const inp = el("input", { type: "number", value: String(obj[key]), step: "any", min: "0" });
    inp.addEventListener("input", () => { obj[key] = +inp.value || 0; update(); });
    return field({ label, input: inp });
  }
  function checkbox(obj, key) {
    const c = el("input", { type: "checkbox", checked: obj[key] || null, style: "width:auto" });
    c.addEventListener("input", () => { obj[key] = c.checked; update(); });
    return c;
  }

  /* ---- output ---- */
  function update() {
    const res = vehicles.map(costs);
    const max = Math.max(...res.map(r => r.total), 1);
    const winner = res[0].total === res[1].total ? -1 : (res[0].total < res[1].total ? 0 : 1);

    out.replaceChildren(
      el("div", { class: "grid cols-2" },
        ...res.map((r, i) => el("div", { class: "card", style: winner === i ? "border-color:var(--brand)" : "" },
          el("div", { style: "display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap" },
            el("h3", { style: "margin:0" }, vehicles[i].make || vehicles[i].label),
            winner === i ? el("span", { class: "badge green" }, "LOWER WLC") : null),
          el("div", { class: "result-hero", style: "margin:10px 0 2px" },
            el("span", { class: "rh-num", style: "font-size:34px" }, gbp(r.total)),
            el("span", { class: "rh-cap" }, "/month · " + r.ppm.toFixed(1) + "p per mile")),
          el("div", { class: "small", style: "margin-bottom:8px" }, "Whole-term cost: " + gbp(r.total * r.months)),
          el("div", { class: "breakdown" },
            ...r.lines.map(([label, val, note]) => el("div", { class: "bk-row" },
              el("span", {}, label, note ? el("span", { class: "small", style: "display:block;color:var(--muted)" }, note) : null),
              el("div", {}, el("div", { class: "bk-bar", style: `width:${Math.max(2, val / max * 100)}%;background:${i === 0 ? "var(--s1)" : "var(--s2)"}` })),
              el("span", { class: "bk-val" }, gbp(val)))))))),
      el("p", { class: "small", style: "margin-top:12px" },
        "Difference: ", el("strong", {}, gbp(Math.abs(res[0].total - res[1].total))), "/month — ",
        el("strong", {}, gbp(Math.abs(res[0].total * res[0].months - res[1].total * res[1].months))),
        " over the term. Employer-cost view (driver BiK sits in the tax calculator). Corporation-tax relief and lease-rental restriction excluded in v1 standard assumptions.")
    );
  }

  const wrap = el("div", { class: "stagger" },
    ...pageHead({
      crumb: "Tools",
      title: "Whole Life Cost Calculator",
      sub: "The number that should drive your choice list: true monthly cost and pence per mile, modelled properly.",
      actions: [el("span", { class: "rates-stamp" }, el("span", { class: "dot" }), "Assumptions editable · rates " + RATES_ASOF)]
    }),
    el("div", { class: "grid cols-2", style: "align-items:start" }, vehicleCard(vehicles[0], 0), vehicleCard(vehicles[1], 1)),
    el("div", { style: "margin-top:16px" }, sharedCard),
    el("h2", { style: "margin:24px 0 10px" }, "Side by side"),
    out
  );

  update();
  return wrap;
}
