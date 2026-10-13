import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FbBuilderStore } from './builder-store';
import { createDefinition, createField, createGroup, indexDefinition } from './definition';
import { UiFormBuilder } from './form-builder';
import { UiFormRenderer } from './form-renderer';
import type { UiFbElement, UiFbField, UiFbGroup, UiFormDefinition, UiFormSubmission } from './schema';

const f = (id: string, type: UiFbField['type'], extra: Partial<UiFbField> = {}): UiFbField => ({ kind: 'field', id, type, key: id, label: id.toUpperCase(), ...extra });
const form = (elements: UiFbElement[], extra: Partial<UiFormDefinition> = {}): UiFormDefinition => ({ schemaVersion: 1, id: 'f', title: 'Test form', pages: [{ id: 'p1', elements }], ...extra });

function store(def?: UiFormDefinition) {
  TestBed.configureTestingModule({ providers: [FbBuilderStore] });
  const s = TestBed.inject(FbBuilderStore);
  if (def) s.load(def);
  return s;
}

describe('FbBuilderStore', () => {
  it('adds right after the selection and selects the new field', () => {
    const s = store(form([f('a', 'text'), f('b', 'text')]));
    s.select('a');
    const n = createField('email', s.def());
    s.add(n);
    expect(s.def().pages[0].elements.map((e) => e.id)).toEqual(['a', n.id, 'b']);
    expect(s.selectedId()).toBe(n.id);
  });

  it('adds into a selected section', () => {
    const g: UiFbGroup = { kind: 'group', id: 'g', elements: [] };
    const s = store(form([g]));
    s.select('g');
    s.add(createField('text', s.def()));
    expect((s.def().pages[0].elements[0] as UiFbGroup).elements.length).toBe(1);
  });

  it('undoes and redoes, and treats quick typing in one box as one step', () => {
    const s = store(form([f('a', 'text')]));
    s.updateField('a', { label: 'N' }, 'label:a');
    s.updateField('a', { label: 'Na' }, 'label:a');
    s.updateField('a', { label: 'Name' }, 'label:a');
    s.updateField('a', { help: 'Your name' });
    s.undo();
    expect(s.field('a')!.help).toBeUndefined();
    expect(s.field('a')!.label).toBe('Name');
    s.undo();
    expect(s.field('a')!.label).toBe('A');
    s.redo();
    expect(s.field('a')!.label).toBe('Name');
    expect(s.canRedo()).toBe(true);
  });

  it('moves out of a section when nudged past its edge', () => {
    const g: UiFbGroup = { kind: 'group', id: 'g', elements: [f('in', 'text')] };
    const s = store(form([f('a', 'text'), g]));
    s.nudge('in', -1);
    expect(s.def().pages[0].elements.map((e) => e.id)).toEqual(['a', 'in', 'g']);
  });

  it('deletes rules that mentioned a deleted question', () => {
    const s = store(form([f('a', 'toggle'), f('b', 'text', { visibility: { action: 'show', when: { ref: 'a', op: 'isTrue' } } })]));
    expect(s.externalRefs('a').length).toBe(1);
    s.remove('a');
    expect(s.field('b')!.visibility).toBeUndefined();
    expect(s.problems().filter((p) => p.severity === 'error')).toEqual([]);
  });

  it('only protects answers once the published form has some', () => {
    const def = form([f('a', 'text')]);
    const s = store(def);
    s.published.set(def);
    expect(s.hasAnswers('a')).toBe(false);
    s.submissionCount.set(3);
    expect(s.hasAnswers('a')).toBe(true);
    s.add(createField('text', s.def()));
    expect(s.hasAnswers(s.selectedId()!)).toBe(false);
  });

  it('offers rules only what they can sensibly ask about', () => {
    const rep: UiFbGroup = { kind: 'group', id: 'r', key: 'r', repeat: {}, elements: [f('qty', 'number'), f('price', 'number')] };
    const s = store(form([f('a', 'text'), rep]));
    // Outside the repeat: other top-level fields and the section itself, not fields inside it.
    expect(s.refOptions('a').map((o) => o.id)).toEqual(['r']);
    // Inside an entry: its siblings (same entry) and outside fields.
    expect(s.refOptions('qty').map((o) => o.id).sort()).toEqual(['a', 'price']);
  });

  it('titles the first page when a second one is added', () => {
    const s = store(createDefinition());
    s.addPage();
    expect(s.def().pages.map((p) => p.title)).toEqual(['Page 1', 'Page 2']);
  });
});

// ── Renderer in the DOM ───────────────────────────────────────────────────

@Component({
  imports: [UiFormRenderer],
  template: `<ui-form-renderer [definition]="def()" [data]="data()" [mode]="mode()" (submitted)="got.push($event)" />`,
})
class RendererHost {
  def = signal<UiFormDefinition>(form([]));
  data = signal<Record<string, unknown> | null>(null);
  mode = signal<'create' | 'edit' | 'view' | null>(null);
  got: UiFormSubmission[] = [];
}

async function renderForm(def: UiFormDefinition, data: Record<string, unknown> | null = null, mode: 'create' | 'edit' | 'view' | null = null) {
  const fx = TestBed.createComponent(RendererHost);
  fx.componentInstance.def.set(def);
  fx.componentInstance.data.set(data);
  fx.componentInstance.mode.set(mode);
  fx.detectChanges();
  await fx.whenStable();
  fx.detectChanges();
  const el = fx.nativeElement as HTMLElement;
  return { fx, el, host: fx.componentInstance };
}

describe('UiFormRenderer', () => {
  it('ties each label to its input, and help text to the input too', async () => {
    const { el } = await renderForm(form([f('name', 'text', { label: 'Full name', help: 'As on your passport' })]));
    const label = el.querySelector('label.ui-fbf-label') as HTMLLabelElement;
    const input = el.querySelector('input.ui-input') as HTMLInputElement;
    expect(label.htmlFor).toBe(input.id);
    expect(input.getAttribute('aria-describedby')).toBe(el.querySelector('.ui-fbf-help')!.id);
  });

  it('on submit, lists every problem at the top, marks the fields, and emits nothing', async () => {
    const { fx, el, host } = await renderForm(form([f('a', 'text', { required: true }), f('b', 'email', { required: true })]));
    (el.querySelector('button[type=submit]') as HTMLButtonElement).click();
    fx.detectChanges();
    await fx.whenStable();
    const items = Array.from(el.querySelectorAll('.ui-fr-summary li')).map((li) => li.textContent!.trim());
    expect(items).toEqual(['A is required.', 'B is required.']);
    expect(el.querySelectorAll('[aria-invalid=true]').length).toBe(2);
    expect(host.got.length).toBe(0);
  });

  it('floats the label inside text boxes only, and keeps the error there when asked', async () => {
    const def = form([
      f('t', 'text', { required: true, layout: { labelPlacement: 'inside', errorPlacement: 'inside' } }),
      f('r', 'radio', { layout: { labelPlacement: 'inside' }, options: [{ id: 'o', value: 'x', label: 'X' }] }),
    ]);
    const { fx, el } = await renderForm(def);
    const [t, r] = Array.from(el.querySelectorAll('.ui-fbf')) as HTMLElement[];
    expect(t.dataset['label']).toBe('inside');
    expect(r.dataset['label']).toBe('top');
    (el.querySelector('button[type=submit]') as HTMLButtonElement).click();
    fx.detectChanges();
    expect(t.querySelector('.ui-fbf-err-in')?.textContent).toContain('T is required.');
    // The full message is still announced, just visually hidden.
    expect(t.querySelector('.ui-fbf-error')!.classList).toContain('sr-only');
  });

  it('shows saved answers as text in view mode, with option labels', async () => {
    const def = form([f('c', 'select', { options: [{ id: 'o1', value: 'mv', label: 'Maldives' }] }), f('n', 'text')]);
    const { el } = await renderForm(def, { c: 'mv', n: '' }, 'view');
    const values = Array.from(el.querySelectorAll('.ui-fbf-value')).map((v) => v.textContent!.trim());
    expect(values).toEqual(['Maldives', 'Not answered']);
    expect(el.querySelector('input, select, button[type=submit]')).toBeNull();
  });

  it('shows every page of a multi-step form in view mode, without steps, skipping pages that were skipped', async () => {
    const def: UiFormDefinition = {
      schemaVersion: 1, id: 'f', title: 'T',
      pages: [
        { id: 'p1', title: 'First', elements: [f('a', 'text')] },
        { id: 'p2', title: 'Skipped', visibility: { action: 'show', when: { ref: 'a', op: 'eq', value: { const: 'yes' } } }, elements: [f('b', 'text')] },
        { id: 'p3', title: 'Last', elements: [f('c', 'text')] },
      ],
    };
    const { el } = await renderForm(def, { a: 'no', c: 'done' }, 'view');
    expect(Array.from(el.querySelectorAll('.ui-fr-page-title')).map((h) => h.textContent!.trim())).toEqual(['First', 'Last']);
    expect(Array.from(el.querySelectorAll('.ui-fbf-value')).map((v) => v.textContent!.trim())).toEqual(['no', 'done']);
    expect(el.querySelector('.ui-fr-progress')).toBeNull();
  });

  it('adds and removes repeat entries within their limits', async () => {
    const rep: UiFbGroup = { kind: 'group', id: 'kids', key: 'kids', title: 'Children', repeat: { min: 1, max: 2, addLabel: 'Add a child', itemLabel: 'Child {n}' }, elements: [f('name', 'text')] };
    const { fx, el } = await renderForm(form([rep]));
    const entries = () => Array.from(el.querySelectorAll('.ui-fr-entry h4')).map((h) => h.textContent!.trim());
    expect(entries()).toEqual(['Child 1']);
    const add = () => Array.from(el.querySelectorAll('ui-button')).find((b) => b.textContent!.includes('Add a child'))!.querySelector('button')!;
    add().click();
    fx.detectChanges();
    expect(entries()).toEqual(['Child 1', 'Child 2']);
    expect(add().disabled).toBe(true);
    const inputs = () => Array.from(el.querySelectorAll<HTMLInputElement>('.ui-fr-entry input.ui-input'));
    inputs()[1].value = 'Zara';
    inputs()[1].dispatchEvent(new Event('input'));
    fx.detectChanges();
    (el.querySelector('[aria-label="Remove Child 2"]') as HTMLButtonElement).click();
    fx.detectChanges();
    expect(entries()).toEqual(['Child 1']);
    // A filled-in entry can be brought back, answers and all.
    expect(el.querySelector('.ui-fr-undo')!.textContent).toContain('Child 2 removed.');
    (el.querySelector('.ui-fr-undo button') as HTMLButtonElement).click();
    fx.detectChanges();
    await fx.whenStable();
    fx.detectChanges();
    expect(entries()).toEqual(['Child 1', 'Child 2']);
    expect(inputs()[1].value).toBe('Zara');
  });
});

// ── Builder shell ─────────────────────────────────────────────────────────

@Component({
  imports: [UiFormBuilder],
  template: `<div style="width: 1300px; height: 800px"><ui-form-builder [(definition)]="def" /></div>`,
})
class BuilderHost {
  def = signal<UiFormDefinition>(form([f('a', 'text', { label: 'First' }), f('b', 'text', { label: 'Second' })]));
}

describe('UiFormBuilder', () => {
  async function render() {
    const fx = TestBed.createComponent(BuilderHost);
    fx.detectChanges();
    await fx.whenStable();
    fx.detectChanges();
    const el = fx.nativeElement as HTMLElement;
    const card = (text: string) => Array.from(el.querySelectorAll<HTMLElement>('.card.field')).find((c) => c.textContent!.includes(text))!;
    return { fx, el, host: fx.componentInstance, card };
  }

  it('adds a field from the palette after the selected one and writes it back', async () => {
    const { fx, el, host, card } = await render();
    card('First').click();
    fx.detectChanges();
    const email = Array.from(el.querySelectorAll<HTMLButtonElement>('ui-fb-palette .item')).find((b) => b.textContent!.includes('Email'))!;
    email.click();
    fx.detectChanges();
    expect(host.def().pages[0].elements.map((e) => (e as UiFbField).label)).toEqual(['First', 'Email address', 'Second']);
    expect(el.querySelector('ui-fb-inspector .head-name')!.textContent).toBe('Email address');
  });

  it('deletes with the keyboard, then undoes from the toast', async () => {
    const { fx, el, host, card } = await render();
    const c = card('Second');
    c.click();
    fx.detectChanges();
    c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    fx.detectChanges();
    expect(host.def().pages[0].elements.length).toBe(1);
    expect(el.querySelector('.toast')!.textContent).toContain('Deleted “Second”');
    (el.querySelector('.toast .fb-link') as HTMLButtonElement).click();
    fx.detectChanges();
    expect(host.def().pages[0].elements.length).toBe(2);
  });

  it('loads a different form the host sets, and starts its history fresh', async () => {
    const { fx, el, host } = await render();
    host.def.set(form([f('z', 'number', { label: 'Only one' })], { title: 'Another' }));
    fx.detectChanges();
    expect(el.querySelector('.top .title')!.textContent!.trim()).toBe('Another');
    expect((el.querySelector('[aria-label="Undo"]') as HTMLButtonElement).disabled).toBe(true);
    expect(indexDefinition(host.def()).has('z')).toBe(true);
  });

  it('starts empty forms with a friendly way in', async () => {
    const { fx, el, host } = await render();
    host.def.set(createDefinition('Blank'));
    fx.detectChanges();
    expect(el.querySelector('.empty-title')!.textContent).toBe('Start your form');
    const section = Array.from(el.querySelectorAll<HTMLButtonElement>('.starter')).find((b) => b.textContent!.includes('Section'))!;
    section.click();
    fx.detectChanges();
    expect(host.def().pages[0].elements[0].kind).toBe('group');
    expect(createGroup().kind).toBe('group');
  });
});
