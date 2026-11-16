import { Component, Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createDefinition, diffDefinitions, fbSubmissionFields, lintDefinition, migrateDefinition } from './definition';
import { UiFormEngine } from './engine';
import { UiFormRenderer } from './form-renderer';
import type { UiFbSubmissionLink, UiFormDefinition, UiFormSubmission } from './schema';

const t = (en: string, dv: string) => ({ en, dv });

function bilingual(extra: Partial<UiFormDefinition> = {}): UiFormDefinition {
  return {
    schemaVersion: 2,
    id: 'bi',
    title: t('Application', 'ފޯމް'),
    description: t('Tell us about you', 'ތިބާގެ ބަޔާން'),
    defaultLocale: 'en',
    supportedLocales: [{ code: 'en' }, { code: 'dv' }],
    revision: 5,
    settings: { submitLabel: t('Send', 'ފޮނުވާ') },
    pages: [{
      id: 'p1',
      elements: [
        { kind: 'field', id: 'name', type: 'text', key: 'name', label: t('Full name', 'ފުރިހަމަ ނަން'), help: t('As on your ID', 'ކާޑުގައިވާ ގޮތަށް'), placeholder: t('Your name', 'ނަން'), required: true },
        { kind: 'field', id: 'city', type: 'select', key: 'city', label: t('City', 'ސިޓީ'), options: [{ id: 'o1', value: 'male', label: t('Malé', 'މާލެ') }, { id: 'o2', value: 'addu', label: 'Addu' }] },
        { kind: 'static', id: 'st', type: 'paragraph', text: t('Thank you', 'ޝުކުރިއްޔާ') },
      ],
    }],
    ...extra,
  };
}

function engine(d: UiFormDefinition, opts: { locale?: string; link?: UiFbSubmissionLink } = {}) {
  const e = new UiFormEngine({ definition: d, injector: TestBed.inject(Injector), ...opts });
  TestBed.tick();
  return e;
}

describe('migrateDefinition v1 to v2', () => {
  const v1 = { schemaVersion: 1, id: 'a', title: 'Old', pages: [{ id: 'p', title: 'One', elements: [{ kind: 'field', id: 'f', type: 'text', key: 'k', label: 'K', custom: 1 }] }], extra: { keep: true } };

  it('keeps plain strings, adds English and the version', () => {
    const d = migrateDefinition(v1);
    expect(d.schemaVersion).toBe(2);
    expect(d.title).toBe('Old');
    expect(d.pages[0].title).toBe('One');
    expect(d.defaultLocale).toBe('en');
    expect(d.supportedLocales).toEqual([{ code: 'en' }]);
    expect((d as unknown as Record<string, unknown>)['extra']).toEqual({ keep: true });
    expect((d.pages[0].elements[0] as unknown as Record<string, unknown>)['custom']).toBe(1);
  });

  it('is idempotent', () => {
    const once = migrateDefinition(v1);
    expect(migrateDefinition(once)).toEqual(once);
  });

  it('accepts plain language codes and adds the default language', () => {
    const d = migrateDefinition({ ...v1, defaultLocale: 'dv', supportedLocales: ['en'] });
    expect(d.supportedLocales).toEqual([{ code: 'dv' }, { code: 'en' }]);
  });

  it('new forms start with English', () => {
    const d = createDefinition();
    expect(d.schemaVersion).toBe(2);
    expect(d.defaultLocale).toBe('en');
    expect(d.supportedLocales).toEqual([{ code: 'en' }]);
  });
});

describe('UiFormEngine languages', () => {
  it('words labels, messages and repeat entries in the active language and falls back to the default', () => {
    const e = engine(bilingual());
    expect(e.locale()).toBe('en');
    expect(e.dir()).toBe('ltr');
    expect(e.text(t('A', 'B'))).toBe('A');
    expect(e.instanceState('name', null).errors).toEqual(['Full name is required.']);
    e.setLocale('dv');
    expect(e.locale()).toBe('dv');
    expect(e.dir()).toBe('rtl');
    expect(e.text(t('A', 'B'))).toBe('B');
    expect(e.instanceState('name', null).errors).toEqual(['ފުރިހަމަ ނަން is required.']);
    e.setLocale('xx');
    expect(e.locale()).toBe('en');
    expect(e.text({ fr: 'Seulement' })).toBe('Seulement');
  });

  it('keeps answers when the language changes', () => {
    const e = engine(bilingual());
    e.setValue('name', null, 'Aisha');
    e.setLocale('dv');
    expect(e.data()['name']).toBe('Aisha');
    expect(e.instanceState('name', null).errors).toEqual([]);
  });

  it('submits the language, the field descriptions and the link', () => {
    const e = engine(bilingual(), { locale: 'dv', link: { workflowId: 'wf', serviceCode: 'S1' } });
    e.setValue('name', null, 'Aisha');
    const s = e.submit()!;
    expect(s).toMatchObject({ formId: 'bi', revision: 5, locale: 'dv', workflowId: 'wf', serviceCode: 'S1' });
    expect(s.fields).toEqual([
      { path: 'name', key: 'name', label: 'ފުރިހަމަ ނަން', type: 'text' },
      { path: 'city', key: 'city', label: 'ސިޓީ', type: 'select' },
    ]);
  });

  it('leaves the link keys out when there is no link', () => {
    const e = engine(bilingual());
    e.setValue('name', null, 'x');
    const s = e.submit()!;
    expect('workflowId' in s).toBe(false);
    expect('serviceCode' in s).toBe(false);
    expect(s.locale).toBe('en');
    e.setLink({ workflowId: 'w' });
    const s2 = e.submit()!;
    expect(s2.workflowId).toBe('w');
    expect('serviceCode' in s2).toBe(false);
  });
});

describe('form language tools', () => {
  it('lists data paths with [] for repeating sections', () => {
    const d = bilingual();
    d.pages[0].elements.push({ kind: 'group', id: 'g', key: 'kids', repeat: {}, elements: [{ kind: 'field', id: 'age', type: 'number', key: 'age', label: t('Age', 'އުމުރު') }] });
    expect(fbSubmissionFields(d, 'dv').pop()).toEqual({ path: 'kids[].age', key: 'age', label: 'އުމުރު', type: 'number' });
  });

  it('warns once per element and language about missing translations, skipping archived ones', () => {
    const d = bilingual();
    d.pages[0].elements.push({ kind: 'field', id: 'gone', type: 'text', key: 'gone', label: 'Old', archived: true });
    const w = lintDefinition(d).filter((p) => p.message.includes('translation'));
    expect(w.map((p) => p.targetId)).toEqual(['city']);
    expect(w[0].message).toContain('(dv)');
    expect(w[0].message).toContain('option 2');
  });

  it('notes added and removed languages and changed wording when comparing versions', () => {
    const before = bilingual();
    const after = structuredClone(before);
    after.supportedLocales = [{ code: 'en' }];
    (after.pages[0].elements[0] as { label: unknown }).label = t('Full name', 'ނަން');
    const diff = diffDefinitions(before, after);
    expect(diff.localesRemoved).toEqual(['dv']);
    expect(diff.textChanged).toEqual(['name']);
    expect(diff.summary.some((l) => l.includes('Removed the language'))).toBe(true);
    const back = diffDefinitions(after, before);
    expect(back.localesAdded).toEqual(['dv']);
  });
});

@Component({
  imports: [UiFormRenderer],
  template: `<ui-form-renderer [definition]="def()" [locale]="locale()" [link]="link()" (submitted)="got.push($event)" />`,
})
class Host {
  def = signal<UiFormDefinition>(bilingual());
  locale = signal<string | null>(null);
  link = signal<UiFbSubmissionLink | null>(null);
  got: UiFormSubmission[] = [];
}

async function settle(fx: { detectChanges(): void; whenStable(): Promise<unknown> }) {
  fx.detectChanges();
  await fx.whenStable();
  fx.detectChanges();
}

describe('UiFormRenderer languages', () => {
  it('switches words and direction without losing answers', async () => {
    const fx = TestBed.createComponent(Host);
    await settle(fx);
    const el = fx.nativeElement as HTMLElement;
    const host = el.querySelector('ui-form-renderer') as HTMLElement;
    const text = () => el.textContent ?? '';
    expect(host.getAttribute('dir')).toBe('ltr');
    expect(host.getAttribute('lang')).toBe('en');
    expect(text()).toContain('Full name');
    expect(text()).toContain('Thank you');
    const input = el.querySelector('input.ui-input') as HTMLInputElement;
    expect(input.placeholder).toBe('Your name');
    input.value = 'Aisha';
    input.dispatchEvent(new Event('input'));
    await settle(fx);

    fx.componentInstance.locale.set('dv');
    await settle(fx);
    expect(host.getAttribute('dir')).toBe('rtl');
    expect(host.getAttribute('lang')).toBe('dv');
    expect(text()).toContain('ފުރިހަމަ ނަން');
    expect(text()).toContain('ޝުކުރިއްޔާ');
    expect(text()).not.toContain('Thank you');
    expect(text()).toContain('ފޮނުވާ');
    expect((el.querySelector('input.ui-input') as HTMLInputElement).value).toBe('Aisha');
    expect((el.querySelector('input.ui-input') as HTMLInputElement).placeholder).toBe('ނަން');

    fx.componentInstance.locale.set(null);
    await settle(fx);
    expect(host.getAttribute('dir')).toBe('ltr');
    expect(text()).toContain('Full name');
    expect((el.querySelector('input.ui-input') as HTMLInputElement).value).toBe('Aisha');
  });

  it('falls back to the default language for one it does not offer, and emits the language and link on submit', async () => {
    const fx = TestBed.createComponent(Host);
    fx.componentInstance.locale.set('fr');
    fx.componentInstance.link.set({ workflowId: 'wf', serviceCode: 'S' });
    await settle(fx);
    const el = fx.nativeElement as HTMLElement;
    expect(el.querySelector('ui-form-renderer')!.getAttribute('lang')).toBe('en');
    fx.componentInstance.locale.set('dv');
    await settle(fx);
    const input = el.querySelector('input.ui-input') as HTMLInputElement;
    input.value = 'Aisha';
    input.dispatchEvent(new Event('input'));
    await settle(fx);
    (el.querySelector('button[type=submit]') as HTMLButtonElement).click();
    await settle(fx);
    expect(fx.componentInstance.got.length).toBe(1);
    expect(fx.componentInstance.got[0]).toMatchObject({ locale: 'dv', workflowId: 'wf', serviceCode: 'S' });
    expect(fx.componentInstance.got[0].fields.map((f) => f.path)).toEqual(['name', 'city']);
  });
});
