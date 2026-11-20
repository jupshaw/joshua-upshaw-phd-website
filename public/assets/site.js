(() => { const button=document.querySelector('[data-menu-toggle]'); const nav=document.getElementById('primary-nav'); if(button && nav){button.addEventListener('click',()=>{const open=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!open));nav.classList.toggle('is-open',!open);});document.addEventListener('keydown',e=>{if(e.key==='Escape'){button.setAttribute('aria-expanded','false');nav.classList.remove('is-open');}});}const year=document.querySelector('[data-year]');if(year)year.textContent=String(new Date().getFullYear());})();
/* Contact-page meeting preference controls. The page never claims to reserve calendar time. */
(() => {
  'use strict';
  const section = document.getElementById('meetings');
  const form = document.getElementById('meeting-request-form');
  if (!section || !form) return;

  const durationInput = document.getElementById('meeting-duration-field');
  const heading = document.getElementById('meeting-form-heading');
  const subject = document.getElementById('meeting-request-subject');
  const badge = document.getElementById('meeting-length-badge');
  const dateInput = document.getElementById('meeting-date');
  const cards = Array.from(section.querySelectorAll('[data-meeting-duration]'));
  const requestPanel = document.getElementById('request-meeting');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const meetingLink = duration => {
    // Add the public URLs from your meeting scheduler to the two data-booking-url
    // attributes in scripts/page_sections/contact.html to enable live self-booking.
    const candidate = (section.getAttribute('data-booking-url-' + duration) || '').trim();
    try {
      const url = new URL(candidate);
      return url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  };

  const selectDuration = duration => {
    if (duration !== '15' && duration !== '30') return;
    durationInput.value = duration + ' minutes';
    heading.textContent = 'Request a ' + duration + '-minute virtual meeting';
    subject.value = 'Professional website · ' + duration + '-minute virtual meeting request';
    badge.textContent = duration + ' MIN';
    cards.forEach(card => {
      const selected = card.dataset.meetingDuration === duration;
      card.classList.toggle('is-selected', selected);
      card.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  };

  cards.forEach(card => {
    const duration = card.dataset.meetingDuration;
    const externalUrl = meetingLink(duration);
    if (externalUrl) {
      const label = card.querySelector('.contact-meeting-cta');
      if (label) label.innerHTML = 'Check live availability <span aria-hidden="true">↗</span>';
      card.setAttribute('aria-label', duration + '-minute meeting, open live calendar booking in a new tab');
    }

    card.addEventListener('click', () => {
      if (externalUrl) {
        window.open(externalUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      selectDuration(duration);
      requestPanel?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' });
    });
  });

  // Set input range using the website owner's Central timezone, not the visitor's timezone.
  const chicagoToday = () => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), 12));
  };
  const formatDate = date => date.toISOString().slice(0, 10);
  const startOfRange = chicagoToday();
  const minDate = new Date(startOfRange);
  minDate.setUTCDate(minDate.getUTCDate() + 1);
  const maxDate = new Date(startOfRange);
  maxDate.setUTCDate(maxDate.getUTCDate() + 45);
  dateInput.min = formatDate(minDate);
  dateInput.max = formatDate(maxDate);

  const validateDate = () => {
    dateInput.setCustomValidity('');
    if (!dateInput.value) return;
    const selected = new Date(dateInput.value + 'T12:00:00Z');
    if (Number.isNaN(selected.getTime())) {
      dateInput.setCustomValidity('Select a valid date.');
    } else if (selected.getUTCDay() === 0 || selected.getUTCDay() === 6) {
      dateInput.setCustomValidity('Please choose a weekday, Monday through Friday.');
    } else if (selected < minDate || selected > maxDate) {
      dateInput.setCustomValidity('Choose a weekday at least one day ahead and within the next 45 days.');
    }
  };
  dateInput.addEventListener('change', validateDate);
  dateInput.addEventListener('input', validateDate);
  form.addEventListener('submit', event => {
    validateDate();
    if (!form.reportValidity()) event.preventDefault();
  });
  selectDuration('15');
})();

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