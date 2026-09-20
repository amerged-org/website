# amerged website

Next.js (App Router) landing page for [amerged](https://amerged.com) — Agents Merged into your business.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm start
```

Content and design are ported from the editorial single-file HTML landing page. Interactive behaviour lives in `app/amerged-experience.js` and mounts via the client `Experience` component.

## Contact form

The project brief is sent through the published ohmyhost transactional-mail client. Enable mail for the existing hosting project, then install two runtime secrets in each deployed environment:

- `CONTACT_RECIPIENT`: the single inbox that receives enquiries. Visitors cannot select a recipient.
- `CONTACT_FORM_SECRET`: a separately generated random secret of at least 32 characters.

The platform supplies the mail gateway URL, key, project ID and private `OHMYHOST_MAIL_GATEWAY` service binding. The request resolves these through OpenNext's Cloudflare context and sends only through that binding; a missing binding reports unavailable. No database, provider credentials or additional outbound origins are required. The original page design and animation remain intact.

`GET /api/contact` issues a signed form receipt bound to the platform-provided visitor IP and a 15-minute slot. `POST /api/contact` accepts bounded, same-origin JSON only, validates the brief and honeypot, and uses that receipt as the gateway's durable idempotency key. Different content in the same slot is refused; the platform also enforces its project quotas. No plaintext visitor IP is stored or included in the email.

The receipt remains usable for 45–60 minutes so the browser can check an uncertain result across a slot boundary without creating another mail request. The browser keeps the exact pending brief in memory and offers **Check send status**. An accepted result means accepted for sending, not proof of inbox delivery. No message is sent automatically when the form opens.

The production gateway must provide `CF-Connecting-IP`; arbitrary `Forwarded` and `X-Real-IP` headers are ignored. A local development request without the hosted runtime and secrets reports unavailable. Tests inject a synthetic gateway transport and never send mail:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Before reporting the production form as working, open it at its final HTTPS origin, submit one explicitly authorized brief, and verify receipt in the configured inbox. Keep an uncertain request and check it; do not submit a replacement automatically.
