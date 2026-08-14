/* Per-member data store. v1 keeps records in localStorage under a
 * per-user namespace with a schema version, structured so the same
 * shapes move server-side (Supabase Postgres + RLS) in phase 2.
 */
import { ENTITIES, fieldsOf } from "./schema.js";

const VERSION = 1;
let ns = null;

export function bindUser(userId) { ns = "fmc:data:" + userId; }

function load() {
  if (!ns) throw new Error("store not bound");
  try {
    const d = JSON.parse(localStorage.getItem(ns));
    if (d && d.version === VERSION) return d;
  } catch { /* fallthrough */ }
  const fresh = { version: VERSION, records: Object.fromEntries(Object.keys(ENTITIES).map(k => [k, []])) };
  return fresh;
}
function save(d) { localStorage.setItem(ns, JSON.stringify(d)); }

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const store = {
  list(entity) { return load().records[entity] || []; },
  get(entity, id) { return this.list(entity).find(r => r.id === id) || null; },
  create(entity, data) {
    const d = load();
    const rec = { ...clean(entity, data), id: uid(), _created: Date.now(), _updated: Date.now() };
    d.records[entity] = d.records[entity] || [];
    d.records[entity].push(rec);
    save(d);
    return rec;
  },
  update(entity, id, data) {
    const d = load();
    const arr = d.records[entity] || [];
    const i = arr.findIndex(r => r.id === id);
    if (i < 0) return null;
    arr[i] = { ...arr[i], ...clean(entity, data), id, _updated: Date.now() };
    save(d);
    return arr[i];
  },
  remove(entity, id) {
    const d = load();
    d.records[entity] = (d.records[entity] || []).filter(r => r.id !== id);
    save(d);
  },
  counts() {
    const d = load();
    return Object.fromEntries(Object.keys(ENTITIES).map(k => [k, (d.records[k] || []).length]));
  },
  wipe() { if (ns) localStorage.removeItem(ns); },
  exportJson() { return JSON.stringify(load(), null, 2); }
};

function clean(entity, data) {
  const out = {};
  for (const f of fieldsOf(entity)) {
    if (f.type === "calc") continue;
    let v = data[f.key];
    if (v == null || v === "") continue;
    if (f.type === "number" || f.type === "money") { v = +String(v).replace(/[£,\s]/g, ""); if (Number.isNaN(v)) continue; }
    else v = String(v).trim();
    if (f.upper) v = v.toUpperCase();
    out[f.key] = v;
  }
  return out;
}

/* resolve a lookup id -> display title */
export function displayTitle(entity, rec) {
  if (!rec) return "";
  const e = ENTITIES[entity];
  if (e.title) return e.title(rec, (ent, id) => { const t = store.get(ent, id); return t ? displayTitle(ent, t) : null; });
  return rec[e.titleField] || "(untitled)";
}
export function resolveLookup(entity, id) {
  const rec = store.get(entity, id);
  return rec ? displayTitle(entity, rec) : "";
}

/* ---------- alerts ---------- */
const DAY = 86400000;
export function alertFields() {
  const out = [];
  for (const [ek, e] of Object.entries(ENTITIES))
    for (const f of e.groups.flatMap(g => g.fields))
      if (f.alert) out.push({ entity: ek, field: f.key, label: f.alert });
  return out;
}
export function dueStatus(dateStr, today = new Date()) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return null;
  const days = Math.floor((d - new Date(today.toDateString())) / DAY);
  if (days < 0) return { level: "red", days, text: Math.abs(days) + "d overdue" };
  if (days <= 14) return { level: "red", days, text: days + "d" };
  if (days <= 30) return { level: "amber", days, text: days + "d" };
  return { level: "ok", days, text: days + "d" };
}
export function collectAlerts(today = new Date()) {
  const alerts = [];
  for (const { entity, field, label } of alertFields()) {
    for (const rec of store.list(entity)) {
      const st = dueStatus(rec[field], today);
      if (st && (st.level === "amber" || st.level === "red")) {
        alerts.push({ entity, rec, field, label, status: st, title: displayTitle(entity, rec) });
      }
    }
  }
  return alerts.sort((a, b) => a.status.days - b.status.days);
}

/* ---------- CSV ---------- */
export function parseCsv(textContent) {
  const rows = [];
  let row = [], cell = "", inQ = false;
  const s = textContent.replace(/\r\n?/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ""));
}
export const normHeader = h => (h || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function toCsv(rows) {
  const esc = v => {
    v = v == null ? "" : String(v);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };
  return rows.map(r => r.map(esc).join(",")).join("\n");
}

/* ---------- sample fleet ---------- */
export function loadSampleData() {
  const mk = (entity, rows) => rows.map(r => store.create(entity, r));
  const iso = d => d.toISOString().slice(0, 10);
  const daysFrom = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

  const [acct] = mk("accounts", [{
    accountName: "Sample Engineering Ltd", relationshipType: "Customer", industry: "Manufacturing",
    fleetSize: 8, mainPhone: "0121 000 0000", town: "Birmingham", postcode: "B1 1AA", country: "United Kingdom",
    employees: 120, yearEstablished: 1998, fuelCard: "Yes", accidentManagement: "No", updateMid: "Yes"
  }]);

  const contacts = mk("contacts", [
    { firstName: "Sarah", surname: "Ellis", jobTitle: "Finance Manager", contactType: "Fleet contact", employeeStatus: "Active", workEmail: "sarah.ellis@example.co.uk", account: acct.id },
    { firstName: "James", surname: "Whitfield", jobTitle: "Area Sales Manager", contactType: "Driver", driverGrade: "Manager", employeeStatus: "Active", workEmail: "j.whitfield@example.co.uk", fuelBenefit: "No", account: acct.id },
    { firstName: "Priya", surname: "Nair", jobTitle: "Service Engineer", contactType: "Driver", driverGrade: "Standard", employeeStatus: "Active", workEmail: "p.nair@example.co.uk", account: acct.id },
    { firstName: "Tom", surname: "Barker", jobTitle: "Operations Director", contactType: "Director", driverGrade: "Director", employeeStatus: "Active", workEmail: "t.barker@example.co.uk", account: acct.id },
    { firstName: "Leah", surname: "Osei", jobTitle: "Field Engineer", contactType: "Driver", driverGrade: "Standard", employeeStatus: "Active", workEmail: "l.osei@example.co.uk", account: acct.id }
  ]);

  const vehicles = mk("vehicles", [
    { reg: "KX74 URB", make: "Kia", model: "Niro EV", derivative: "3 64.8kWh", fuelType: "Electric", co2: 0, evRange: 285, p11d: 39150, fuelConsumption: 3.8, transmission: "Automatic", bodyStyle: "SUV", doors: 5, regDate: "2024-11-08", extColour: "Interstellar Grey", driver: contacts[1].id, territory: "Midlands" },
    { reg: "WM73 KPT", make: "Volkswagen", model: "Golf", derivative: "1.5 TSI Life", fuelType: "Petrol", co2: 122, engineCc: 1498, p11d: 27470, fuelConsumption: 51.4, transmission: "Manual", bodyStyle: "Hatchback", doors: 5, regDate: "2023-10-12", extColour: "Moonstone Grey", driver: contacts[2].id, territory: "Midlands" },
    { reg: "EO24 VXA", make: "Tesla", model: "Model 3", derivative: "RWD", fuelType: "Electric", co2: 0, evRange: 318, p11d: 40045, fuelConsumption: 4.1, transmission: "Automatic", bodyStyle: "Saloon", doors: 4, regDate: "2024-03-22", extColour: "Pearl White", driver: contacts[3].id, territory: "Midlands" },
    { reg: "BN73 HZC", make: "Ford", model: "Transit Connect", derivative: "1.5 EcoBlue Trend", fuelType: "Diesel", co2: 130, engineCc: 1499, p11d: 24890, fuelConsumption: 56.5, transmission: "Manual", bodyStyle: "Car-derived Van", doors: 4, regDate: "2023-12-04", extColour: "Frozen White", driver: contacts[4].id, territory: "Midlands" },
    { reg: "KY25 TFJ", make: "BMW", model: "330e", derivative: "M Sport Touring", fuelType: "Plug-in Hybrid", co2: 36, evRange: 35, engineCc: 1998, p11d: 48420, fuelConsumption: 176.6, transmission: "Automatic", bodyStyle: "Estate", doors: 5, regDate: "2025-04-30", extColour: "Portimao Blue", territory: "Midlands" },
    { reg: "GF71 WLR", make: "Toyota", model: "Corolla", derivative: "1.8 Hybrid Icon", fuelType: "Hybrid", co2: 102, engineCc: 1798, p11d: 29105, fuelConsumption: 62.8, transmission: "Automatic", bodyStyle: "Hatchback", doors: 5, regDate: "2021-09-17", extColour: "Silver", territory: "Midlands" }
  ]);

  mk("contracts", [
    { funderRef: "LEX-482115", funder: "Lex Autolease", vehicle: vehicles[0].id, account: acct.id, term: "48", fundingMethod: "Contract Hire", annualMileage: 12000, paymentProfile: "3+47", currency: "GBP", financeRental: 398, serviceRental: 52, startDate: "2024-11-08", endDate: daysFrom(240), initialPayment: 1194, vatType: "Standard" },
    { funderRef: "ALD-771904", funder: "Ayvens", vehicle: vehicles[1].id, account: acct.id, term: "36", fundingMethod: "Contract Hire", annualMileage: 15000, paymentProfile: "3+33", currency: "GBP", financeRental: 312, serviceRental: 44, startDate: "2023-10-12", endDate: daysFrom(24), initialPayment: 936, vatType: "Standard" },
    { funderRef: "ARV-220518", funder: "Arval", vehicle: vehicles[2].id, account: acct.id, term: "36", fundingMethod: "Salary Sacrifice", annualMileage: 10000, paymentProfile: "3+35", currency: "GBP", financeRental: 429, serviceRental: 58, startDate: "2024-03-22", endDate: daysFrom(410), initialPayment: 1287, vatType: "Standard" },
    { funderRef: "LEX-508821", funder: "Lex Autolease", vehicle: vehicles[3].id, account: acct.id, term: "48", fundingMethod: "Contract Hire", annualMileage: 20000, paymentProfile: "1+47", currency: "GBP", financeRental: 289, serviceRental: 39, startDate: "2023-12-04", endDate: daysFrom(112), vatType: "Standard" },
    { funderRef: "ZEN-114230", funder: "Zenith", vehicle: vehicles[4].id, account: acct.id, term: "36", fundingMethod: "Contract Hire", annualMileage: 12000, paymentProfile: "3+35", currency: "GBP", financeRental: 512, serviceRental: 61, startDate: "2025-04-30", endDate: daysFrom(624), initialPayment: 1536, vatType: "Standard" }
  ]);

  mk("milestones", [
    { vehicle: vehicles[0].id, createdOn: "2024-09-02", orderReceived: "2024-09-02", orderConfirmed: "2024-09-16", deliveryDate: "2024-11-08", registrationDate: "2024-11-08", motDue: daysFrom(448), renewalDate: daysFrom(210) },
    { vehicle: vehicles[1].id, createdOn: "2023-08-15", deliveryDate: "2023-10-12", registrationDate: "2023-10-12", motDue: daysFrom(59), renewalDate: daysFrom(10) },
    { vehicle: vehicles[3].id, createdOn: "2023-10-20", deliveryDate: "2023-12-04", registrationDate: "2023-12-04", motDue: daysFrom(21), renewalDate: daysFrom(100) },
    { vehicle: vehicles[5].id, createdOn: "2021-07-30", deliveryDate: "2021-09-17", registrationDate: "2021-09-17", motDue: daysFrom(-3), renewalDate: daysFrom(34) }
  ]);

  mk("insurance", [
    { insurer: "Allianz Commercial", policyNumber: "MF-2261189", policyStart: "2025-11-01", policyExpiry: daysFrom(79), insuranceExcess: 500, glassExcess: 100, midWebsite: "https://www.mib.org.uk", midUser1: "sample.fleet" }
  ]);

  mk("orders", [
    { status: "Ordered", make: "Škoda", model: "Enyaq", derivative: "85 Edition", fuelType: "Electric", co2: 0, p11d: 44585, funder: "Lex Autolease", term: "48", fundingMethod: "Contract Hire", annualMileage: 12000, financeRental: 431, serviceRental: 49, expectedDelivery: daysFrom(46), account: acct.id, driver: contacts[4].id, supplyingDealer: "Listers Škoda Coventry" },
    { status: "Quote", make: "Hyundai", model: "Kona Electric", derivative: "65kWh Advance", fuelType: "Electric", co2: 0, p11d: 35420, funder: "Arval", term: "36", fundingMethod: "Salary Sacrifice", annualMileage: 8000, financeRental: 366, serviceRental: 41, account: acct.id }
  ]);
}
