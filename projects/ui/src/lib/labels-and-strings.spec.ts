import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiButton } from '../../button/src/button';
import { UiSplitButton } from '../../button/src/split-button';
import { UiToggleButton } from '../../button/src/toggle-button';
import { UiSwitch } from '../../form/src/switch';
import { UiFileUpload } from '../../form/src/file-upload';
import { UiPagination } from '../../navigation/src/pagination';
import { UiRowActions } from '../../table/src/table';
import { UiFloatingPanel } from '../../layout/src/floating-panel';
// Components import the core as @zouriel/ui, so the token must come from there too.
import { provideUiStrings } from '@zouriel/ui';

@Component({
  imports: [UiButton, UiSplitButton, UiToggleButton, UiSwitch],
  template: `
    <ui-button id="b" [ariaLabel]="label()">View</ui-button>
    <ui-button id="s" aria-label="Static name">Go</ui-button>
    <ui-button id="n">Plain</ui-button>
    <ui-toggle-button id="t" ariaLabel="Bold">B</ui-toggle-button>
    <ui-split-button id="sp" ariaLabel="Save the draft">Save</ui-split-button>
    <ui-switch id="sw" ariaLabel="Show test data" />
  `,
})
class Labels {
  label = signal('View Dr Aminath');
}

describe('accessible names on wrapped controls', () => {
  it('puts ariaLabel (or a static aria-label) on the inner native control, never on the wrapper', () => {
    const f = TestBed.createComponent(Labels);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const inner = (id: string, sel: string) => el.querySelector(`#${id} ${sel}`)!;
    expect(inner('b', 'button').getAttribute('aria-label')).toBe('View Dr Aminath');
    expect(el.querySelector('#b')!.hasAttribute('aria-label')).toBe(false);
    expect(inner('s', 'button').getAttribute('aria-label')).toBe('Static name');
    expect(el.querySelector('#s')!.hasAttribute('aria-label')).toBe(false);
    expect(inner('n', 'button').hasAttribute('aria-label')).toBe(false);
    expect(inner('t', 'button').getAttribute('aria-label')).toBe('Bold');
    expect(inner('sp', 'button.main').getAttribute('aria-label')).toBe('Save the draft');
    expect(inner('sp', 'button.caret').getAttribute('aria-label')).toBe('More actions');
    expect(inner('sw', 'input[role=switch]').getAttribute('aria-label')).toBe('Show test data');
    expect(el.querySelector('#sw')!.hasAttribute('aria-label')).toBe(false);
    f.componentInstance.label.set('View Dr Hassan');
    f.detectChanges();
    expect(inner('b', 'button').getAttribute('aria-label')).toBe('View Dr Hassan');
  });
});

@Component({
  imports: [UiFileUpload, UiPagination],
  template: `
    <ui-file-upload id="d" />
    <ui-file-upload id="c" label="ފައިލް އަޕްލޯޑްކުރޭ" hint="" />
    <ui-pagination [page]="2" [total]="5" />
  `,
})
class Words {}

describe('built-in strings', () => {
  const text = (el: Element) => el.textContent!.replace(/\s+/g, ' ').trim();

  it('keeps the English defaults, and the upload label and hint can be replaced or hidden', () => {
    const f = TestBed.createComponent(Words);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(text(el.querySelector('#d .hint')!)).toBe('Click to upload or drag & drop');
    expect(text(el.querySelector('#c .hint')!)).toBe('ފައިލް އަޕްލޯޑްކުރޭ');
    expect(el.querySelector('ui-pagination button')!.getAttribute('aria-label')).toBe('Previous page');
  });

  it('takes an app language from provideUiStrings, keeping English for words not given', () => {
    TestBed.configureTestingModule({ providers: [provideUiStrings({ previousPage: 'ކުރީ ޞަފްޙާ', uploadLabel: 'އަޕްލޯޑް' })] });
    const f = TestBed.createComponent(Words);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('ui-pagination button')!.getAttribute('aria-label')).toBe('ކުރީ ޞަފްޙާ');
    expect([...el.querySelectorAll('ui-pagination button')].at(-1)!.getAttribute('aria-label')).toBe('Next page');
    expect(text(el.querySelector('#d .hint')!)).toBe('އަޕްލޯޑް or drag & drop');
  });
});

@Component({
  imports: [UiRowActions, UiFloatingPanel],
  template: `
    <ui-row-actions id="r"><button>View</button><button>Edit</button></ui-row-actions>
    <ui-row-actions id="rs" align="start"><button>View</button></ui-row-actions>
    <div style="position: relative"><ui-floating-panel id="p" ariaLabel="Nurse">Card</ui-floating-panel></div>
    <div style="position: relative"><ui-floating-panel id="q" placement="top">Card</ui-floating-panel></div>
  `,
})
class Layouts {}

describe('ui-row-actions and ui-floating-panel', () => {
  it('row actions: a wrapping flex row with a space-2 gap, at the end unless asked', () => {
    const f = TestBed.createComponent(Layouts);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const r = getComputedStyle(el.querySelector('#r')!);
    expect([r.display, r.flexWrap, r.gap, r.justifyContent]).toEqual(['flex', 'wrap', 'var(--ui-space-2)', 'flex-end']);
    expect(el.querySelector('#rs')!.getAttribute('data-align')).toBe('start');
  });

  it('floating panel: a named region when labelled, bottom by default, top when placed there', () => {
    const f = TestBed.createComponent(Layouts);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const p = el.querySelector('#p')!;
    expect(p.getAttribute('role')).toBe('region');
    expect(p.getAttribute('aria-label')).toBe('Nurse');
    expect(p.getAttribute('data-placement')).toBe('bottom');
    expect(el.querySelector('#q')!.hasAttribute('role')).toBe(false);
    expect(el.querySelector('#q')!.getAttribute('data-placement')).toBe('top');
  });
});
