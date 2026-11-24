import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { createDefinition } from './definition';
import type { UiFormDefinition } from './schema';
import { UiFormBuilder } from './form-builder';
import { UiFormSummary } from './form-summary';

function sampleDef(): UiFormDefinition {
  const def = createDefinition('Planning Application');
  def.title = { en: 'Planning Application', dv: 'ޕްލޭނިންގ އެޕްލިކޭޝަން' };
  def.supportedLocales = [{ code: 'en', label: 'English', dir: 'ltr' }, { code: 'dv', label: 'Dhivehi', dir: 'rtl' }];
  def.defaultLocale = 'en';
  def.pages = [
    {
      id: 'p1',
      title: 'Step 1',
      elements: [
        {
          id: 'sec1',
          kind: 'group',
          key: 'personal',
          title: { en: 'Personal details', dv: 'އަމިއްލަ މަޢުލޫމާތު' },
          elements: [
            { id: 'f_name', kind: 'field', type: 'text', key: 'full_name', label: { en: 'Full name', dv: 'ފުރިހަމަ ނަން' } },
            { id: 'f_empty', kind: 'field', type: 'text', key: 'nickname', label: 'Nickname' },
            { id: 'f_hidden_type', kind: 'field', type: 'hidden', key: 'secret', label: 'Secret' },
          ],
        },
        {
          id: 'f_has_exp',
          kind: 'field',
          type: 'toggle',
          key: 'has_exp',
          label: 'Has experience',
        },
        {
          id: 'f_years',
          kind: 'field',
          type: 'number',
          key: 'years',
          label: 'Years of experience',
          visibility: { action: 'show', when: { match: 'all', conditions: [{ ref: 'f_has_exp', op: 'isTrue' }] } },
        },
      ],
    },
  ];
  return def;
}

@Component({
  imports: [UiFormSummary],
  template: `
    <ui-form-summary
      [definition]="def()"
      [answers]="answers()"
      [language]="lang()"
      [marked]="marked()"
      subtitle="Ref 001"
    >
      <div summary-footer><button type="button" id="confirm-btn">Confirm &amp; Submit</button></div>
    </ui-form-summary>
  `,
})
class SummaryHost {
  readonly def = signal(sampleDef());
  readonly answers = signal<Record<string, unknown>>({
    personal: { full_name: 'Aishath Ali', secret: 'xyz' },
    has_exp: false,
    years: 5,
  });
  readonly lang = signal<string | null>('en');
  readonly marked = signal<string[]>(['personal.full_name']);
}

@Component({
  imports: [UiFormBuilder],
  template: `
    <ui-form-builder
      [(definition)]="def"
      [(agentInteractable)]="agent"
      [agentInteractableLabel]="label()"
      [agentInteractableHint]="hint()"
    />
  `,
})
class BuilderHost {
  readonly def = signal(createDefinition('Test Form'));
  readonly agent = signal(false);
  readonly label = signal('Available to the assistant');
  readonly hint = signal('Lets the AI assistant read this form and fill it in field by field for a signed-in person, who confirms before it is submitted.');
}

describe('ui-form-summary', () => {
  it('shows answered visible fields in order, keeps section headings, skips hidden/unanswered, and marks assistant fields', () => {
    const f = TestBed.createComponent(SummaryHost);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;

    expect(el.querySelector('header h3')!.textContent).toBe('Planning Application');
    expect(el.querySelector('header p')!.textContent).toBe('Ref 001');
    expect(el.querySelector('.sec')!.textContent).toBe('Personal details');

    const rows = Array.from(el.querySelectorAll('.row'));
    // Full name + Has experience (nickname is empty, secret is hidden type, years is hidden by visibleWhen)
    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('dt')!.textContent).toBe('Full name');
    expect(rows[0].querySelector('dd span')!.textContent).toBe('Aishath Ali');
    expect(rows[0].querySelector('.ai')).toBeTruthy();

    expect(rows[1].querySelector('dt')!.textContent).toBe('Has experience');
    expect(rows[1].querySelector('dd span')!.textContent).toBe('No');
    expect(rows[1].querySelector('.ai')).toBeNull();

    expect(el.querySelector('.legend')!.textContent).toContain('Filled in by the assistant');
    expect(el.querySelector('#confirm-btn')).toBeTruthy();

    // Flipping has_exp to true reveals Years of experience
    f.componentInstance.answers.set({
      personal: { full_name: 'Aishath Ali' },
      has_exp: true,
      years: 5,
    });
    f.detectChanges();
    const rows2 = Array.from(el.querySelectorAll('.row'));
    expect(rows2.length).toBe(3);
    expect(rows2[2].querySelector('dt')!.textContent).toBe('Years of experience');
    expect(rows2[2].querySelector('dd span')!.textContent).toBe('5');
  });

  it('switches language and direction for Dhivehi', () => {
    const f = TestBed.createComponent(SummaryHost);
    f.componentInstance.lang.set('dv');
    f.detectChanges();
    const host = (f.nativeElement as HTMLElement).querySelector('ui-form-summary')!;
    expect(host.getAttribute('dir')).toBe('rtl');
    expect(host.querySelector('header h3')!.textContent).toBe('ޕްލޭނިންގ އެޕްލިކޭޝަން');
    expect(host.querySelector('.sec')!.textContent).toBe('އަމިއްލަ މަޢުލޫމާތު');
  });
});

describe('ui-form-builder agentInteractable', () => {
  it('shows the switch in form settings, syncs two-way, and does not store it in definition JSON', () => {
    const f = TestBed.createComponent(BuilderHost);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Available to the assistant');
    expect(el.textContent).toContain('Lets the AI assistant read this form');

    const sw = Array.from(el.querySelectorAll('ui-switch')).find((s) =>
      s.textContent?.includes('Available to the assistant'),
    )!;
    const toggle = sw.querySelector('button[role="switch"], input[type="checkbox"]') as HTMLElement;
    expect(toggle).toBeTruthy();
    toggle.click();
    f.detectChanges();

    expect(f.componentInstance.agent()).toBe(true);
    expect((f.componentInstance.def() as unknown as Record<string, unknown>)['agentInteractable']).toBeUndefined();
  });
});
