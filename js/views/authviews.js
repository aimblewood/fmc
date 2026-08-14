/* Sign in / register / reset screens. */
import { auth, validatePassword, validEmail } from "../auth.js";
import { el, field, toast } from "../ui.js";

function brandPanel() {
  const route = el("svg", { class: "route", viewBox: "0 0 600 900", preserveAspectRatio: "xMidYMid slice", "aria-hidden": "true" });
  route.innerHTML = `<path d="M-40 720 C 160 660, 120 520, 300 470 S 640 380, 560 220 S 300 60, 360 -40"/>`;
  return el("div", { class: "auth-brand" },
    el("div", { class: "auth-logo" }, el("span", { class: "mark" }, "F"), "fleetmanager.club"),
    el("div", { class: "auth-hero" },
      el("h1", {}, "The fleet manager your business ", el("em", {}, "doesn't have.")),
      el("p", {}, "Working tools, practitioner knowledge and ready-to-deploy templates for UK fleets of 25–200 vehicles.")
    ),
    el("ul", { class: "auth-points" },
      el("li", {}, "Company car tax modelled through to 2029/30"),
      el("li", {}, "Whole life costs your FD will actually trust"),
      el("li", {}, "Your fleet, in one place — not eleven spreadsheets")
    ),
    el("div", { class: "auth-foot" }, "Independent by design — nobody is selling you a van at the end of this."),
    route
  );
}

function formCard(title, sub, formEl, alt) {
  return el("div", { class: "auth-panel" },
    el("div", { class: "auth-card stagger" },
      el("h2", {}, title),
      el("p", { class: "sub" }, sub),
      formEl,
      alt,
      auth.mode === "demo" ? el("div", { class: "demo-note" },
        el("b", {}, "Demo build. "), "Accounts and fleet data are stored in this browser only. Connect Supabase in ", el("code", {}, "config.js"), " to switch to hosted sign-in with email confirmation.") : null
    )
  );
}

const input = (id, type, ph, extra = {}) => el("input", { id, type, placeholder: ph, ...extra });

function setBusy(btn, busy) {
  btn.disabled = busy;
  btn.textContent = busy ? "One moment…" : btn.dataset.label;
}

export function renderAuth(route, { onAuthed }) {
  const wrap = el("div", { class: "auth-wrap" }, brandPanel());

  if (route === "register") {
    const name = input("f-name", "text", "e.g. Alex Turner", { autocomplete: "name" });
    const company = input("f-company", "text", "e.g. Turner Logistics Ltd", { autocomplete: "organization" });
    const email = input("f-email", "email", "you@company.co.uk", { autocomplete: "email" });
    const pw = input("f-pw", "password", "10+ characters, letters and a number", { autocomplete: "new-password" });
    const err = el("div", { class: "error", role: "alert", style: "margin-bottom:10px" });
    const btn = el("button", { class: "btn primary", style: "width:100%", "data-label": "Create account" }, "Create account");
    const form = el("form", { onsubmit: async e => {
      e.preventDefault(); err.textContent = "";
      if (!validEmail(email.value)) { err.textContent = "Enter a valid email address."; return; }
      const pwErr = validatePassword(pw.value);
      if (pwErr) { err.textContent = pwErr; return; }
      setBusy(btn, true);
      try {
        const res = await auth.signUp({ email: email.value, password: pw.value, name: name.value, company: company.value });
        if (res?.confirmEmail) { toast("Check your inbox to confirm your email."); location.hash = "#/login"; }
        else { toast("Welcome to the club."); onAuthed(auth.getSession()); }
      } catch (ex) { err.textContent = ex.message; }
      setBusy(btn, false);
    } },
      field({ label: "Your name", input: name }),
      field({ label: "Company", input: company }),
      field({ label: "Work email", input: email }),
      field({ label: "Password", input: pw, hint: "Minimum 10 characters with letters and at least one number." }),
      err, btn
    );
    wrap.append(formCard("Join the club", "Set up your member account.", form,
      el("p", { class: "auth-alt" }, "Already a member? ", el("a", { href: "#/login" }, "Sign in"))));
    return wrap;
  }

  if (route === "reset") {
    const email = input("f-email", "email", "you@company.co.uk", { autocomplete: "email" });
    const pw = input("f-pw", "password", "New password", { autocomplete: "new-password" });
    const pwWrap = field({ label: "New password", input: pw, hint: "Demo mode resets in place — live mode sends a secure email link." });
    const err = el("div", { class: "error", role: "alert", style: "margin-bottom:10px" });
    const btn = el("button", { class: "btn primary", style: "width:100%", "data-label": "Reset password" }, "Reset password");
    if (auth.mode !== "demo") pwWrap.style.display = "none";
    const form = el("form", { onsubmit: async e => {
      e.preventDefault(); err.textContent = "";
      setBusy(btn, true);
      try {
        if (auth.mode === "demo") {
          await auth.resetPassword({ email: email.value });
          await auth.completeReset({ email: email.value, password: pw.value });
          toast("Password updated. Sign in with your new password.");
        } else {
          await auth.resetPassword({ email: email.value });
          toast("Reset link sent — check your inbox.");
        }
        location.hash = "#/login";
      } catch (ex) { err.textContent = ex.message; }
      setBusy(btn, false);
    } },
      field({ label: "Account email", input: email }),
      pwWrap, err, btn
    );
    wrap.append(formCard("Reset your password", "We'll get you back in.", form,
      el("p", { class: "auth-alt" }, el("a", { href: "#/login" }, "Back to sign in"))));
    return wrap;
  }

  // sign in
  const email = input("f-email", "email", "you@company.co.uk", { autocomplete: "email" });
  const pw = input("f-pw", "password", "Your password", { autocomplete: "current-password" });
  const err = el("div", { class: "error", role: "alert", style: "margin-bottom:10px" });
  const btn = el("button", { class: "btn primary", style: "width:100%", "data-label": "Sign in" }, "Sign in");
  const form = el("form", { onsubmit: async e => {
    e.preventDefault(); err.textContent = "";
    setBusy(btn, true);
    try {
      await auth.signIn({ email: email.value, password: pw.value });
      onAuthed(auth.getSession());
    } catch (ex) { err.textContent = ex.message; }
    setBusy(btn, false);
  } },
    field({ label: "Email", input: email }),
    field({ label: "Password", input: pw }),
    err, btn
  );
  wrap.append(formCard("Welcome back", "Sign in to your member area.", form,
    el("p", { class: "auth-alt" },
      el("a", { href: "#/reset" }, "Forgotten password?"), " · New here? ", el("a", { href: "#/register" }, "Create an account"))));
  return wrap;
}
