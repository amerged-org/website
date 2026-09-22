// @ts-nocheck
/** amerged: progressive enhancement shared by HTML and Next.js.
 * Every listener, observer and animation is cleaned up for React Strict Mode.
 * No tracking, network submission or persistent storage is used.
 */
export function initExperience() {
  if (typeof window === 'undefined') return () => {};
  const cleanups = [];
  const listen = (target, type, handler, options) => {
    if (!target) return;
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const menu = document.getElementById('menu-button');
  const nav = document.getElementById('mobile-nav');
  function closeMenu() {
    if (!menu || !nav) return;
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-label', 'Open menu');
    nav.hidden = true;
  }
  listen(menu, 'click', () => {
    if (!menu || !nav) return;
    const expanded = menu.getAttribute('aria-expanded') === 'true';
    menu.setAttribute('aria-expanded', String(!expanded));
    menu.setAttribute('aria-label', expanded ? 'Open menu' : 'Close menu');
    nav.hidden = expanded;
  });
  nav?.querySelectorAll('a').forEach(link => listen(link, 'click', closeMenu));
  listen(document, 'keydown', event => {
    if (event.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') {
      closeMenu(); menu.focus();
    }
  });
  const mobile = window.matchMedia('(max-width: 680px)');
  listen(mobile, 'change', event => { if (!event.matches) closeMenu(); });

  // Scroll progress: one paint per browser frame, never a blocking scroll listener.
  let scrollFrame = 0;
  const progress = document.getElementById('reading-progress');
  function updateProgress() {
    const maximum = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = `scaleX(${maximum > 0 ? Math.min(1, window.scrollY / maximum) : 0})`;
    if (window.scrollY < 80) document.querySelectorAll('.nav a[aria-current]').forEach(link => link.removeAttribute('aria-current'));
    scrollFrame = 0;
  }
  const scheduleProgress = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateProgress); };
  listen(window, 'scroll', scheduleProgress, { passive: true });
  listen(window, 'resize', scheduleProgress, { passive: true });
  updateProgress();
  cleanups.push(() => { if (scrollFrame) cancelAnimationFrame(scrollFrame); });

  if ('IntersectionObserver' in window) {
    const reveals = [...document.querySelectorAll('[data-reveal]')];
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.03, rootMargin: '0px 0px 0px 0px' });
    reveals.forEach(element => { element.classList.add('will-reveal'); observer.observe(element); });
    cleanups.push(() => {
      observer.disconnect();
      reveals.forEach(element => element.classList.remove('will-reveal', 'is-visible'));
    });
    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        document.querySelectorAll('.nav a').forEach(link => {
          if (link.getAttribute('href') === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-12% 0px -58% 0px', threshold: 0 });
    document.querySelectorAll('.paper-section').forEach(section => sectionObserver.observe(section));
    cleanups.push(() => sectionObserver.disconnect());
  }

  // Context engineering figure (SMIL): the signal wave crosses one quarter of
  // the funnel per layer. The layers below follow it; a click jumps there.
  const layerCount = 4;
  const knowledge = document.getElementById('amerged-knowledge');
  const layerButtons = [...document.querySelectorAll('[data-layer]')];
  const knowledgeClock = !!knowledge && typeof knowledge.getCurrentTime === 'function';
  let activeLayer = -1;
  function showLayer(index) {
    if (index === activeLayer || index < 0 || index >= layerCount) return;
    activeLayer = index;
    layerButtons.forEach((item, j) => item.setAttribute('aria-pressed', String(j === index)));
  }
  function paintKnowledge() {
    if (!knowledgeClock) return;
    const t = knowledge.getCurrentTime() % 16;
    const index = Math.min(3, Math.floor(t / 4));
    showLayer(index);
    layerButtons[index]?.style.setProperty('--progress', String((t - index * 4) / 4));
  }
  layerButtons.forEach(button => listen(button, 'click', () => {
    const index = Number(button.getAttribute('data-layer'));
    if (!(index >= 0 && index < layerCount)) return;
    if (knowledgeClock) knowledge.setCurrentTime(index * 4 + .05);
    showLayer(index);
    paintKnowledge();
  }));
  if (knowledge && knowledgeClock) {
    // The loop waits at 01 until the figure is actually on screen, so a
    // visitor who scrolls down sees it from the start, not mid-way. It pauses
    // while scrolled away and continues where it left off.
    let knowledgeInView = !('IntersectionObserver' in window);
    const syncKnowledge = () => {
      if (reduced.matches || document.hidden || !knowledgeInView) knowledge.pauseAnimations();
      else knowledge.unpauseAnimations();
    };
    knowledge.setCurrentTime(reduced.matches ? 8 : 0);
    syncKnowledge();
    if ('IntersectionObserver' in window) {
      const knowledgeObserver = new IntersectionObserver(entries => {
        knowledgeInView = entries[0]?.isIntersecting ?? false;
        syncKnowledge();
      }, { threshold: .35 });
      knowledgeObserver.observe(knowledge);
      cleanups.push(() => knowledgeObserver.disconnect());
    }
    listen(document, 'visibilitychange', syncKnowledge);
    listen(reduced, 'change', syncKnowledge);
    const knowledgeTimer = window.setInterval(() => { if (!document.hidden) paintKnowledge(); }, 80);
    cleanups.push(() => window.clearInterval(knowledgeTimer));
    paintKnowledge();
  }

  // Cookie notice: technical cookies only, so this is information, not consent.
  // Dismissal is remembered locally; storage can be unavailable.
  const cookieNote = document.getElementById('cookie-note');
  const cookieKey = 'amerged-cookie-note';
  let cookieSeen = false;
  try { cookieSeen = window.localStorage.getItem(cookieKey) === '1'; } catch { /* storage blocked */ }
  if (cookieNote && !cookieSeen) cookieNote.hidden = false;
  listen(document.getElementById('cookie-ok'), 'click', () => {
    if (cookieNote) cookieNote.hidden = true;
    try { window.localStorage.setItem(cookieKey, '1'); } catch { /* storage blocked */ }
  });

  // Honest local-only prototype: the form exports a brief; it does not pretend to send mail.
  const dialog = document.getElementById('brief-dialog');
  const form = document.getElementById('brief-form');
  const status = document.getElementById('form-status');
  let returnFocus = null;
  const initialStatus = 'Design preview: saves a text file on your device. No message is sent and no details are stored by this page.';
  document.querySelectorAll('[data-contact]').forEach(button => listen(button, 'click', () => {
    if (!(dialog instanceof HTMLDialogElement)) return;
    returnFocus = button;
    if (status) status.textContent = initialStatus;
    dialog.showModal();
    document.getElementById('brief-name')?.focus();
  }));
  listen(document.getElementById('close-dialog'), 'click', () => dialog?.close());
  listen(dialog, 'click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  listen(dialog, 'close', () => returnFocus?.focus());
  const objectUrls = new Set();
  listen(form, 'submit', event => {
    event.preventDefault();
    if (!(form instanceof HTMLFormElement) || !form.reportValidity()) return;
    const data = new FormData(form);
    const value = name => String(data.get(name) || '').trim();
    const text = [
      'amerged — Project brief',
      'Prepared locally. This brief has not been sent to amerged.',
      '', `Name: ${value('name')}`, `Email: ${value('email')}`,
      `Area: ${value('service')}`, '', 'The opportunity', value('message'), ''
    ].join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    objectUrls.add(url);
    const download = document.createElement('a');
    download.href = url; download.download = 'amerged-project-brief.txt';
    document.body.appendChild(download); download.click(); download.remove();
    // Keep the object URL alive until cleanup; Safari may begin the download asynchronously.
    if (status) status.textContent = 'Your project brief is ready to save on your device. Nothing has been sent to amerged.';
  });
  cleanups.push(() => objectUrls.forEach(url => URL.revokeObjectURL(url)));


  // Header lockup (SMIL): "agents" becomes the drawn a, "merged." slides in.
  // Replays on hover/focus once the 4.6s intro has finished.
  const logo = document.getElementById('amerged-brand');
  const logoMark = document.getElementById('amg-brand-drawn-a');
  const brandLink = document.querySelector('.brand-lockup');
  const logoAnimated = !!logo && typeof logo.setCurrentTime === 'function';
  // Snap the drawn a to the rendered baseline at any logo size (header and footer).
  const footerLogo = document.getElementById('amerged-footer-brand');
  const lockups = [[logo, logoMark], [footerLogo, document.getElementById('amg-foot-drawn-a')]];
  function alignLogoMark() {
    lockups.forEach(([svg, mark]) => {
      const matrix = svg?.getScreenCTM();
      if (!matrix || !mark) return;
      const scale = Math.hypot(matrix.c, matrix.d);
      if (!(scale > 0)) return;
      const y = 17.2 - 2 / scale;
      mark.setAttribute('transform',
        `translate(-18.7635 ${y.toFixed(6)}) scale(.104) translate(352.122971 263.440361) rotate(5) scale(.95) scale(1.05 1) translate(-352.122971 -263.440361)`);
    });
  }
  alignLogoMark();
  if (logo && typeof ResizeObserver === 'function') {
    const logoObserver = new ResizeObserver(alignLogoMark);
    logoObserver.observe(logo);
    if (footerLogo) logoObserver.observe(footerLogo);
    cleanups.push(() => logoObserver.disconnect());
  } else {
    listen(window, 'resize', alignLogoMark, { passive: true });
  }
  let lastLogoRun = -10000;
  function replayLogo() {
    if (!logoAnimated || reduced.matches || performance.now() - lastLogoRun < 4700) return;
    lastLogoRun = performance.now();
    logo.setCurrentTime(0);
    logo.unpauseAnimations();
  }
  if (logoAnimated) {
    if (reduced.matches) { logo.setCurrentTime(4.6); logo.pauseAnimations(); }
    else lastLogoRun = performance.now();
  }
  listen(brandLink, 'pointerenter', event => { if (event.pointerType !== 'touch') replayLogo(); });
  listen(brandLink, 'focus', replayLogo);
  listen(reduced, 'change', () => {
    if (reduced.matches && logoAnimated) { logo.setCurrentTime(4.6); logo.pauseAnimations(); }
  });

  // Hero story (SMIL): the caption, its progress bar and the labels follow
  // the SVG clock. The loop plays continuously; reduced motion keeps it still.
  const story = document.getElementById('amerged-story-a');
  const storyCaption = document.getElementById('story-caption');
  const storyCaptionIndex = document.getElementById('story-caption-index');
  const storyCaptionPhase = document.getElementById('story-caption-phase');
  const storyProgress = document.getElementById('story-progress');
  if (story) {
    const storyLabels = [...story.querySelectorAll('.amg-part')];
    const narrow = window.matchMedia('(max-width: 600px)');
    const duration = 20;
    const phases = [
      { start: 0, end: 4.6, parts: ['context'], name: 'Your context', copy: 'We start with the way you work.' },
      { start: 4.6, end: 13.2, parts: ['build', 'train'], name: 'Build / train', copy: 'We build solutions. We teach your team how.' },
      { start: 13.2, end: 16.4, parts: ['run'], name: 'Run it', copy: 'Put the software and the skills to work.' },
      { start: 16.4, end: 20, parts: ['feedback'], name: 'Learn / iterate', copy: 'What we learn becomes your next context.' }
    ];
    const supported = typeof story.pauseAnimations === 'function';
    let selected = -1;
    const resize = () => story.setAttribute('viewBox', narrow.matches ? '65 60 750 580' : '0 0 860 650');
    const time = () => supported ? story.getCurrentTime() % duration : 0;
    function paint() {
      const t = time();
      const found = phases.findIndex(p => t >= p.start && t < p.end);
      const index = found < 0 ? 0 : found;
      const phase = phases[index];
      if (selected !== index) {
        selected = index;
        if (storyCaption) storyCaption.textContent = phase.copy;
        if (storyCaptionIndex) storyCaptionIndex.textContent = String(index + 1).padStart(2, '0');
        if (storyCaptionPhase) storyCaptionPhase.textContent = phase.name;
        storyLabels.forEach(label => label.classList.toggle('is-active', phase.parts.includes(label.dataset.phase)));
        // Make each change of phase visible: the caption rises in.
        const captionLine = storyCaption?.closest('.story-caption');
        if (!reduced.matches && captionLine?.animate) {
          captionLine.animate(
            [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
            { duration: 520, easing: 'cubic-bezier(.2,.7,.2,1)' });
        }
      }
      storyProgress?.style.setProperty('--progress', String(Math.min(1, Math.max(0, (t - phase.start) / (phase.end - phase.start)))));
    }
    function syncMotion() {
      if (!supported) return;
      if (reduced.matches || document.hidden) story.pauseAnimations();
      else story.unpauseAnimations();
      paint();
    }
    listen(document, 'visibilitychange', syncMotion);
    listen(reduced, 'change', syncMotion);
    listen(narrow, 'change', resize);
    resize();
    if (supported) story.setCurrentTime(.05);
    syncMotion();
    const storyTimer = window.setInterval(() => { if (!document.hidden) paint(); }, 60);
    cleanups.push(() => window.clearInterval(storyTimer));
  }
  return () => cleanups.forEach(cleanup => cleanup());
}
