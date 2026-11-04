#!/usr/bin/env node
/*
 * ui-filter and ui-filter-chips, measured in a real Chromium. Fails on any problem; prints numbers.
 *
 *   node projects/showcase/audit/filter.mjs --url http://localhost:4310 [--shots /tmp/filter-shots]
 *
 * Media page (#filter), light and dark themes:
 *   - 1440 wide (mouse): the button opens a popover (role dialog) under the button, 340 wide, inside
 *     the screen, whose rows are >= 44px tall and whose footer (Clear all, Show N) is in view;
 *     choosing a person changes the demo's count and adds a chip; Escape closes it.
 *   - 390 wide (touch, pointer: coarse): the button's target is >= 44px (elementFromPoint 20px above
 *     and below its centre still hits it), it opens a bottom sheet inside the screen (no sideways
 *     overflow) with rows >= 44px and the footer in view; a chip's × (44px target) turns it off.
 * --css '<rules>' adds a stylesheet first: plant a fault to check the audit catches it, e.g.
 *   --css 'ui-filter-panel label.row { min-height: 30px !important }'.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const base = arg('url', 'http://localhost:4310').replace(/\/$/, '');
const extraCss = arg('css', '');
const shots = arg('shots', '');
if (shots) mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ channel: process.env.CHROME_PATH ? undefined : 'chromium', executablePath: process.env.CHROME_PATH || undefined });
const problems = [];
const fail = (where, what) => problems.push(`${where}: ${what}`);

async function open(width, height, touch, theme) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 });
  const page = await ctx.newPage();
  await page.goto(`${base}/media#filter`, { waitUntil: 'networkidle' });
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  if (extraCss) await page.addStyleTag({ content: extraCss });
  const section = page.locator('#filter');
  await section.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy({ top: document.querySelector('#filter ui-filter').getBoundingClientRect().top - 120, behavior: 'instant' }));
  await page.waitForTimeout(300);
  return { ctx, page };
}

/** The row whose label is exactly `name` ("Videos" must not match "Photos and videos"). */
const row = (page, scope, name) => page.locator(`${scope} label.row`).filter({ has: page.locator('.lbl', { hasText: new RegExp(`^${name}$`) }) }).first();
const demoCount = (page) => page.locator('#filter .flt-note').innerText();
const rowHeights = (page, scope) =>
  page.evaluate((sel) => [...document.querySelectorAll(`${sel} label.row`)].map((r) => r.getBoundingClientRect().height), scope);

for (const theme of ['winterLight', 'winterDark']) {
  // Desktop: popover.
  {
    const where = `${theme} @1440`;
    const { ctx, page } = await open(1440, 900, false, theme);
    const btn = page.locator('#filter ui-filter-button button');
    await btn.click();
    await page.waitForTimeout(400);
    const pop = page.locator('.ui-filter-pop');
    if (!(await pop.isVisible())) fail(where, 'no popover after clicking Filter');
    else {
      const b = await btn.boundingBox();
      const p = await pop.boundingBox();
      if (Math.abs(p.width - 340) > 1) fail(where, `popover ${p.width}px wide, expected 340`);
      if (p.y < b.y + b.height - 1) fail(where, 'popover is not under the button');
      if (p.x < 0 || p.x + p.width > 1440 || p.y + p.height > 900) fail(where, `popover outside the screen ${JSON.stringify(p)}`);
      if ((await page.locator('.ui-filter-pop').getAttribute('role')) !== 'dialog') fail(where, 'popover is not a dialog');
      const hs = await rowHeights(page, '.ui-filter-pop');
      if (!hs.length || hs.some((h) => h < 44)) fail(where, `row heights ${hs.join(',')}`);
      const foot = await page.locator('.ui-filter-pop ui-filter-footer').boundingBox();
      if (!foot || foot.y + foot.height > p.y + p.height + 1) fail(where, 'footer not in view');
      const before = await demoCount(page);
      await row(page, '.ui-filter-pop', 'Aisha').click();
      await page.waitForTimeout(200);
      const after = await demoCount(page);
      if (before === after) fail(where, `choosing Aisha didn't change the demo (${before})`);
      const chips = await page.locator('#filter ui-filter-chips ui-chip').count();
      if (chips !== 1) fail(where, `${chips} chips after choosing one person`);
      const label = await btn.getAttribute('aria-label');
      if (label !== 'Filter, 1 on') fail(where, `button named "${label}"`);
      if (shots) await page.screenshot({ path: `${shots}/web-1440-${theme}-open.png` });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      if (await pop.isVisible()) fail(where, 'Escape did not close the popover');
      console.log(`${where}: popover ${p.width}x${Math.round(p.height)}, rows ${Math.min(...hs)}-${Math.max(...hs)}px, ${before} -> ${after}`);
    }
    await ctx.close();
  }
  // Phone: bottom sheet.
  {
    const where = `${theme} @390`;
    const { ctx, page } = await open(390, 844, true, theme);
    const btn = page.locator('#filter ui-filter-button button');
    const b = await btn.boundingBox();
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const hits = await page.evaluate(([x, y]) => [y - 20, y + 20].map((yy) => !!document.elementFromPoint(x, yy)?.closest('ui-filter-button')), [cx, cy]);
    if (hits.includes(false)) fail(where, `button target under 44px (hits ${hits})`);
    if (shots) await page.screenshot({ path: `${shots}/web-390-${theme}-toolbar.png` });
    await page.tap('#filter ui-filter-button button');
    await page.waitForTimeout(700);
    const sheet = page.locator('#filter ui-bottom-sheet');
    if (!(await sheet.count())) fail(where, 'no bottom sheet after tapping Filter');
    else {
      const hs = await rowHeights(page, '#filter ui-bottom-sheet');
      if (!hs.length || hs.some((h) => h < 44)) fail(where, `row heights ${hs.join(',')}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 0) fail(where, `page overflows sideways by ${overflow}px`);
      const foot = await page.locator('#filter ui-bottom-sheet ui-filter-footer').boundingBox();
      if (!foot || foot.y + foot.height > 844 + 1 || foot.y < 0) fail(where, `footer not in view ${JSON.stringify(foot)}`);
      await row(page, '#filter ui-bottom-sheet', 'Ali').tap();
      await page.waitForTimeout(200);
      await row(page, '#filter ui-bottom-sheet', 'Videos').tap();
      await page.waitForTimeout(300);
      if (shots) await page.screenshot({ path: `${shots}/web-390-${theme}-sheet.png` });
      await page.locator('#filter ui-bottom-sheet ui-filter-footer ui-button').last().locator('button').tap();
      await page.waitForTimeout(700);
      const chips = await page.locator('#filter ui-filter-chips ui-chip').count();
      if (chips !== 2) fail(where, `${chips} chips after choosing Ali and Videos`);
      if (shots) await page.screenshot({ path: `${shots}/web-390-${theme}-chips.png` });
      const x = await page.locator('#filter ui-filter-chips ui-chip button').first().boundingBox();
      const xHits = await page.evaluate(([x0, y0]) => [y0 - 20, y0 + 20].map((yy) => document.elementFromPoint(x0, yy)?.closest('button')?.classList.contains('x') ?? false), [x.x + x.width / 2, x.y + x.height / 2]);
      if (xHits.includes(false)) fail(where, `chip × target under 44px (hits ${xHits})`);
      await page.locator('#filter ui-filter-chips ui-chip button').first().tap();
      await page.waitForTimeout(200);
      const left = await page.locator('#filter ui-filter-chips ui-chip').count();
      if (left !== 1) fail(where, `${left} chips after removing one`);
      console.log(`${where}: sheet rows ${Math.min(...hs)}-${Math.max(...hs)}px, footer at ${Math.round(foot?.y ?? -1)}`);
    }
    await ctx.close();
  }
}

await browser.close();
if (problems.length) {
  console.error(`${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('filter audit: no problems');
