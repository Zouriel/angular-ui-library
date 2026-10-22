#!/usr/bin/env node
/*
 * Chat bubble wrap check, in a real browser. Before 0.42.2 a ui-chat-bubble put in a column with
 * align-items: flex-start/flex-end shrank to its content, its 80% max-width then resolved against
 * that shrunk host and overflow-wrap: anywhere let the text break inside a word ("ok/ay").
 *
 * Takes the showcase's own bubbles (the Data page), clones them (so the component's real styles
 * apply) into parents of every common shape at 390px: flex columns with align-items flex-start,
 * flex-end, center and stretch, a flex row, and a grid with justify-items: start; LTR and RTL; yours
 * and theirs. Checks that a short word stays on one line, that the bubble sits at its own side of the
 * row (inline end for yours, inline start for theirs) whatever the parent's alignment, and that a
 * 200-character URL wraps inside 80% of the row without overflowing.
 *
 *   npm run audit:chat-wrap -- --url http://localhost:4310
 *   npm run audit:chat-wrap -- --dist <showcase build output>   (serves the build itself)
 *
 * Browser: playwright-core's Chromium, or CHROME_PATH.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};

let server;
let base = arg('url', 'http://localhost:4310').replace(/\/$/, '');
const dist = arg('dist', '');
if (dist) {
  const root = existsSync(join(dist, 'browser')) ? join(dist, 'browser') : dist;
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon', '.mjs': 'text/javascript' };
  server = createServer((req, res) => {
    const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(root, p);
    // Single-page app: any route without a file is the index.
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
}

/** Runs in the page: builds every case from the showcase's bubbles and measures it. */
function measure() {
  const src = {
    theirs: [...document.querySelectorAll('ui-chat-bubble')].find((b) => !b.classList.contains('mine')),
    mine: document.querySelector('ui-chat-bubble.mine'),
  };
  const ROW = 358; // a 390px phone with 16px gutters
  const parents = {
    'column flex-start': 'display:flex;flex-direction:column;align-items:flex-start',
    'column flex-end': 'display:flex;flex-direction:column;align-items:flex-end',
    'column center': 'display:flex;flex-direction:column;align-items:center',
    'column stretch': 'display:flex;flex-direction:column;align-items:stretch',
    'row': 'display:flex;flex-direction:row',
    'grid justify-items start': 'display:grid;justify-items:start',
  };
  const url = 'https://example.com/' + 'a1b2c3d4e5'.repeat(18); // 200 characters, no break opportunity
  const stage = document.createElement('div');
  stage.style.cssText = 'position:absolute;inset-inline-start:0;top:0;width:390px;padding:0 16px;box-sizing:border-box;z-index:99999;background:var(--ui-color-surface)';
  document.body.appendChild(stage);
  const lines = (el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    return new Set([...r.getClientRects()].filter((q) => q.width > 0).map((q) => Math.round(q.top))).size;
  };
  const out = [];
  for (const [pname, css] of Object.entries(parents)) {
    for (const dir of ['ltr', 'rtl']) {
      for (const who of ['theirs', 'mine']) {
        for (const [kind, text] of [['short', 'okay'], ['url', url]]) {
          const parent = document.createElement('div');
          parent.dir = dir;
          parent.style.cssText = `${css};width:${ROW}px;box-sizing:border-box`;
          const b = src[who].cloneNode(true);
          b.querySelector('.meta')?.remove();
          b.querySelector('.text').textContent = text;
          parent.appendChild(b);
          stage.appendChild(parent);
          const bubble = b.querySelector('.bubble');
          const pr = parent.getBoundingClientRect(), br = bubble.getBoundingClientRect();
          const t = b.querySelector('.text');
          const failures = [];
          const n = lines(t);
          if (kind === 'short' && n !== 1) failures.push(`"okay" on ${n} lines (bubble ${Math.round(br.width)}px)`);
          if (kind === 'url') {
            if (br.width > ROW * 0.8 + 0.5) failures.push(`bubble ${Math.round(br.width)}px, wider than 80% of the row (${ROW * 0.8}px)`);
            if (t.scrollWidth > t.clientWidth + 1) failures.push(`text overflows its bubble (${t.scrollWidth} > ${t.clientWidth})`);
            if (br.right > pr.right + 0.5 || br.left < pr.left - 0.5) failures.push('bubble runs outside the row');
            if (n < 2) failures.push('URL did not wrap');
          }
          // Yours at the inline end of the row, theirs at the inline start, whatever the parent says.
          const end = (who === 'mine') === (dir === 'ltr');
          const gap = end ? pr.right - br.right : br.left - pr.left;
          if (Math.abs(gap) > 0.5) failures.push(`not at the ${end ? 'right' : 'left'} edge of the row (${Math.round(gap)}px off)`);
          out.push({ name: `${pname} · ${dir} · ${who} · ${kind}`, lines: n, width: Math.round(br.width), failures });
        }
      }
    }
  }
  stage.remove();
  return out;
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(`${base}/data`, { waitUntil: 'networkidle' });
await page.waitForSelector('ui-chat-bubble.mine');
await page.evaluate(() => document.fonts.ready);
const results = await page.evaluate(measure);
let failed = 0;
for (const r of results) {
  if (r.failures.length) failed++;
  console.log(`${r.failures.length ? 'FAIL' : 'ok  '} ${r.name}: ${r.lines} line(s), ${r.width}px${r.failures.length ? ' - ' + r.failures.join('; ') : ''}`);
}
console.log(`${results.length - failed}/${results.length} cases passed`);
await browser.close();
server?.close();
process.exit(failed || !results.length ? 1 : 0);
