import { Component, DestroyRef, Injector, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import SparklesIcon from '@hugeicons/core-free-icons/SparklesIcon';
import { isEmptyValue } from './conditions';
import { UiFormEngine } from './engine';
import { UI_FORM_STRINGS } from './form-strings';
import { formatValue } from './format';
import { fbLocaleDir } from './localize';
import type { UiFbElement, UiFbGroup, UiFormDefinition } from './schema';

export interface UiFormSummaryRow {
  path: string;
  label: string;
  value: string;
  marked: boolean;
}

export interface UiFormSummarySection {
  title: string;
  rows: UiFormSummaryRow[];
}

/**
 * `ui-form-summary` — compact review card of a form's answered, visible fields in definition
 * order, keeping section headings and skipping fields hidden by conditions. Reuses `UiFormEngine`
 * and `formatValue` for condition evaluation, localization, and display formatting.
 *
 * Fields whose path is in `marked` get a small assistant marker and a legend at the bottom.
 * Project action buttons (e.g. Edit Answers / Confirm & Submit) into `[summary-footer]`.
 */
@Component({
  selector: 'ui-form-summary',
  imports: [HugeiconsIconComponent],
  host: {
    class: 'ui-form-summary',
    role: 'group',
    '[attr.aria-label]': 'title() || null',
    '[attr.dir]': 'dir()',
    '[attr.lang]': 'lang()',
  },
  template: `
    @if (showTitle() && (title() || subtitle())) {
      <header>
        @if (title()) {
          <h3>{{ title() }}</h3>
        }
        @if (subtitle()) {
          <p>{{ subtitle() }}</p>
        }
      </header>
    }
    <dl class="sum">
      @for (sec of sections(); track $index) {
        @if (sec.title) {
          <div class="sec">{{ sec.title }}</div>
        }
        @for (row of sec.rows; track row.path) {
          <div class="row">
            <dt>{{ row.label }}</dt>
            <dd>
              <span>{{ row.value }}</span>
              @if (row.marked) {
                <span class="ai" [attr.title]="markedLabel()" [attr.aria-label]="markedLabel()">
                  <hugeicons-icon aria-hidden="true" [icon]="sparkIcon" [size]="11" />
                </span>
              }
            </dd>
          </div>
        }
      }
    </dl>
    @if (hasMarked()) {
      <div class="legend">
        <span class="ai" aria-hidden="true">
          <hugeicons-icon [icon]="sparkIcon" [size]="11" />
        </span>
        <span>{{ markedLabel() }}</span>
      </div>
    }
    <footer class="footer"><ng-content select="[summary-footer]" /></footer>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-color-surface-raised);
      color: var(--ui-color-text);
      font-family: var(--ui-font-default);
      overflow: hidden;
    }
    header {
      padding: var(--ui-space-3) var(--ui-space-3) 10px;
      border-bottom: 1px solid var(--ui-color-border-subtle, var(--ui-color-border));
    }
    header h3 {
      margin: 0;
      font-size: var(--ui-font-size-md);
      line-height: 1.35;
    }
    header p {
      margin: 3px 0 0;
      font-size: var(--ui-font-size-sm);
      color: var(--ui-color-text-muted);
    }
    .sum {
      margin: 0;
      padding: 6px 14px 4px;
    }
    .sec {
      margin: var(--ui-space-2) 0 2px;
      font-size: 11.5px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--ui-color-text-muted);
    }
    .row {
      display: grid;
      grid-template-columns: 112px 1fr;
      gap: 10px;
      padding: 6px 0;
      border-bottom: 1px dashed var(--ui-color-border-subtle, var(--ui-color-border));
      font-size: var(--ui-font-size-sm);
    }
    .row:last-child {
      border-bottom: 0;
    }
    dt {
      color: var(--ui-color-text-secondary);
    }
    dd {
      margin: 0;
      min-width: 0;
      overflow-wrap: anywhere;
      display: flex;
      align-items: flex-start;
      gap: 6px;
      justify-content: space-between;
    }
    .ai {
      flex: none;
      display: inline-grid;
      place-items: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--ui-color-accent) 28%, transparent);
      color: var(--ui-color-text);
    }
    .legend {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: var(--ui-space-2) 14px;
      font-size: 12px;
      color: var(--ui-color-text-secondary);
      background: var(--ui-color-surface-subtle);
    }
    .footer:empty {
      display: none;
    }
    .footer {
      display: flex;
      gap: var(--ui-space-2);
      padding: 10px 14px var(--ui-space-3);
    }
  `,
})
export class UiFormSummary {
  private readonly injector = inject(Injector);
  private readonly providedStrings = inject(UI_FORM_STRINGS, { optional: true });

  readonly definition = input.required<UiFormDefinition>();
  readonly answers = input<Record<string, unknown>>({});
  readonly language = input<string | null>(null);
  readonly marked = input<readonly string[]>([]);
  readonly markedLabel = input('Filled in by the assistant');
  readonly subtitle = input('');
  readonly showTitle = input(true);

  protected readonly sparkIcon = SparklesIcon;

  private readonly engine = signal<UiFormEngine | null>(null);

  constructor() {
    effect(() => {
      const def = this.definition();
      const answers = this.answers();
      const lang = this.language();
      untracked(() => {
        this.engine()?.destroy();
        this.engine.set(
          new UiFormEngine({
            definition: def,
            values: answers,
            mode: 'view',
            locale: lang,
            strings: this.providedStrings,
            injector: this.injector,
          }),
        );
      });
    });
    inject(DestroyRef).onDestroy(() => this.engine()?.destroy());
  }

  protected readonly lang = computed(() => this.engine()?.locale() ?? 'en');
  protected readonly dir = computed(() => fbLocaleDir(this.definition(), this.lang()));
  protected readonly title = computed(() => this.engine()?.text(this.definition().title) ?? '');

  protected readonly sections = computed<UiFormSummarySection[]>(() => {
    const e = this.engine();
    if (!e) return [];
    const def = e.definition;
    const markedSet = new Set(this.marked());
    const out: UiFormSummarySection[] = [];
    let pendingTop: UiFormSummaryRow[] = [];

    const flush = (title: string, rows: UiFormSummaryRow[]) => {
      if (rows.length) out.push({ title, rows: [...rows] });
    };
    const flushTop = () => {
      if (pendingTop.length) {
        out.push({ title: '', rows: pendingTop });
        pendingTop = [];
      }
    };

    const collect = (elements: readonly UiFbElement[], row: string | null, bucket: UiFormSummaryRow[] | null) => {
      for (const el of elements) {
        if (el.kind === 'static') continue;
        if (el.kind === 'group') {
          const g = el as UiFbGroup;
          if (!bucket) flushTop();
          if (g.repeat) {
            for (const rowId of e.rows(g.id)) {
              if (!e.instanceState(g.id, rowId).visible) continue;
              const sub: UiFormSummaryRow[] = [];
              collect(g.elements, rowId, sub);
              flush(e.text(g.title), sub);
            }
          } else {
            if (!e.instanceState(g.id, row).visible) continue;
            const sub: UiFormSummaryRow[] = [];
            collect(g.elements, row, sub);
            flush(e.text(g.title), sub);
          }
          continue;
        }
        if (el.type === 'hidden') continue;
        const st = e.instanceState(el.id, row);
        if (!st.visible) continue;
        if (isEmptyValue(st.value)) continue;
        const display = formatValue(el, st.value, e.locale(), e.defaultLocale, e.strings());
        if (!display) continue;
        const path = e.valuePath(el.id, row);
        const isMarked = markedSet.has(path) || (!!el.key && markedSet.has(el.key));
        (bucket ?? pendingTop).push({
          path,
          label: e.text(el.label) || el.key || el.id,
          value: display,
          marked: isMarked,
        });
      }
    };

    for (const pageIdx of e.path()) {
      const page = def.pages[pageIdx];
      if (!page) continue;
      collect(page.elements, null, null);
    }
    flushTop();
    return out;
  });

  protected readonly hasMarked = computed(() => this.sections().some((s) => s.rows.some((r) => r.marked)));
}
