// Renders the social preview images (Open Graph / X / LinkedIn / Facebook /
// WhatsApp at 1200x630, Instagram square at 1080x1080) from the site's own
// SVGs with headless Chrome. Usage: node scripts/social/render.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const load = (f) => { const s = fs.readFileSync(f, 'utf8'); return JSON.parse(s.slice(s.indexOf('= ') + 2, s.lastIndexOf(';'))); };
const logo = load('app/footer-logo-svg.ts');
const story = load('app/story-svg.ts').replace('id="amerged-story-a"', 'id="amerged-story-a" data-motion="on"');
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const css = `
*{box-sizing:border-box;margin:0}
html,body{background:#fff}
.card{position:relative;overflow:hidden;background:#fff;color:#171717;font-family:Georgia,"Times New Roman",serif}
.rule{position:absolute;left:var(--pad);right:var(--pad);height:1px;background:#171717}
.logo{position:absolute;left:var(--pad);width:var(--logo)}
.logo svg{display:block;width:100%;height:auto;overflow:visible}
#amerged-footer-brand text{font-family:Georgia,"Times New Roman",serif;fill:#171717}
h1{position:absolute;left:var(--pad);font-weight:400;letter-spacing:-.035em;line-height:1.02}
h1 em{font-style:italic}
h1 .dot{color:#b12c2b}
.kicker{position:absolute;left:var(--pad);font:14px/1.5 "SFMono-Regular",Menlo,Consolas,monospace;letter-spacing:.12em;color:#171717;display:flex;align-items:center;gap:12px}
.kicker i{display:inline-block;width:7px;height:7px;background:#b12c2b}
.url{position:absolute;font:14px/1.5 "SFMono-Regular",Menlo,Consolas,monospace;letter-spacing:.08em;color:#6b6b6b}
.mark{position:absolute}
.mark svg{display:block;width:100%;height:auto;overflow:visible}
#amerged-story-a .amg-part text,#amerged-story-a .amg-leader,#amerged-story-a g[aria-label] text{display:none}
#amerged-story-a .amg-node{fill:#b12c2b;stroke:#b12c2b}
#amerged-story-a .amg-moving-dot{fill:#b12c2b}
`;
const freeze = `<script>const s=document.getElementById('amerged-story-a');s.pauseAnimations();s.setCurrentTime(6.2);
const f=document.getElementById('amerged-footer-brand'),m=document.getElementById('amg-foot-drawn-a');const c=f.getScreenCTM();const k=Math.hypot(c.c,c.d);
m.setAttribute('transform','translate(-18.7635 '+(17.2-2/k).toFixed(6)+') scale(.104) translate(352.122971 263.440361) rotate(5) scale(.95) scale(1.05 1) translate(-352.122971 -263.440361)');</script>`;
const layouts = {
  'og': { w: 1200, h: 630, html: `<div class="card" style="width:1200px;height:630px;--pad:72px;--logo:250px">
    <div class="logo" style="top:60px">${logo}</div>
    <div class="kicker" style="top:212px"><i></i>WE’RE PUTTING INTELLIGENCE TO WORK.</div>
    <h1 style="top:250px;font-size:74px;width:640px">Agents merged<br>into <em>your</em><br>business<span class="dot">.</span></h1>
    <div class="rule" style="bottom:66px"></div>
    <div class="url" style="left:72px;bottom:28px">AMERGED.COM</div>
    <div class="url" style="right:72px;bottom:28px">AMERGED B.V. / VENRAY, NL</div>
    <div class="mark" style="left:600px;top:-6px;width:700px">${story}</div></div>` },
  'square': { w: 1080, h: 1080, html: `<div class="card" style="width:1080px;height:1080px;--pad:80px;--logo:270px">
    <div class="logo" style="top:74px">${logo}</div>
    <div class="mark" style="left:150px;top:150px;width:860px">${story}</div>
    <div class="kicker" style="top:790px"><i></i>WE’RE PUTTING INTELLIGENCE TO WORK.</div>
    <h1 style="top:830px;font-size:74px">Agents merged into <em>your</em> business<span class="dot">.</span></h1>
    <div class="url" style="right:80px;top:96px">AMERGED.COM</div></div>` },
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'amerged-social-'));
for (const [name, l] of Object.entries(layouts)) {
  const file = path.join(tmp, name + '.html');
  fs.writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${l.html}${freeze}</body></html>`);
  const out = path.join(tmp, name + '.png');
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--window-size=${l.w},${l.h}`, '--virtual-time-budget=2000', `--screenshot=${out}`, 'file://' + file], { stdio: 'ignore' });
  if (name === 'og') { fs.copyFileSync(out, 'app/opengraph-image.png'); fs.copyFileSync(out, 'app/twitter-image.png'); }
  else fs.copyFileSync(out, 'public/amerged-social-square.png');
  console.log(name, '->', out);
}
