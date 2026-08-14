/* Auth layer — pluggable providers.
 * Demo provider: browser-local accounts. Passwords are never stored in
 * plain text (PBKDF2-SHA256, 150k iterations, per-user salt); sessions
 * expire after 12h idle; sign-in throttled after repeated failures.
 * NOTE: demo mode is for evaluation — data lives in this browser only and
 * client-side auth is not a substitute for a real backend.
 * Supabase provider: activates automatically when config.js has keys —
 * real hosted auth (email confirm, recovery, JWT sessions, RLS-ready).
 */

const cfg = window.FMC_CONFIG || {};
const enc = new TextEncoder();

const SESSION_KEY = "fmc:session";
const USERS_KEY = "fmc:users";
const SESSION_TTL = 12 * 60 * 60 * 1000;
const LOCK_WINDOW = 5 * 60 * 1000;
const LOCK_AFTER = 5;

const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));

async function hashPassword(password, saltB64) {
  const salt = saltB64
    ? Uint8Array.from(atob(saltB64), c => c.charCodeAt(0))
    : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" }, keyMaterial, 256);
  return { hash: b64(bits), salt: b64(salt.buffer ? salt.buffer : salt) };
}

export function validatePassword(pw) {
  if (!pw || pw.length < 10) return "At least 10 characters.";
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return "Use letters and at least one number.";
  return null;
}
export const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e || "");

/* ---------- demo provider ---------- */
const demo = {
  mode: "demo",
  _users() { try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; } catch { return {}; } },
  _saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); },
  _fails: {},

  async signUp({ email, password, name, company }) {
    email = (email || "").trim().toLowerCase();
    if (!validEmail(email)) throw new Error("Enter a valid email address.");
    const pwErr = validatePassword(password);
    if (pwErr) throw new Error(pwErr);
    const users = this._users();
    if (users[email]) throw new Error("An account with that email already exists. Sign in instead.");
    const { hash, salt } = await hashPassword(password);
    users[email] = { email, name: (name || "").trim() || email.split("@")[0], company: (company || "").trim(), hash, salt, created: Date.now() };
    this._saveUsers(users);
    return this._startSession(users[email]);
  },

  async signIn({ email, password }) {
    email = (email || "").trim().toLowerCase();
    const f = this._fails[email];
    if (f && f.count >= LOCK_AFTER && Date.now() - f.last < LOCK_WINDOW) {
      const mins = Math.ceil((LOCK_WINDOW - (Date.now() - f.last)) / 60000);
      throw new Error(`Too many failed attempts. Try again in ${mins} min.`);
    }
    const u = this._users()[email];
    const bad = () => {
      this._fails[email] = { count: (f?.count || 0) + 1, last: Date.now() };
      throw new Error("Email or password is incorrect.");
    };
    if (!u) bad();
    const { hash } = await hashPassword(password, u.salt);
    if (hash !== u.hash) bad();
    delete this._fails[email];
    return this._startSession(u);
  },

  async resetPassword({ email }) {
    email = (email || "").trim().toLowerCase();
    // Demo mode has no email channel; reset is performed in place.
    if (!this._users()[email]) throw new Error("No account found for that email.");
    return { demoInPlace: true };
  },

  async completeReset({ email, password }) {
    email = (email || "").trim().toLowerCase();
    const pwErr = validatePassword(password);
    if (pwErr) throw new Error(pwErr);
    const users = this._users();
    const u = users[email];
    if (!u) throw new Error("No account found for that email.");
    const { hash, salt } = await hashPassword(password);
    Object.assign(u, { hash, salt });
    this._saveUsers(users);
    return true;
  },

  _startSession(u) {
    const s = {
      userId: u.email, email: u.email, name: u.name, company: u.company,
      token: b64(crypto.getRandomValues(new Uint8Array(24)).buffer),
      expires: Date.now() + SESSION_TTL
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    return s;
  },

  getSession() {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (!s) return null;
      if (Date.now() > s.expires) { localStorage.removeItem(SESSION_KEY); return null; }
      // sliding expiry
      s.expires = Date.now() + SESSION_TTL;
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      return s;
    } catch { return null; }
  },

  signOut() { localStorage.removeItem(SESSION_KEY); }
};

/* ---------- supabase provider ---------- */
function makeSupabase(client) {
  return {
    mode: "supabase",
    async signUp({ email, password, name, company }) {
      const pwErr = validatePassword(password);
      if (pwErr) throw new Error(pwErr);
      const { data, error } = await client.auth.signUp({ email, password, options: { data: { name, company } } });
      if (error) throw new Error(error.message);
      if (!data.session) return { confirmEmail: true };
      return this.getSession();
    },
    async signIn({ email, password }) {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      return this.getSession();
    },
    async resetPassword({ email }) {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      if (error) throw new Error(error.message);
      return { emailSent: true };
    },
    async completeReset({ password }) {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw new Error(error.message);
      return true;
    },
    getSession() {
      const s = client.__session;
      if (!s) return null;
      const m = s.user?.user_metadata || {};
      return { userId: s.user.id, email: s.user.email, name: m.name || s.user.email.split("@")[0], company: m.company || "", token: s.access_token, expires: s.expires_at * 1000 };
    },
    signOut() { client.auth.signOut(); client.__session = null; }
  };
}

let provider = demo;
let readyResolve;
export const authReady = new Promise(r => (readyResolve = r));

(async function init() {
  if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      const { data } = await client.auth.getSession();
      client.__session = data.session;
      client.auth.onAuthStateChange((_e, session) => { client.__session = session; });
      provider = makeSupabase(client);
    } catch (e) {
      console.warn("Supabase unavailable, falling back to demo auth:", e);
    }
  }
  readyResolve(provider);
})();

export const auth = {
  get mode() { return provider.mode; },
  signUp: o => provider.signUp(o),
  signIn: o => provider.signIn(o),
  signOut: () => provider.signOut(),
  resetPassword: o => provider.resetPassword(o),
  completeReset: o => provider.completeReset(o),
  getSession: () => provider.getSession()
};
