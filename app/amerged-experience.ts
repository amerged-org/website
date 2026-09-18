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

  // An explorable systems diagram with fully visible static labels.
  const layers = [
    ['01 / EXTRACT', 'Capture the documents, decisions and exceptions behind a process.'],
    ['02 / STRUCTURE', 'Turn that knowledge into context: relevant facts, decision rules, permissions and tool access.'],
    ['03 / EXECUTE', 'Connect agents to your systems, with clear tasks, approvals and exception handling.'],
    ['04 / EVALUATE', 'Measure quality, reliability and manual effort. Use the results to improve the system.']
  ];
  document.querySelectorAll('[data-layer]').forEach(button => listen(button, 'click', () => {
    const index = Number(button.getAttribute('data-layer'));
    if (!layers[index]) return;
    document.querySelectorAll('[data-layer]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    const label = document.getElementById('layer-label');
    const description = document.getElementById('layer-description');
    if (label) label.textContent = layers[index][0];
    if (description) description.textContent = layers[index][1];
  }));

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


  // Logo-only revision: show "agents    merged." before merging the words.
  // Both suffixes share a baseline and have no background or masking layer.
  // "merged" slides over stationary "gents" while "gents" fades from the first movement frame.
  // The two words keep their generous starting gap and a common baseline.
  const logo = document.getElementById('brand-wordmark');
  const brandLink = document.querySelector('.brand-lockup');
  let logoAnimations = [];
  let logoPlaying = false;
  let logoDisposed = false;
  let logoRun = 0;
  let logoCooldown = 0;
  function finishLogo() {
    logoRun++;
    logoAnimations.forEach(animation => animation.cancel());
    logoAnimations = [];
    logoPlaying = false;
    if (logo) logo.dataset.state = 'amerged';
  }
  function playLogo() {
    if (!logo || !logo.animate || reduced.matches || logoPlaying || logoDisposed) return;
    const merged = logo.querySelector('.logo-merged');
    const gents = logo.querySelector('.logo-gents');
    const dot = logo.querySelector('.logo-dot');
    if (!merged || !gents || !dot) return;
    finishLogo();
    const run = logoRun;
    // Both suffixes have their resting origin immediately after the fixed "a".
    // Separate the complete words with a generous .70em initial gap.
    const wordSpace = parseFloat(getComputedStyle(logo).fontSize) * .70;
    const startX = gents.getBoundingClientRect().width + wordSpace;
    const fromRight = `translateX(${startX}px)`;
    // A readable beginning, then simultaneous transparent sliding and fading.
    const duration = 3200;
    const slideStart = 850 / duration;
    const slideEnd = 2550 / duration;
    const fadeStart = slideStart;
    const fadeEnd = slideEnd;
    const options = { duration, fill: 'both', easing: 'linear' };
    const slide = 'cubic-bezier(.45,0,.2,1)';
    logoPlaying = true;
    logo.dataset.state = 'merging';
    logoAnimations = [
      // No movement or masking of "gents". Its fade begins exactly with the slide,
      // staying partly visible during the overlap and reaching zero at arrival.
      gents.animate([
        { opacity: 1, transform: 'translateX(0)', offset: 0 },
        { opacity: 1, transform: 'translateX(0)', offset: fadeStart, easing: 'cubic-bezier(.3,0,.8,1)' },
        { opacity: 0, transform: 'translateX(0)', offset: fadeEnd },
        { opacity: 0, transform: 'translateX(0)', offset: 1 }
      ], options),
      // Transparent glyphs overlap on the same baseline; no paper rectangle.
      merged.animate([
        { transform: fromRight, offset: 0 },
        { transform: fromRight, offset: slideStart, easing: slide },
        { transform: 'translateX(0)', offset: slideEnd },
        { transform: 'translateX(0)', offset: 1 }
      ], options),
      // Keep the red point attached to "merged" throughout the motion.
      dot.animate([
        { transform: fromRight, offset: 0 },
        { transform: fromRight, offset: slideStart, easing: slide },
        { transform: 'translateX(0)', offset: slideEnd },
        { transform: 'translateX(0)', offset: 1 }
      ], options)
    ];
    // On a narrow desktop header, fit the two-word starting state into the
    // existing gap. This affects only the animated logo, never header layout.
    const logoBounds = logo.getBoundingClientRect();
    const nextControl = [...document.querySelectorAll('.header .nav, .header .menu-button')]
      .find(element => getComputedStyle(element).display !== 'none');
    if (nextControl) {
      const available = nextControl.getBoundingClientRect().left - logoBounds.left - 12;
      const initialWidth = logoBounds.width + startX;
      const startScale = Math.min(1, Math.max(.5, available / initialWidth));
      if (startScale < 1) {
        logoAnimations.push(logo.animate([
          { transform: `scale(${startScale})`, transformOrigin: '0% 50%', offset: 0 },
          { transform: `scale(${startScale})`, transformOrigin: '0% 50%', offset: slideStart, easing: slide },
          { transform: 'scale(1)', transformOrigin: '0% 50%', offset: slideEnd },
          { transform: 'scale(1)', transformOrigin: '0% 50%', offset: 1 }
        ], options));
      }
    }
    Promise.all(logoAnimations.map(animation => animation.finished)).then(() => {
      if (run !== logoRun || logoDisposed) return;
      finishLogo();
      logoCooldown = performance.now() + 1400;
    }).catch(() => { /* cancelled by reduced-motion, navigation or cleanup */ });
  }
  // Native paper typography is also the offline fallback. No font download is
  // required for this animation to run, and the final wordmark is the no-JS view.
  playLogo();
  listen(brandLink, 'pointerenter', event => {
    if (event.pointerType !== 'touch' && performance.now() > logoCooldown) playLogo();
  });
  listen(brandLink, 'click', () => { if (performance.now() > logoCooldown) playLogo(); });
  listen(reduced, 'change', () => { if (reduced.matches) finishLogo(); });
  listen(window, 'resize', finishLogo, { passive: true });
  if (document.fonts) listen(document.fonts, 'loadingdone', event => {
    if (!logoDisposed && event.fontfaces.some(face => face.status === 'loaded')) {
      const replay = logoPlaying; finishLogo(); if (replay) playLogo();
    }
  });
  listen(document, 'visibilitychange', () => {
    logoAnimations.forEach(animation => {
      if (document.hidden && animation.playState === 'running') animation.pause();
      else if (!document.hidden && animation.playState === 'paused') animation.play();
    });
  });
  cleanups.push(() => { logoDisposed = true; finishLogo(); });

  // SVG feedback loop: the selected station and the moving signal always agree.
  // The return section connects feedback directly back to context.
  const stage = document.getElementById('figure-stage');
  const loop = document.getElementById('agent-loop');
  const route = document.getElementById('loop-route');
  const scene = document.getElementById('loop-scene');
  const signal = document.getElementById('loop-signal');
  const trail = document.getElementById('loop-trail');
  const pauseButton = document.getElementById('motion-button');
  const zones = [0, 1, 2].map(index => document.getElementById(`loop-zone-${index}`));
  const phaseNotes = [
    'Your data and decisions, structured for agents.',
    'Agents use that context to work in your systems.',
    'Outcomes refine the context for the next step.'
  ];
  const phaseNames = ['Context', 'Action', 'Feedback'];
  let frame = 0;
  let active = true;
  let visible = true;
  let paused = reduced.matches;
  let lastTime = 0;
  let elapsed = 0;
  let travelled = 0;
  let phase = -1;
  let mouseX = 0, mouseY = 0, targetX = 0, targetY = 0;
  const validSvg = route && typeof route.getTotalLength === 'function' && zones.every(Boolean);
  const routeLength = validSvg ? route.getTotalLength() : 1;
  const lengths = validSvg ? zones.map(path => path.getTotalLength()) : [1, 1, 1];
  const offsets = [0, lengths[0], lengths[0] + lengths[1]];
  const inputPaths = [0, 1, 2].map(index => document.getElementById(`loop-input-${index}`));
  const inputSignals = [0, 1, 2].map(index => document.getElementById(`input-signal-${index}`));
  const inputLengths = inputPaths.map(path => path?.getTotalLength() || 0);

  function updatePhase(nextPhase, announce = false) {
    if (nextPhase === phase && !announce) return;
    phase = nextPhase;
    loop?.setAttribute('data-phase', String(phase));
    document.querySelectorAll('[data-phase].figure-step').forEach(button => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.phase) === phase));
    });
    document.querySelectorAll('[data-term]').forEach(term => {
      term.classList.toggle('active-term', Number(term.dataset.term) === phase);
    });
    document.querySelectorAll('[data-station]').forEach(station => {
      station.classList.toggle('is-active', Number(station.dataset.station) === phase);
    });
    document.querySelectorAll('[data-loop-label]').forEach(label => {
      label.classList.toggle('is-active', Number(label.dataset.loopLabel) === phase);
    });
    zones.forEach((zone, index) => zone?.classList.toggle('is-active', index === phase));
    const note = document.getElementById('figure-note');
    if (note) note.textContent = phaseNotes[phase];
    // Auto-animation never repeatedly interrupts a screen reader.
    const announcement = document.getElementById('loop-announcement');
    if (announce && announcement) announcement.textContent = `${phaseNames[phase]}. ${phaseNotes[phase]}`;
  }
  function updatePauseUI() {
    if (!pauseButton) return;
    pauseButton.textContent = paused ? 'Play' : 'Pause';
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.setAttribute('aria-label', paused ? 'Play animation' : 'Pause animation');
  }
  function renderLoop() {
    if (!validSvg || !signal || !trail) return;
    const distance = ((travelled % routeLength) + routeLength) % routeLength;
    const point = route.getPointAtLength(distance);
    signal.setAttribute('cx', point.x.toFixed(2));
    signal.setAttribute('cy', point.y.toFixed(2));
    // The trace is transparent and wraps continuously at the context station.
    const traceLength = routeLength * .075;
    trail.setAttribute('stroke-dasharray', `${traceLength.toFixed(2)} ${(routeLength-traceLength).toFixed(2)}`);
    trail.setAttribute('stroke-dashoffset', (traceLength-distance).toFixed(2));
    updatePhase(distance < offsets[1] ? 0 : distance < offsets[2] ? 1 : 2);
    if (scene) {
      const breathing = reduced.matches ? 1 : 1 + Math.sin(elapsed * .48) * .003;
      scene.style.transform = `translate(${(mouseX * 3).toFixed(2)}px,${(mouseY * 3).toFixed(2)}px) scale(${breathing.toFixed(5)})`;
    }
    inputPaths.forEach((path, index) => {
      if (!path || !inputSignals[index]) return;
      const progress = (elapsed / 4.4 + index / 3) % 1;
      const p = path.getPointAtLength(progress * inputLengths[index]);
      inputSignals[index].setAttribute('cx', p.x.toFixed(2));
      inputSignals[index].setAttribute('cy', p.y.toFixed(2));
      inputSignals[index].style.opacity = String((phase === 0 ? .75 : .28) * Math.sin(progress * Math.PI));
    });
  }
  function tick(timestamp) {
    frame = 0;
    if (!active || paused || !visible || document.hidden) return;
    if (!lastTime) lastTime = timestamp;
    const delta = Math.min((timestamp - lastTime) / 1000, .05);
    lastTime = timestamp;
    elapsed += delta;
    travelled = (travelled + delta * routeLength / 18) % routeLength;
    mouseX += (targetX - mouseX) * .055;
    mouseY += (targetY - mouseY) * .055;
    renderLoop();
    frame = requestAnimationFrame(tick);
  }
  function syncAnimation() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    if (active && !paused && visible && !document.hidden && validSvg) frame = requestAnimationFrame(tick);
  }
  listen(pauseButton, 'click', () => {
    paused = !paused;
    updatePauseUI();
    syncAnimation();
  });
  listen(reduced, 'change', event => {
    paused = event.matches;
    if (paused) { mouseX = mouseY = targetX = targetY = 0; renderLoop(); }
    updatePauseUI();
    syncAnimation();
  });
  listen(document, 'visibilitychange', syncAnimation);
  listen(stage, 'pointermove', event => {
    if (reduced.matches || paused || event.pointerType === 'touch') return;
    const rect = stage.getBoundingClientRect();
    targetX = (event.clientX - rect.left) / rect.width - .5;
    targetY = (event.clientY - rect.top) / rect.height - .5;
  }, { passive: true });
  listen(stage, 'pointerleave', () => { targetX = targetY = 0; });
  document.querySelectorAll('.figure-step[data-phase]').forEach(button => listen(button, 'click', () => {
    const nextPhase = Number(button.dataset.phase);
    if (!Number.isInteger(nextPhase) || nextPhase < 0 || nextPhase > 2) return;
    travelled = offsets[nextPhase] + .1;
    renderLoop();
    updatePhase(nextPhase, true);
  }));
  if (validSvg && stage) {
    renderLoop();
    updatePauseUI();
    if ('IntersectionObserver' in window) {
      const visibilityObserver = new IntersectionObserver(entries => {
        visible = entries[0]?.isIntersecting ?? true;
        syncAnimation();
      }, { threshold: 0 });
      visibilityObserver.observe(stage);
      cleanups.push(() => visibilityObserver.disconnect());
    }
    syncAnimation();
  }
  cleanups.push(() => {
    active = false;
    if (frame) cancelAnimationFrame(frame);
  });
  return () => cleanups.forEach(cleanup => cleanup());
}
