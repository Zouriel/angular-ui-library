import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOC_SECTIONS } from './doc-index';
import { docAnchor } from './docs-ui';

/*
 * The command palette searches DOC_SECTIONS, a static list. This keeps it equal to the
 * <doc-section> tags in the pages, so a new or renamed section is findable and no search result
 * points at a heading that is gone.
 */

const app = join(process.cwd(), 'projects/showcase/src/app');
const routes = [...readFileSync(join(app, 'app.routes.ts'), 'utf8')
  .matchAll(/path: '([^']*)', loadComponent: \(\) => import\('\.\/pages\/([\w-]+)\.page'\)/g)]
  .map((m) => ({ route: m[1], page: m[2] }));

function unescapeHtml(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function sectionsIn(page: string): { name: string; anchor: string }[] {
  const src = readFileSync(join(app, 'pages', `${page}.page.ts`), 'utf8');
  return [...src.matchAll(/<doc-section\b([^>]*)>/g)].flatMap((m) => {
    const name = /(?<![\w[-])name="([^"]*)"/.exec(m[1]);
    if (!name) return [];
    const anchor = /(?<![\w[-])anchor="([^"]*)"/.exec(m[1]);
    const n = unescapeHtml(name[1]);
    return [{ name: n, anchor: anchor ? anchor[1] : docAnchor(n) }];
  });
}

describe('doc section index', () => {
  it('finds the routed pages', () => {
    expect(routes.length).toBeGreaterThan(10);
  });

  it('lists every doc-section of every page, in order', () => {
    const actual: Record<string, { name: string; anchor: string }[]> = {};
    for (const { route, page } of routes) {
      const s = sectionsIn(page);
      if (s.length) actual[route] = s;
    }
    // On failure, regenerate doc-index.ts from this object.
    expect(DOC_SECTIONS).toEqual(actual);
  });

  it('gives each section on a page its own anchor', () => {
    for (const [route, list] of Object.entries(DOC_SECTIONS)) {
      const anchors = list.map((s) => s.anchor);
      expect(new Set(anchors).size, `duplicate anchor on /${route}`).toBe(anchors.length);
    }
  });
});
