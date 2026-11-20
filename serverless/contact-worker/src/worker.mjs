/**
 * Private-delivery API for the public professional website.
 * No recipient address or provider credentials are stored in browser assets.
 * Deploy as a Cloudflare Worker; bind CONTACT_RATE_LIMIT and provision secrets:
 * TURNSTILE_SECRET_KEY, RESEND_API_KEY, CONTACT_RECIPIENT, CONTACT_SENDER.
 */
const SITE_HOSTS = new Set(["joshuaupshawphd.com", "www.joshuaupshawphd.com"]);
const SITE_ORIGINS = new Set([...SITE_HOSTS].map(host => "https://" + host));
const MAX_BODY_BYTES = 16_384;
const MAX_TURNSTILE_TOKEN = 2048;

function json(body, status = 200, origin = "") {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Vary": "Origin",
  };
  if (SITE_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    headers["Access-Control-Max-Age"] = "600";
  }
  return new Response(JSON.stringify(body), { status, headers });
}

const fail = (message, status, origin) => json({ ok: false, message }, status, origin);

const safeString = (value, min, max) => {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (clean.length < min || clean.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(clean)) return null;
  return clean;
};

function centralTodayUTC() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const fields = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return Date.UTC(Number(fields.year), Number(fields.month) - 1, Number(fields.day));
}

function validateMeeting(value) {
  const duration = value.meeting_duration;
  const date = safeString(value.preferred_date, 10, 10);
  const time = safeString(value.preferred_start_time_central, 5, 5);
  const topic = safeString(value.discussion_topic, 10, 1500);
  const alternatives = safeString(value.alternative_availability ?? "", 0, 250);
  if (!["15 minutes", "30 minutes"].includes(duration) || !date || !time || !topic || alternatives === null) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const candidate = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (!Number.isFinite(candidate)) return null;
  if (new Date(candidate).toISOString().slice(0, 10) !== date) return null;
  const days = (candidate - centralTodayUTC()) / 86_400_000;
  if (days < 1 || days > 45 || [0, 6].includes(new Date(candidate).getUTCDay())) return null;
  if (!/^(09|10|11|12|13|14|15|16):(00|30)$/.test(time)) return null;

  return { duration, date, time, topic, alternatives };
}

function validateSubmission(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  if (!["inquiry", "meeting"].includes(input.type)) return null;
  const name = safeString(input.name, 2, 120);
  const email = safeString(input.email, 5, 254);
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || /[\r\n]/.test(email)) return null;
  const token = safeString(input.turnstileToken, 1, MAX_TURNSTILE_TOKEN);
  if (!token) return null;
  if (input.type === "inquiry") {
    const organization = safeString(input.organization ?? "", 0, 150);
    const category = safeString(input.inquiry_type, 3, 80);
    const message = safeString(input.message, 10, 2500);
    const acceptedCategories = new Set([
      "Professional opportunity", "Research collaboration", "Healthcare AI / product development",
      "Speaking or scientific discussion", "General inquiry",
    ]);
    if (organization === null || !category || !acceptedCategories.has(category) || !message) return null;
    return { type: "inquiry", name, email, organization, category, message, token };
  }
  const meeting = validateMeeting(input);
  return meeting ? { type: "meeting", name, email, token, ...meeting } : null;
}

async function verifyChallenge(token, expectedAction, request, env) {
  const data = new FormData();
  data.append("secret", env.TURNSTILE_SECRET_KEY);
  data.append("response", token);
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) data.append("remoteip", ip);
  const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST", body: data, signal: AbortSignal.timeout(8000),
  });
  if (!result.ok) return false;
  const verified = await result.json();
  return verified.success === true &&
    verified.action === expectedAction &&
    SITE_HOSTS.has(verified.hostname);
}

function formatEmail(data) {
  const rows = [
    ["Type", data.type === "inquiry" ? "Professional inquiry" : "Virtual meeting request"],
    ["Name", data.name],
    ["Reply email", data.email],
  ];
  if (data.type === "inquiry") {
    rows.push(["Organization", data.organization || "(not supplied)"], ["Topic", data.category], ["Message", data.message]);
  } else {
    rows.push(
      ["Duration", data.duration],
      ["Preferred date", data.date],
      ["Preferred start", data.time + " (America/Chicago)"],
      ["Discussion", data.topic],
      ["Alternative times", data.alternatives || "(not supplied)"],
      ["Booking status", "Request only, not a confirmed reservation"]
    );
  }
  return rows.map(([k, v]) => k + ":\n" + v).join("\n\n");
}

async function deliverEmail(data, env) {
  const subject = data.type === "inquiry"
    ? "Portfolio inquiry: " + data.category
    : "Portfolio meeting request: " + data.duration;
  const replyAddress = data.email;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.RESEND_API_KEY,
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      from: env.CONTACT_SENDER,
      to: [env.CONTACT_RECIPIENT],
      reply_to: replyAddress,
      subject,
      text: formatEmail(data),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  return response.ok;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, service: "contact" });
    }
    if (url.pathname !== "/v1/contact") return fail("Not found", 404);
    if (!SITE_ORIGINS.has(origin)) return fail("Origin not allowed", 403);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "600",
        "Cache-Control": "no-store",
        "Vary": "Origin",
      } });
    }
    if (request.method !== "POST") return fail("Method not allowed", 405, origin);
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") || "")) {
      return fail("JSON request required", 415, origin);
    }

    // Fail closed when external protections or delivery credentials are missing.
    if (!env.TURNSTILE_SECRET_KEY || !env.RESEND_API_KEY ||
        !env.CONTACT_RECIPIENT || !env.CONTACT_SENDER || !env.CONTACT_RATE_LIMIT) {
      return fail("Contact service is unavailable", 503, origin);
    }

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    let allowed;
    try {
      const decision = await env.CONTACT_RATE_LIMIT.limit({ key: ip });
      allowed = decision.success === true;
    } catch {
      return fail("Contact service is unavailable", 503, origin);
    }
    if (!allowed) return fail("Too many requests. Try again later.", 429, origin);

    let input;
    try {
      const declared = Number(request.headers.get("Content-Length") || 0);
      if (declared > MAX_BODY_BYTES) return fail("Request too large", 413, origin);
      const text = await request.text();
      if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return fail("Request too large", 413, origin);
      input = JSON.parse(text);
    } catch {
      return fail("Invalid request", 400, origin);
    }

    // The honeypot is deliberately silent to discourage automated submission.
    if (typeof input === "object" && input !== null && typeof input.website === "string" && input.website.trim()) {
      return json({ ok: true }, 200, origin);
    }

    const data = validateSubmission(input);
    if (!data) return fail("Please check the form fields and try again.", 400, origin);

    try {
      const expectedAction = data.type === "inquiry" ? "contact_inquiry" : "contact_meeting";
      if (!await verifyChallenge(data.token, expectedAction, request, env)) {
        return fail("Verification failed. Please try again.", 403, origin);
      }
      if (!await deliverEmail(data, env)) {
        return fail("Could not deliver your message. Please try again later.", 502, origin);
      }
    } catch {
      // Do not log form data, email addresses, tokens, or provider response bodies.
      return fail("Contact service is temporarily unavailable.", 502, origin);
    }
    return json({ ok: true }, 200, origin);
  },
};
