"use client";

type Submission = Record<"name" | "email" | "service" | "message" | "website" | "token", string>;

/** Preserve the exact brief and signed receipt until an uncertain send can be checked. */
export function initContactForm() {
  const dialog = document.getElementById("brief-dialog");
  const form = document.getElementById("brief-form");
  const status = document.getElementById("form-status");
  const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
  const submitLabel = document.getElementById("brief-submit-label");
  if (
    !(dialog instanceof HTMLDialogElement) ||
    !(form instanceof HTMLFormElement) ||
    !status ||
    !submit ||
    !submitLabel
  )
    return () => {};
  const fields = [
    ...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("[name]"),
  ];
  const cleanups: Array<() => void> = [];
  let opener: HTMLElement | null = null;
  let pending = false;
  let disposed = false;
  let submission: Submission | null = null;
  const listen = (target: EventTarget | null, name: string, handler: EventListener) => {
    target?.addEventListener(name, handler);
    cleanups.push(() => target?.removeEventListener(name, handler));
  };
  const controls = (busy: boolean, locked = false) => {
    pending = busy;
    form.setAttribute("aria-busy", String(busy));
    submit.disabled = busy;
    fields.forEach((field) => {
      field.disabled = busy || locked;
    });
    submitLabel.textContent = busy
      ? "Sending…"
      : locked
        ? "Check send status"
        : "Send project brief";
  };
  document.querySelectorAll<HTMLElement>("[data-contact]").forEach((button) =>
    listen(button, "click", () => {
      opener = button;
      dialog.showModal();
      (fields.find((field) => !field.disabled && field.name === "name") ?? submit).focus();
    }),
  );
  listen(document.getElementById("close-dialog"), "click", () => dialog.close());
  listen(dialog, "click", (event) => {
    if (event.target !== dialog || !(event instanceof MouseEvent)) return;
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      dialog.close();
  });
  listen(dialog, "close", () => opener?.focus());
  listen(form, "submit", async (event) => {
    event.preventDefault();
    if (pending || (!submission && !form.reportValidity())) return;
    const data = new FormData(form);
    controls(true, submission !== null);
    status.textContent = submission ? "Checking the same message…" : "Sending your project brief…";
    if (!submission) {
      try {
        const response = await fetch("/api/contact", {
          credentials: "same-origin",
          cache: "no-store",
          signal: AbortSignal.timeout(15_000),
        });
        const result = await response.json();
        if (!response.ok || typeof result.token !== "string") throw Error("unavailable");
        submission = {
          name: String(data.get("name") ?? ""),
          email: String(data.get("email") ?? ""),
          service: String(data.get("service") ?? ""),
          message: String(data.get("message") ?? ""),
          website: String(data.get("website") ?? ""),
          token: result.token,
        };
      } catch {
        if (disposed) return;
        controls(false);
        status.textContent =
          "The contact service is temporarily unavailable. Nothing was submitted. Please try again later.";
        return;
      }
    }
    if (disposed) return;
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(submission),
        signal: AbortSignal.timeout(25_000),
      });
      const result = await response.json();
      if (disposed) return;
      if (response.status === 202 && result.state === "accepted") {
        submission = null;
        form.reset();
        controls(false);
        status.textContent = "Your message was accepted for sending. We’ll reply by email.";
      } else if (response.status === 202 && result.state === "uncertain") {
        controls(false, true);
        status.textContent =
          "Your message may have been sent. Use Check send status to check the same request.";
      } else if (result.state === "error" && result.code === "expired") {
        controls(false, true);
        submit.disabled = true;
        status.textContent =
          "This request can no longer be checked here. It may already have been sent. Please wait for a reply before sending again.";
      } else if (
        result.state === "error" &&
        [
          "invalid_request",
          "too_large",
          "forbidden",
          "rate_limited",
          "unavailable",
          "rejected",
        ].includes(result.code)
      ) {
        submission = null;
        controls(false);
        status.textContent =
          result.code === "rate_limited"
            ? "No new message was sent. Please wait before submitting another project brief."
            : result.code === "invalid_request" || result.code === "too_large"
              ? "Please check your name, work email and project details, then try again."
              : "Your message was not accepted. Please try again later.";
      } else throw Error("uncertain");
    } catch {
      if (disposed) return;
      controls(false, true);
      status.textContent =
        "We could not confirm the result. Your message may have been sent. Use the button to check the same message.";
    }
  });
  return () => {
    disposed = true;
    cleanups.forEach((cleanup) => cleanup());
  };
}
