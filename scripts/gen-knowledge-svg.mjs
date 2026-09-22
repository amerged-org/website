import fs from 'node:fs';
// Deterministic pseudo-random so the figure is stable between builds.
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const f = n => +n.toFixed(2);
const N = 18, NECK_Y = 170, DUR = 16;
const tracks = [96, 170, 244];
const perTrack = [0, 0, 0];
const strands = [];
// Shuffled orders make the strands cross: at the weave point, inside the
// neck and again in each output braid. Nothing runs in tidy parallel.
const order = n => { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const weave = order(N), neckIn = order(N), neckOut = order(N);
for (let i = 0; i < N; i++) {
  const y0 = 18 + (i / (N - 1)) * 304 + (rnd() - .5) * 12;
  const x0 = 8 + rnd() * 70;
  const ym = 78 + ((i * .72 + weave[i] * .28) / (N - 1)) * 184 + (rnd() - .5) * 8;
  const oa = (neckIn[i] - (N - 1) / 2) * 1.05;
  const ob = (neckOut[i] - (N - 1) / 2) * 1.05;
  const t = Math.floor(rnd() * 3);
  strands.push({ x0, y0, ym, oa, ob, t, k: perTrack[t]++, phase: rnd() });
}
strands.forEach(s => { const n = perTrack[s.t]; s.o2 = (s.k - (n - 1) / 2) * 1.5; });
// Segments as cubic control points, so lengths can be measured.
function segs(s) {
  const na = NECK_Y + s.oa, nb = NECK_Y + s.ob, ty = tracks[s.t];
  const w1 = ty - s.o2 * 1.1, w2 = ty + s.o2 * .8 * (s.phase > .5 ? 1 : -1);
  return [
    [[s.x0, s.y0], [s.x0 + 130, s.y0], [200, s.ym], [265, s.ym]],
    [[265, s.ym], [320, s.ym], [400, na], [470, na]],
    [[470, na], [495, na], [505, nb], [530, nb]],
    [[530, nb], [640, nb], [650, ty + s.o2], [760, ty + s.o2]],
    [[760, ty + s.o2], [800, ty + s.o2], [830, w1], [870, w1]],
    [[870, w1], [910, w1], [940, w2], [985, w2]],
  ];
}
const d = s => { const g = segs(s); return `M ${f(g[0][0][0])} ${f(g[0][0][1])} ` + g.map(c => `C ${c.slice(1).map(p => `${f(p[0])} ${f(p[1])}`).join(' ')}`).join(' '); };
const bez = (c, t) => [0, 1].map(j => (1 - t) ** 3 * c[0][j] + 3 * (1 - t) ** 2 * t * c[1][j] + 3 * (1 - t) * t * t * c[2][j] + t ** 3 * c[3][j]);
// Fraction of total length reached when the path first crosses each x.
function fractions(s, xs) {
  const pts = []; segs(s).forEach(c => { for (let i = 0; i <= 200; i++) pts.push(bez(c, i / 200)); });
  let L = 0; const acc = [0];
  for (let i = 1; i < pts.length; i++) { L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); acc.push(L); }
  return xs.map(x => acc[pts.findIndex(p => p[0] >= x)] / L);
}
const out = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" id="amerged-knowledge" viewBox="0 0 1000 352" role="img" aria-labelledby="kn-title kn-desc" fill="none">`);
out.push(`<title id="kn-title">From your knowledge to action</title><desc id="kn-desc">Many sources, such as files, chats, tickets and documents, flow into a funnel. They are distilled where agents merge into your business, which feeds software, agents and workflows. Results flow back as new context.</desc>`);
out.push(`<defs><linearGradient id="kn-flow" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1000" y2="0"><stop offset="0" stop-color="#b9b9b4"/><stop offset=".24" stop-color="#6f6f6b"/><stop offset=".4" stop-color="#171717"/><stop offset=".47" stop-color="#b12c2b"/><stop offset=".56" stop-color="#b12c2b"/><stop offset=".66" stop-color="#171717"/><stop offset=".9" stop-color="#171717"/><stop offset="1" stop-color="#b12c2b"/></linearGradient></defs>`);
// Funnel walls and the return path.
out.push(`<g class="kn-frame" aria-hidden="true"><path d="M 0 4 C 230 4 330 150 470 158"/><path d="M 0 334 C 230 334 330 190 470 182"/></g>`);
out.push(`<path class="kn-return" aria-hidden="true" id="kn-return" d="M 988 262 C 1000 305 965 344 905 344 L 120 344 C 70 344 40 336 20 326"/>`);
out.push(`<g class="kn-strands" aria-hidden="true">` + strands.map(s => `<path d="${d(s)}"/>`).join('') + `</g>`);
out.push(`<g class="kn-sources" aria-hidden="true">` + strands.map(s => `<circle cx="${f(s.x0)}" cy="${f(s.y0)}" r="1.7"/>`).join('') + `</g>`);
out.push(`<g class="kn-outputs" aria-hidden="true">` + tracks.map(y => `<circle cx="988" cy="${y}" r="3"/>`).join('') + `</g>`);
// Moving signals: every strand carries one dot with a short trail; the
// wave crosses each quarter of the figure in step with the four layers.
const kt = '0;.25;.5;.75;1';
const motion = strands.map((s, i) => {
  const [a, b, c] = fractions(s, [250, 500, 750]);
  const kp = [0, a, b, c, 1];
  const off = kp.map(p => f(5 - p * 100)).join(';');
  const pd = d(s);
  return `<path id="kn-s${i}" d="${pd}" class="kn-trail" pathLength="100" stroke-dasharray="5 110"><animate attributeName="stroke-dashoffset" values="${off}" keyTimes="${kt}" dur="${DUR}s" repeatCount="indefinite" calcMode="linear"/></path>` +
    `<circle r="2" class="kn-dot"><animateMotion dur="${DUR}s" repeatCount="indefinite" calcMode="linear" keyPoints="${kp.map(f).join(';')}" keyTimes="${kt}"><mpath href="#kn-s${i}"/></animateMotion></circle>`;
}).join('');
out.push(`<g class="kn-motion" aria-hidden="true">${motion}<circle r="2.4" class="kn-dot"><animateMotion dur="${DUR}s" repeatCount="indefinite" calcMode="linear" keyPoints="0;0;1;1" keyTimes="0;.76;.99;1"><mpath href="#kn-return"/></animateMotion><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;.76;.78;.97;1" dur="${DUR}s" repeatCount="indefinite"/></circle></g>`);
// The distillation point.
out.push(`<g class="kn-brain" aria-hidden="true"><circle class="kn-pulse" cx="500" cy="${NECK_Y}" r="11"><animate attributeName="r" values="9;18;9" dur="4s" repeatCount="indefinite"/><animate attributeName="opacity" values=".55;0;.55" dur="4s" repeatCount="indefinite"/></circle><circle class="kn-core" cx="500" cy="${NECK_Y}" r="3.4"/><text x="500" y="208" text-anchor="middle" class="kn-label">AGENTS MERGED INTO YOUR BUSINESS</text></g>`);
out.push(`</svg>`);
const svg = out.join('');
fs.writeFileSync('app/knowledge-svg.ts', `/** Context engineering figure: many sources, distilled through one company brain into action. Generated. */\nexport const knowledgeSvg = ${JSON.stringify(svg)};\n`);
console.log('bytes', svg.length);
