/* Secure contact form transport. No recipient address or API secrets appear here. */
(() => {
  "use strict";
  const page = document.querySelector('main[data-secure-contact-api][data-turnstile-sitekey]');
  const forms = [...document.querySelectorAll("form[data-secure-form]")];
  if (!page || !forms.length) return;

  const apiString = (page.dataset.secureContactApi || "").trim();
  const siteKey = (page.dataset.turnstileSitekey || "").trim();
  const configValid = (() => {
    try {
      const url = new URL(apiString);
      return url.protocol === "https:" &&
        url.pathname === "/v1/contact" &&
        (url.hostname.endsWith(".workers.dev") || url.hostname === "forms.joshuaupshawphd.com") &&
        /^[A-Za-z0-9_-]{15,128}$/.test(siteKey);
    } catch { return false; }
  })();

  const state = new Map();
  for (const form of forms) {
    const status = form.querySelector(".contact-form-status");
    const button = form.querySelector("[data-secure-submit]");
    const type = form.dataset.secureForm;
    const slot = form.querySelector("[data-turnstile-slot]");
    state.set(form, { status, button, type, slot, widgetId: null, token: "" });
    // Fail closed if the backend or anti-bot challenge is not configured.
    button.disabled = true;
  }

  function announce(form, message, isError = false) {
    const entry = state.get(form);
    entry.status.textContent = message;
    entry.status.classList.toggle("contact-form-error", isError);
  }

  if (!configValid) return;

  function renderWidgets() {
    if (!window.turnstile || typeof window.turnstile.render !== "function") return;
    for (const form of forms) {
      const entry = state.get(form);
      try {
        entry.widgetId = window.turnstile.render(entry.slot, {
          sitekey: siteKey,
          action: entry.type === "inquiry" ? "contact_inquiry" : "contact_meeting",
          theme: "dark",
          callback: token => { entry.token = token; announce(form, "Verification ready. You may submit your message."); },
          "expired-callback": () => { entry.token = ""; announce(form, "Verification expired. Please verify again.", true); },
          "error-callback": () => { entry.token = ""; announce(form, "Verification could not load. Please retry or use direct email.", true); },
        });
        entry.button.disabled = false;
        announce(form, "Please complete the security verification if prompted.");
      } catch {
        announce(form, "Secure submissions are unavailable. Please email contact@joshuaupshawphd.com.", true);
      }
    }
  }

  const turnstileScript = document.createElement("script");
  turnstileScript.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  turnstileScript.async = true;
  turnstileScript.defer = true;
  turnstileScript.onload = renderWidgets;
  turnstileScript.onerror = () => {
    for (const form of forms) announce(form, "Verification could not load. Please use direct email.", true);
  };
  document.head.appendChild(turnstileScript);

  for (const form of forms) {
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const entry = state.get(form);
      if (!entry.widgetId && entry.widgetId !== 0) return;
      if (!entry.token) {
        announce(form, "Complete the security verification before submitting.", true);
        return;
      }

      const data = Object.fromEntries(new FormData(form).entries());
      data.type = entry.type;
      data.turnstileToken = entry.token;
      data.website = (form.elements.namedItem("website")?.value || "").trim();
      entry.button.disabled = true;
      announce(form, "Sending securely...");

      try {
        const response = await fetch(apiString, {
          method: "POST",
          mode: "cors",
          credentials: "omit",
          cache: "no-store",
          redirect: "error",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          signal: AbortSignal.timeout(15000),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.ok !== true) {
          throw new Error(response.status === 429 ? "Too many requests. Try again shortly." :
            typeof result.message === "string" ? result.message : "The form could not be delivered.");
        }
        window.location.assign("/contact/thanks/");
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to deliver the message.";
        announce(form, message + " If the problem continues, email contact@joshuaupshawphd.com.", true);
      } finally {
        entry.token = "";
        if (window.turnstile && entry.widgetId !== null) {
          try { window.turnstile.reset(entry.widgetId); } catch { /* Keep form available for retries. */ }
        }
        entry.button.disabled = false;
      }
    });
  }
})();