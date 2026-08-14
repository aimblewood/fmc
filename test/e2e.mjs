/* End-to-end verification loop: auth flows, all routes, calculator maths
 * in-browser, fleet CRUD, CSV import round-trip, alerts, mobile viewport,
 * console errors. Run: node test/e2e.mjs [--shots] */
import { chromium } from "playwright";
import { createServer } from "http";
import { readFile } from "fs/promises";
import { extname, join } from "path";

const ROOT = new URL("..", import.meta.url).pathname;
const SHOTS = process.argv.includes("--shots");
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };

const server = createServer(async (req, res) => {
  let p = req.url.split("?")[0];
  if (p === "/") p = "/index.html";
  try {
    const data = await readFile(join(ROOT, p));
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(data);
  } catch { res.writeHead(404); res.end("nope"); }
});
await new Promise(r => server.listen(4173, r));
const BASE = "http://localhost:4173";

let pass = 0, fail = 0;
const results = [];
const ok = (desc, cond, extra = "") => {
  if (cond) { pass++; results.push("  ✓ " + desc); }
  else { fail++; results.push("  ✗ FAIL " + desc + (extra ? " — " + extra : "")); }
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1380, height: 900 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", e => consoleErrors.push("PAGEERROR: " + e.message));
const failedLocal = [];
page.on("requestfailed", r => { if (r.url().startsWith("http://localhost")) failedLocal.push(r.url()); });

const shot = async name => { if (SHOTS) { await page.waitForTimeout(750); await page.screenshot({ path: join(ROOT, "shots", name + ".png"), fullPage: false }); } };

/* ---- 1. auth ---- */
await page.goto(BASE);
await page.waitForSelector(".auth-card");
ok("redirects unauthenticated visitor to login", page.url().includes("#/login"));
await shot("01-login");

// bad password rejected on register
await page.click('a[href="#/register"]');
await page.waitForSelector("#f-name");
await page.fill("#f-name", "Simon Tester");
await page.fill("#f-company", "Sample Engineering Ltd");
await page.fill("#f-email", "simon@test.co.uk");
await page.fill("#f-pw", "short1");
await page.click("button.primary");
await page.waitForTimeout(200);
ok("weak password rejected", (await page.textContent(".error"))?.includes("10"));

await page.fill("#f-pw", "fleetclub2026x");
await page.click("button.primary");
await page.waitForSelector(".rail", { timeout: 5000 });
ok("register creates account and lands in member area", page.url().includes("#/home"));
await shot("02-home-empty");

// sign out, wrong password, lockout-ish, then good sign-in
await page.click('button[title="Sign out"]');
await page.waitForSelector(".auth-card");
await page.fill("#f-email", "simon@test.co.uk");
await page.fill("#f-pw", "wrongpassword1");
await page.click("button.primary");
await page.waitForTimeout(300);
ok("wrong password rejected", (await page.textContent(".error"))?.includes("incorrect"));
await page.fill("#f-pw", "fleetclub2026x");
await page.click("button.primary");
await page.waitForSelector(".rail");
ok("sign-in works", page.url().includes("#/home"));

// route guard while signed in: session persists across reload
await page.reload();
await page.waitForSelector(".rail");
ok("session survives reload", await page.isVisible(".rail-user"));

/* ---- 2. load sample fleet & dashboard ---- */
await page.click("text=Load sample fleet");
await page.waitForSelector("text=Let's get your fleet in", { state: "detached" });
await page.waitForSelector(".widget-grid .tile");
const tiles = await page.$$eval(".widget-grid .tile .t-value", els => els.map(e => e.textContent.trim()));
ok("home tiles render after sample load", tiles.length === 4, JSON.stringify(tiles));
ok("vehicle count tile = 6", tiles[0] === "6", tiles[0]);
ok("EV share tile = 33%", tiles[2] === "33%", tiles[2]);
await shot("03-home");

/* ---- 3. fleet dashboard & alerts ---- */
await page.goto(BASE + "#/fleet");
await page.waitForSelector(".widget-grid .tile");
const fleetTiles = await page.$$eval(".widget-grid .tile .t-value", els => els.map(e => e.textContent.trim()));
ok("fleet dashboard tiles render", fleetTiles.length === 4);
// sample data: renewal 10d (red), MOT 21d (amber), MOT -3d overdue (red), renewal 34d (ok>30), insurance 79d(ok), endDate 24d (amber), endDate 112d ok...
// due within 30: renewal 10, MOT 21, MOT -3, contract end 24 => 4
ok("alert count = 4 (due within 30 days)", fleetTiles[1] === "4", fleetTiles[1]);
ok("fuel mix chart renders", await page.isVisible(".minibar"));
const alertRows = await page.$$eval(".card .due.red, .card .due.amber", els => els.length);
ok("alert rows visible", alertRows >= 3, String(alertRows));
await shot("04-fleet-dashboard");

/* ---- 4. vehicles list: sort, search, edit ---- */
await page.goto(BASE + "#/fleet/vehicles");
await page.waitForSelector("table.tbl");
let rows = await page.$$eval("tbody tr", t => t.length);
ok("vehicles list shows 6 rows", rows === 6, String(rows));
await page.fill('input[placeholder^="Search"]', "tesla");
rows = await page.$$eval("tbody tr", t => t.length);
ok("search filters to 1 row", rows === 1, String(rows));
await page.fill('input[placeholder^="Search"]', "");
// sort by P11D
await page.click('th:has-text("P11D")');
const firstP11d = await page.textContent("tbody tr:first-child td:nth-child(6)");
ok("sort by P11D ascending puts Transit first", firstP11d.includes("24,890"), firstP11d);
// open detail
await page.click("tbody tr:first-child");
await page.waitForSelector(".modal");
ok("detail modal opens", await page.isVisible(".detail-grid"));
await shot("05-vehicle-detail");
await page.click(".m-foot button.primary"); // Edit
await page.waitForSelector(".modal .field input");
// edit: change territory
const territoryInput = page.locator('.modal input[list]').first();
await page.click(".m-foot button.primary"); // Save
await page.waitForTimeout(300);
ok("edit modal saves without error", !(await page.isVisible(".modal")));

// add a vehicle manually
await page.click('button:has-text("New vehicle")');
await page.waitForSelector(".modal");
await page.click(".m-foot button.primary"); // save with nothing -> required error
ok("required-field validation fires", (await page.textContent(".modal .error"))?.includes("Registration"));
await page.fill(".modal .field input >> nth=0", "AB12 CDE");
await page.click(".m-foot button.primary");
await page.waitForTimeout(300);
rows = await page.$$eval("tbody tr", t => t.length);
ok("manual add creates row (7 total)", rows === 7, String(rows));

/* ---- 5. CSV import round-trip ---- */
await page.click('button:has-text("Import CSV")');
await page.waitForSelector(".drop");
const csv = "Registration,Manufacturer,Model,Fuel,CO2 g/km,P11D Value,Date of Registration\nZZ71 XYZ,Kia,Sportage,Petrol,149,32100,12/05/2022\nKX74 URB,Kia,Niro EV,Electric,0,39150,08/11/2024\n";
const fileChooserPromise = page.waitForEvent("filechooser");
await page.click(".drop");
const chooser = await fileChooserPromise;
await chooser.setFiles({ name: "fleet.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
await page.waitForSelector(".map-row");
const autoText = await page.textContent(".modal .small");
ok("CSV columns auto-mapped (7 of 7)", autoText.includes("7 of 7"), autoText);
await shot("06-csv-map");
await page.click('.m-foot button:has-text("Import 2 rows")');
await page.waitForTimeout(400);
rows = await page.$$eval("tbody tr", t => t.length);
ok("CSV import: 1 new + 1 dedupe-update (8 total rows)", rows === 8, String(rows));
// check date normalised
await page.fill('input[placeholder^="Search"]', "sportage");
await page.click("tbody tr:first-child");
await page.waitForSelector(".modal");
const detailText = await page.textContent(".modal .m-body");
ok("imported date normalised to UK display", detailText.includes("12 May 2022"), "");
await page.keyboard.press("Escape");
await page.fill('input[placeholder^="Search"]', "");

/* ---- 6. other entity lists ---- */
for (const ent of ["contracts", "contacts", "accounts", "milestones", "insurance", "orders"]) {
  await page.goto(BASE + "#/fleet/" + ent);
  await page.waitForSelector("table.tbl");
  const n = await page.$$eval("tbody tr", t => t.length);
  ok(`${ent} list renders (${n} rows)`, n >= 1, String(n));
}
// contract end-date alert badge in list
await page.goto(BASE + "#/fleet/contracts");
await page.waitForSelector("table.tbl");
ok("contract list shows due badges", await page.isVisible("tbody .due"));

/* ---- 7. tax calculator maths in-browser ---- */
await page.goto(BASE + "#/tools/tax");
await page.waitForSelector("#tax-monthly");
// default: EV £40k, higher rate 40%: benefit 1600, tax 640/yr = £53/mo
let hero = await page.textContent("#tax-monthly");
ok("tax calc default EV £40k @40% = £53/mo", hero === "£53", hero);
// switch to petrol golf-ish: P11D 27470, CO2 122, basic rate
await page.selectOption("#fuel", "petrol");
await page.fill("#p11d", "27470");
await page.fill("#co2", "122");
await page.selectOption("#band", "0"); // basic 20%
await page.waitForTimeout(150);
hero = await page.textContent("#tax-monthly");
// 27470*0.31=8515.7 *0.2 = 1703.14/yr = 141.9/mo
ok("tax calc petrol 122g @20% = £142/mo", hero === "£142", hero);
// year cards show 4 years and rising percents
const pcts = await page.$$eval(".year-card .yc-pct", els => els.map(e => e.textContent));
ok("year cards show 31/32/33/34%", JSON.stringify(pcts) === JSON.stringify(["31%", "32%", "33%", "34%"]), JSON.stringify(pcts));
// Scotland bands appear
await page.selectOption("#region", "scotland");
const bandCount = await page.$$eval("#band option", o => o.length);
ok("Scottish bands = 6", bandCount === 6, String(bandCount));
// capital contribution cap: set 8000 -> only 5000 applied
await page.selectOption("#region", "rUK");
await page.selectOption("#band", "1");
await page.selectOption("#fuel", "electric");
await page.fill("#p11d", "40000");
await page.fill("#capital", "8000");
await page.waitForTimeout(150);
hero = await page.textContent("#tax-monthly");
// (40000-5000)*0.04*0.4/12 = 46.67 -> £47
ok("capital contribution capped at £5k = £47/mo", hero === "£47", hero);
await page.fill("#capital", "0");
await shot("07-tax-calc");

/* ---- 8. WLC calculator ---- */
await page.goto(BASE + "#/tools/wlc");
await page.waitForSelector(".result-hero");
const totals = await page.$$eval(".rh-num", els => els.map(e => e.textContent));
ok("WLC renders two vehicle totals", totals.length === 2, JSON.stringify(totals));
ok("WLC shows LOWER WLC badge", await page.isVisible("text=LOWER WLC"));
// sanity: EV cheaper than petrol on defaults
const a = +totals[0].replace(/[£,]/g, ""), b = +totals[1].replace(/[£,]/g, "");
ok("EV (A) cheaper than petrol (B) on defaults", a < b, `${a} vs ${b}`);
// hand-check vehicle A funding: rental 431 net = 431*(1-0.5*(0.2/1.2)) = 395.08; service 49/1.2=40.83; initial 1293/48=26.94 => 462.85
// energy: 12000/12=1000mi /3.6 mi/kWh *0.27 = 75; SMR 0 (in service rental); VED 0; ins 850/12=70.83; NIC 44585*0.04*0.15/12=22.29
// total ≈ 631
ok("WLC vehicle A ≈ £631/mo (hand-computed)", Math.abs(a - 631) <= 2, String(a));
await shot("08-wlc");

/* ---- 9. resources & tools pages ---- */
await page.goto(BASE + "#/resources");
await page.waitForSelector(".res-row");
const resRows = await page.$$eval(".res-row", r => r.length);
ok("resources render (11 rows)", resRows === 11, String(resRows));
await page.fill('input[placeholder="Search resources…"]', "grey");
const visible = await page.$$eval("[data-search]", els => els.filter(e => e.style.display !== "none").length);
ok("resource search filters", visible === 1, String(visible));
const dl = page.waitForEvent("download");
await page.fill('input[placeholder="Search resources…"]', "");
await page.click('.res-row:has-text("Grey Fleet") button');
const download = await dl;
ok("template downloads", (await download.suggestedFilename()) === "grey-fleet.md");
await shot("09-resources");

await page.goto(BASE + "#/tools");
await page.waitForSelector(".tool-card");
const live = await page.$$eval(".tool-card:not(.soon)", t => t.length);
const soon = await page.$$eval(".tool-card.soon", t => t.length);
ok("tools page: 3 live + 5 coming soon", live === 3 && soon === 5, `${live}/${soon}`);
await shot("10-tools");

/* ---- 10. account page: export ---- */
await page.goto(BASE + "#/account");
await page.waitForSelector("text=Your data");
const dl2 = page.waitForEvent("download");
await page.click('button:has-text("Export everything")');
await dl2;
ok("full JSON export downloads", true);

/* ---- 11. mobile viewport ---- */
const mob = await ctx.newPage();
await mob.setViewportSize({ width: 390, height: 844 });
await mob.goto(BASE + "#/home");
await mob.waitForSelector(".menu-btn");
ok("mobile: menu button visible", await mob.isVisible(".menu-btn"));
await mob.click(".menu-btn");
await mob.waitForTimeout(300);
ok("mobile: rail slides open", await mob.$eval("#rail", r => r.classList.contains("open")));
await mob.click('a[href="#/tools/tax"]').catch(() => {});
if (SHOTS) await mob.screenshot({ path: join(ROOT, "shots", "11-mobile-home.png") });
await mob.close();

/* ---- 12. reset password flow (demo) ---- */
await page.click('button[title="Sign out"]');
await page.waitForSelector(".auth-card");
await page.click('a[href="#/reset"]');
await page.waitForSelector("#f-email");
await page.fill("#f-email", "simon@test.co.uk");
await page.fill("#f-pw", "newpassword2026");
await page.click("button.primary");
await page.waitForTimeout(400);
await page.fill("#f-email", "simon@test.co.uk");
await page.fill("#f-pw", "newpassword2026");
await page.click("button.primary");
await page.waitForSelector(".rail");
ok("password reset + sign-in with new password", true);

/* ---- 13. admin gating: ordinary member sees no System ---- */
ok("non-admin: no System nav", !(await page.isVisible('[data-test="system-nav"]')));
await page.goto(BASE + "#/system");
await page.waitForTimeout(400);
ok("non-admin: #/system bounces to home", page.url().includes("#/home"));

/* ---- 14. admin: System area, Theme Studio, Layout builder ---- */
const actx = await browser.newContext({ viewport: { width: 1380, height: 900 } });
const apage = await actx.newPage();
const aErrors = [];
apage.on("pageerror", e => aErrors.push(e.message));
// make the test account an admin by serving a patched config.js
await actx.route("**/config.js", async route => {
  const body = (await (await fetch(BASE + "/config.js")).text())
    .replace('adminEmails: ["edgers-dives8r@icloud.com"]', 'adminEmails: ["edgers-dives8r@icloud.com", "admin@test.co.uk"]');
  route.fulfill({ body, contentType: "text/javascript" });
});
await apage.goto(BASE + "#/register");
await apage.waitForSelector("#f-name");
await apage.fill("#f-name", "Simon Admin");
await apage.fill("#f-email", "admin@test.co.uk");
await apage.fill("#f-pw", "fleetclub2026x");
await apage.click("button.primary");
await apage.waitForSelector(".rail");
ok("admin: System nav visible", await apage.isVisible('[data-test="system-nav"]'));

// Theme Studio: change brand colour via hex input -> primary buttons repaint
await apage.click('[data-test="system-nav"]');
await apage.waitForSelector(".theme-row");
const hexInput = apage.locator(".theme-row input[type=text]").first();
await hexInput.fill("#0F4C81");
await hexInput.dispatchEvent("change");
await apage.waitForTimeout(200);
const btnBg = await apage.$eval(".btn.primary", el2 => getComputedStyle(el2).backgroundColor);
ok("theme: brand colour applies live", btnBg === "rgb(15, 76, 129)", btnBg);
await apage.reload();
await apage.waitForSelector(".theme-row");
const btnBg2 = await apage.$eval(".btn.primary", el2 => getComputedStyle(el2).backgroundColor);
ok("theme: draft persists across reload", btnBg2 === "rgb(15, 76, 129)", btnBg2);
// font change updates the Google Fonts link
await apage.selectOption(".form-row select >> nth=0", "Sora");
await apage.waitForTimeout(200);
const fontsHref = await apage.$eval("#fmc-fonts", l => l.href);
ok("theme: display font swap loads Sora", fontsHref.includes("Sora"), fontsHref);
// contrast checks visible
ok("theme: accessibility checks render", (await apage.$$eval(".badge.green, .badge.red", b => b.length)) >= 4);
if (SHOTS) { await apage.waitForTimeout(500); await apage.screenshot({ path: join(ROOT, "shots", "12-theme-studio.png") }); }

// Layout builder
await apage.goto(BASE + "#/system/layouts");
await apage.waitForSelector(".wg-edit");
let order = await apage.$$eval(".builder .wg-edit", els => els.map(e => e.dataset.widget));
ok("builder: fleet layout shows 8 widgets", order.length === 8, JSON.stringify(order));
// move second widget up via accessible button
await apage.click('.wg-edit >> nth=1 >> button[title="Move up"]');
await apage.waitForTimeout(150);
order = await apage.$$eval(".builder .wg-edit", els => els.map(e => e.dataset.widget));
ok("builder: move-up swaps first two", order[0] === "statDue" && order[1] === "statVehicles", JSON.stringify(order));
// remove the fuel mix widget
await apage.click('.wg-edit[data-widget="fuelMix"] button[title="Remove"]');
await apage.waitForTimeout(150);
order = await apage.$$eval(".builder .wg-edit", els => els.map(e => e.dataset.widget));
ok("builder: remove widget", !order.includes("fuelMix") && order.length === 7, JSON.stringify(order));
// drag-and-drop: drag first card onto third
await apage.hover('.builder .wg-edit >> nth=0');
const dragOk = await apage.evaluate(() => {
  const cells = document.querySelectorAll(".builder .wg-edit");
  const dt = new DataTransfer();
  cells[0].dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
  cells[2].dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer: dt }));
  cells[2].dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt }));
  cells[0].dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
  return true;
});
await apage.waitForTimeout(150);
order = await apage.$$eval(".builder .wg-edit", els => els.map(e => e.dataset.widget));
ok("builder: drag-and-drop reorders", dragOk && order[2] === "statDue", JSON.stringify(order));
if (SHOTS) { await apage.waitForTimeout(400); await apage.screenshot({ path: join(ROOT, "shots", "13-layout-builder.png") }); }

// the edited layout drives the real fleet dashboard
await apage.goto(BASE + "#/fleet");
await apage.waitForSelector(".widget-grid");
const liveOrder = await apage.$$eval(".widget-grid .wg-item", els => els.map(e => e.dataset.widget));
ok("builder: live dashboard follows edited layout", !liveOrder.includes("fuelMix") && liveOrder[2] === "statDue", JSON.stringify(liveOrder));

// publish downloads customisation.js containing both theme + layout
await apage.goto(BASE + "#/system");
await apage.waitForSelector("text=Publish");
const dl3p = apage.waitForEvent("download");
await apage.click('button:has-text("Publish")');
const dl3 = await dl3p;
ok("publish downloads customisation.js", (await dl3.suggestedFilename()) === "customisation.js");
const dlPath = await dl3.path();
const dlBody = await readFile(dlPath, "utf8");
ok("published file carries theme + layouts", dlBody.includes("#0F4C81") && dlBody.includes("statDue") && !dlBody.match(/"w": "fuelMix"/), "");
ok("admin flow: no JS errors", aErrors.length === 0, aErrors.slice(0, 3).join(" | "));
await actx.close();

/* ---- console errors ---- */
const realErrors = consoleErrors.filter(e => !e.includes("favicon") && !/Failed to load resource/.test(e));
ok("no JS errors", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));
ok("no failed local resources", failedLocal.length === 0, failedLocal.slice(0, 3).join(" | "));

console.log(results.join("\n"));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
