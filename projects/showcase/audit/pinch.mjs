#!/usr/bin/env node
/*
 * Pinch check: on a phone-sized Chromium with real touch (CDP Input.dispatchTouchEvent), pinches the
 * Media page's ui-masonry-grid 20 times at different spots and in different ways, and fails if any
 * pinch left the column count unchanged or zoomed the page (visualViewport.scale != 1).
 *
 *   node projects/showcase/audit/pinch.mjs --url http://localhost:4310
 *
 * The ways: both fingers down together; the first finger moving (a scroll starting) before the second
 * lands; the second finger on a tile edge or on the gap between tiles; with the page scrolled.
 * A pinch outside the grid is also made, and must still zoom the page (page zoom is not disabled).
 *
 * Browser: playwright-core's Chromium, or CHROME_PATH.
 */
import { chromium } from 'playwright-core';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const base = arg('url', 'http://localhost:4310').replace(/\/$/, '');
const route = arg('route', '/media');
const selector = arg('grid', 'ui-masonry-grid');

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--disable-features=OverscrollHistoryNavigation'],
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
let page = await context.newPage();
let cdp = await context.newCDPSession(page);
/** A fresh tab: a zoomed page keeps its zoom across a reload. */
async function freshPage() {
  await page.close();
  page = await context.newPage();
  cdp = await context.newCDPSession(page);
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
}

const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

/** Columns now: distinct left offsets of the grid's cells. */
const columns = () => page.evaluate((sel) => {
  const grid = document.querySelector(sel);
  const lefts = new Set([...grid.querySelectorAll('.cell')].map((c) => Math.round(parseFloat(c.style.left))));
  return lefts.size;
}, selector);
const scale = () => page.evaluate(() => window.visualViewport?.scale ?? 1);
const gridBox = () => page.evaluate((sel) => {
  const r = document.querySelector(sel).getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}, selector);
/** A point on the gap between the first two columns, `dy` px into the visible part of the grid. */
const gapPoint = (dy) => page.evaluate(({ sel, dy }) => {
  const cells = [...document.querySelector(sel).querySelectorAll('.cell')];
  const first = cells.find((c) => parseFloat(c.style.left) === 0);
  const gx = first.getBoundingClientRect().right + 2;
  const top = Math.max(document.querySelector(sel).getBoundingClientRect().top, 0);
  return [gx, top + dy];
}, { sel: selector, dy });

/**
 * One pinch. `apart` spreads the fingers, else closes them. `lead` moves the first finger before the
 * second lands (a scroll already started). `b0` is where the second finger starts.
 */
async function pinch({ a0, b0, apart, lead = 0 }) {
  const steps = 12;
  await touch('touchStart', [a0]);
  let a = [...a0];
  for (let k = 1; k <= lead; k++) {
    a = [a0[0], a0[1] + k * 4];
    await touch('touchMove', [a]);
  }
  await touch('touchStart', [a, b0]);
  const mid = [(a[0] + b0[0]) / 2, (a[1] + b0[1]) / 2];
  const far = apart ? 1.9 : 0.45;
  for (let k = 1; k <= steps; k++) {
    const f = 1 + (far - 1) * (k / steps);
    const pa = [mid[0] + (a[0] - mid[0]) * f, mid[1] + (a[1] - mid[1]) * f];
    const pb = [mid[0] + (b0[0] - mid[0]) * f, mid[1] + (b0[1] - mid[1]) * f];
    await touch('touchMove', [pa, pb]);
  }
  await touch('touchEnd', []);
  await frame();
  await page.waitForTimeout(350);
}

await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
await page.locator(selector).first().scrollIntoViewIfNeeded();
await page.waitForTimeout(300);

const failures = [];
const cases = [];
for (let i = 0; i < 20; i++) {
  const kinds = ['together', 'lead', 'gap', 'edge', 'scrolled'];
  cases.push({ i, kind: kinds[i % kinds.length], apart: i % 2 === 0 });
}

/** Where the grid is on screen, and its column edges. */
const geometry = () => page.evaluate((sel) => {
  const grid = document.querySelector(sel);
  const r = grid.getBoundingClientRect();
  const cells = [...grid.querySelectorAll('.cell')].map((c) => c.getBoundingClientRect());
  const firstColRight = Math.max(...cells.filter((c) => Math.abs(c.left - r.left) < 1).map((c) => c.right));
  return { x: r.left, y: r.top, w: r.width, h: r.height, gapX: firstColRight + 2, cells: cells.filter((c) => c.top > 120 && c.bottom < 720).map((c) => [c.left, c.top, c.right, c.bottom]) };
}, selector);
const onGrid = (pts) => page.evaluate(({ sel, pts }) => pts.map(([x, y]) => !!document.elementFromPoint(x, y)?.closest(sel)), { sel: selector, pts });

for (const c of cases) {
  // Put the grid on screen: from its top for most cases, part way down it for "scrolled".
  await page.evaluate(({ sel, kind, i }) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    const into = kind === 'scrolled' ? Math.max(0, Math.min(r.height - 900, r.height * ((i % 3) + 1) / 4)) : 0;
    window.scrollTo({ top: window.scrollY + r.top - 60 + into, behavior: 'instant' });
  }, { sel: selector, kind: c.kind, i: c.i });
  await page.waitForTimeout(150);
  const g = await geometry();
  const before = await columns();
  const apart = before <= 1 ? false : before >= 5 ? true : c.apart;

  const vy0 = Math.max(g.y, 80);
  const vy1 = Math.min(g.y + g.h, 764);
  const vh = vy1 - vy0;
  const jitter = ((c.i * 37) % 21) / 100 - 0.1;
  const cx = g.x + g.w * (0.5 + jitter);
  const cy = vy0 + vh * (0.5 - jitter);
  let a0;
  let b0;
  if (apart) {
    a0 = [cx - g.w * 0.12, cy - vh * 0.1];
    b0 = [cx + g.w * 0.12, cy + vh * 0.1];
  } else {
    a0 = [g.x + g.w * 0.18, vy0 + vh * 0.12];
    b0 = [g.x + g.w * 0.82, vy0 + vh * 0.88];
  }
  if (c.kind === 'gap' && before > 1) b0 = [g.gapX, b0[1]];
  if (c.kind === 'edge' && g.cells.length) {
    const cell = g.cells[c.i % g.cells.length];
    b0 = [cell[2] - 1, (cell[1] + cell[3]) / 2];
    if (Math.hypot(b0[0] - a0[0], b0[1] - a0[1]) < 60) a0 = [g.x + g.w - b0[0] + g.x, Math.min(vy1 - 10, b0[1] + 150)];
  }
  const hits = await onGrid([a0, b0]);
  if (process.env.PINCH_DEBUG) console.log('   fingers', a0.map(Math.round), b0.map(Math.round), 'on grid', hits);
  if (!hits.every(Boolean)) {
    console.log(`${String(c.i + 1).padStart(2)} ${c.kind.padEnd(8)} HARNESS: a finger is not on the grid`, a0.map(Math.round), b0.map(Math.round));
    failures.push(`${c.i + 1} (harness)`);
    continue;
  }

  await pinch({ a0, b0, apart, lead: c.kind === 'lead' ? 5 : 0 });
  const after = await columns();
  const s = await scale();
  const ok = after !== before && Math.abs(s - 1) < 0.001;
  console.log(`${String(c.i + 1).padStart(2)} ${c.kind.padEnd(8)} ${apart ? 'apart   ' : 'together'} columns ${before} -> ${after}  scale ${s.toFixed(3)} ${ok ? 'ok' : 'FAIL'}`);
  if (!ok) failures.push(c.i + 1);
  if (Math.abs(s - 1) > 0.001) {
    // Undo a page zoom so later cases start clean.
    await freshPage();
  }
}

// Outside the grid, the page must still zoom: page zoom stays available.
await freshPage();
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.waitForTimeout(200);
await pinch({ a0: [150, 120], b0: [240, 200], apart: true });
const outside = await scale();
console.log(`outside the grid: scale ${outside.toFixed(3)} ${outside > 1.01 ? 'ok (page still zooms)' : 'FAIL (page zoom blocked)'}`);
if (!(outside > 1.01)) failures.push('outside');

await browser.close();
if (failures.length) {
  console.log(`FAILED: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('PASS: every pinch on the grid changed it, and the page never zoomed');
