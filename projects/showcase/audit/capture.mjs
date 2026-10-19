#!/usr/bin/env node
/*
 * Screenshots every showcase section, for reviewing the look by eye (spacing, alignment, crowding).
 *
 *   npm run audit:shots -- --url http://localhost:4310 --out shots
 *   npm run audit:shots -- --pages buttons,forms --themes dark --widths 390
 *
 * Writes <out>/<route>/<theme>@<width>/NN-<section>.png, one per doc-section, or viewport-sized
 * slices for pages without sections (the studios). Same browser setup as ui-audit.mjs.
 */
import { mkdirSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const base = arg('url', 'http://localhost:4200').replace(/\/$/, '');
const out = arg('out', 'shots');
const themes = arg('themes', 'dark,light').split(',');
const widths = arg('widths', '1440,390').split(',').map(Number);
const only = arg('pages', '');

const routesSrc = readFileSync(join(here, '../src/app/app.routes.ts'), 'utf8');
let routes = [...routesSrc.matchAll(/path: '([^'*]*)'/g)].map((m) => m[1]);
if (only) routes = routes.filter((r) => only.split(',').includes(r || 'overview'));

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
let shots = 0;

for (const width of widths) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', hasTouch: width < 700 });
  const page = await ctx.newPage();
  for (const route of routes) {
    for (const theme of themes) {
      await page.goto(`${base}/${route}`, { waitUntil: 'networkidle' });
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await page.waitForTimeout(450);
      const dir = join(out, route || 'overview', `${theme}@${width}`);
      mkdirSync(dir, { recursive: true });
      const sections = page.locator('doc-section');
      const n = await sections.count();
      if (n) {
        for (let i = 0; i < n; i++) {
          const s = sections.nth(i);
          const name = slug((await s.getAttribute('name')) || `section-${i}`);
          await s.scrollIntoViewIfNeeded();
          await page.waitForTimeout(120);
          await s.screenshot({ path: join(dir, `${String(i).padStart(2, '0')}-${name}.png`) });
          shots++;
        }
      } else {
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0, i = 0; y < height && i < 6; y += 900, i++) {
          await page.evaluate((top) => window.scrollTo(0, top), y);
          await page.waitForTimeout(150);
          await page.screenshot({ path: join(dir, `${String(i).padStart(2, '0')}-viewport.png`) });
          shots++;
        }
      }
    }
  }
  await ctx.close();
}
await browser.close();
console.log(`${shots} screenshots in ${out}`);
