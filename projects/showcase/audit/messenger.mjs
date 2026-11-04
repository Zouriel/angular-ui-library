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
 * Since 0.58.0 the contact row is small icon-only buttons: 32x32, 12px apart, each a 44px target
 * (checked with elementFromPoint), the tick badge >= 3:1 against its ring. The messenger switch is
 * centred, <= 360px, its logo centred on the pill, and a CDP touch swipe moves it to the next app
 * without pressing it. Also the centring checks above for all buttons.
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
        size: b.dataset.size,
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
    if (m.size === 'sm' ? Math.abs(m.h - 32) > 0.5 : m.h < 44) problems.push(`${where} ${m.app} (${m.size}): ${m.h}px tall`);
    if (Math.abs(m.dyLogo) > 0.5) problems.push(`${where} ${m.app}: logo centre off by ${m.dyLogo.toFixed(2)}px`);
    if (Math.abs(m.dyLabel) > 0.5) problems.push(`${where} ${m.app}: label centre off by ${m.dyLabel.toFixed(2)}px`);
    if (Math.abs(m.dxGroup) > 0.5) problems.push(`${where} ${m.app}: logo+label group off-centre by ${m.dxGroup.toFixed(2)}px`);
    if (!m.name) problems.push(`${where} ${m.app}: no accessible name`);
    if (m.cut) problems.push(`${where} ${m.app}: label cut off (ellipsis)`);
    if (m.tick) ticks.add(`${m.size}:${m.tick.dx.toFixed(2)},${m.tick.dy.toFixed(2)},${m.tick.w}`);
  }
  for (const size of ['sm', 'md']) {
    const own = [...ticks].filter((t) => t.startsWith(`${size}:`));
    if (own.length > 1) problems.push(`${where}: ${size} tick badges at different offsets ${own.join(' | ')}`);
  }
  return [...ticks];
}

const equal = (xs, tol = 0.5) => xs.every((x) => Math.abs(x - xs[0]) <= tol);
const report = [];

for (const theme of ['winterLight', 'winterDark']) {
  for (const width of [1280, 360]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2, hasTouch: true });
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
          return { x: br.left, right: br.right, w: br.width, h: br.height, label: !b.classList.contains('icon-only'), name: b.getAttribute('aria-label') };
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
        // 0.58.0: small icon-only buttons, 32px boxes, 12px apart, left-aligned (not stretched).
        if (b.btns.some((x) => x.label)) problems.push(`${w}: a contact button shows its name`);
        if (b.btns.some((x) => Math.abs(x.w - 32) > 0.5 || Math.abs(x.h - 32) > 0.5)) problems.push(`${w}: contact buttons not 32x32 (${b.btns.map((x) => `${x.w}x${x.h}`).join(', ')})`);
        if (gaps.some((g) => Math.abs(g - 12) > 0.5)) problems.push(`${w}: gaps ${gaps.join(', ')} (want 12)`);
      }
      if (b.scrollW > b.clientW + 1) problems.push(`${w}: content overflows (${b.scrollW} > ${b.clientW})`);
      report.push(`${w}: label x ${b.labelX.map((x) => x.toFixed(1)).join('/')}, value x ${b.valueX.map((x) => x.toFixed(1)).join('/')}, buttons x ${b.appsX?.toFixed(1)}, widths ${b.btns.map((x) => x.w.toFixed(1)).join('/')}, labels ${b.btns.map((x) => (x.label ? 'y' : 'n')).join('')}`);
    });
    checkButtons(`${where} contact`, await measureButtons(page, 'ui-contact-channels'));

    // Every small button is a 44x44 target: points 21px from its centre in each direction still hit it.
    const hits = await page.evaluate(() => [...document.querySelectorAll('ui-messenger-button button[data-size="sm"]')].map((b) => {
      b.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = b.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const miss = [[0, -21], [0, 21], [-21, 0], [21, 0]].filter(([dx, dy]) => document.elementFromPoint(cx + dx, cy + dy)?.closest('button') !== b);
      return { app: b.dataset.app, miss: miss.length };
    }));
    for (const h of hits) if (h.miss) problems.push(`${where}: sm ${h.app} button misses ${h.miss} of 4 points of its 44px target`);
    report.push(`${where} sm hit areas: ${hits.length} buttons checked at ±21px`);

    // The tick badge reads on every brand fill: its success disc against its surface-coloured ring >= 3:1.
    const badge = await page.evaluate(() => {
      const t = document.querySelector('ui-contact-channels .tick, ui-messenger-button .tick');
      if (!t) return null;
      const cs = getComputedStyle(t);
      return { bg: cs.backgroundColor, ring: cs.boxShadow };
    });
    if (badge) {
      const rgb = (v) => v.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
      const lum = ([r, g, b]) => [r, g, b].map((v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
      const [x, y] = [lum(rgb(badge.bg)), lum(rgb(badge.ring))].sort((p, q) => q - p);
      const c = (x + 0.05) / (y + 0.05);
      if (c < 3) problems.push(`${where}: tick badge ${c.toFixed(2)}:1 against its ring`);
      report.push(`${where} tick badge vs ring: ${c.toFixed(2)}:1`);
    }

    // The messenger switch: centred, <= 360 wide, logo centred on the pill, a touch swipe changes channel.
    await page.goto(`${base}/buttons`, { waitUntil: 'networkidle' });
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    await page.locator('ui-messenger-switch').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const sw = await page.evaluate(() => {
      const host = document.querySelector('ui-messenger-switch');
      const parent = host.parentElement.getBoundingClientRect();
      const ps = getComputedStyle(host.parentElement);
      const inner = { left: parent.left + parseFloat(ps.paddingLeft), right: parent.right - parseFloat(ps.paddingRight) };
      const r = host.getBoundingClientRect();
      const pill = host.querySelector('.pill').getBoundingClientRect();
      const logo = host.querySelector('.pill ui-messenger-logo').getBoundingClientRect();
      const navs = [...host.querySelectorAll('.nav')].map((n) => n.getBoundingClientRect());
      return {
        w: r.width, gapL: r.left - inner.left, gapR: inner.right - r.right,
        dyLogo: logo.top + logo.height / 2 - (pill.top + pill.height / 2), pillH: pill.height,
        navMin: Math.min(...navs.map((n) => Math.min(n.width, n.height))),
        pill: { x: pill.left + pill.width / 2, y: pill.top + pill.height / 2 },
        app: host.querySelector('.pill').dataset.app,
        clipped: (() => { const l = host.querySelector('.pill .label'); return l.scrollHeight > l.clientHeight + 0.5; })(),
      };
    });
    if (sw.w > 360.5) problems.push(`${where}: switch ${sw.w}px wide`);
    if (sw.clipped) problems.push(`${where}: switch words cut off`);
    if (Math.abs(sw.gapL - sw.gapR) > 0.5) problems.push(`${where}: switch off-centre (${sw.gapL} vs ${sw.gapR})`);
    if (Math.abs(sw.dyLogo) > 0.5) problems.push(`${where}: switch logo off by ${sw.dyLogo.toFixed(2)}px`);
    if (sw.pillH < 44 || sw.navMin < 44) problems.push(`${where}: switch targets ${sw.pillH}/${sw.navMin}px`);
    stats.centreY = Math.max(stats.centreY, Math.abs(sw.dyLogo));
    // A real touch swipe (CDP), finger to the left: the next channel.
    const cdp = await context.newCDPSession(page);
    const touch = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: sw.pill.y, id: 1 }] });
    await touch('touchStart', sw.pill.x + 40);
    for (let i = 1; i <= 6; i++) await touch('touchMove', sw.pill.x + 40 - i * 15);
    await touch('touchEnd', 0);
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({
      app: document.querySelector('ui-messenger-switch .pill').dataset.app,
      out: document.querySelector('.switch-out')?.textContent ?? '',
    }));
    if (!(sw.app === 'whatsapp' && after.app === 'viber')) problems.push(`${where}: swipe went ${sw.app} -> ${after.app}`);
    if (/pressed: \d/.test(after.out)) problems.push(`${where}: the swipe also pressed (${after.out})`);
    report.push(`${where} switch: ${sw.w.toFixed(1)}px wide, gaps ${sw.gapL.toFixed(1)}/${sw.gapR.toFixed(1)}, logo dy ${sw.dyLogo.toFixed(3)}, swipe ${sw.app} -> ${after.app}`);
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
