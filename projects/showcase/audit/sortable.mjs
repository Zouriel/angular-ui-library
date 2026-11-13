#!/usr/bin/env node
/*
 * Sortable / handle field / theme swatch check in a real Chromium on a phone (real touch through CDP
 * Input.dispatchTouchEvent, not mouse events) and on a desktop with a mouse:
 *
 *   node projects/showcase/audit/sortable.mjs --url http://localhost:4310
 *
 * - Nothing runs off the page at 320 and 390 wide; section-list rows and their 44px buttons fit, a long
 *   label ends in an ellipsis; the reorder grid fills the width with tiles at least 96px.
 * - Touch: dragging a section-list handle moves the row at once; a locked first row stays first.
 * - Touch: holding a grid tile and dragging moves it; a quick swipe on a tile scrolls the page and
 *   moves nothing; a quick tap fires tileTap (the demo makes it the cover); the x removes a tile.
 * - Mouse: press and move a handle (list) and a tile (grid).
 * - Handle field: typed text is filtered; the swatch fits its choice-grid tile.
 *
 * Browser: playwright-core's Chromium, or CHROME_PATH.
 */
import { chromium } from 'playwright-core';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const base = arg('url', 'http://localhost:4310').replace(/\/$/, '');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--disable-features=OverscrollHistoryNavigation'] });
const problems = [];
const passes = [];
const check = (ok, what) => (ok ? passes : problems).push(what);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function phone(width) {
  const context = await browser.newContext({ viewport: { width, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 })) });
  /** A finger: down at a, optionally held, then moved to b in steps, then up. */
  async function swipe(a, b, { hold = 0, steps = 16, stepMs = 16 } = {}) {
    await touch('touchStart', [a]);
    if (hold) await wait(hold);
    for (let i = 1; i <= steps; i++) {
      await touch('touchMove', [[a[0] + ((b[0] - a[0]) * i) / steps, a[1] + ((b[1] - a[1]) * i) / steps]]);
      await wait(stepMs);
    }
    await wait(120);
    await touch('touchEnd', []);
    await wait(400);
  }
  async function tap(p) {
    await touch('touchStart', [p]);
    await wait(60);
    await touch('touchEnd', []);
    await wait(300);
  }
  return { context, page, swipe, tap };
}

const center = async (loc) => {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  return [b.x + b.width / 2, b.y + b.height / 2];
};
const listIds = (page) => page.$$eval('ui-section-list .row', (rows) => rows.map((r) => r.dataset.id));
const gridIds = (page) => page.$$eval('ui-reorder-grid .cell', (c) => c.map((x) => x.dataset.id));

for (const width of [320, 390]) {
  const { context, page, swipe, tap } = await phone(width);
  await page.goto(`${base}/sortable`, { waitUntil: 'networkidle' });
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(over <= 0, `${width}: /sortable has no sideways scroll (${over}px over)`);
  const rows = await page.$$eval('ui-section-list .row', (rows) => rows.map((r) => {
    const rb = r.getBoundingClientRect();
    const kids = [...r.querySelectorAll('.handle, .act')].map((b) => b.getBoundingClientRect());
    const label = r.querySelector('.label');
    return {
      fits: kids.every((k) => k.right <= rb.right + 0.5 && k.left >= rb.left - 0.5) && r.scrollWidth <= r.clientWidth,
      targets: kids.every((k) => k.width >= 44 && k.height >= 44),
      truncated: label.scrollHeight > label.clientHeight + 1 && getComputedStyle(label).webkitLineClamp === '2',
    };
  }));
  check(rows.every((r) => r.fits), `${width}: every section-list row keeps its buttons inside`);
  check(rows.every((r) => r.targets), `${width}: handles and buttons are at least 44px`);
  check(rows[2].truncated, `${width}: the long label stops at two lines with an ellipsis`);
  const shortCut = await page.$$eval('ui-section-list .row', (rows) => rows.filter((r) => ['about', 'contact', 'cover'].includes(r.dataset.id))
    .filter((r) => { const l = r.querySelector('.label'); return l.scrollHeight > l.clientHeight + 1 || l.scrollWidth > l.clientWidth; }).map((r) => r.dataset.id));
  check(shortCut.length === 0, `${width}: short names are shown whole (cut: ${shortCut.join(',') || 'none'})`);
  const grid = await page.$eval('ui-reorder-grid .grid', (g) => {
    const cells = [...g.querySelectorAll('.cell')].map((c) => c.getBoundingClientRect());
    const top = cells[0].top;
    const firstRow = cells.filter((c) => Math.abs(c.top - top) < 1);
    const gb = g.getBoundingClientRect();
    return { cols: firstRow.length, min: Math.min(...cells.map((c) => c.width)), square: cells.every((c) => Math.abs(c.width - c.height) < 1), fill: Math.abs(firstRow.at(-1).right - gb.right) < 1, gw: gb.width };
  });
  check(grid.min >= 96 && grid.square && grid.fill && grid.cols === Math.floor((grid.gw + 8) / (96 + 8)),
    `${width}: grid fills the width with ${grid.cols} square columns ≥96px (min ${grid.min.toFixed(1)})`);

  // List drag with a finger, at once from the handle: About me (2nd) below Gallery (3rd).
  let before = await listIds(page);
  const about = page.locator('ui-section-list .row[data-id="about"] .handle');
  const contactRow = page.locator('ui-section-list .row[data-id="contact"]');
  const from = await center(about);
  const to = await center(contactRow);
  await swipe(from, [from[0], to[1] + 4]);
  let after = await listIds(page);
  check(after.indexOf('about') > before.indexOf('about') && after[0] === 'cover', `${width}: touch drag moves a row (${before.join(',')} -> ${after.join(',')})`);
  // Drag the last row above the locked Cover: Cover stays first.
  const lastId = after.at(-1);
  const lastHandle = await center(page.locator(`ui-section-list .row[data-id="${lastId}"] .handle`));
  const coverRow = await center(page.locator('ui-section-list .row[data-id="cover"]'));
  await swipe(lastHandle, [lastHandle[0], coverRow[1] - 30], { steps: 24 });
  const locked = await listIds(page);
  check(locked[0] === 'cover' && locked.indexOf(lastId) === 1, `${width}: a locked first row stays first (${locked.join(',')})`);

  // Grid: hold and drag tile 1 onto tile 3.
  before = await gridIds(page);
  const t1 = await center(page.locator('ui-reorder-grid .cell').nth(0));
  const t3 = await center(page.locator('ui-reorder-grid .cell').nth(2));
  await swipe(t1, t3, { hold: 450 });
  after = await gridIds(page);
  check(after.indexOf(before[0]) === 2, `${width}: hold and drag moves a tile (${before.join(',')} -> ${after.join(',')})`);
  // A quick swipe up on a tile scrolls the page and moves nothing.
  before = after;
  const t2 = await center(page.locator('ui-reorder-grid .cell').nth(1));
  const y0 = await page.evaluate(() => window.scrollY);
  await swipe(t2, [t2[0], t2[1] - 200], { steps: 8, stepMs: 10 });
  const y1 = await page.evaluate(() => window.scrollY);
  after = await gridIds(page);
  check(y1 > y0 + 50 && after.join() === before.join(), `${width}: a quick swipe on a tile scrolls (${y0} -> ${y1}) and moves nothing`);
  // A tap makes it the cover in the demo; the x removes without tapping.
  const target = page.locator('ui-reorder-grid .cell').nth(3);
  const tid = await target.getAttribute('data-id');
  await tap(await center(target.locator('.tile')));
  const coverNow = await page.$eval('ui-reorder-grid .cover', (c) => c.closest('.cell').dataset.id);
  check(coverNow === tid, `${width}: a tap fires tileTap (cover ${coverNow}, tapped ${tid})`);
  const n0 = (await gridIds(page)).length;
  const x = page.locator('ui-reorder-grid .cell').nth(1).locator('.x');
  const xb = await x.boundingBox();
  check(xb.width >= 44 && xb.height >= 44, `${width}: the x is a 44px target`);
  await tap(await center(x));
  const n1 = (await gridIds(page)).length;
  const coverAfterX = await page.$eval('ui-reorder-grid .cover', (c) => c.closest('.cell').dataset.id);
  check(n1 === n0 - 1 && coverAfterX === tid, `${width}: the x removes a tile without tapping it (${n0} -> ${n1})`);

  for (const route of ['/forms', '/foundation']) {
    await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
    const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(o <= 0, `${width}: ${route} has no sideways scroll (${o}px over)`);
  }
  await page.goto(`${base}/forms#handle-field`, { waitUntil: 'networkidle' });
  const field = page.locator('ui-handle-field input');
  await field.scrollIntoViewIfNeeded();
  await field.click();
  await page.keyboard.type('Mia Ali!');
  check((await field.inputValue()) === 'miaali', `${width}: handle field keeps only a-z 0-9 . _ (${await field.inputValue()})`);
  await wait(1200);
  const line = await page.$eval('ui-handle-field .status', (s) => s.textContent.trim());
  check(line.includes('@miaali is free'), `${width}: handle field reports free (${line})`);
  const fh = await page.$eval('ui-handle-field .frame', (f) => f.getBoundingClientRect().height);
  check(fh >= 44, `${width}: handle field is ${fh}px tall`);
  await page.goto(`${base}/foundation#theme-swatch`, { waitUntil: 'networkidle' });
  const sw = await page.$$eval('ui-choice-grid ui-theme-swatch', (s) => s.map((el) => {
    const art = el.closest('.art').getBoundingClientRect();
    const b = el.getBoundingClientRect();
    return b.height <= art.height + 0.5 && b.width <= art.width + 0.5 && b.height > 20;
  }));
  check(sw.length === 6 && sw.every(Boolean), `${width}: every theme swatch fits its tile`);
  await context.close();
}

// Desktop mouse: press and move.
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${base}/sortable`, { waitUntil: 'networkidle' });
  const drag = async (a, b) => {
    await page.mouse.move(...a);
    await page.mouse.down();
    for (let i = 1; i <= 16; i++) { await page.mouse.move(a[0] + ((b[0] - a[0]) * i) / 16, a[1] + ((b[1] - a[1]) * i) / 16); await wait(16); }
    await wait(120);
    await page.mouse.up();
    await wait(400);
  };
  let before = await listIds(page);
  await drag(await center(page.locator('ui-section-list .row[data-id="contact"] .handle')), await center(page.locator('ui-section-list .row[data-id="about"]')));
  let after = await listIds(page);
  check(after.indexOf('contact') < before.indexOf('contact'), `desktop: mouse drag moves a row (${after.join(',')})`);
  before = await gridIds(page);
  await drag(await center(page.locator('ui-reorder-grid .cell').nth(4)), await center(page.locator('ui-reorder-grid .cell').nth(0)));
  after = await gridIds(page);
  check(after[0] === before[4], `desktop: mouse drag moves a tile (${before.join(',')} -> ${after.join(',')})`);
  await context.close();
}

await browser.close();
for (const p of passes) console.log('ok  ', p);
for (const p of problems) console.log('FAIL', p);
console.log(problems.length ? `${problems.length} problem(s)` : `all ${passes.length} checks passed`);
process.exit(problems.length ? 1 : 0);
