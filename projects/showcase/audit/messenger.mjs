#!/usr/bin/env node
/*
 * Messenger buttons and contact channels, measured in a real Chromium (full Chromium, not the
 * headless shell). Fails on any problem; prints the numbers.
 *
 *   node projects/showcase/audit/messenger.mjs --url http://localhost:4310
 *
 * Buttons page (#messenger-button), at 1280 and 360 wide, light and dark themes:
 *   - every ui-messenger-button is at least 44px tall;
 *   - the logo's and the label's centre lines are within 0.5px of the button's centre line, and the
 *     logo + label group is centred across the button within 0.5px (icon-only: the logo);
 *   - the tick badge sits at the same offset from the top-right corner on every ticked button;
 *   - the expanded row's buttons have equal widths;
 *   - no shown label is cut off (compact="auto" shows the whole name or the logo alone).
 * Data page (#contact-channels): in every ui-contact-channels, label x and value x are equal across
 * rows, the messenger row starts at the value x, its buttons have equal widths and gaps, all fit
 * inside the component (no overflow), and at 360 wide they are icon-only while keeping their names;
 * at 1280 the wide cards show labels. Also the centring checks above for those buttons.
 *
 * Browser: playwright-core's Chromium (channel 'chromium'), or CHROME_PATH.
 * --css '<rules>' adds a stylesheet to every page first: plant a fault to check the audit catches it,
 * e.g. --css 'ui-messenger-button svg.logo { margin-top: 2px }'.
 */
import { chromium } from 'playwright-core';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const base = arg('url', 'http://localhost:4310').replace(/\/$/, '');
const extraCss = arg('css', '');
const browser = await chromium.launch({ channel: process.env.CHROME_PATH ? undefined : 'chromium', executablePath: process.env.CHROME_PATH || undefined });
const problems = [];
const stats = { centreY: 0, centreX: 0, buttons: 0 };

/** Measures every ui-messenger-button under `root`: geometry, centring, badge offset. */
const measureButtons = (page, root) =>
  page.evaluate((root) => {
    const out = [];
    for (const host of document.querySelectorAll(`${root} ui-messenger-button`)) {
      const b = host.querySelector('button');
      const br = b.getBoundingClientRect();
      if (!br.width) continue;
      const logo = b.querySelector('.logo').getBoundingClientRect();
      const labelEl = b.querySelector('.label');
      const shown = !b.classList.contains('icon-only');
      const cut = shown && labelEl.scrollWidth > labelEl.clientWidth + 0.5;
      const label = labelEl.getBoundingClientRect();
      const tick = b.querySelector('.tick')?.getBoundingClientRect();
      const left = logo.left;
      const right = shown ? label.right : logo.right;
      out.push({
        app: b.dataset.app,
        name: b.getAttribute('aria-label'),
        w: br.width,
        h: br.height,
        x: br.left,
        right: br.right,
        labelShown: shown,
        cut,
        dyLogo: logo.top + logo.height / 2 - (br.top + br.height / 2),
        dyLabel: shown ? label.top + label.height / 2 - (br.top + br.height / 2) : 0,
        dxGroup: (left + right) / 2 - (br.left + br.width / 2),
        tick: tick ? { dx: tick.right - br.right, dy: tick.top - br.top, w: tick.width } : null,
      });
    }
    return out;
  }, root);

function checkButtons(where, list) {
  if (!list.length) problems.push(`${where}: no buttons found`);
  const ticks = new Set();
  for (const m of list) {
    stats.buttons++;
    stats.centreY = Math.max(stats.centreY, Math.abs(m.dyLogo), Math.abs(m.dyLabel));
    stats.centreX = Math.max(stats.centreX, Math.abs(m.dxGroup));
    if (m.h < 44) problems.push(`${where} ${m.app}: ${m.h}px tall`);
    if (Math.abs(m.dyLogo) > 0.5) problems.push(`${where} ${m.app}: logo centre off by ${m.dyLogo.toFixed(2)}px`);
    if (Math.abs(m.dyLabel) > 0.5) problems.push(`${where} ${m.app}: label centre off by ${m.dyLabel.toFixed(2)}px`);
    if (Math.abs(m.dxGroup) > 0.5) problems.push(`${where} ${m.app}: logo+label group off-centre by ${m.dxGroup.toFixed(2)}px`);
    if (!m.name) problems.push(`${where} ${m.app}: no accessible name`);
    if (m.cut) problems.push(`${where} ${m.app}: label cut off (ellipsis)`);
    if (m.tick) ticks.add(`${m.tick.dx.toFixed(2)},${m.tick.dy.toFixed(2)},${m.tick.w}`);
  }
  if (ticks.size > 1) problems.push(`${where}: tick badges at different offsets ${[...ticks].join(' | ')}`);
  return [...ticks];
}

const equal = (xs, tol = 0.5) => xs.every((x) => Math.abs(x - xs[0]) <= tol);
const report = [];

for (const theme of ['winterLight', 'winterDark']) {
  for (const width of [1280, 360]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    if (extraCss) await page.addInitScript((css) => addEventListener('DOMContentLoaded', () => document.head.append(Object.assign(document.createElement('style'), { textContent: css }))), extraCss);
    const where = `${theme} @${width}`;

    await page.goto(`${base}/buttons`, { waitUntil: 'networkidle' });
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    await page.waitForSelector('ui-messenger-button button');
    await page.waitForTimeout(200);
    const btns = await measureButtons(page, 'body');
    const tickOffsets = checkButtons(`${where} buttons`, btns);
    const row = await page.evaluate(() => [...document.querySelectorAll('.msg-row ui-messenger-button button')].map((b) => b.getBoundingClientRect().width));
    if (row.length !== 3 || !equal(row)) problems.push(`${where}: expanded row widths ${row.join(', ')}`);
    report.push(`${where} buttons: ${btns.length} measured, tick offset ${tickOffsets.join(' ')}, row widths ${row.map((w) => w.toFixed(1)).join('/')}`);

    await page.goto(`${base}/data`, { waitUntil: 'networkidle' });
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    await page.waitForSelector('ui-contact-channels');
    await page.waitForTimeout(200);
    const blocks = await page.evaluate(() =>
      [...document.querySelectorAll('ui-contact-channels')].map((cc) => {
        const r = cc.getBoundingClientRect();
        const xs = (sel) => [...cc.querySelectorAll(sel)].map((e) => e.getBoundingClientRect().left);
        const apps = cc.querySelector('.apps');
        const btns = [...cc.querySelectorAll('.apps ui-messenger-button button')].map((b) => {
          const br = b.getBoundingClientRect();
          return { x: br.left, right: br.right, w: br.width, label: !b.classList.contains('icon-only'), name: b.getAttribute('aria-label') };
        });
        const status = cc.querySelector('.status')?.getBoundingClientRect();
        return {
          w: r.width, left: r.left, right: r.right,
          labelX: xs('.lbl'), valueX: xs('.val'),
          appsX: apps ? apps.getBoundingClientRect().left : null,
          scrollW: cc.scrollWidth, clientW: cc.clientWidth,
          btns, statusW: status?.width ?? null,
        };
      }),
    );
    blocks.forEach((b, i) => {
      const w = `${where} contact #${i + 1} (${b.w.toFixed(0)}px)`;
      if (!equal(b.labelX)) problems.push(`${w}: label x ${b.labelX.join(', ')}`);
      if (!equal(b.valueX)) problems.push(`${w}: value x ${b.valueX.join(', ')}`);
      if (b.appsX !== null && Math.abs(b.appsX - b.valueX[0]) > 0.5) problems.push(`${w}: buttons start at ${b.appsX}, values at ${b.valueX[0]}`);
      if (b.btns.length) {
        if (!equal(b.btns.map((x) => x.w))) problems.push(`${w}: button widths ${b.btns.map((x) => x.w).join(', ')}`);
        const gaps = b.btns.slice(1).map((x, j) => x.x - b.btns[j].right);
        if (!equal(gaps)) problems.push(`${w}: gaps ${gaps.join(', ')}`);
        if (Math.abs(b.btns[0].x - b.valueX[0]) > 0.5) problems.push(`${w}: first button at ${b.btns[0].x}`);
        if (b.btns.at(-1).right > b.right + 0.5) problems.push(`${w}: buttons overflow (${b.btns.at(-1).right} > ${b.right})`);
        if (b.btns.some((x) => !x.name)) problems.push(`${w}: a button without a name`);
        if (new Set(b.btns.map((x) => x.label)).size > 1) problems.push(`${w}: row mixes labelled and icon-only buttons`);
        if (width === 360 && b.btns.some((x) => x.label)) problems.push(`${w}: labels shown at 360`);
        if (width === 1280 && b.w > 400 && b.btns.some((x) => !x.label)) problems.push(`${w}: icon-only with room for labels`);
      }
      if (b.scrollW > b.clientW + 1) problems.push(`${w}: content overflows (${b.scrollW} > ${b.clientW})`);
      report.push(`${w}: label x ${b.labelX.map((x) => x.toFixed(1)).join('/')}, value x ${b.valueX.map((x) => x.toFixed(1)).join('/')}, buttons x ${b.appsX?.toFixed(1)}, widths ${b.btns.map((x) => x.w.toFixed(1)).join('/')}, labels ${b.btns.map((x) => (x.label ? 'y' : 'n')).join('')}`);
    });
    checkButtons(`${where} contact`, await measureButtons(page, 'ui-contact-channels'));
    await context.close();
  }
}
await browser.close();

console.log(report.join('\n'));
console.log(`\ncentring: ${stats.buttons} buttons, worst vertical offset ${stats.centreY.toFixed(3)}px, worst horizontal group offset ${stats.centreX.toFixed(3)}px`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('OK');
