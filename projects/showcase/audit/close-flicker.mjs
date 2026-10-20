#!/usr/bin/env node
/*
 * Close-flicker check: opens each backdrop + panel dialog on the Overlays page, closes it, and
 * samples the backdrop's opacity every animation frame until it is gone. Fails if the opacity ever
 * rises during a close (the 0.32 drawer flashed its full overlay back for a frame or two).
 *
 *   node projects/showcase/audit/close-flicker.mjs --url http://localhost:4310
 *
 * Browser: playwright-core's Chromium, or CHROME_PATH.
 */
import { chromium } from 'playwright-core';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const base = arg('url', 'http://localhost:4310').replace(/\/$/, '');

const cases = [
  { name: 'ui-drawer', open: 'Open drawer', backdrop: '.ui-layer > .backdrop' },
  { name: 'ui-modal', open: 'Open modal', backdrop: '.ui-layer > .backdrop' },
  { name: 'ui-bottom-sheet (backdrop)', open: 'Open with backdrop', backdrop: 'ui-bottom-sheet .backdrop' },
  { name: 'ui-command-palette', open: 'Open command palette', backdrop: '.ui-layer > .cp-backdrop', closers: ['backdrop click', 'escape'] },
];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
let failed = 0;
const closers = {
  // A real click on the backdrop's left edge, Escape, and the panel's own close button.
  'backdrop click': async () => page.mouse.click(8, 450),
  escape: async () => page.keyboard.press('Escape'),
  'close button': async () => page.locator('.ui-layer [aria-label="Close"]:visible, ui-bottom-sheet [aria-label="Close"]:visible').first().click(),
};
for (const c of cases) {
  for (const [how, close] of Object.entries(closers).filter(([k]) => !c.closers || c.closers.includes(k))) {
    await page.goto(`${base}/overlays`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: c.open, exact: true }).first().click();
    await page.waitForSelector(c.backdrop);
    await page.waitForTimeout(600); // let the enter animations finish
    // Sample every frame from now on, in the page, while the close happens from outside.
    await page.evaluate((sel) => {
      const w = window;
      w.__samples = [];
      const start = performance.now();
      const tick = () => {
        const b = document.querySelector(sel);
        w.__samples.push({ t: Math.round(performance.now() - start), o: b ? Number(getComputedStyle(b).opacity) : null });
        if (b && performance.now() - start < 1500) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, c.backdrop);
    await close();
    await page.waitForTimeout(900);
    const samples = await page.evaluate(() => window.__samples);
    const seen = samples.filter((s) => s.o !== null);
    let rise = null;
    for (let i = 1; i < seen.length; i++) if (seen[i].o > seen[i - 1].o + 0.01) rise ??= [seen[i - 1], seen[i]];
    const gone = samples.at(-1)?.o === null;
    const ok = !rise && gone;
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${c.name} (${how}): ${seen.length} frames, ${rise ? `opacity rose ${rise[0].o.toFixed(3)} -> ${rise[1].o.toFixed(3)} at ${rise[1].t} ms` : 'never rose'}${gone ? `, removed by ${samples.at(-1).t} ms` : ', NOT removed'}`);
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
