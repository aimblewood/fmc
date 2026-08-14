/* Customisation engine — theme tokens + screen layouts.
 * Resolution order: built-in defaults ← published customisation.js
 * (window.FMC_CUSTOM) ← local draft (localStorage, this browser).
 * "Publish" exports a customisation.js to commit to the repo. */

const DRAFT_KEY = "fmc:custom";

export const DEFAULT_THEME = {
  colors: {
    brand: "#1C5D43",
    brandDeep: "#123D2C",
    accent: "#C89B3C",
    paper: "#F6F5F0",
    surface: "#FFFFFF",
    ink: "#17251F",
    inkSoft: "#4E5B54"
  },
  fonts: { display: "Bricolage Grotesque", body: "Public Sans" },
  styles: { headingWeight: 700, baseSize: 15, headingSpacing: -0.01, radius: 16 }
};

export const FONT_CHOICES = {
  display: ["Bricolage Grotesque", "Fraunces", "Sora", "Manrope", "Outfit", "Archivo", "Zilla Slab", "Newsreader", "Public Sans"],
  body: ["Public Sans", "Source Sans 3", "Work Sans", "Karla", "Albert Sans", "IBM Plex Sans", "Nunito Sans", "Spline Sans"]
};

export const COLOR_LABELS = {
  brand: "Brand colour",
  brandDeep: "Brand deep (hovers, headers)",
  accent: "Accent (gold details)",
  paper: "Page background",
  surface: "Card background",
  ink: "Text ink",
  inkSoft: "Secondary text"
};

/* ---------- merge & access ---------- */
const deepMerge = (base, over) => {
  if (!over || typeof over !== "object") return base;
  const out = Array.isArray(base) ? [...(over ?? base)] : { ...base };
  if (Array.isArray(base)) return over ?? base;
  for (const k of Object.keys(over)) {
    out[k] = base && typeof base[k] === "object" && !Array.isArray(base[k])
      ? deepMerge(base[k], over[k])
      : over[k];
  }
  return out;
};

export function getDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY)) || {}; } catch { return {}; }
}
export function saveDraft(patch) {
  const d = deepMerge(getDraft(), patch);
  localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  return d;
}
export function clearDraft() { localStorage.removeItem(DRAFT_KEY); }

export function getCustom() {
  let merged = { theme: DEFAULT_THEME, layouts: {} };
  merged = deepMerge(merged, window.FMC_CUSTOM || {});
  merged = deepMerge(merged, getDraft());
  return merged;
}
export const getTheme = () => getCustom().theme;

/* ---------- colour maths ---------- */
const hex2rgb = h => {
  h = h.replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
};
const rgb2hex = rgb => "#" + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
export const mix = (hexA, hexB, pctA) => {
  const a = hex2rgb(hexA), b = hex2rgb(hexB);
  return rgb2hex(a.map((v, i) => v * pctA + b[i] * (1 - pctA)));
};
const lum = hex => {
  const [r, g, b] = hex2rgb(hex).map(v => {
    v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};
export const onColor = bg => contrast(bg, "#FFFFFF") >= contrast(bg, "#17251F") ? "#F4F7F4" : "#17251F";

/* ---------- apply ---------- */
export function applyCustom() {
  const t = getTheme();
  const c = t.colors, s = t.styles;
  const root = document.documentElement.style;

  root.setProperty("--brand", c.brand);
  root.setProperty("--brand-deep", c.brandDeep);
  root.setProperty("--brand-ink", mix(c.brandDeep, "#000000", 0.82));
  root.setProperty("--brand-tint", mix(c.brand, "#FFFFFF", 0.13));
  root.setProperty("--brand-tint-2", mix(c.brand, "#FFFFFF", 0.06));
  root.setProperty("--brand-contrast", onColor(c.brand));
  root.setProperty("--gold", c.accent);
  root.setProperty("--paper", c.paper);
  root.setProperty("--surface", c.surface);
  root.setProperty("--surface-2", mix(c.surface, c.paper, 0.55));
  root.setProperty("--ink", c.ink);
  root.setProperty("--ink-2", c.inkSoft);
  root.setProperty("--muted", mix(c.inkSoft, c.paper, 0.62));
  root.setProperty("--line", mix(c.ink, c.paper, 0.10));
  root.setProperty("--line-strong", mix(c.ink, c.paper, 0.22));
  // auth panel gradient stops
  root.setProperty("--grad-1", mix(c.brandDeep, "#FFFFFF", 0.92));
  root.setProperty("--grad-2", c.brandDeep);
  root.setProperty("--grad-3", mix(c.brandDeep, "#000000", 0.72));
  root.setProperty("--grad-glow", mix(c.brand, "#FFFFFF", 0.78));

  root.setProperty("--font-display", `"${t.fonts.display}", "Public Sans", system-ui, sans-serif`);
  root.setProperty("--font-body", `"${t.fonts.body}", system-ui, -apple-system, "Segoe UI", sans-serif`);
  root.setProperty("--hw", String(s.headingWeight));
  root.setProperty("--fs-base", s.baseSize + "px");
  root.setProperty("--ls-head", s.headingSpacing + "em");
  root.setProperty("--r-lg", s.radius + "px");
  root.setProperty("--r-md", Math.round(s.radius * 0.75) + "px");
  root.setProperty("--r-sm", Math.round(s.radius * 0.5) + "px");

  loadFonts(t.fonts);
}

function loadFonts(fonts) {
  const fam = f => f.replace(/ /g, "+");
  const noExtraBold = new Set(["Zilla Slab"]); // fonts without an 800 weight — invalid axes 400 the whole request
  const parts = new Set();
  if (fonts.display === "Bricolage Grotesque")
    parts.add("family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800");
  else
    parts.add(`family=${fam(fonts.display)}:wght@${noExtraBold.has(fonts.display) ? "500;600;700" : "500;600;700;800"}`);
  parts.add(`family=${fam(fonts.body)}:wght@400;500;600;700`);
  const href = "https://fonts.googleapis.com/css2?" + [...parts].join("&") + "&display=swap";
  const link = document.getElementById("fmc-fonts");
  if (link && link.getAttribute("href") !== href) link.setAttribute("href", href);
}

/* ---------- publish ---------- */
export function exportCustomisation() {
  const current = getCustom();
  const payload = { theme: current.theme, layouts: current.layouts };
  return `/* Published site customisation (theme + screen layouts).
 * Generated by the System area on ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
 * Commit this file to the repo root as customisation.js to apply it for everyone. */
window.FMC_CUSTOM = ${JSON.stringify(payload, null, 2)};
`;
}

/* ---------- admin ---------- */
export function isAdmin(session) {
  if (!session) return false;
  const list = (window.FMC_CONFIG?.adminEmails || []).map(e => e.toLowerCase());
  return list.includes((session.email || "").toLowerCase());
}
