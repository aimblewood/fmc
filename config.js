/* Fleet Manager Club — runtime configuration.
 *
 * DEMO MODE (default): leave supabaseUrl/supabaseAnonKey empty.
 *   Accounts and fleet data live in this browser only (localStorage).
 *
 * LIVE MODE: create a Supabase project (supabase.com), then paste your
 *   Project URL and anon public key below. Auth (sign-up, sign-in,
 *   password reset, email confirmation) switches to Supabase automatically.
 *   Fleet data sync moves server-side in phase 2 (see docs/ARCHITECTURE.md).
 */
window.FMC_CONFIG = {
  supabaseUrl: "https://nylobynklgabdfqljlnc.supabase.co",
  supabaseAnonKey: "sb_publishable_Z_fu5jwtxrzNnycR2Db6kg_UWNYvCde",   // your full publishable key, from Supabase → Settings → API Keys
  appName: "Fleet Manager Club",
  domain: "fleetmanager.club",
  adminEmails: ["simon.homer@mac.com"]
};