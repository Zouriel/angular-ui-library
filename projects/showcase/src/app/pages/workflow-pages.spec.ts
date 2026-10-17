import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * The workflow pages' live demos run against the playground server, which tests don't have, so these
 * checks read the pages' templates. They keep the demos from redrawing what must stay put (the tasks
 * drawer closed after every decision when a "rev" loop redrew it) and the docs from promising views
 * the library no longer has.
 */

const pages = join(process.cwd(), 'projects/showcase/src/app/pages');
const read = (f: string) => readFileSync(join(pages, f), 'utf8');

/** The bodies of every `@for (k of [rev()]; …) { … }` block (redrawn whenever rev changes). */
function revBlocks(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/@for \(k of \[rev\(\)\]; track k\) \{/g)) {
    let depth = 1;
    let i = m.index! + m[0].length;
    const start = i;
    for (; i < src.length && depth; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
    }
    out.push(src.slice(start, i - 1));
  }
  return out;
}

describe('workflow components page', () => {
  const src = read('workflow-components.page.ts');

  it('never redraws the tasks drawer or the panel on changes (the drawer would close; the panel reloads in place)', () => {
    expect(src).toContain('<ui-workflow-tasks-drawer');
    for (const block of revBlocks(src)) {
      expect(block).not.toContain('<ui-workflow-tasks-drawer');
      expect(block).not.toContain('<ui-workflow-panel');
    }
    expect(src).toContain('this.drawer()?.refresh()');
    expect(src).toContain('this.panel()?.reload()');
  });

  it('explains when "Show a stopped payment" can\'t use the picked application', () => {
    expect(src).toContain('already past approval');
  });

  it('promises no inbox, run or audit views the library no longer has as components', () => {
    expect(src).not.toMatch(/an inbox, run and audit views/);
    expect(read('workflow-builder.page.ts')).not.toMatch(/run and audit views/);
  });
});

describe('workflow builder page', () => {
  it('documents readOnly, (dirtyChange) and [wfActions]', () => {
    const src = read('workflow-builder.page.ts');
    for (const name of ["name: 'readOnly'", "name: '(dirtyChange)'", "name: '[wfActions]'"]) expect(src).toContain(name);
  });
});
