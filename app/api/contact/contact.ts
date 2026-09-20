import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { createTransactionalMailClient } from "@ohmyhost/customer-runtime/mail";

const WINDOW_MS = 15 * 60_000;
const TOKEN_WINDOWS = 4;
const MAX_BODY_BYTES = 24 * 1024;
const SERVICES = new Set([
  "Micro SaaS development",
  "Custom AI software",
  "Agentic transformation & context engineering",
  "AI engineering training & workshops",
  "Let’s find out together",
]);

export interface ContactEnvironment {
  readonly CONTACT_FORM_SECRET?: string;
  readonly CONTACT_RECIPIENT?: string;
  readonly OHMYHOST_PROJECT_ID?: string;
  readonly OHMYHOST_MAIL_GATEWAY_URL?: string;
  readonly OHMYHOST_MAIL_KEY?: string;
  readonly OHMYHOST_MAIL_GATEWAY?: { fetch(request: Request): Promise<Response> };
}
type Brief = { name: string; email: string; service: string; message: string };

class FormError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

/** The gateway stores the durable mail claim; this application needs no database. */
export function createContactHandlers(dependencies: {
  environment: ContactEnvironment | (() => Promise<ContactEnvironment>);
  now?: () => number;
}) {
  const now = dependencies.now ?? Date.now;
  async function configuration() {
    const env =
      typeof dependencies.environment === "function"
        ? await dependencies.environment()
        : dependencies.environment;
    const secret = env.CONTACT_FORM_SECRET ?? "";
    const recipient = (env.CONTACT_RECIPIENT ?? "").trim().toLowerCase();
    if (secret.length < 32 || !validEmail(recipient)) throw new FormError(503, "unavailable");
    const gateway = env.OHMYHOST_MAIL_GATEWAY;
    if (!gateway || typeof gateway.fetch !== "function") throw new FormError(503, "unavailable");
    const projectId = env.OHMYHOST_PROJECT_ID ?? "";
    const mail = createTransactionalMailClient({
      endpoint: env.OHMYHOST_MAIL_GATEWAY_URL ?? "",
      key: env.OHMYHOST_MAIL_KEY ?? "",
      projectId,
      fetch: (request) => gateway.fetch(request),
      timeoutMilliseconds: 15_000,
    });
    return { secret, recipient, projectId, mail };
  }
  return {
    async GET(request: Request): Promise<Response> {
      try {
        if (request.headers.get("sec-fetch-site") === "cross-site")
          throw new FormError(403, "forbidden");
        const config = await configuration();
        const slot = Math.floor(now() / WINDOW_MS);
        const signature = sign(config.secret, config.projectId, trustedIp(request), slot);
        return reply(200, {
          token: `v1.${slot}.${signature.toString("base64url")}`,
          expiresAt: new Date((slot + TOKEN_WINDOWS) * WINDOW_MS).toISOString(),
        });
      } catch (error) {
        return formFailure(error);
      }
    },
    async POST(request: Request): Promise<Response> {
      let config: Awaited<ReturnType<typeof configuration>>;
      let brief: Brief;
      let idempotencyKey: string;
      try {
        if (request.headers.get("origin") !== new URL(request.url).origin)
          throw new FormError(403, "forbidden");
        if (request.headers.get("content-type")?.split(";", 1)[0]?.trim() !== "application/json")
          throw new FormError(415, "invalid_request");
        config = await configuration();
        const ip = trustedIp(request);
        const input = await readBody(request);
        brief = parseBrief(input);
        if (typeof input.token !== "string") throw new FormError(403, "forbidden");
        const match = /^v1\.(\d{1,10})\.([A-Za-z0-9_-]{43})$/u.exec(input.token);
        if (!match) throw new FormError(403, "forbidden");
        const slot = Number(match[1]);
        const signature = sign(config.secret, config.projectId, ip, slot);
        if (!timingSafeEqual(signature, Buffer.from(match[2], "base64url")))
          throw new FormError(403, "forbidden");
        if (now() < slot * WINDOW_MS || now() >= (slot + TOKEN_WINDOWS) * WINDOW_MS)
          throw new FormError(410, "expired");
        // A signed slot remains stable when an uncertain result is checked after the clock
        // advances. Different content in the same IP slot conflicts at the durable gateway.
        idempotencyKey = `contact.v1.${signature.toString("base64url")}`;
      } catch (error) {
        return formFailure(error);
      }
      try {
        const result = await config.mail.send({
          idempotencyKey,
          to: config.recipient,
          subject: "amerged — Project enquiry",
          text: [
            "New project enquiry",
            "",
            `Name: ${brief.name}`,
            `Email: ${brief.email}`,
            `Area: ${brief.service}`,
            "",
            brief.message,
          ].join("\n"),
          html: `<h1>New project enquiry</h1><p><strong>Name:</strong> ${escapeHtml(brief.name)}</p><p><strong>Email:</strong> ${escapeHtml(brief.email)}</p><p><strong>Area:</strong> ${escapeHtml(brief.service)}</p><pre style="white-space:pre-wrap">${escapeHtml(brief.message)}</pre>`,
        });
        return reply(202, { state: result.state });
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? error.code : null;
        if (code === "mail_send_conflict" || code === "mail_send_limit_exceeded")
          return reply(
            429,
            { state: "error", code: "rate_limited" },
            {
              "retry-after": String(
                Math.max(
                  1,
                  Math.ceil(
                    ((code === "mail_send_limit_exceeded" ? 86_400_000 : WINDOW_MS) -
                      (now() % (code === "mail_send_limit_exceeded" ? 86_400_000 : WINDOW_MS))) /
                      1000,
                  ),
                ),
              ),
            },
          );
        if (code === "mail_rejected") return reply(502, { state: "error", code: "rejected" });
        if (
          code === "mail_credit_insufficient" ||
          code === "mail_reputation_suspended" ||
          code === "unauthorized"
        )
          return reply(503, { state: "error", code: "unavailable" });
        // A transport failure cannot tell us whether the gateway sent the message. Checking
        // again must keep the signed token and the exact body, never create another claim.
        return reply(202, { state: "uncertain" });
      }
    },
  };
}

function trustedIp(request: Request): string {
  // Cloudflare supplies this at the public gateway. Forwarded/X-Real-IP and form fields are
  // deliberately ignored; absence outside the hosted gateway fails closed.
  const ip = request.headers.get("cf-connecting-ip")?.toLowerCase() ?? "";
  if (!isIP(ip)) throw new FormError(503, "unavailable");
  return ip;
}
function sign(secret: string, projectId: string, ip: string, slot: number): Buffer {
  return createHmac("sha256", secret).update(`contact:v1:${projectId}:${ip}:${slot}`).digest();
}
async function readBody(request: Request): Promise<Record<string, unknown>> {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/u.test(declared) || Number(declared) > MAX_BODY_BYTES))
    throw new FormError(413, "too_large");
  const reader = request.body?.getReader();
  if (!reader) throw new FormError(400, "invalid_request");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new FormError(413, "too_large");
      }
      chunks.push(value);
    }
    const value: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
    );
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new FormError(400, "invalid_request");
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof FormError) throw error;
    throw new FormError(400, "invalid_request");
  } finally {
    reader.releaseLock();
  }
}
function parseBrief(input: Record<string, unknown>): Brief {
  if (
    Object.keys(input).sort().join(",") !== "email,message,name,service,token,website" ||
    input.website !== ""
  )
    throw new FormError(400, "invalid_request");
  for (const name of ["name", "email", "service", "message"])
    if (typeof input[name] !== "string") throw new FormError(400, "invalid_request");
  const name = (input.name as string).trim();
  const email = (input.email as string).trim().toLowerCase();
  const service = input.service as string;
  const message = (input.message as string).replace(/\r\n?/gu, "\n").trim();
  if (
    !name ||
    name.length > 100 ||
    /[\u0000-\u001f\u007f]/u.test(name) ||
    !validEmail(email) ||
    !SERVICES.has(service) ||
    message.length < 10 ||
    message.length > 4000 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(message)
  )
    throw new FormError(400, "invalid_request");
  return { name, email, service, message };
}
function validEmail(value: string): boolean {
  return (
    value.length <= 254 &&
    /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u.test(
      value,
    )
  );
}
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function reply(
  status: number,
  body: Readonly<Record<string, unknown>>,
  headers: Record<string, string> = {},
): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers },
  });
}
function formFailure(error: unknown): Response {
  return error instanceof FormError
    ? reply(error.status, { state: "error", code: error.code })
    : reply(503, { state: "error", code: "unavailable" });
}
