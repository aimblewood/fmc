# fleetmanager.club — platform v0.1

The first working build of the member platform: login/security, **Resources**,
**Tools** (company car tax calculator · whole life cost calculator · My Fleet),
with Community and Learning stubbed for later phases.

## Run it

It's a static app — no build step, no dependencies.

- Quickest: `npx serve .` or `python3 -m http.server` in this folder, open the URL.
- Or push the folder to GitHub Pages / Netlify / Cloudflare Pages as-is.
- Opening `index.html` directly from disk won't work (ES modules need http).

## Demo mode vs live mode

Out of the box it runs in **demo mode**: accounts and fleet data live in the
browser's localStorage. Passwords are still salted + hashed (PBKDF2-SHA256,
150k rounds), sessions expire after 12h, and failed sign-ins are throttled —
but it is browser-local by design, for evaluation.

To go live: create a Supabase project and paste the Project URL and anon key
into `config.js`. Auth (sign-up, sign-in, email confirmation, password reset)
switches to Supabase automatically. Fleet-data sync moves server-side in
phase 2 (per-member rows + row-level security).

## What's inside

```
index.html          shell
config.js           demo/Supabase switch
css/app.css         design system (British Racing Green / warm paper / road-marking motif)
js/rates.js         verified UK tax tables — BiK to 2029/30, NIC, VED, AFRs (sources inside)
js/schema.js        My Fleet record types, from the Dynamics CRM workbook + colour key
js/auth.js          pluggable auth (demo PBKDF2 / Supabase)
js/store.js         per-user data layer, alerts engine, CSV parse, sample fleet
js/views/…          home, resources, tools, tax calc, WLC, fleet, account
test/e2e.mjs        verification loop (Playwright): 49 checks
```

## Verification

- `node test/e2e.mjs` — full click-through: auth flows, every route, calculator
  outputs vs hand-computed cases, CSV import round-trip, alerts, mobile, console errors.
- BiK engine has 37 unit checks (EV ramp 4→9%, range-band abolition 2028/29,
  caps 37/38/39%, diesel supplement, 5g/km steps).

## Rates

Stamped "current as of 14 August 2026" in-app, with sources listed under the
tax calculator. Budget-day updates = edit `js/rates.js` only.
