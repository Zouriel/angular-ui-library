#!/usr/bin/env node
/*
 * Map marker placement check: on the Map page, every ui-map marker's dot and its hit area must be
 * centred on the marker's point (where Leaflet places the icon). Fails on any marker more than
 * 0.5px off. From 0.35.1 to 0.44.1 the markers were in normal flow, each drawn ~16px below the one
 * before (280 pins became a column on the Dhirumi web map), and every dot sat 4px low.
 *
 *   node projects/showcase/audit/map-markers.mjs --url http://localhost:4310
 *
 * Browser: playwright-core's Chromium, or CHROME_PATH.
 */
import { chromium } from 'playwright-core';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const base = arg('url', 'http://localhost:4310').replace(/\/$/, '');

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
let failed = 0;
let seen = 0;
for (const pointer of ['fine', 'coarse']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: pointer === 'coarse' });
  const page = await ctx.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${base}/map`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const rows = await page.$$eval('.ui-map', (maps) =>
    maps.flatMap((m, mi) => {
      const xy = (el) => {
        const t = el.style.transform.match(/translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/);
        return t ? [+t[1], +t[2]] : [0, 0];
      };
      const box = m.querySelector('.leaflet-container')?.getBoundingClientRect();
      const pane = m.querySelector('.leaflet-map-pane');
      if (!box || !pane) return [];
      const [px, py] = xy(pane);
      return [...m.querySelectorAll('.leaflet-marker-pane .ui-map-marker')].map((el, i) => {
        const [x, y] = xy(el);
        const point = [box.left + px + x, box.top + py + y];
        const d = el.querySelector('.ui-map-dot').getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const b = getComputedStyle(el, '::before');
        const hit = [r.left + parseFloat(b.left) + parseFloat(b.width) / 2, r.top + parseFloat(b.top) + parseFloat(b.height) / 2];
        const off = (a) => Math.round(Math.hypot(a[0] - point[0], a[1] - point[1]) * 10) / 10;
        return { where: `map ${mi + 1} marker ${i + 1}${el.hasAttribute('data-selected') ? ' (selected)' : ''}`, dot: off([d.left + d.width / 2, d.top + d.height / 2]), hit: off(hit) };
      });
    }),
  );
  seen += rows.length;
  for (const r of rows) {
    if (r.dot > 0.5 || r.hit > 0.5) {
      failed++;
      console.log(`FAIL ${pointer}: ${r.where}: dot ${r.dot}px, hit area ${r.hit}px from its point`);
    }
  }
  console.log(`${pointer}: ${rows.length} markers checked`);
  await ctx.close();
}
await browser.close();
if (seen < 4) {
  console.log(`FAIL: only ${seen} markers found; the check saw nothing to measure`);
  process.exit(1);
}
console.log(failed ? `${failed} misplaced` : 'every marker centred on its point');
process.exit(failed ? 1 : 0);
