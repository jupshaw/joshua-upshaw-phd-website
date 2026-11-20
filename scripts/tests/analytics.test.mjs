import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../page_sections/analytics.js", import.meta.url), "utf8");

function site({ storedConsent = null, gtm = "GTM-P84JWK5G", ga4 = "", gpc = false } = {}) {
  const scripts = [];
  const handlers = {};
  const cookie = [];
  const storage = new Map();
  if (storedConsent !== null) storage.set("jup_analytics_consent_v2", storedConsent);
  const banner = { hidden: true };
  const controls = ["declined", "accepted"].map(choice => ({
    dataset: { analyticsChoice: choice },
    addEventListener: (event, handler) => { handlers[choice + ":" + event] = handler; },
  }));
  const preferences = [{
    addEventListener: (event, handler) => { handlers["preferences:" + event] = handler; },
  }];
  const document = {
    body: { dataset: { ga4Id: ga4, gtmId: gtm } },
    getElementById: id => id === "analytics-consent" ? banner : null,
    querySelectorAll: query => query === "[data-analytics-choice]" ? controls :
      query === "[data-analytics-settings]" ? preferences : [],
    createElement: tag => ({ tag, async: false, src: "" }),
    head: { appendChild: element => scripts.push(element) },
    addEventListener: (event, handler) => { handlers["document:" + event] = handler; },
    get cookie() { return cookie.join(";"); },
    set cookie(value) { cookie.push(value); },
  };
  const window = { localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  }};
  const location = {
    origin: "https://joshuaupshawphd.com",
    hostname: "joshuaupshawphd.com", pathname: "/",
    reload: () => { location.reloaded = true; },
  };
  runInNewContext(source, {
    document, window, navigator: { globalPrivacyControl: gpc, doNotTrack: gpc ? "1" : "0" },
    location, Date, Set, String, encodeURIComponent, console,
  }, { timeout: 2000 });
  return {
    scripts, banner, window, location, storage,
    accept: () => handlers["accepted:click"](),
    decline: () => handlers["declined:click"](),
    preferences: () => handlers["preferences:click"](),
  };
}

test("GTM is never loaded before explicit opt-in", () => {
  const s = site();
  assert.equal(s.banner.hidden, false);
  assert.equal(s.scripts.length, 0);
  assert.equal(s.window.dataLayer, undefined);
});

test("accepted analytics loads exactly the supplied GTM container", () => {
  const s = site();
  s.accept();
  assert.equal(s.scripts.length, 1);
  assert.equal(s.scripts[0].src,
    "https://www.googletagmanager.com/gtm.js?id=GTM-P84JWK5G");
  assert.equal(s.storage.get("jup_analytics_consent_v2"), "accepted");
  assert.equal(s.banner.hidden, true);
  const commands = s.window.dataLayer;
  assert.equal(commands.some(v => v && v.event === "gtm.js" && typeof v["gtm.start"] === "number"), true);
  const defaults = commands.find(v => v?.[0] === "consent" && v?.[1] === "default");
  assert.equal(defaults?.[2]?.analytics_storage, "denied");
  assert.equal(defaults?.[2]?.ad_storage, "denied");
  assert.equal(commands.some(v => v?.[0] === "consent" && v?.[1] === "update" &&
    v?.[2]?.analytics_storage === "granted"), true);
  assert.equal(commands.some(v => v?.[0] === "config"), false);
});

test("GTM receives allowlisted custom events without personal fields", () => {
  const s = site({ storedConsent: "accepted" });
  s.window.siteAnalytics.track("meeting_duration_selected", { duration: "30", email: "private@example.com" });
  s.window.siteAnalytics.track("outbound_profile_click", { destination: "github" });
  s.window.siteAnalytics.track("unknown_event", { secret: "test" });
  const events = s.window.dataLayer.filter(x => x?.event === "meeting_duration_selected" ||
    x?.event === "outbound_profile_click" || x?.event === "unknown_event");
  assert.equal(events.length, 2);
  assert.equal(events[0].meeting_minutes, 30);
  assert.equal(events[1].destination, "github");
  assert.equal(JSON.stringify(events).includes("private@example.com"), false);
});

test("declining disables tag manager and records preference", () => {
  const s = site();
  s.decline();
  assert.equal(s.scripts.length, 0);
  assert.equal(s.storage.get("jup_analytics_consent_v2"), "declined");
  assert.equal(s.banner.hidden, true);
});

test("stored rejection prevents subsequent tracking", () => {
  const s = site({ storedConsent: "declined" });
  assert.equal(s.scripts.length, 0);
  s.window.siteAnalytics.track("contact_email_click");
  assert.equal(s.window.dataLayer, undefined);
});

test("a global privacy control suppresses the tag manager", () => {
  const s = site({ storedConsent: "accepted", gpc: true });
  assert.equal(s.scripts.length, 0);
});

test("GA4-only fallback remains available when no GTM container is configured", () => {
  const s = site({ gtm: "", ga4: "G-TEST1234" });
  s.accept();
  assert.equal(s.scripts.length, 1);
  assert.equal(s.scripts[0].src, "https://www.googletagmanager.com/gtag/js?id=G-TEST1234");
  assert.equal(s.window.dataLayer.some(x => x?.[0] === "config" && x?.[1] === "G-TEST1234"), true);
});


test("supplied GA4 measurement ID takes precedence over existing GTM to avoid duplicate hits", () => {
  const s = site({ gtm: "GTM-P84JWK5G", ga4: "G-ZCZ7BZ77CW" });
  assert.equal(s.scripts.length, 0, "no Google code loads before consent");
  s.accept();
  assert.equal(s.scripts.length, 1, "load only one Google library");
  assert.equal(s.scripts[0].src,
    "https://www.googletagmanager.com/gtag/js?id=G-ZCZ7BZ77CW");
  assert.equal(s.scripts.some(x => x.src.includes("gtm.js")), false);
  const config = s.window.dataLayer.filter(x => x?.[0] === "config");
  assert.equal(config.length, 1);
  assert.equal(config[0][1], "G-ZCZ7BZ77CW");
  assert.equal(config[0][2].allow_google_signals, false);
  assert.equal(config[0][2].allow_ad_personalization_signals, false);
});

test("direct GA4 keeps non-personal custom events and respects consent", () => {
  const s = site({ gtm: "GTM-P84JWK5G", ga4: "G-ZCZ7BZ77CW" });
  s.window.siteAnalytics.track("contact_inquiry_sent", { email: "private@example.com" });
  assert.equal(s.window.dataLayer, undefined);
  s.accept();
  s.window.siteAnalytics.track("meeting_request_sent", { email: "private@example.com" });
  s.window.siteAnalytics.track("meeting_duration_selected", { duration: "15", secret: "do-not-send" });
  const events=s.window.dataLayer.filter(v=>v?.[0]==="event");
  assert.equal(events.length, 2);
  assert.equal(events[0][1], "meeting_request_sent");
  assert.equal(events[1][2].meeting_minutes, 15);
  assert.equal(JSON.stringify(events).includes("private@example.com"), false);
  assert.equal(JSON.stringify(events).includes("do-not-send"), false);
});

test("direct GA4 does not load for a declined visitor", () => {
  const s = site({ storedConsent: "declined", gtm: "GTM-P84JWK5G", ga4: "G-ZCZ7BZ77CW" });
  assert.equal(s.scripts.length, 0);
  assert.equal(s.window.dataLayer, undefined);
});
