/**
 * Runs the fixtures shared with the Flutter port (zouriel_ui, test/form_engine/fixtures) against
 * this engine. The same JSON files drive both suites, so a form built here renders and validates
 * identically there. This engine is the reference: when the two disagree, the Dart port is fixed.
 */
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describeCalc, evaluateCalc } from './calc';
import { conditionComplete, describeCondition, evaluateCondition } from './conditions';
import {
  createDefinition, diffDefinitions, externalReferences, fbKeyValid, fbSlug, findCycles, indexDefinition, lintDefinition,
  migrateDefinition, moveElement, referencesTo, removeReferences, renameKey, subtreeIds, uniqueKey,
} from './definition';
import { coerceValue, UiFormEngine, type UiFormMode } from './engine';
import { operatorsFor, typesCompatible } from './field-types';
import { formatValue } from './format';
import { sourcesFromSettings } from './global-settings';
import { fillPattern, httpOptionSource, originAllowed, originOf, readSourceReply, sourceUrl, type UiFbHttpSourceConfig } from './http-sources';
import { optionValueOf, sourceHasMore, toChoice } from './option-sources';
import type { UiFbElement, UiFbField, UiFbGroup, UiFbPage, UiFormDefinition } from './schema';
import { UI_FB_BUILTIN_VALIDATORS, validatorsFor } from './validators';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

const DIR = join(process.cwd(), 'projects/ui/form-builder/src/fixtures');
const load = (name: string): Json => JSON.parse(readFileSync(join(DIR, name), 'utf8'));
/** Drops `undefined` (missing in JSON) and copies, so results compare like the Dart side's JSON. */
const norm = (v: unknown): Json => (v === undefined ? null : JSON.parse(JSON.stringify(v)));

describe('shared fixtures', () => {
  it('are all present', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
    expect(files).toEqual([
      'calc.json', 'conditions.json', 'definition.json', 'describe.json', 'engine-rules.json', 'engine-scholarship.json',
      'http-sources.json', 'scholarship.answers.json', 'scholarship.definition.json', 'slug.json', 'values.json',
    ]);
  });
});

// ── Engine scenarios ────────────────────────────────────────────────────────────────────────

function runEngine(file: string): void {
  const fx = load(file);
  describe(`engine: ${file}`, () => {
    for (const c of fx.cases as Json[]) {
      it(c.name, async () => {
        const definition: UiFormDefinition = c.definition ?? (c.definitionFile ? load(c.definitionFile) : fx.definition ?? load(fx.definitionFile));
        const data = c.data ?? (c.dataFile ? load(c.dataFile) : undefined);
        const e = new UiFormEngine({ definition, data, mode: c.mode as UiFormMode | undefined, today: () => c.today, injector: TestBed.inject(Injector) });
        const tick = () => { TestBed.tick(); TestBed.tick(); };
        tick();
        const at = (addr: string): [string, string | null] => {
          const [id, n] = addr.split('@');
          if (n === undefined) return [id, null];
          const g = e.index.get(id)!.repeat!;
          return [id, e.rows(g.id)[Number(n)] ?? `missing-row-${n}`];
        };
        const name = (id: string, row: string | null) => {
          const g = e.index.get(id)?.repeat;
          return row && g ? `${id}@${e.rows(g.id).indexOf(row)}` : id;
        };
        c.steps.forEach((step: Json, i: number) => {
          const where = `${c.name} — step ${i + 1}`;
          if ('set' in step) { const [id, row] = at(step.set); e.setValue(id, row, step.value); }
          else if ('touch' in step) { const [id, row] = at(step.touch); e.markTouched(id, row); }
          else if ('addRow' in step) e.addRow(step.addRow);
          else if ('removeRow' in step) e.removeRow(step.removeRow, e.rows(step.removeRow)[step.index]);
          else if ('moveRow' in step) e.moveRow(step.moveRow, e.rows(step.moveRow)[step.index], step.delta);
          else if ('next' in step) expect(e.next(), `${where}: next`).toBe(step.next);
          else if ('back' in step) expect(e.back(), `${where}: back`).toBe(step.back);
          else if ('goTo' in step) e.goTo(step.goTo);
          else if ('submit' in step) {
            const s = e.submit();
            if (step.submit === false) expect(s, `${where}: submit`).toBeNull();
            else if (step.submit === true) expect(s, `${where}: submit`).not.toBeNull();
            else expect(norm({ formId: s?.formId, revision: s?.revision, data: s?.data }), `${where}: submit`).toEqual(step.submit);
          } else if ('expect' in step) checkEngine(step.expect, where);
          tick();
        });

        function checkEngine(x: Json, where: string): void {
          const per = (key: string, read: (id: string, row: string | null) => unknown) => {
            for (const [addr, want] of Object.entries(x[key] ?? {})) {
              const [id, row] = at(addr);
              expect(norm(read(id, row)), `${where}: ${key} of ${addr}`).toEqual(want);
            }
          };
          if ('mode' in x) expect(e.mode, `${where}: mode`).toBe(x.mode);
          if ('path' in x) expect(e.path(), `${where}: path`).toEqual(x.path);
          if ('pageIndex' in x) expect(e.pageIndex(), `${where}: pageIndex`).toBe(x.pageIndex);
          if ('step' in x) expect(e.step(), `${where}: step`).toBe(x.step);
          if ('isLastPage' in x) expect(e.isLastPage(), `${where}: isLastPage`).toBe(x.isLastPage);
          per('visible', (id, row) => e.instanceState(id, row).visible);
          per('disabled', (id, row) => e.instanceState(id, row).disabled);
          per('required', (id, row) => e.instanceState(id, row).required);
          per('pending', (id, row) => e.instanceState(id, row).pending);
          per('value', (id, row) => e.instanceState(id, row).value);
          per('raw', (id, row) => e.rawValue(id, row));
          per('errors', (id, row) => e.instanceState(id, row).errors);
          per('warnings', (id, row) => e.instanceState(id, row).warnings);
          per('errorsShown', (id, row) => e.errorsShown(id, row));
          per('display', (id, row) => formatValue(e.field(id)!, e.instanceState(id, row).value));
          per('dataPath', (id, row) => e.dataPath(id, row));
          per('instanceLabel', (id, row) => e.instanceLabel(id, row));
          per('sourceParams', (id, row) => {
            const out: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(e.field(id)?.source?.params ?? {})) out[k] = optionValueOf('ref' in v ? e.answerFor(v.ref, row) : v.const);
            return out;
          });
          for (const [g, n] of Object.entries(x.rows ?? {})) expect(e.rows(g).length, `${where}: rows of ${g}`).toBe(n);
          for (const [g, v] of Object.entries(x.canAddRow ?? {})) expect(e.canAddRow(g), `${where}: canAddRow ${g}`).toBe(v);
          for (const [g, v] of Object.entries(x.canRemoveRow ?? {})) expect(e.canRemoveRow(g), `${where}: canRemoveRow ${g}`).toBe(v);
          for (const [p, want] of Object.entries(x.pageErrors ?? {})) {
            const got = e.pageErrors(Number(p)).map((it) => ({ field: name(it.id, it.row), label: it.label, message: it.message }));
            expect(got, `${where}: pageErrors of page ${p}`).toEqual(want);
          }
          if ('data' in x) expect(norm(e.data()), `${where}: data`).toEqual(x.data);
          for (const [k, v] of Object.entries(x.dataHas ?? {})) expect(norm(e.data()[k]), `${where}: data.${k}`).toEqual(v);
          for (const k of x.dataLacks ?? []) expect(k in e.data(), `${where}: data lacks ${k}`).toBe(false);
          if ('dirty' in x) expect(e.dirty(), `${where}: dirty`).toBe(x.dirty);
          if ('changes' in x) expect(norm(e.changes()), `${where}: changes`).toEqual(x.changes);
        }
      });
    }
  });
}

runEngine('engine-scholarship.json');
runEngine('engine-rules.json');

// ── Rules, calculations and wording ─────────────────────────────────────────────────────────

describe('conditions.json', () => {
  const fx = load('conditions.json');
  for (const c of fx.cases as Json[]) {
    it(c.name, () => {
      const ctx = {
        value: (r: string) => c.values[r],
        visible: (r: string) => c.visible?.[r] ?? true,
        complete: (r: string) => c.complete?.[r] ?? true,
        rows: (r: string) => (c.rows && r in c.rows ? c.rows[r] : 0),
        today: () => fx.today,
      };
      expect(evaluateCondition(c.condition ?? undefined, ctx)).toBe(c.expected);
    });
  }
});

describe('calc.json', () => {
  const fx = load('calc.json');
  for (const c of fx.cases as Json[]) {
    it(c.name, () => {
      const ctx = { values: (r: string) => c.values[r] ?? [], rows: (r: string) => c.rows?.[r] ?? null, today: () => fx.today };
      expect(evaluateCalc(c.calc, ctx)).toEqual(c.expected);
    });
  }
});

describe('describe.json', () => {
  const fx = load('describe.json');
  const d = { name: (r: string) => fx.names[r] ?? r, value: (r: string, v: unknown) => fx.labels[r]?.[String(v)] ?? String(v) };
  it('describes conditions', () => {
    for (const c of fx.conditions) expect(describeCondition(c.condition ?? undefined, d)).toBe(c.expected);
  });
  it('knows when a condition is finished', () => {
    for (const c of fx.complete) expect(conditionComplete(c.condition), JSON.stringify(c.condition)).toBe(c.expected);
  });
  it('describes calculations', () => {
    for (const c of fx.calcs) expect(describeCalc(c.calc, (r) => fx.names[r] ?? r)).toBe(c.expected);
  });
});

describe('slug.json', () => {
  const fx = load('slug.json');
  it('makes keys from labels', () => {
    for (const c of fx.slugs) expect(fbSlug(c.label), c.label).toBe(c.expected);
  });
  it('checks keys', () => {
    for (const c of fx.keys) expect(fbKeyValid(c.key), c.key).toBe(c.expected);
  });
});

describe('values.json', () => {
  const fx = load('values.json');
  it('coerces answers to their field’s shape', () => {
    for (const c of fx.coerce) expect(norm(coerceValue(c.field, c.value)), `${c.field.type} ${JSON.stringify(c.value)}`).toEqual(c.expected);
  });
  it('reads saved choices', () => {
    for (const c of fx.choices) {
      expect(norm(optionValueOf(c.value)), JSON.stringify(c.value)).toEqual(c.optionValueOf);
      expect(norm(toChoice(c.value)), JSON.stringify(c.value)).toEqual(c.toChoice);
    }
  });
  it('knows when a source has more pages', () => {
    for (const c of fx.hasMore) expect(sourceHasMore(c.page, c.loaded, c.pageSize), JSON.stringify(c)).toBe(c.expected);
  });
  it('formats answers for people', () => {
    expect(Intl.NumberFormat().resolvedOptions().locale).toBe(fx.locale);
    for (const c of fx.format) expect(formatValue(c.field, c.value), `${c.field.type} ${JSON.stringify(c.value)}`).toBe(c.expected);
  });
});

// ── Definition helpers ──────────────────────────────────────────────────────────────────────

describe('definition.json', () => {
  const fx = load('definition.json');
  const defOf = (c: Json): UiFormDefinition => c.definition ?? load(c.definitionFile);

  it('lints', () => {
    for (const c of fx.lint) expect(lintDefinition(defOf(c)), c.name).toEqual(c.expected);
  });
  it('finds loops', () => {
    for (const c of fx.cycles) expect(findCycles(c.definition), c.name).toEqual(c.expected);
  });
  it('finds references', () => {
    const r = fx.references;
    for (const [id, want] of Object.entries(r.referencesTo)) expect(referencesTo(r.definition, id), id).toEqual(want);
    for (const [id, want] of Object.entries(r.externalReferences)) expect(externalReferences(r.definition, id), id).toEqual(want);
    for (const [id, want] of Object.entries(r.subtreeIds)) expect(subtreeIds(r.definition, id), id).toEqual(want);
  });
  it('removes references', () => {
    for (const c of fx.removeReferences) expect(norm(removeReferences(c.definition, c.ids)), c.name).toEqual(c.expected);
  });
  it('migrates', () => {
    for (const c of fx.migrate) expect(norm(migrateDefinition(c.raw)), JSON.stringify(c.raw)).toEqual(c.expected);
    for (const c of fx.migrateGenerated) {
      const d = migrateDefinition(c.raw);
      expect(d.pages.length).toBe(c.pages);
      expect(d.id).toBeTruthy();
      expect(d.pages.every((p) => !!p.id && Array.isArray(p.elements))).toBe(true);
      expect(d.schemaVersion).toBe(1);
    }
  });
  it('round-trips definitions unchanged', () => {
    for (const c of fx.roundtrip) expect(norm(migrateDefinition(defOf(c))), c.name).toEqual(defOf(c));
  });
  it('keeps keys unique per data scope', () => {
    for (const c of fx.uniqueKey) expect(uniqueKey(c.definition, c.base, c.id), `${c.base} ${c.id}`).toBe(c.expected);
  });
  it('remembers renamed keys', () => {
    for (const c of fx.renameKey) {
      let d: UiFormDefinition = c.definition;
      for (const [id, key] of c.steps) d = renameKey(d, id, key);
      const el = indexDefinition(d).get(c.id)!.element as UiFbField | UiFbGroup;
      expect(norm({ key: el.key, keyHistory: el.keyHistory }), JSON.stringify(c.steps)).toEqual(c.expected);
    }
  });
  it('moves elements', () => {
    for (const c of fx.move) {
      const out = moveElement(c.definition, c.id, c.target);
      if (c.unchanged) { expect(out, c.name).toBe(c.definition); continue; }
      const got: Record<string, string[]> = {};
      for (const [id, entry] of indexDefinition(out)) {
        const el = entry.element as UiFbPage | UiFbElement;
        if (!('kind' in el) || el.kind === 'group') got[id] = ('kind' in el ? (el as UiFbGroup).elements : (el as UiFbPage).elements).map((x) => x.id);
      }
      expect(got, c.name).toEqual(c.expected);
    }
  });
  it('summarises what changed between versions', () => {
    for (const c of fx.diff) expect(diffDefinitions(c.before, c.after)).toEqual(c.expected);
  });
  it('offers operators and checks that fit', () => {
    for (const [kind, ops] of Object.entries(fx.operatorsFor)) expect(operatorsFor(kind as any).map((o) => o.op), kind).toEqual(ops);
    for (const c of fx.validatorsFor) expect(validatorsFor({ type: c.type, props: c.format ? { format: c.format } : undefined }, UI_FB_BUILTIN_VALIDATORS).map((d) => d.type), c.type).toEqual(c.expected);
    for (const [a, b, want] of fx.typesCompatible) expect(typesCompatible(a, b), `${a} ${b}`).toBe(want);
  });
  it('starts new forms with the app’s defaults', () => {
    const c = fx.createDefinition;
    const d = createDefinition(c.title, c.defaults);
    expect(d.settings).toEqual(c.expectedSettings);
    expect(d.title).toBe(c.title);
    expect(d.pages.length).toBe(1);
  });
});

// ── Lists set up in settings ────────────────────────────────────────────────────────────────

describe('http-sources.json', () => {
  const fx = load('http-sources.json');
  const page = (p: Json) => ({ items: p.items.map((i: Json) => ({ value: i.value, label: i.label, description: i.description ?? null })), total: p.total ?? null, hasMore: p.hasMore ?? null });

  it('builds request addresses', () => {
    for (const c of fx.sourceUrl) expect(sourceUrl(c.config, c), c.config.url).toBe(c.expected);
  });
  it('reads replies, and explains a reply that does not match', () => {
    for (const c of fx.readSourceReply) {
      if (c.error) expect(() => readSourceReply(c.config, c.reply, c.pageSize), c.name).toThrow(c.error);
      else expect(page(readSourceReply(c.config, c.reply, c.pageSize)), c.name).toEqual(page(c.expected));
    }
  });
  it('fills label patterns', () => {
    for (const c of fx.fillPattern) expect(fillPattern(c.obj, c.pattern), c.pattern).toBe(c.expected);
  });
  it('only allows listed servers', () => {
    for (const c of fx.originAllowed) expect(originAllowed(c.url, c.allowed), c.url).toBe(c.expected);
    for (const c of fx.originOf) expect(originOf(c.url), c.url).toBe(c.expected);
  });
  it('searches through the app’s fetch hook, and refuses other servers', async () => {
    const s = fx.search;
    const seen: string[] = [];
    const src = httpOptionSource(s.config as UiFbHttpSourceConfig, { allowedOrigins: s.allowed, fetch: async (url) => { seen.push(url); return s.reply; } });
    const res = await src.search({ query: '', page: 1, pageSize: s.config.pageSize, params: {}, signal: new AbortController().signal });
    expect(res.items.map((i) => i.label)).toEqual(s.expectedLabels);
    expect(seen).toEqual(s.expectedUrls);
    const blocked = httpOptionSource({ ...s.config, url: s.blockedUrl }, { allowedOrigins: s.allowed, fetch: async () => s.reply });
    await expect(blocked.search({ query: '', page: 1, pageSize: 2, params: {}, signal: new AbortController().signal })).rejects.toThrow(s.blockedError);
  });
  it('turns global settings into sources', () => {
    expect(sourcesFromSettings(fx.globalSettings.settings).map((x) => x.type)).toEqual(fx.globalSettings.expectedTypes);
  });
});
