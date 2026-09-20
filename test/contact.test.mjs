import assert from "node:assert/strict";
import { test } from "node:test";
import { createContactHandlers } from "../app/api/contact/contact.ts";

const origin = "https://amerged.example";
const environment = {
  CONTACT_FORM_SECRET: "test-only-contact-key-".repeat(3),
  CONTACT_RECIPIENT: "inbox@example.com",
  OHMYHOST_MAIL_GATEWAY_URL: "https://mail.example",
  OHMYHOST_MAIL_KEY: "k".repeat(43),
  OHMYHOST_PROJECT_ID: "00000000000000000000000001",
};
const brief = {
  name: "Example Person",
  email: "person@example.com",
  service: "Custom AI software",
  message: "Build a document review tool for our team.",
  website: "",
};
function fixture(options = {}) {
  let now = Date.parse("2026-09-19T12:14:50.000Z");
  const calls = [],
    stored = new Map();
  const handlers = createContactHandlers({
    environment: { ...environment, ...options.environment },
    now: () => now,
    fetch: async (request) => {
      const body = await request.json();
      const key = request.headers.get("idempotency-key");
      calls.push({ key, body });
      if (stored.has(key) && stored.get(key) !== JSON.stringify(body))
        return Response.json({ code: "mail_send_conflict" }, { status: 409 });
      stored.set(key, JSON.stringify(body));
      if (options.uncertain && calls.length === 1)
        return Response.json(
          { state: "uncertain", request_id: "00000000000000000000000002" },
          { status: 202 },
        );
      if (options.disconnect) throw Error("private upstream failure with secret-value");
      return Response.json(
        { state: "accepted", request_id: "00000000000000000000000002", message_id: "mail-example" },
        { status: 202 },
      );
    },
  });
  return {
    handlers,
    calls,
    advance: (milliseconds) => {
      now += milliseconds;
    },
    token: async () => {
      const response = await handlers.GET(
        new Request(origin + "/api/contact", { headers: { "cf-connecting-ip": "203.0.113.7" } }),
      );
      assert.equal(response.status, 200);
      return (await response.json()).token;
    },
    post: (payload, headers = {}) =>
      handlers.POST(
        new Request(origin + "/api/contact", {
          method: "POST",
          headers: {
            origin,
            "content-type": "application/json",
            "cf-connecting-ip": "203.0.113.7",
            ...headers,
          },
          body: JSON.stringify(payload),
        }),
      ),
  };
}

test("submits only to the server recipient and escapes submitted HTML", async () => {
  const f = fixture();
  const response = await f.post({ ...brief, name: "<Example & Person>", token: await f.token() });
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { state: "accepted" });
  assert.equal(f.calls[0].body.to, environment.CONTACT_RECIPIENT);
  assert.match(f.calls[0].body.text, /person@example.com/);
  assert.match(f.calls[0].body.html, /&lt;Example &amp; Person&gt;/);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("replays the same brief and limits another brief in the same IP window", async () => {
  const f = fixture(),
    token = await f.token();
  assert.equal(await f.token(), token);
  assert.equal((await f.post({ ...brief, token })).status, 202);
  assert.equal((await f.post({ ...brief, token })).status, 202);
  const conflict = await f.post({ ...brief, message: "A different project to submit now.", token });
  assert.equal(conflict.status, 429);
  assert.equal((await conflict.json()).code, "rate_limited");
  assert.equal(new Set(f.calls.map((call) => call.key)).size, 1);
  assert.ok(Number(conflict.headers.get("retry-after")) > 0);
});

test("retains one gateway key when an uncertain send is checked across the window boundary", async () => {
  const f = fixture({ uncertain: true }),
    token = await f.token();
  const pending = await f.post({ ...brief, token });
  assert.deepEqual(await pending.json(), { state: "uncertain" });
  f.advance(20_000);
  const checked = await f.post({ ...brief, token });
  assert.deepEqual(await checked.json(), { state: "accepted" });
  assert.equal(f.calls[0].key, f.calls[1].key);
  assert.deepEqual(f.calls[0].body, f.calls[1].body);
  const disconnected = fixture({ disconnect: true });
  const response = await disconnected.post({ ...brief, token: await disconnected.token() });
  assert.deepEqual(await response.json(), { state: "uncertain" });
});

test("rejects cross-origin, modified, expired and differently scoped form tokens before sending", async () => {
  const f = fixture(),
    token = await f.token();
  for (const headers of [
    { origin: "https://other.example" },
    { origin: "null" },
    { "cf-connecting-ip": "203.0.113.8" },
  ])
    assert.equal((await f.post({ ...brief, token }, headers)).status, 403);
  assert.equal((await f.post({ ...brief, token: token + "x" })).status, 403);
  f.advance(60 * 60_000);
  assert.equal((await f.post({ ...brief, token })).status, 410);
  assert.equal(f.calls.length, 0);
});

test("bounds and validates the complete request, including honeypot and recipient injection", async () => {
  const f = fixture(),
    token = await f.token();
  for (const change of [
    { name: "" },
    { email: "not-an-email" },
    { service: "Unexpected" },
    { message: "short" },
    { name: "bad\nheader" },
    { website: "https://spam.example" },
    { to: "attacker@example.com" },
  ])
    assert.equal((await f.post({ ...brief, token, ...change })).status, 400);
  assert.equal((await f.post({ ...brief, token, message: "x".repeat(30_000) })).status, 413);
  assert.equal((await f.post({ ...brief, token }, { "content-type": "text/plain" })).status, 415);
  assert.equal(f.calls.length, 0);
});

test("requires configured secrets and platform IP without exposing either", async () => {
  const missing = fixture({ environment: { CONTACT_FORM_SECRET: "" } });
  const response = await missing.handlers.GET(
    new Request(origin + "/api/contact", { headers: { "cf-connecting-ip": "203.0.113.7" } }),
  );
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { state: "error", code: "unavailable" });
  const f = fixture(),
    token = await f.token();
  assert.equal((await f.post({ ...brief, token }, { "cf-connecting-ip": "" })).status, 503);
  assert.equal(f.calls.length, 0);
});
