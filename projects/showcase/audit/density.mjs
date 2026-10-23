#!/usr/bin/env node
/*
 * Density (0.45.0) in a real browser: what jsdom can't check, since it has no cascade, media
 * queries or layout.
 *
 *   npm run audit:density -- --url http://localhost:4310     # needs the showcase running
 *
 * On the Foundation page's density demo, at 390px wide with a touch screen (coarse pointer):
 * - comfortable (the default) renders exactly the old sizes: 15px body, 30px buttons, 20px icons;
 * - compact renders 14px body, 26px buttons, an 18px icon, a 34px switch track, a smaller checkbox,
 *   and the same spacing tokens; every button keeps its 44px touch area;
 * - auto is compact at 599px wide, comfortable at 600px, and compact again after resizing back.
 * Exits 1 on any failure.
 */
import { chromium } from 'playwright-core';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const base = arg('url', 'http://localhost:4310').replace(/\/$/, '');

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await context.newPage();
await page.goto(`${base}/foundation`, { waitUntil: 'networkidle' });
await page.waitForSelector('.density-sample ui-button .ui-btn');

const failures = [];
const check = (what, ok, detail) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`);
  if (!ok) failures.push(what);
};

async function measure() {
  return page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const sample = document.querySelector('.density-sample');
    const rect = (sel) => sample.querySelector(sel).getBoundingClientRect();
    const btn = sample.querySelector('ui-button .ui-btn');
    const touch = getComputedStyle(btn, '::before');
    return {
      md: root.getPropertyValue('--ui-font-size-md').trim(),
      body: getComputedStyle(sample.querySelector('ui-text .v-body') ?? sample.querySelector('ui-text')).fontSize,
      h3: getComputedStyle(sample.querySelector('.v-h3')).fontSize,
      button: Math.round(btn.getBoundingClientRect().height * 10) / 10,
      buttonFont: getComputedStyle(btn).fontSize,
      touch: touch.height,
      icon: Math.round(rect('hugeicons-icon').width * 10) / 10,
      track: Math.round(rect('ui-switch .track').width * 10) / 10,
      box: Math.round(rect('ui-checkbox .box').width * 10) / 10,
      input: Math.round(rect('ui-input .ui-input').height * 10) / 10,
      spaces: ['1', '2', '3', '4', '6', '8', '12', '20'].map((n) => root.getPropertyValue(`--ui-space-${n}`).trim()).join(' '),
      radius: root.getPropertyValue('--ui-radius').trim(),
    };
  });
}
const setDensity = (d) => page.evaluate((v) => {
  if (v === 'comfortable') document.documentElement.removeAttribute('data-density');
  else document.documentElement.setAttribute('data-density', v);
}, d);

await setDensity('comfortable');
const c = await measure();
check('comfortable: body 15px', c.md === '15px' && c.body === '15px', `${c.md} / ${c.body}`);
check('comfortable: h3 22px', c.h3 === '22px', c.h3);
check('comfortable: button 30px, 14px text', c.button === 30 && c.buttonFont === '14px', `${c.button} / ${c.buttonFont}`);
check('comfortable: icon 20px, switch 38px, checkbox 18px', c.icon === 20 && c.track === 38 && c.box === 18, `${c.icon} / ${c.track} / ${c.box}`);
check('comfortable: touch area 44px', c.touch === '44px', c.touch);

await setDensity('compact');
const k = await measure();
check('compact: body 14px', k.md === '14px' && k.body === '14px', `${k.md} / ${k.body}`);
check('compact: h3 20px', k.h3 === '20px', k.h3);
check('compact: button 26px, 13px text', k.button === 26 && Math.abs(parseFloat(k.buttonFont) - 13.02) < 0.05, `${k.button} / ${k.buttonFont}`);
check('compact: input 26px', k.input === 26, String(k.input));
check('compact: icon 18px', k.icon === 18, String(k.icon));
check('compact: switch 34.2px, checkbox 16.2px', Math.abs(k.track - 34.2) < 0.2 && Math.abs(k.box - 16.2) < 0.2, `${k.track} / ${k.box}`);
check('compact: touch area still 44px', k.touch === '44px', k.touch);
check('compact: spacing and radius unchanged', k.spaces === c.spaces && k.radius === c.radius, `${k.spaces} | ${k.radius}`);

await setDensity('auto');
await page.setViewportSize({ width: 599, height: 844 });
const a1 = await measure();
check('auto at 599px: compact', a1.md === '14px' && a1.button === 26, `${a1.md} / ${a1.button}`);
await page.setViewportSize({ width: 600, height: 844 });
const a2 = await measure();
check('auto at 600px: comfortable', a2.md === '15px' && a2.button === 30, `${a2.md} / ${a2.button}`);
await page.setViewportSize({ width: 599, height: 844 });
const a3 = await measure();
check('auto back at 599px: compact again', a3.md === '14px' && a3.button === 26, `${a3.md} / ${a3.button}`);

await browser.close();
if (failures.length) {
  console.error(`\n${failures.length} density check(s) failed`);
  process.exit(1);
}
console.log('\nall density checks passed');
