/* Consent-first Google Tag Manager; GA4 gtag.js retained only as a fallback. */
(() => {
  "use strict";
  const ga4Id = document.body?.dataset.ga4Id || "";
  const containerId = document.body?.dataset.gtmId || "";
  const useTagManager = /^GTM-[A-Z0-9]{6,15}$/.test(containerId);
  const useGA4Fallback = !useTagManager && /^G-[A-Z0-9]{4,20}$/.test(ga4Id);
  if (!useTagManager && !useGA4Fallback) return;

  const KEY = "jup_analytics_consent_v1";
  const banner = document.getElementById("analytics-consent");
  const choices = document.querySelectorAll("[data-analytics-choice]");
  const settings = document.querySelectorAll("[data-analytics-settings]");
  const prefersNoTracking = navigator.globalPrivacyControl === true || navigator.doNotTrack === "1";
  let loaded = false, enabled = false;

  function getPreference() {
    try { return window.localStorage.getItem(KEY); } catch { return null; }
  }
  function storePreference(value) {
    try { window.localStorage.setItem(KEY, value); } catch { /* Ask again next visit. */ }
  }
  function showBanner() {
    if (banner) banner.hidden = false;
  }
  function hideBanner() {
    if (banner) banner.hidden = true;
  }
  function bootstrap() {
    if (loaded || prefersNoTracking) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    // Basic consent mode: loading Google itself waits for opt-in.
    window.gtag("consent", "default", {
      analytics_storage: "denied", ad_storage: "denied",
      ad_user_data: "denied", ad_personalization: "denied"
    });
    window.gtag("consent", "update", { analytics_storage: "granted" });
    window.gtag("js", new Date());
    const tag = document.createElement("script");
    tag.async = true;
    if (useTagManager) {
      // GTM needs the container startup event. Consent was granted before loading.
      window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
      tag.src = "https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(containerId);
    } else {
      // Fallback for a future site that uses direct GA4 without GTM.
      window.gtag("config", ga4Id, {
        page_location: location.origin + location.pathname,
        allow_google_signals: false,
        allow_ad_personalization_signals: false
      });
      tag.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(ga4Id);
    }
    document.head.appendChild(tag);
  }
  function apply(value) {
    enabled = value === "accepted" && !prefersNoTracking;
    if (enabled) bootstrap();
    hideBanner();
  }
  function clearAnalyticsCookies() {
    const names = document.cookie.split(";").map(s => s.trim().split("=")[0])
      .filter(s => s === "_ga" || s.startsWith("_ga_") || s === "_gid");
    for (const cookie of names) {
      for (const domain of ["", location.hostname, ".joshuaupshawphd.com"]) {
        document.cookie = cookie + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax" +
          (domain ? "; domain=" + domain : "");
      }
    }
  }
  function setChoice(value) {
    storePreference(value);
    if (value === "declined") {
      enabled = false;
      if (loaded && typeof window.gtag === "function") {
        window.gtag("consent", "update", { analytics_storage: "denied" });
      }
      clearAnalyticsCookies();
      // A reload removes an already loaded GA script after withdrawal.
      if (loaded) { location.reload(); return; }
    }
    apply(value);
  }
  window.siteAnalytics = {
    track: function(eventName, parameters = {}) {
      if (!enabled || typeof window.gtag !== "function") return;
      const allowed = new Set(["contact_email_click", "outbound_profile_click",
        "meeting_duration_selected", "contact_inquiry_sent", "meeting_request_sent"]);
      if (!allowed.has(eventName)) return;
      // Never pass form input, personal data, message bodies, email, or URL parameters.
      const safeParams = {};
      if (eventName === "meeting_duration_selected" && ["15", "30"].includes(String(parameters.duration))) {
        safeParams.meeting_minutes = Number(parameters.duration);
      }
      if (eventName === "outbound_profile_click" &&
          ["linkedin", "github", "scholar"].includes(parameters.destination)) {
        safeParams.destination = parameters.destination;
      }
      if (useTagManager) {
        // GTM Custom Event triggers can use these dataLayer event names.
        window.dataLayer.push({ event: eventName, ...safeParams });
      } else {
        window.gtag("event", eventName, safeParams);
      }
    }
  };
  for (const button of choices) {
    button.addEventListener("click", () => {
      if (button.dataset.analyticsChoice === "accepted" && prefersNoTracking) {
        showBanner(); return;
      }
      setChoice(button.dataset.analyticsChoice);
    });
  }
  for (const button of settings) button.addEventListener("click", showBanner);
  document.addEventListener("click", event => {
    const link = event.target.closest("a[href]");
    if (!link) return;
    if (link.protocol === "mailto:") window.siteAnalytics.track("contact_email_click");
    if (link.hostname === "www.linkedin.com") window.siteAnalytics.track("outbound_profile_click", {destination:"linkedin"});
    else if (link.hostname === "github.com") window.siteAnalytics.track("outbound_profile_click", {destination:"github"});
    else if (link.hostname === "scholar.google.com") window.siteAnalytics.track("outbound_profile_click", {destination:"scholar"});
  });
  const pref = getPreference();
  if (pref === "accepted" && !prefersNoTracking) apply("accepted");
  else if (pref === "declined" || prefersNoTracking) apply("declined");
  else showBanner();
})();