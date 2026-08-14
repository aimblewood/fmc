/* System area (global admin only): Theme Studio, Screen Layouts,
 * placeholders for future modules. */
import { el, icon, pageHead, toast, modal, downloadText, field } from "../ui.js";
import {
  DEFAULT_THEME, FONT_CHOICES, COLOR_LABELS,
  getCustom, getTheme, saveDraft, clearDraft, applyCustom,
  exportCustomisation, contrast
} from "../custom.js";
import { WIDGETS, DEFAULT_LAYOUTS, getLayout } from "../widgets.js";

export function renderSystem(ctx, route) {
  const tab = route.split("/")[1] || "theme";
  const tabs = [
    ["theme", "Theme Studio"],
    ["layouts", "Screen Layouts"],
    ["modules", "Modules"]
  ];

  const wrap = el("div", { class: "stagger" },
    ...pageHead({
      crumb: "System · Global admin",
      title: "System",
      sub: "Configure the platform. Changes preview live in this browser; Publish exports a customisation.js to commit to the repo, which applies them for every member.",
      actions: [
        el("button", { class: "btn primary", onclick: publish }, icon("download", 15), "Publish (export customisation.js)")
      ]
    }),
    el("div", { class: "tabs" },
      ...tabs.map(([key, label]) =>
        el("button", { class: tab === key ? "active" : "", onclick: () => { location.hash = "#/system/" + key; } }, label)))
  );

  if (tab === "layouts") wrap.append(layoutBuilder(ctx));
  else if (tab === "modules") wrap.append(modulesPanel());
  else wrap.append(themeStudio(ctx));
  return wrap;
}

function publish() {
  downloadText("customisation.js", exportCustomisation(), "text/javascript");
  modal({
    title: "Publish your customisation",
    body: el("div", {},
      el("p", {}, "A file called ", el("code", {}, "customisation.js"), " has just downloaded. To make this the live look for every member:"),
      el("ol", { style: "padding-left:20px;display:grid;gap:8px;font-size:14px" },
        el("li", {}, "Open your GitHub repo and click on ", el("code", {}, "customisation.js"), "."),
        el("li", {}, "Click the pencil (Edit), select everything, and paste the contents of the downloaded file."),
        el("li", {}, "Commit changes. The site redeploys in about a minute.")),
      el("p", { class: "small" }, "Until you publish, changes only affect this browser (that's your safe preview). When member accounts move server-side, this becomes a Save button — no file step."))
  });
}

/* ================= THEME STUDIO ================= */
function themeStudio({ rerender }) {
  const t = structuredClone(getTheme());

  const apply = () => { saveDraft({ theme: t }); applyCustom(); refreshChecks(); };

  /* colours */
  const colourRows = Object.entries(COLOR_LABELS).map(([key, label]) => {
    const picker = el("input", { type: "color", value: t.colors[key], class: "swatch" });
    const hex = el("input", { type: "text", value: t.colors[key], style: "width:110px;font-family:ui-monospace,monospace;font-size:13px" });
    const sync = v => {
      if (!/^#[0-9a-fA-F]{6}$/.test(v)) return;
      t.colors[key] = v; picker.value = v; hex.value = v; apply();
    };
    picker.addEventListener("input", () => sync(picker.value));
    hex.addEventListener("change", () => sync(hex.value.startsWith("#") ? hex.value : "#" + hex.value));
    return el("div", { class: "theme-row" },
      el("span", { class: "theme-label" }, label), picker, hex);
  });

  /* fonts */
  const fontSel = (slot, label) => {
    const sel = el("select", {},
      ...FONT_CHOICES[slot].map(f => el("option", { value: f, selected: t.fonts[slot] === f || null }, f)));
    sel.addEventListener("input", () => { t.fonts[slot] = sel.value; apply(); });
    return field({ label, input: sel });
  };

  /* style knobs */
  const knob = (label, get, set, min, max, step, fmt = v => v) => {
    const val = el("span", { class: "small", style: "min-width:52px;text-align:right;font-variant-numeric:tabular-nums" }, String(fmt(get())));
    const range = el("input", { type: "range", min: String(min), max: String(max), step: String(step), value: String(get()) });
    range.addEventListener("input", () => { set(+range.value); val.textContent = String(fmt(get())); apply(); });
    return el("div", { class: "theme-row" }, el("span", { class: "theme-label" }, label), range, val);
  };

  /* contrast checks */
  const checksBox = el("div", { style: "display:flex;gap:8px;flex-wrap:wrap;margin-top:10px" });
  function refreshChecks() {
    const checks = [
      ["Button text on brand", contrast(t.colors.brand, "#FFFFFF") >= 3 || contrast(t.colors.brand, "#17251F") >= 3],
      ["Text ink on page", contrast(t.colors.ink, t.colors.paper) >= 4.5],
      ["Text ink on cards", contrast(t.colors.ink, t.colors.surface) >= 4.5],
      ["Secondary text on cards", contrast(t.colors.inkSoft, t.colors.surface) >= 3]
    ];
    checksBox.replaceChildren(...checks.map(([label, okC]) =>
      el("span", { class: "badge " + (okC ? "green" : "red") }, (okC ? "✓ " : "✗ ") + label)));
  }
  refreshChecks();

  const preview = el("div", { class: "card", style: "position:sticky;top:20px" },
    el("h3", {}, "Live preview"),
    el("p", { class: "small" }, "The whole app is the preview — every change applies instantly. This panel shows the key pieces side by side."),
    el("div", { style: "display:grid;gap:10px" },
      el("div", { class: "tile" },
        el("div", { class: "t-label" }, "Stat tile"),
        el("div", { class: "t-value" }, "£2,194"),
        el("div", { class: "t-foot" }, "per month, ex VAT")),
      el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" },
        el("button", { class: "btn primary" }, "Primary button"),
        el("button", { class: "btn" }, "Secondary"),
        el("span", { class: "badge green" }, "BADGE"),
        el("span", { class: "badge gold" }, "SAMPLE")),
      el("div", { class: "card", style: "box-shadow:none" },
        el("h3", {}, "Heading in your display face"),
        el("p", { style: "margin:0;color:var(--ink-2)" }, "Body copy in your text face — the quick brown fox jumps over the lazy dog. 0123456789."))),
    el("hr", { class: "roadline" }),
    el("h3", {}, "Accessibility"),
    checksBox);

  return el("div", { class: "grid cols-2", style: "align-items:start" },
    el("div", { class: "card" },
      el("h3", {}, "Colours"),
      ...colourRows,
      el("hr", { class: "roadline" }),
      el("h3", {}, "Typography"),
      el("div", { class: "form-row" },
        fontSel("display", "Display font (headings, numbers)"),
        fontSel("body", "Body font (UI, text)")),
      knob("Heading weight", () => t.styles.headingWeight, v => t.styles.headingWeight = v, 500, 800, 100),
      knob("Base text size", () => t.styles.baseSize, v => t.styles.baseSize = v, 13, 17, 0.5, v => v + "px"),
      knob("Heading letter-spacing", () => t.styles.headingSpacing, v => t.styles.headingSpacing = v, -0.04, 0.04, 0.005, v => v.toFixed(3) + "em"),
      knob("Corner radius", () => t.styles.radius, v => t.styles.radius = v, 0, 22, 1, v => v + "px"),
      el("hr", { class: "roadline" }),
      el("div", { style: "display:flex;gap:10px;flex-wrap:wrap" },
        el("button", { class: "btn danger", onclick: () => {
          clearDraft(); applyCustom(); toast("Local draft cleared — back to the published theme."); rerender();
        } }, "Reset to published"),
        el("button", { class: "btn", onclick: () => {
          saveDraft({ theme: structuredClone(DEFAULT_THEME) }); applyCustom(); toast("Factory defaults restored (as a draft)."); rerender();
        } }, "Factory defaults"))),
    preview);
}

/* ================= LAYOUT BUILDER ================= */
function layoutBuilder(ctx) {
  let page = "fleet";
  let layout = structuredClone(getLayout(page));
  let dragIdx = null;

  const container = el("div", {});

  const persist = () => { saveDraft({ layouts: { [page]: layout } }); };

  function widthLabel(span) {
    return { 3: "¼ width", 4: "⅓ width", 6: "½ width", 8: "⅔ width", 12: "Full width" }[span] || span + "/12";
  }
  const SPANS = [3, 4, 6, 8, 12];

  function render() {
    const inUse = new Set(layout.map(i => i.w));
    const addable = Object.entries(WIDGETS).filter(([k]) => !inUse.has(k));

    const grid = el("div", { class: "widget-grid builder" });
    layout.forEach((item, idx) => {
      const def = WIDGETS[item.w];
      const span = item.span || def.span;
      const cell = el("div", {
        class: "wg-item s" + span + " wg-edit", draggable: "true",
        dataset: { widget: item.w },
        ondragstart: e => { dragIdx = idx; e.dataTransfer.effectAllowed = "move"; cell.classList.add("dragging"); },
        ondragend: () => { dragIdx = null; cell.classList.remove("dragging"); },
        ondragover: e => { e.preventDefault(); cell.classList.add("dropover"); },
        ondragleave: () => cell.classList.remove("dropover"),
        ondrop: e => {
          e.preventDefault(); cell.classList.remove("dropover");
          if (dragIdx == null || dragIdx === idx) return;
          const [moved] = layout.splice(dragIdx, 1);
          layout.splice(idx, 0, moved);
          persist(); render();
        }
      },
        el("div", { class: "wg-toolbar" },
          el("span", { class: "wg-grip", title: "Drag to move" }, "⠿"),
          el("span", { class: "wg-name" }, def.label),
          el("span", { style: "flex:1" }),
          el("button", { class: "wg-btn", title: "Move up", "aria-label": "Move " + def.label + " earlier", onclick: () => {
            if (idx === 0) return;
            [layout[idx - 1], layout[idx]] = [layout[idx], layout[idx - 1]];
            persist(); render();
          } }, "↑"),
          el("button", { class: "wg-btn", title: "Move down", "aria-label": "Move " + def.label + " later", onclick: () => {
            if (idx === layout.length - 1) return;
            [layout[idx + 1], layout[idx]] = [layout[idx], layout[idx + 1]];
            persist(); render();
          } }, "↓"),
          el("button", { class: "wg-btn", title: "Cycle width", onclick: () => {
            const cur = SPANS.indexOf(span);
            item.span = SPANS[(cur + 1) % SPANS.length];
            persist(); render();
          } }, widthLabel(span)),
          el("button", { class: "wg-btn danger", title: "Remove", "aria-label": "Remove " + def.label, onclick: () => {
            layout.splice(idx, 1); persist(); render();
          } }, "✕")),
        el("div", { class: "wg-preview" }, def.render())
      );
      grid.append(cell);
    });

    const addSel = el("select", { style: "max-width:260px" },
      el("option", { value: "" }, addable.length ? "Add a widget…" : "All widgets placed"),
      ...addable.map(([k, d]) => el("option", { value: k }, d.label)));
    addSel.addEventListener("input", () => {
      if (!addSel.value) return;
      layout.push({ w: addSel.value });
      persist(); render();
    });

    container.replaceChildren(
      el("div", { style: "display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px" },
        el("div", { class: "tabs", style: "margin:0;border:0" },
          el("button", { class: page === "fleet" ? "active" : "", onclick: () => switchPage("fleet") }, "My Fleet dashboard"),
          el("button", { class: page === "home" ? "active" : "", onclick: () => switchPage("home") }, "Home")),
        el("span", { style: "flex:1" }),
        addSel,
        el("button", { class: "btn sm", onclick: () => {
          layout = structuredClone(DEFAULT_LAYOUTS[page]);
          persist(); render(); toast("Layout reset to default (draft).");
        } }, "Reset this screen")),
      el("p", { class: "small", style: "margin-bottom:14px" },
        "Drag cards to reorder (or use ↑ ↓). Click the width button to resize. This is the live screen, editable — visit ",
        el("a", { href: "#/" + (page === "home" ? "home" : "fleet") }, "the real page"), " to see it in place. Publish (top right) makes it the default for every member; members get their own version of this builder in a later phase."),
      grid
    );
  }

  function switchPage(p) {
    page = p;
    layout = structuredClone(getLayout(page));
    render();
  }

  render();
  return container;
}

/* ================= MODULES ================= */
function modulesPanel() {
  const mods = [
    ["Theme Studio", "Colours, typography and shape — live.", true, "#/system/theme"],
    ["Screen Layouts", "Drag-and-drop composition of member screens.", true, "#/system/layouts"],
    ["Members & roles", "Invite members, assign roles, see activity.", false],
    ["Content manager", "Publish briefings, templates and guides from here instead of the repo.", false],
    ["Billing & tiers", "Stripe products, fleet-size bands, upgrade paths.", false],
    ["Data & integrations", "DVLA lookups, imports, backups, API keys.", false],
    ["Fields & records", "Rename record types, add custom fields, tweak picklists.", false]
  ];
  return el("div", { class: "grid cols-3" },
    ...mods.map(([title, desc, live, href]) => {
      const inner = [
        el("div", { class: "tc-ico" + (live ? "" : ""), style: live ? "" : "background:#EDEEE9;color:var(--muted)" }, icon(live ? "tools" : "lock", 20)),
        el("h3", {}, title),
        el("p", {}, desc),
        el("div", { class: "tc-foot" },
          el("span", { class: "badge " + (live ? "green" : "grey") }, live ? "LIVE" : "PLANNED"),
          live ? icon("arrow", 16) : null)
      ];
      return live
        ? el("a", { class: "card tool-card", href }, ...inner)
        : el("div", { class: "card tool-card soon" }, ...inner);
    }));
}
