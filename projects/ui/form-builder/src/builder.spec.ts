import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FbBuilderStore } from './builder-store';
import { FbCanvas } from './builder-canvas';
import { FbDnd } from './builder-dnd';
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
  it('lets a section key follow its title until it is renamed by hand', () => {
    const g = { ...createGroup(undefined, true), id: 'g' };
    const s = store(form([f('a', 'text'), g]));
    expect(g.key).toBe('items');
    s.setGroupTitle('g', 'Dependants');
    const key = () => (s.def().pages[0].elements[1] as UiFbGroup).key;
    expect(key()).toBe('dependants');
    s.setGroupTitle('g', 'Children');
    expect(key()).toBe('children');
    s.updateGroup('g', { key: 'kids' });
    s.setGroupTitle('g', 'Young people');
    expect(key()).toBe('kids');
  });

  it('keeps a section without a key keyless when it is retitled', () => {
    const s = store(form([{ ...createGroup(), id: 'g' }]));
    s.setGroupTitle('g', 'Contact details');
    expect((s.def().pages[0].elements[0] as UiFbGroup).key).toBeUndefined();
  });

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

  it('keeps history when the host hands back the same form with a new revision (publishing)', () => {
    const s = store(form([f('a', 'text')]));
    s.updateField('a', { label: 'Name' });
    expect(s.canUndo()).toBe(true);
    // The host publishes: a new object, revision bumped, content as the builder has it.
    s.load({ ...s.def(), revision: 3 });
    expect(s.canUndo()).toBe(true);
    expect(s.def().revision).toBe(3);
    // A copy that went through JSON (undefined keys dropped) is still the same form.
    s.load(JSON.parse(JSON.stringify({ ...s.def(), revision: 4 })));
    expect(s.canUndo()).toBe(true);
    // Undo steps back through content; the revision the host gave stays.
    s.undo();
    expect(s.field('a')!.label).toBe('A');
    expect(s.def().revision).toBe(4);
    s.redo();
    expect(s.field('a')!.label).toBe('Name');
    expect(s.def().revision).toBe(4);
  });

  it('clears history for another form, for other content, or when asked', () => {
    const s = store(form([f('a', 'text')]));
    s.updateField('a', { label: 'Name' });
    s.load(form([f('a', 'text', { label: 'Name' })], { id: 'other' }));
    expect(s.canUndo()).toBe(false);
    s.updateField('a', { label: 'Again' });
    s.load(form([f('a', 'text', { label: 'Changed elsewhere' })], { id: 'other' }));
    expect(s.canUndo()).toBe(false);
    s.updateField('a', { label: 'Once more' });
    s.clearHistory();
    expect(s.canUndo()).toBe(false);
    expect(s.canRedo()).toBe(false);
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
  template: `<ui-form-renderer [definition]="def()" [values]="values()" [mode]="mode()" [locale]="locale()" [presentation]="presentation()" (presentationChange)="presentation.set($event)" (submitted)="got.push($event)" />`,
})
class RendererHost {
  def = signal<UiFormDefinition>(form([]));
  values = signal<Record<string, unknown> | null>(null);
  mode = signal<'create' | 'edit' | 'view' | null>(null);
  locale = signal<string | null>(null);
  presentation = signal<'page' | 'one-question'>('page');
  got: UiFormSubmission[] = [];
}

async function renderForm(def: UiFormDefinition, values: Record<string, unknown> | null = null, mode: 'create' | 'edit' | 'view' | null = null) {
  const fx = TestBed.createComponent(RendererHost);
  fx.componentInstance.def.set(def);
  fx.componentInstance.values.set(values);
  fx.componentInstance.mode.set(mode);
  fx.detectChanges();
  await fx.whenStable();
  fx.detectChanges();
  const el = fx.nativeElement as HTMLElement;
  return { fx, el, host: fx.componentInstance };
}

describe('UiFormRenderer', () => {
  it('keeps the existing page presentation by default', async () => {
    const { el } = await renderForm(form([f('a', 'text'), f('b', 'text')]));
    expect(el.querySelector('.ui-fr-question')).toBeNull();
    expect(el.querySelectorAll('.ui-fbf').length).toBe(2);
  });

  it('steps one question at a time, blocks invalid Next, reviews, and submits the same payload', async () => {
    const def = form([f('a', 'text', { required: true }), f('b', 'number')]);
    const { fx, el, host } = await renderForm(def);
    host.presentation.set('one-question');
    fx.detectChanges();
    expect(el.querySelector('.ui-fr-step')!.textContent).toContain('Question 1 of 2');
    (el.querySelector('button[type=submit]') as HTMLButtonElement).click();
    fx.detectChanges();
    expect(el.querySelector('[aria-invalid="true"]')).not.toBeNull();
    expect(el.querySelector('.ui-fr-step')!.textContent).toContain('Question 1 of 2');
    const input = el.querySelector<HTMLInputElement>('input.ui-input')!;
    input.value = 'ok';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fx.detectChanges();
    (el.querySelector('button[type=submit]') as HTMLButtonElement).click();
    await fx.whenStable();
    fx.detectChanges();
    expect(el.querySelector('.ui-fr-step')!.textContent).toContain('Question 2 of 2');
    expect(el.querySelector('.ui-fr-live')!.textContent).toContain('Question 2 of 2');
    expect(document.activeElement).toBe(el.querySelector('.ui-fr-question-title'));
    (el.querySelector('button[type=submit]') as HTMLButtonElement).click();
    fx.detectChanges();
    expect(el.querySelector('.ui-fr-review')).not.toBeNull();
    (el.querySelector('button[type=submit]') as HTMLButtonElement).click();
    expect(host.got).toHaveLength(1);
    expect(host.got[0].values).toEqual({ a: 'ok', b: null });
  });

  it('skips hidden questions and keeps answers when the presentation changes', async () => {
    const def = form([
      f('show', 'text'),
      f('hidden', 'text', { visibility: { action: 'show', when: { ref: 'show', op: 'eq', value: { const: 'yes' } } } }),
      f('last', 'text'),
    ]);
    const { fx, el, host } = await renderForm(def);
    host.presentation.set('one-question');
    fx.detectChanges();
    expect(el.querySelector('.ui-fr-step')!.textContent).toContain('Question 1 of 2');
    const first = el.querySelector<HTMLInputElement>('input.ui-input')!;
    first.value = 'yes';
    first.dispatchEvent(new Event('input', { bubbles: true }));
    fx.detectChanges();
    expect(el.querySelector('.ui-fr-step')!.textContent).toContain('Question 1 of 3');
    expect(el.querySelector<HTMLInputElement>('input.ui-input')!.value).toBe('yes');
    host.presentation.set('page');
    fx.detectChanges();
    await fx.whenStable();
    fx.detectChanges();
    expect(el.querySelector<HTMLInputElement>('input.ui-input')!.value).toBe('yes');
    host.presentation.set('one-question');
    fx.detectChanges();
    expect(el.querySelector('.ui-fr-question')).not.toBeNull();
  });

  it('offers read-aloud in English and hides it for Dhivehi', async () => {
    const { fx, el, host } = await renderForm(form([f('a', 'text')], { supportedLocales: [{ code: 'en' }, { code: 'dv' }] }));
    host.presentation.set('one-question');
    fx.detectChanges();
    expect(el.querySelector('.ui-fr-read')).not.toBeNull();
    expect(el.querySelector('ui-form-renderer')!.getAttribute('lang')).toBe('en');
    host.locale.set('dv');
    fx.detectChanges();
    expect(el.querySelector('.ui-fr-read')).toBeNull();
  });
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

  it('a page reached with Continue starts clean: its problems wait for blur or for its own Continue', async () => {
    const def: UiFormDefinition = {
      schemaVersion: 1, id: 'f', title: 'T', settings: { validateOn: 'blur' },
      pages: [
        { id: 'p1', title: 'First', elements: [f('a', 'text', { required: true })] },
        { id: 'p2', title: 'Second', elements: [f('b', 'text', { required: true }), f('c', 'email', { required: true })] },
      ],
    };
    const { fx, el } = await renderForm(def);
    const input = el.querySelector<HTMLInputElement>('input')!;
    input.value = 'x';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fx.whenStable();
    fx.detectChanges();
    (el.querySelector('button[type=submit]') as HTMLButtonElement).click();
    await fx.whenStable();
    fx.detectChanges();
    expect(el.querySelector('.ui-fr-step')!.textContent).toContain('Second');
    expect(el.querySelector('.ui-fr-summary')).toBeNull();
    expect(el.querySelectorAll('[aria-invalid="true"]').length).toBe(0);
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
    (el.querySelector('.toast .act') as HTMLButtonElement).click();
    fx.detectChanges();
    expect(host.def().pages[0].elements.length).toBe(2);
  });

  it('takes the undo toast down when the view changes, so it never covers the buttons of another view', async () => {
    const { fx, el, card } = await render();
    const c = card('Second');
    c.click();
    fx.detectChanges();
    c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    fx.detectChanges();
    expect(el.querySelector('.toast')).not.toBeNull();
    const preview = Array.from(el.querySelectorAll<HTMLButtonElement>('.views button')).find((b) => b.textContent!.includes('Preview'))!;
    preview.click();
    fx.detectChanges();
    expect(el.querySelector('.toast')).toBeNull();
  });

  it('keeps every inspector control at the small size, and leaves icon spacing to ui-button', async () => {
    const { fx, el, card } = await render();
    card('First').click();
    fx.detectChanges();
    const insp = el.querySelector('ui-fb-inspector')!;
    const controls = Array.from(insp.querySelectorAll('ui-input .ui-input, ui-textarea .ui-textarea, ui-number-input .wrap, ui-switch .ui-switch'));
    expect(controls.length).toBeGreaterThan(3);
    for (const c of controls) expect(c.getAttribute('data-size')).toBe('sm');
    // ui-button spaces its icon itself; a margin on top makes the gap 12px instead of 8.
    const css = [...document.querySelectorAll('style')].map((x) => x.textContent ?? '').join('\n');
    expect(css).not.toMatch(/ui-button(\[[^\]]*\])?\s+hugeicons-icon(\[[^\]]*\])?\s*\{\s*margin/);
  });

  it('loads a different form the host sets, and starts its history fresh', async () => {
    const { fx, el, host } = await render();
    host.def.set(form([f('z', 'number', { label: 'Only one' })], { title: 'Another' }));
    fx.detectChanges();
    expect(el.querySelector('.top .title')!.textContent!.trim()).toBe('Another');
    expect((el.querySelector('[aria-label="Undo"]') as HTMLButtonElement).disabled).toBe(true);
    expect(indexDefinition(host.def()).has('z')).toBe(true);
  });

  it('keeps undo after the host stores a published copy back into [(definition)]', async () => {
    const { fx, el, host, card } = await render();
    const c = card('Second');
    c.click();
    fx.detectChanges();
    c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    fx.detectChanges();
    const undo = () => el.querySelector('[aria-label="Undo"]') as HTMLButtonElement;
    expect(undo().disabled).toBe(false);
    // Publish, the way the README shows it.
    host.def.set({ ...host.def(), revision: 1 });
    fx.detectChanges();
    await fx.whenStable();
    fx.detectChanges();
    expect(undo().disabled).toBe(false);
    undo().click();
    fx.detectChanges();
    expect(host.def().pages[0].elements.length).toBe(2);
    expect(host.def().revision).toBe(1);
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

// ── Canvas: tap selects, hold opens settings ──────────────────────────────

@Component({
  imports: [FbCanvas],
  providers: [FbBuilderStore, FbDnd],
  template: `<ui-fb-canvas (open)="opened.push($event)" (picked)="picked.push($event)" (deleteRequest)="deleted.push($event.id)" />`,
})
class CanvasHost {
  readonly store = inject(FbBuilderStore);
  opened: string[] = [];
  picked: (string | null)[] = [];
  deleted: string[] = [];
}

function press(target: HTMLElement, type: string, pointerType: string, x = 10, y = 10): void {
  const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
  Object.defineProperty(e, 'pointerType', { value: pointerType });
  Object.defineProperty(e, 'isPrimary', { value: true });
  target.dispatchEvent(e);
}

describe('FbCanvas', () => {
  afterEach(() => vi.useRealTimers());

  function render(def = form([f('a', 'text', { label: 'First' })])) {
    const fx = TestBed.createComponent(CanvasHost);
    fx.componentInstance.store.load(def);
    fx.detectChanges();
    const el = fx.nativeElement as HTMLElement;
    return { fx, el, host: fx.componentInstance, card: el.querySelector<HTMLElement>('.card.field')! };
  }

  it('a tap only selects a card, so its toolbar can be used', () => {
    const { fx, host, card, el } = render();
    card.click();
    fx.detectChanges();
    expect(host.picked).toEqual(['a']);
    expect(host.opened).toEqual([]);
    expect(el.querySelector('.tools')).not.toBeNull();
  });

  it('holding a card on a touch screen opens its settings, and the lift that follows is not a second tap', () => {
    vi.useFakeTimers();
    const { host, card } = render();
    press(card, 'pointerdown', 'touch');
    vi.advanceTimersByTime(300);
    expect(host.opened).toEqual([]);
    vi.advanceTimersByTime(200);
    expect(host.opened).toEqual(['a']);
    press(card, 'pointerup', 'touch');
    card.click();
    expect(host.picked).toEqual([]);
  });

  it('a finger that moves (a scroll) never opens settings', () => {
    vi.useFakeTimers();
    const { host, card } = render();
    press(card, 'pointerdown', 'touch', 10, 10);
    press(window as unknown as HTMLElement, 'pointermove', 'touch', 10, 40);
    vi.advanceTimersByTime(1000);
    expect(host.opened).toEqual([]);
  });

  it('opens settings from the toolbar, a double-click or Enter', () => {
    const { fx, host, card, el } = render();
    card.click();
    fx.detectChanges();
    (el.querySelector('.tools [aria-label^="Settings for"]') as HTMLButtonElement).click();
    card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(host.opened).toEqual(['a', 'a', 'a']);
  });

  it('a page can be deleted or moved from its menu', () => {
    const def = form([f('a', 'text')]);
    def.pages.push({ id: 'p2', title: 'Second', elements: [] });
    const { fx, host, el } = render(def);
    (el.querySelector('.page-more') as HTMLButtonElement).click();
    fx.detectChanges();
    const item = (label: string) => Array.from(document.querySelectorAll<HTMLButtonElement>('[role=menuitem]')).find((b) => b.textContent!.includes(label))!;
    expect(item('Move earlier').disabled).toBe(true);
    item('Delete page').click();
    expect(host.deleted).toEqual(['p1']);
  });
});

describe('FbCanvas target sizes', () => {
  it('gives the drag grip a 24x24 box', () => {
    const fx = TestBed.createComponent(CanvasHost);
    fx.componentInstance.store.load(form([f('a', 'text', { label: 'First' })]));
    fx.detectChanges();
    const grip = (fx.nativeElement as HTMLElement).querySelector('.grip') as HTMLElement;
    const cs = getComputedStyle(grip);
    expect(cs.width).toBe('24px');
    expect(cs.height).toBe('24px');
  });
});

describe('FbBuilderStore languages', () => {
  const bilingual = () => {
    const s = store(form([
      f('a', 'select', { label: { en: 'Island', dv: 'ރަށް' }, options: [{ id: 'o1', value: 'male', label: { en: 'Male', dv: 'މާލެ' } }] }),
      f('b', 'text', { label: 'Name' }),
    ], { title: { en: 'Survey', dv: 'ސާވޭ' } }));
    s.addLocale('dv');
    return s;
  };

  it('starts with one language and adds Dhivehi as right to left', () => {
    const s = store(form([f('a', 'text')]));
    expect(s.multilingual()).toBe(false);
    expect(s.editLocale()).toBe('en');
    expect(s.addLocale('dv')).toBe(true);
    expect(s.addLocale('dv')).toBe(false);
    expect(s.locales().map((l) => [l.code, l.dir])).toEqual([['en', 'ltr'], ['dv', 'rtl']]);
    expect(s.def().defaultLocale).toBe('en');
    s.undo();
    expect(s.multilingual()).toBe(false);
  });

  it('reads with no fallback for editors and with fallback for display', () => {
    const s = bilingual();
    const b = s.field('b')!;
    s.setEditLocale('dv');
    expect(s.editDir()).toBe('rtl');
    expect(s.text(b.label)).toBe('');
    expect(s.shown(b.label)).toBe('Name');
    expect(s.defaultText(b.label)).toBe('Name');
    expect(s.text(s.field('a')!.label)).toBe('ރަށް');
    s.setEditLocale('en');
    expect(s.defaultText(b.label)).toBe('');
  });

  it('editing another language writes that translation and leaves the default intact', () => {
    const s = bilingual();
    s.setEditLocale('dv');
    const b = s.field('b')!;
    s.updateField('b', { label: s.setText(b.label, 'ނަން') });
    expect(s.field('b')!.label).toEqual({ en: 'Name', dv: 'ނަން' });
    s.setEditLocale('en');
    s.updateField('b', { label: s.setText(s.field('b')!.label, 'Full name') });
    expect(s.field('b')!.label).toEqual({ en: 'Full name', dv: 'ނަން' });
    // Clearing a translation goes back to a plain string.
    s.setEditLocale('dv');
    s.updateField('b', { label: s.setText(s.field('b')!.label, '') });
    expect(s.field('b')!.label).toBe('Full name');
  });

  it('keeps a section key and a field key when only a translation changes', () => {
    const g = { ...createGroup(undefined, true), id: 'g', title: 'Dependants' };
    const s = store(form([g]));
    s.addLocale('dv');
    s.setGroupTitle('g', 'Dependants');
    const key = (s.index().get('g')!.element as UiFbGroup).key;
    s.setEditLocale('dv');
    s.setGroupTitle('g', 'ބެލެނިވެރިން');
    expect((s.index().get('g')!.element as UiFbGroup).key).toBe(key);
    expect((s.index().get('g')!.element as UiFbGroup).title).toEqual({ en: 'Dependants', dv: 'ބެލެނިވެރިން' });
  });

  it('removing a language drops its text everywhere and is one undo', () => {
    const s = bilingual();
    s.removeLocale('en');
    expect(s.locales().length).toBe(2);
    s.removeLocale('dv');
    const a = s.field('a')!;
    expect(a.label).toBe('Island');
    expect(a.options![0].label).toBe('Male');
    expect(s.def().title).toBe('Survey');
    expect(s.def().supportedLocales?.map((l) => l.code)).toEqual(['en']);
    s.undo();
    expect(s.field('a')!.label).toEqual({ en: 'Island', dv: 'ރަށް' });
  });

  it('falls back to the default language when the edit language is removed', () => {
    const s = bilingual();
    s.setEditLocale('dv');
    s.removeLocale('dv');
    expect(s.editLocale()).toBe('en');
  });

  it('changes the default language and a language direction', () => {
    const s = bilingual();
    s.setDefaultLocale('dv');
    expect(s.defaultLocale()).toBe('dv');
    expect(s.locales()[0].code).toBe('dv');
    s.setLocaleDir('en', 'rtl');
    expect(s.locales().find((l) => l.code === 'en')!.dir).toBe('rtl');
  });

  it('replaces the whole definition as one undoable edit', () => {
    const s = store(form([f('a', 'text')]));
    s.replace(form([f('z', 'text')]));
    expect(s.index().has('z')).toBe(true);
    s.undo();
    expect(s.index().has('a')).toBe(true);
    expect(s.canUndo()).toBe(false);
  });
});

describe('FbCanvas languages', () => {
  it('lays the canvas out right to left when editing Dhivehi', () => {
    const fx = TestBed.createComponent(CanvasHost);
    const s = fx.componentInstance.store;
    s.load(form([f('a', 'text', { label: { en: 'Name', dv: 'ނަން' } })]));
    s.addLocale('dv');
    fx.detectChanges();
    const paper = () => (fx.nativeElement as HTMLElement).querySelector('.paper') as HTMLElement;
    expect(paper().getAttribute('dir')).toBe('ltr');
    expect(paper().textContent).toContain('Name');
    s.setEditLocale('dv');
    fx.detectChanges();
    expect(paper().getAttribute('dir')).toBe('rtl');
    expect(paper().getAttribute('lang')).toBe('dv');
    expect(paper().textContent).toContain('ނަން');
  });
});
