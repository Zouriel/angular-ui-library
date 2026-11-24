import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A class a component puts on its own host ('[class.open]': ...) can only be matched from the
 * component's styles as :host(.open). Written as a plain ancestor (.open .panel), emulated
 * encapsulation scopes it to the component's content, so the rule silently never applies (this hid
 * ui-chat-widget's phone layout and its draggable launcher until 0.96.1).
 */
function componentFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : componentFiles(path);
    return name.endsWith('.ts') && !name.endsWith('.spec.ts') ? [path] : [];
  });
}

describe('host class selectors', () => {
  it('match a component\'s own host classes only through :host()', () => {
    const problems: string[] = [];
    let checked = 0;
    for (const file of componentFiles(join(process.cwd(), 'projects/ui'))) {
      const source = readFileSync(file, 'utf8');
      const hostBlock = /host:\s*\{([\s\S]*?)\n\s*\},/.exec(source)?.[1] ?? '';
      const hostClasses = [...hostBlock.matchAll(/'\[class\.([\w-]+)\]'/g)].map(([, name]) => name);
      const styles = /styles:\s*`([\s\S]*?)`/.exec(source)?.[1] ?? '';
      if (hostClasses.length === 0 || styles === '') continue;
      checked++;
      for (const name of hostClasses) {
        const plain = new RegExp(`(^|[\\s,{}])\\.${name}(?=[\\s.:\\[>+~])(?![\\w-])`, 'm');
        for (const line of styles.split('\n')) {
          if (plain.test(line.replace(/:host\([^)]*\)/g, '').replace(/:host-context\([^)]*\)/g, ''))) {
            problems.push(`${file.replace(process.cwd() + '/', '')}: "${line.trim()}" uses host class .${name} without :host()`);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(10);
    expect(problems).toEqual([]);
  });
});
