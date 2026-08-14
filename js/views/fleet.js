/* My Fleet — schema-driven records platform: dashboard, lists, forms,
 * CSV import, renewal alerts. */
import { el, icon, pageHead, modal, confirmDialog, toast, fmtDate, downloadText } from "../ui.js";
import { ENTITIES, FUTURE, fieldsOf, inputFieldsOf, LIST_COLUMNS, CSV_SYNONYMS } from "../schema.js";
import { store, displayTitle, resolveLookup, collectAlerts, dueStatus, loadSampleData, parseCsv, normHeader, toCsv } from "../store.js";
import { gbp } from "../rates.js";

export function renderFleet(ctx, route) {
  const parts = route.split("/"); // fleet | fleet/<entity>
  const entityKey = parts[1] && ENTITIES[parts[1]] ? parts[1] : null;
  return entityKey ? entityList(ctx, entityKey) : dashboard(ctx);
}

/* ---------------- dashboard ---------------- */
function dashboard({ rerender }) {
  const counts = store.counts();
  const isEmpty = Object.values(counts).every(n => n === 0);
  const vehicles = store.list("vehicles");
  const contracts = store.list("contracts");
  const alerts = collectAlerts();
  const evCount = vehicles.filter(v => v.fuelType === "Electric").length;
  const monthly = contracts.reduce((s, c) => s + (+c.financeRental || 0) + (+c.serviceRental || 0), 0);

  const wrap = el("div", { class: "stagger" },
    ...pageHead({
      crumb: "Tools",
      title: "My Fleet",
      sub: "Your fleet's single source of truth — vehicles, contracts, people and the dates that catch companies out.",
      actions: [
        el("button", { class: "btn", onclick: () => importCsvFlow("vehicles", rerender) }, icon("upload", 16), "Import spreadsheet"),
        el("a", { class: "btn primary", href: "#/fleet/vehicles" }, icon("plus", 16), "Add vehicles")
      ]
    })
  );

  if (isEmpty) {
    wrap.append(el("div", { class: "card pad-lg", style: "text-align:center" },
      el("h2", {}, "Nothing here yet"),
      el("p", { class: "page-sub", style: "margin:0 auto 16px" }, "Import your vehicle spreadsheet (we'll map the columns), add records by hand, or explore with sample data."),
      el("div", { style: "display:flex;gap:10px;justify-content:center;flex-wrap:wrap" },
        el("button", { class: "btn primary", onclick: () => importCsvFlow("vehicles", rerender) }, icon("upload", 16), "Import CSV"),
        el("button", { class: "btn", onclick: () => { loadSampleData(); toast("Sample fleet loaded."); rerender(); } }, "Load sample fleet"))));
  } else {
    wrap.append(el("div", { class: "tiles" },
      tile("Vehicles", String(vehicles.length), "on fleet"),
      tile("Due in 30 days", String(alerts.length), alerts.length ? "MOTs, renewals, expiries" : "all clear",
        alerts.some(a => a.status.level === "red") ? "alert-red" : (alerts.length ? "alert" : "")),
      tile("Electric share", vehicles.length ? Math.round(100 * evCount / vehicles.length) + "%" : "—", evCount + " electric"),
      tile("Contracted rentals", gbp(monthly), "per month, ex VAT")));

    // fuel mix mini chart
    if (vehicles.length) {
      const mix = {};
      vehicles.forEach(v => { const k = v.fuelType || "Unknown"; mix[k] = (mix[k] || 0) + 1; });
      const entries = Object.entries(mix).sort((a, b) => b[1] - a[1]);
      const max = Math.max(...entries.map(e => e[1]));
      wrap.append(el("div", { class: "grid cols-2", style: "align-items:start" },
        el("div", { class: "card" },
          el("h3", {}, "Fleet by fuel"),
          el("div", { class: "minibar", role: "img", "aria-label": "Fleet count by fuel type" },
            ...entries.map(([k, n], i) => el("div", { class: "mb-row" },
              el("span", {}, k),
              el("div", { class: "mb-track" }, el("div", { class: "mb-fill", style: `width:${n / max * 100}%;background:var(--s1)` })),
              el("span", { class: "mb-val" }, String(n)))))),
        alertsCard(alerts)));
    }
  }

  // record type cards
  wrap.append(el("h2", { style: "margin:26px 0 10px" }, "Records"));
  wrap.append(el("div", { class: "grid cols-4" },
    ...Object.entries(ENTITIES).map(([k, e]) =>
      el("a", { class: "card tool-card", href: "#/fleet/" + k, style: "padding:16px" },
        el("div", { class: "tc-ico", style: "width:36px;height:36px" }, icon(e.icon, 19)),
        el("h3", { style: "font-size:15px" }, e.name),
        el("div", { class: "tc-foot" },
          el("span", { class: "badge " + (counts[k] ? "green" : "grey") }, counts[k] + " record" + (counts[k] === 1 ? "" : "s")),
          icon("arrow", 15))))));

  wrap.append(el("h2", { style: "margin:26px 0 4px" }, "Future add-ons"),
    el("p", { class: "page-sub" }, "Structured and named, waiting on the roadmap."),
    el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" },
      ...FUTURE.map(f => el("span", { class: "badge grey", style: "font-size:12.5px;padding:7px 13px" }, f + " · soon"))));

  return wrap;
}

function tile(label, value, foot, cls = "") {
  return el("div", { class: "tile " + cls },
    el("div", { class: "t-label" }, label),
    el("div", { class: "t-value" }, value),
    el("div", { class: "t-foot" }, foot));
}

function alertsCard(alerts) {
  return el("div", { class: "card" },
    el("h3", {}, "Coming up"),
    alerts.length === 0
      ? el("p", { class: "small", style: "margin:0" }, "Nothing due in the next 30 days.")
      : el("div", {}, ...alerts.slice(0, 6).map(a =>
        el("div", { class: "res-row", style: "padding:9px 2px" },
          el("span", { class: "due " + a.status.level }, el("span", { class: "d" }), a.status.text),
          el("div", { class: "r-body" },
            el("div", { class: "r-title", style: "font-size:13.5px" }, a.label + " — " + a.title),
            el("div", { class: "r-meta" }, fmtDate(a.rec[a.field]))),
          el("a", { class: "btn ghost sm", href: "#/fleet/" + a.entity }, "Open")))));
}

/* ---------------- entity list ---------------- */
function entityList({ rerender }, entityKey) {
  const e = ENTITIES[entityKey];
  let rows = store.list(entityKey);
  let sortKey = null, sortDir = 1, query = "";

  const cols = LIST_COLUMNS[entityKey].map(k => fieldsOf(entityKey).find(f => f.key === k)).filter(Boolean);
  const alertField = fieldsOf(entityKey).find(f => f.alert);

  const tblWrap = el("div", { class: "tbl-wrap" });

  function cellValue(rec, f) {
    if (f.type === "calc") return f.fn(rec);
    return rec[f.key];
  }
  function cellText(rec, f) {
    const v = cellValue(rec, f);
    if (v == null || v === "") return "";
    if (f.type === "lookup") return resolveLookup(f.entity, v);
    if (f.type === "money") return gbp(+v, +v % 1 ? 2 : 0);
    if (f.type === "date") return fmtDate(v);
    if (f.type === "secret") return "••••••";
    return String(v);
  }

  function renderTable() {
    let data = rows;
    if (query) {
      const q = query.toLowerCase();
      data = rows.filter(r => cols.some(f => cellText(r, f).toLowerCase().includes(q)) || displayTitle(entityKey, r).toLowerCase().includes(q));
    }
    if (sortKey) {
      const f = cols.find(c => c.key === sortKey);
      data = [...data].sort((a, b) => {
        let va = cellValue(a, f), vb = cellValue(b, f);
        if (f.type === "money" || f.type === "number" || f.type === "calc") { va = +va || 0; vb = +vb || 0; }
        else { va = (cellText(a, f) || "").toLowerCase(); vb = (cellText(b, f) || "").toLowerCase(); }
        return (va < vb ? -1 : va > vb ? 1 : 0) * sortDir;
      });
    }
    const numeric = f => f.type === "money" || f.type === "number" || f.type === "calc";
    const table = el("table", { class: "tbl" },
      el("thead", {}, el("tr", {},
        ...cols.map(f => el("th", { class: numeric(f) ? "num" : "", onclick: () => {
          if (sortKey === f.key) sortDir *= -1; else { sortKey = f.key; sortDir = 1; }
          renderTable();
        } }, f.label, sortKey === f.key ? el("span", { class: "dir" }, sortDir > 0 ? " ↑" : " ↓") : "")),
        alertField ? el("th", {}, "Status") : null,
        el("th", { style: "cursor:default" }, ""))),
      el("tbody", {},
        data.length === 0
          ? el("tr", { class: "empty" }, el("td", { colspan: String(cols.length + 2) }, query ? "No matches." : "No records yet — add one or import a spreadsheet."))
          : data.map(rec => {
            const st = alertField ? dueStatus(rec[alertField.key]) : null;
            return el("tr", { class: "click", onclick: () => openDetail(rec) },
              ...cols.map(f => el("td", { class: numeric(f) ? "num" : "" }, cellText(rec, f))),
              alertField ? el("td", {}, st && st.level !== "ok"
                ? el("span", { class: "due " + st.level }, el("span", { class: "d" }), st.text)
                : (rec[alertField.key] ? el("span", { class: "due ok" }, el("span", { class: "d" }), st.text) : "")) : null,
              el("td", { class: "num", onclick: ev => ev.stopPropagation() },
                el("button", { class: "btn ghost sm", "aria-label": "Edit", onclick: () => openForm(rec) }, "Edit")));
          })));
    tblWrap.replaceChildren(table);
  }

  function refresh() { rows = store.list(entityKey); renderTable(); updateNav(); }
  const countBadge = el("span", { class: "badge grey" }, rows.length + " records");
  function updateNav() { countBadge.textContent = rows.length + " record" + (rows.length === 1 ? "" : "s"); }

  /* ---- forms ---- */
  function openForm(existing) {
    const isNew = !existing;
    const draft = { ...(existing || {}) };
    const errBox = el("div", { class: "error", role: "alert", style: "margin-bottom:8px" });
    const body = el("div", {});

    for (const group of e.groups) {
      const fields = group.fields.filter(f => f.type !== "calc");
      if (!fields.length) continue;
      body.append(el("h3", { style: "margin-top:14px" }, group.label));
      const grid = el("div", { class: "form-row" });
      for (const f of fields) grid.append(formField(f, draft));
      body.append(grid);
    }

    const { close } = modal({
      title: (isNew ? "New " : "Edit ") + e.singular.toLowerCase(),
      wide: true,
      body: el("div", {}, errBox, body),
      footer: [
        !isNew ? el("button", { class: "btn danger", onclick: () => confirmDialog("Delete this " + e.singular.toLowerCase() + "? This can't be undone.", () => { store.remove(entityKey, existing.id); close(); toast("Deleted."); refresh(); }) }, "Delete") : null,
        el("button", { class: "btn", onclick: () => close() }, "Cancel"),
        el("button", { class: "btn primary", onclick: () => {
          const missing = inputFieldsOf(entityKey).filter(f => f.required && !(draft[f.key] || "").toString().trim());
          if (missing.length) { errBox.textContent = "Required: " + missing.map(f => f.label).join(", "); return; }
          if (isNew) store.create(entityKey, draft); else store.update(entityKey, existing.id, draft);
          close(); toast(isNew ? e.singular + " added." : "Saved."); refresh();
        } }, isNew ? "Add " + e.singular.toLowerCase() : "Save changes")
      ]
    });
  }

  function formField(f, draft) {
    let input;
    const set = v => { draft[f.key] = v; };
    if (f.type === "pick") {
      if (f.free) {
        const listId = "dl-" + entityKey + "-" + f.key;
        input = el("input", { type: "text", value: draft[f.key] || "", list: listId, oninput: e2 => set(e2.target.value) });
        input.after; // datalist appended alongside below
        const dl = el("datalist", { id: listId }, ...f.options.map(o => el("option", { value: o })));
        const wrapEl = el("div", { class: "field" }, el("label", {}, f.label + (f.required ? " *" : "")), input, dl);
        return wrapEl;
      }
      input = el("select", { oninput: e2 => set(e2.target.value) },
        el("option", { value: "" }, "—"),
        ...f.options.map(o => el("option", { value: o, selected: draft[f.key] === o || null }, o)));
    } else if (f.type === "lookup") {
      const options = store.list(f.entity);
      input = el("select", { oninput: e2 => set(e2.target.value) },
        el("option", { value: "" }, "—"),
        ...options.map(o => el("option", { value: o.id, selected: draft[f.key] === o.id || null }, displayTitle(f.entity, o))));
    } else if (f.type === "secret") {
      input = el("input", { type: "password", value: draft[f.key] || "", autocomplete: "off", oninput: e2 => set(e2.target.value) });
    } else {
      const type = f.type === "date" ? "date" : (f.type === "number" || f.type === "money") ? "number" : "text";
      input = el("input", { type, step: "any", value: draft[f.key] ?? "", oninput: e2 => set(e2.target.value) });
    }
    return el("div", { class: "field" }, el("label", {}, f.label + (f.required ? " *" : "")), input,
      f.added ? el("div", { class: "hint" }, "Added beyond the CRM sheet") : null);
  }

  /* ---- detail ---- */
  function openDetail(rec) {
    const body = el("div", {});
    for (const group of e.groups) {
      body.append(el("h3", { style: "margin-top:12px" }, group.label));
      const dl = el("div", { class: "detail-grid" });
      for (const f of group.fields) {
        const isCalc = f.type === "calc";
        const raw = isCalc ? f.fn(rec) : rec[f.key];
        let text = "";
        if (raw != null && raw !== "") {
          if (f.type === "lookup") text = resolveLookup(f.entity, raw);
          else if (f.type === "money" || isCalc) text = gbp(+raw, +raw % 1 ? 2 : 0);
          else if (f.type === "date") text = fmtDate(raw);
          else if (f.type === "secret") text = "••••••••";
          else text = String(raw);
        }
        dl.append(el("div", { class: "dl" },
          el("dt", {}, f.label, isCalc ? " ⚙" : ""),
          el("dd", {}, text)));
      }
      body.append(dl);
    }
    const { close } = modal({
      title: displayTitle(entityKey, rec), wide: true, body,
      footer: [
        el("button", { class: "btn", onclick: () => close() }, "Close"),
        el("button", { class: "btn primary", onclick: () => { close(); openForm(rec); } }, "Edit")
      ]
    });
  }

  /* ---- export ---- */
  function exportCsv() {
    const fs = inputFieldsOf(entityKey);
    const rowsOut = [fs.map(f => f.label)];
    for (const rec of rows) rowsOut.push(fs.map(f => f.type === "lookup" ? resolveLookup(f.entity, rec[f.key]) : (rec[f.key] ?? "")));
    downloadText(entityKey + ".csv", toCsv(rowsOut), "text/csv");
    toast("Exported " + rows.length + " records. Your data leaves with you.");
  }

  const wrap = el("div", { class: "stagger" },
    ...pageHead({
      crumb: "My Fleet",
      title: e.name,
      actions: [
        el("a", { class: "btn ghost sm", href: "#/fleet" }, "← Fleet overview"),
        countBadge,
        CSV_SYNONYMS[entityKey] ? el("button", { class: "btn", onclick: () => importCsvFlow(entityKey, refresh) }, icon("upload", 15), "Import CSV") : null,
        el("button", { class: "btn", onclick: exportCsv }, icon("download", 15), "Export"),
        el("button", { class: "btn primary", onclick: () => openForm(null) }, icon("plus", 15), "New " + e.singular.toLowerCase())
      ]
    }),
    el("div", { style: "margin-bottom:12px" },
      el("input", { type: "text", placeholder: "Search " + e.name.toLowerCase() + "…", style: "max-width:320px", oninput: ev => { query = ev.target.value; renderTable(); } })),
    tblWrap
  );
  renderTable();
  updateNav();
  return wrap;
}

/* ---------------- CSV import ---------------- */
function importCsvFlow(entityKey, onDone) {
  const e = ENTITIES[entityKey];
  const synonyms = CSV_SYNONYMS[entityKey] || {};
  const fields = inputFieldsOf(entityKey).filter(f => f.type !== "lookup" && f.type !== "secret");

  const fileInput = el("input", { type: "file", accept: ".csv,text/csv", style: "display:none" });
  const drop = el("div", { class: "drop", tabindex: "0", role: "button", "aria-label": "Choose a CSV file",
    onclick: () => fileInput.click(),
    onkeydown: ev => { if (ev.key === "Enter") fileInput.click(); },
    ondragover: ev => { ev.preventDefault(); drop.classList.add("over"); },
    ondragleave: () => drop.classList.remove("over"),
    ondrop: ev => { ev.preventDefault(); drop.classList.remove("over"); if (ev.dataTransfer.files[0]) readFile(ev.dataTransfer.files[0]); } },
    el("div", { style: "font-size:26px;margin-bottom:6px" }, "📄"),
    el("div", { style: "font-weight:600" }, "Drop your CSV here, or click to choose"),
    el("div", { class: "small", style: "margin-top:4px" }, "First row should be column headings. Messy is fine — you'll map columns next."));
  fileInput.addEventListener("change", () => { if (fileInput.files[0]) readFile(fileInput.files[0]); });

  const m1 = modal({ title: "Import " + e.name.toLowerCase() + " from a spreadsheet", body: el("div", {}, drop, fileInput,
    el("p", { class: "small", style: "margin-top:12px" }, "Exporting from Excel? Save As → CSV. Your file never leaves this browser.")) });

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result));
      if (rows.length < 2) { toast("That file needs a heading row plus at least one data row.", true); return; }
      m1.close();
      mapStep(rows);
    };
    reader.readAsText(file);
  }

  function mapStep(rows) {
    const headers = rows[0];
    const dataRows = rows.slice(1);
    const mapping = headers.map(h => synonyms[normHeader(h)] || "");

    const selects = headers.map((h, i) => {
      const sel = el("select", { oninput: ev => mapping[i] = ev.target.value },
        el("option", { value: "" }, "— skip —"),
        ...fields.map(f => el("option", { value: f.key, selected: mapping[i] === f.key || null }, f.label)));
      return el("div", { class: "map-row" },
        el("div", {}, el("strong", {}, h || "(blank)"), el("div", { class: "small" }, "e.g. " + (dataRows[0]?.[i] || "—"))),
        el("div", { class: "arrow" }, "→"), sel);
    });

    const auto = mapping.filter(Boolean).length;
    const { close } = modal({
      title: "Map your columns", wide: true,
      body: el("div", {},
        el("p", { class: "small" }, dataRows.length + " rows found. " + auto + " of " + headers.length + " columns matched automatically — adjust anything we got wrong."),
        ...selects),
      footer: [
        el("button", { class: "btn", onclick: () => close() }, "Cancel"),
        el("button", { class: "btn primary", onclick: () => {
          let created = 0, updated = 0, skipped = 0;
          const keyField = ENTITIES[entityKey].titleField;
          const existing = store.list(entityKey);
          for (const row of dataRows) {
            const rec = {};
            mapping.forEach((fk, i) => { if (fk && row[i] != null && row[i].trim() !== "") rec[fk] = row[i].trim(); });
            if (Object.keys(rec).length === 0) { skipped++; continue; }
            // normalise dates like 12/03/2024 -> 2024-03-12
            for (const f of fields) if (f.type === "date" && rec[f.key]) rec[f.key] = normDate(rec[f.key]);
            const dupe = rec[keyField] && existing.find(r => (r[keyField] || "").toString().replace(/\s/g, "").toLowerCase() === rec[keyField].replace(/\s/g, "").toLowerCase());
            if (dupe) { store.update(entityKey, dupe.id, rec); updated++; }
            else if (ENTITIES[entityKey].groups.flatMap(g => g.fields).some(f => f.required && !rec[f.key])) { skipped++; }
            else { store.create(entityKey, rec); created++; }
          }
          close();
          toast(`Imported: ${created} new, ${updated} updated${skipped ? ", " + skipped + " skipped (missing required fields)" : ""}.`);
          onDone?.();
        } }, "Import " + dataRows.length + " rows")
      ]
    });
  }
}

function normDate(s) {
  s = s.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = (+y > 50 ? "19" : "20") + y;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(s);
  return isNaN(parsed) ? s : parsed.toISOString().slice(0, 10);
}
