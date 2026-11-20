import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.mjs";

const endpoint = "https://joshua-upshaw-contact.example.workers.dev/v1/contact";
const allowedOrigin = "https://joshuaupshawphd.com";
const inquiry = {
  type: "inquiry", name: "Jane Example", email: "jane@example.org",
  organization: "University", inquiry_type: "Research collaboration",
  message: "I'd like to discuss an experimental research study.",
  website: "", turnstileToken: "test-turnstile-token",
};

function environment(overrides = {}) {
  return {
    TURNSTILE_SECRET_KEY: "private-turnstile-test-key",
    RESEND_API_KEY: "private-resend-test-key",
    CONTACT_RECIPIENT: "internal@example.invalid",
    CONTACT_SENDER: "Website <verified@example.invalid>",
    CONTACT_RATE_LIMIT: { limit: async () => ({ success: true }) },
    ...overrides,
  };
}

function request(data = inquiry, opts = {}) {
  return new Request(endpoint, {
    method: opts.method ?? "POST",
    headers: {
      Origin: opts.origin ?? allowedOrigin,
      "Content-Type": opts.contentType ?? "application/json",
      "CF-Connecting-IP": "203.0.113.10",
    },
    body: JSON.stringify(data),
  });
}

function mockedProvider({ success = true, hostname = "joshuaupshawphd.com", action = "contact_inquiry", sendOk = true } = {}) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    const url = typeof input === "string" ? input : input.url;
    calls.push({ url, options });
    if (url.includes("siteverify")) {
      return new Response(JSON.stringify({ success, hostname, action }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("api.resend.com")) {
      return new Response(JSON.stringify({ id: "mock-email-id" }), {
        status: sendOk ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw new Error("Unexpected provider: " + url);
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

test("rejects unknown origins without delivery", async () => {
  const r = await worker.fetch(request(inquiry, { origin: "https://attacker.example" }), environment());
  assert.equal(r.status, 403);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), null);
});

test("supports preflight only from the portfolio origin", async () => {
  const r = await worker.fetch(new Request(endpoint, {
    method: "OPTIONS", headers: { Origin: allowedOrigin },
  }), environment());
  assert.equal(r.status, 204);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), allowedOrigin);
});

test("fails closed if credentials or rate limiter are missing", async () => {
  const r = await worker.fetch(request(), environment({ RESEND_API_KEY: undefined }));
  assert.equal(r.status, 503);
});

test("rejects malformed contact input before calling external providers", async () => {
  const mock = mockedProvider();
  try {
    const r = await worker.fetch(request({ ...inquiry, email: "bad-email" }), environment());
    assert.equal(r.status, 400);
    assert.equal(mock.calls.length, 0);
  } finally { mock.restore(); }
});

test("rejects exceeding Cloudflare per-IP rate limit", async () => {
  const r = await worker.fetch(request(), environment({
    CONTACT_RATE_LIMIT: { limit: async () => ({ success: false }) },
  }));
  assert.equal(r.status, 429);
});

test("honeypot submissions do not send email", async () => {
  const mock = mockedProvider();
  try {
    const r = await worker.fetch(request({ ...inquiry, website: "bot-value" }), environment());
    assert.equal(r.status, 200);
    assert.equal(mock.calls.length, 0);
  } finally { mock.restore(); }
});

test("rejects Turnstile verification with an incorrect hostname", async () => {
  const mock = mockedProvider({ hostname: "evil.example" });
  try {
    const r = await worker.fetch(request(), environment());
    assert.equal(r.status, 403);
    assert.equal(mock.calls.filter(x => x.url.includes("api.resend.com")).length, 0);
  } finally { mock.restore(); }
});

test("rejects Turnstile verification with an incorrect action", async () => {
  const mock = mockedProvider({ action: "other" });
  try {
    const r = await worker.fetch(request(), environment());
    assert.equal(r.status, 403);
  } finally { mock.restore(); }
});

test("sends validated inquiry with private recipient and visitor reply-to", async () => {
  const mock = mockedProvider();
  try {
    const r = await worker.fetch(request(), environment());
    assert.equal(r.status, 200);
    assert.equal((await r.json()).ok, true);
    assert.equal(r.headers.get("Access-Control-Allow-Origin"), allowedOrigin);
    assert.equal(r.headers.get("Cache-Control"), "no-store");
    const send = mock.calls.find(x => x.url === "https://api.resend.com/emails");
    assert.ok(send);
    const body = JSON.parse(send.options.body);
    assert.deepEqual(body.to, ["internal@example.invalid"]);
    assert.equal(body.reply_to, "jane@example.org");
    assert.match(body.text, /Research collaboration/);
    assert.match(send.options.headers.Authorization, /^Bearer private-resend-test-key$/);
    assert.ok(!JSON.stringify(await (new Response(JSON.stringify({ok: true}))).json()).includes("internal@example.invalid"));
  } finally { mock.restore(); }
});

test("fails safely when the email provider is unavailable", async () => {
  const mock = mockedProvider({ sendOk: false });
  try {
    const r = await worker.fetch(request(), environment());
    assert.equal(r.status, 502);
    assert.doesNotMatch(await r.text(), /private-resend-test-key|internal@example.invalid/);
  } finally { mock.restore(); }
});

test("rejects out-of-range meeting dates before provider calls", async () => {
  const mock = mockedProvider();
  try {
    const r = await worker.fetch(request({
      type: "meeting", name: "Jane Example", email: "jane@example.org",
      meeting_duration: "30 minutes", preferred_date: "2020-01-01",
      preferred_start_time_central: "10:00", discussion_topic: "Please discuss the project.",
      alternative_availability: "", website: "", turnstileToken: "test-turnstile-token",
    }), environment());
    assert.equal(r.status, 400);
    assert.equal(mock.calls.length, 0);
  } finally { mock.restore(); }
});

test("delivers a valid weekday meeting request without creating a reservation", async () => {
  const todayParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const parts = Object.fromEntries(todayParts.map(p => [p.type, p.value]));
  const day = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1));
  while ([0, 6].includes(day.getUTCDay())) day.setUTCDate(day.getUTCDate() + 1);
  const preferred = day.toISOString().slice(0, 10);
  const mock = mockedProvider({ action: "contact_meeting" });
  try {
    const r = await worker.fetch(request({
      type: "meeting", name: "Jane Example", email: "jane@example.org",
      meeting_duration: "30 minutes", preferred_date: preferred,
      preferred_start_time_central: "10:30", discussion_topic: "Please discuss research partnership.",
      alternative_availability: "", website: "", turnstileToken: "test-turnstile-token",
    }), environment());
    assert.equal(r.status, 200);
    const sent = mock.calls.find(x => x.url === "https://api.resend.com/emails");
    assert.ok(sent);
    const body = JSON.parse(sent.options.body);
    assert.match(body.text, /Request only, not a confirmed reservation/);
    assert.match(body.text, /America\/Chicago/);
    assert.match(body.subject, /30 minutes/);
  } finally { mock.restore(); }
});

test("rejects impossible future dates without throwing", async () => {
  const r = await worker.fetch(request({
    type: "meeting", name: "Jane Example", email: "jane@example.org",
    meeting_duration: "30 minutes", preferred_date: "9999-99-99",
    preferred_start_time_central: "10:00", discussion_topic: "Please discuss a research project.",
    alternative_availability: "", website: "", turnstileToken: "test-turnstile-token",
  }), environment());
  assert.equal(r.status, 400);
});
