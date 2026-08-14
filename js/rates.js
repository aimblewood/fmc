/* UK company-car tax & cost rate tables.
 * Verified 14 August 2026 against GOV.UK (480 Appendix 2; company car tax
 * rates 2028-30 policy paper; advisory fuel rates) and HMRC-confirmed
 * uprating announcements. See SOURCES below.
 */

export const RATES_ASOF = "14 August 2026";
export const CURRENT_TAX_YEAR = "2026/27";

export const TAX_YEARS = ["2026/27", "2027/28", "2028/29", "2029/30"];

/* Appropriate percentage (cars first registered on/after 6 April 2020 — NEDC-era
 * cars pre-2020 differ slightly; v1 models the post-2020 table which covers
 * virtually all current fleet stock). */
const AP = {
  "2026/27": { zero: 4, bands1to50: [[130, 4], [70, 7], [40, 10], [30, 14], [0, 16]], at51: 17, cap: 37 },
  "2027/28": { zero: 5, bands1to50: [[130, 5], [70, 8], [40, 11], [30, 15], [0, 17]], at51: 18, cap: 37 },
  "2028/29": { zero: 7, flat1to50: 18, at51: 19, cap: 38 },
  "2029/30": { zero: 9, flat1to50: 19, at51: 20, cap: 39 }
};

/** BiK appropriate percentage.
 * @param {string} year e.g. "2026/27"
 * @param {number} co2 g/km (WLTP)
 * @param {string} fuel "petrol"|"diesel"|"diesel-non-rde2"|"hybrid"|"electric"
 * @param {number} evRange electric range in miles (hybrids 1–50 g/km only)
 */
export function bikPercent(year, co2, fuel, evRange = 0) {
  const t = AP[year];
  if (!t) throw new Error("Unknown tax year: " + year);
  let pct;
  if (fuel === "electric" || co2 <= 0) {
    pct = t.zero;
  } else if (co2 <= 50) {
    if (t.flat1to50 != null) pct = t.flat1to50; // range bands abolished from 2028/29
    else pct = t.bands1to50.find(([min]) => evRange >= min)[1];
  } else if (co2 <= 54) {
    pct = t.at51;
  } else {
    pct = t.at51 + 1 + Math.floor((co2 - 55) / 5);
  }
  if (fuel === "diesel-non-rde2" && co2 > 0) pct += 4;
  return Math.min(pct, t.cap);
}

/* Income tax — marginal rates the member selects. */
export const TAX_BANDS = {
  rUK: [
    { label: "Basic rate (20%)", rate: 0.20 },
    { label: "Higher rate (40%)", rate: 0.40 },
    { label: "Additional rate (45%)", rate: 0.45 }
  ],
  scotland: [
    { label: "Starter (19%)", rate: 0.19 },
    { label: "Basic (20%)", rate: 0.20 },
    { label: "Intermediate (21%)", rate: 0.21 },
    { label: "Higher (42%)", rate: 0.42 },
    { label: "Advanced (45%)", rate: 0.45 },
    { label: "Top (48%)", rate: 0.48 }
  ]
};

export const CLASS_1A_NIC = 0.15;            // employer NIC on benefits, from April 2025
export const FUEL_BENEFIT_MULTIPLIER = 29200; // 2026/27 (CPI-uprated from £28,200)

/* VED (cars registered after 1 April 2017), 2026/27 */
export const VED = {
  standard: 200,
  expensiveSupplement: 440,     // years 2–6
  expensiveThreshold: 40000,    // list price; new EVs registered from Apr 2026: £50,000
  expensiveThresholdEV: 50000
};

/* HMRC advisory fuel rates, from 1 June 2026 (pence per mile) */
export const AFR = {
  petrol: [[1400, 14], [2000, 17], [Infinity, 26]],
  diesel: [[1600, 15], [2000, 17], [Infinity, 23]],
  lpg: [[1400, 11], [2000, 13], [Infinity, 21]],
  electricHome: 7,
  electricPublic: 15
};

/* Editable default assumptions (WLC). Members can override in the tool. */
export const DEFAULTS = {
  petrolPencePerLitre: 162,
  dieselPencePerLitre: 182,
  elecHomePencePerKwh: 27,
  elecPublicPencePerKwh: 62,
  smrCarPencePerMile: 6,     // service, maintenance & repair — standard assumption
  smrEvPencePerMile: 4.5,
  insurancePerYear: 850,
  residualPct3yr: 0.45       // outright purchase: % of OTR retained after 3yr/60k (standard assumption)
};

export const SOURCES = [
  { label: "GOV.UK — company car appropriate percentages (480 Appendix 2)", url: "https://www.gov.uk/guidance/company-car-benefit-the-appropriate-percentage-480-appendix-2" },
  { label: "GOV.UK — company car tax rates 2028–30 (Autumn Budget 2024)", url: "https://www.gov.uk/government/publications/income-tax-company-car-tax-rates-2028-to-2030" },
  { label: "GOV.UK — advisory fuel rates (from 1 June 2026)", url: "https://www.gov.uk/guidance/advisory-fuel-rates" },
  { label: "Car fuel benefit multiplier 2026/27 (£29,200, CPI uprating)", url: "https://www.scottrowe.co.uk/site/library/legalnews/annual_increases_in_vehicle_benefit_charges_for_2026_27.html" }
];

/* helpers */
export const gbp = (n, dp = 0) =>
  (n < 0 ? "−£" : "£") + Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
export const pct = n => n + "%";
