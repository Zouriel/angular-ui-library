import { Component, computed, inject, output, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { FbBuilderStore } from './builder-store';
import { FB_SHARED_STYLES } from './builder-styles';
import { allElements } from './definition';
import type { UiFbElement, UiFbPage } from './schema';
import { FB_ICONS } from './builder-icons';

interface RuleLine {
  kind: string;
  text: string;
}

interface RuleEntry {
  id: string;
  name: string;
  where: string;
  lines: RuleLine[];
}

/**
 * `ui-fb-logic` — every rule in the form, in plain words, grouped by the
 * question or page it belongs to; plus anything that needs fixing.
 */
@Component({
  selector: 'ui-fb-logic',
  imports: [HugeiconsIconComponent],
  template: `
    <div class="wrap">
      @if (store.problems().length) {
        <section class="problems" [attr.aria-labelledby]="store.uid + '-problems'">
          <h3 [id]="store.uid + '-problems'">Needs attention</h3>
          <ul role="list">
            @for (p of store.problems(); track $index) {
              <li>
                <button type="button" class="problem" [class.err]="p.severity === 'error'" (click)="open.emit(p.targetId)">
                  <hugeicons-icon aria-hidden="true" [icon]="p.severity === 'error' ? errorIcon : warnIcon" [size]="15" [strokeWidth]="1.8" />
                  <span>{{ p.message }}</span>
                </button>
              </li>
            }
          </ul>
        </section>
      }

      <section [attr.aria-labelledby]="store.uid + '-rules'">
        <div class="bar">
          <h3 [id]="store.uid + '-rules'">Rules</h3>
          <span class="count">{{ entries().length }} question{{ entries().length === 1 ? '' : 's' }} and pages with rules</span>
          <div class="search">
            <hugeicons-icon [icon]="searchIcon" [size]="14" [strokeWidth]="1.8" aria-hidden="true" />
            <input type="search" placeholder="Find a question…" aria-label="Find a question" autocomplete="off" [value]="query()" (input)="query.set($any($event.target).value)" />
          </div>
        </div>
        <ul class="entries" role="list">
          @for (e of filtered(); track e.id) {
            <li>
              <button type="button" class="entry" (click)="open.emit(e.id)">
                <span class="entry-head"><span class="entry-name">{{ e.name }}</span><span class="entry-where">{{ e.where }}</span></span>
                @for (l of e.lines; track $index) {
                  <span class="line"><span class="fb-chip logic">{{ l.kind }}</span><span class="text">{{ l.text }}</span></span>
                }
              </button>
            </li>
          } @empty {
            <li class="empty">
              @if (query()) { Nothing matches “{{ query() }}”. }
              @else { No rules yet. Select a question and open its Logic tab to show it only sometimes, make it required under a condition, or fill it in automatically. }
            </li>
          }
        </ul>
      </section>
    </div>
  `,
  styles: [FB_SHARED_STYLES, `
    :host { display: block; overflow: auto; min-height: 0; background: var(--ui-color-bg); }
    .wrap { max-width: 820px; margin: 0 auto; padding: var(--ui-space-4) var(--ui-space-3) var(--ui-space-12); display: flex; flex-direction: column; gap: var(--ui-space-6); }
    h3 { margin: 0; font-size: calc(15px * var(--ui-font-scale)); font-weight: 600; }
    .problems ul, .entries { list-style: none; margin: var(--ui-space-2) 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .problem { display: flex; align-items: flex-start; gap: var(--ui-space-2); width: 100%; padding: var(--ui-space-2); text-align: left;
      border: 1px solid color-mix(in srgb, var(--ui-color-warning) 35%, transparent); border-radius: var(--ui-radius);
      background: color-mix(in srgb, var(--ui-color-warning) 8%, var(--ui-color-surface)); color: var(--ui-color-text); font: inherit; font-size: calc(13px * var(--ui-font-scale)); cursor: pointer; }
    .problem.err { border-color: color-mix(in srgb, var(--ui-color-danger) 40%, transparent); background: color-mix(in srgb, var(--ui-color-danger) 8%, var(--ui-color-surface)); }
    .problem hugeicons-icon { flex: none; margin-top: 1px; color: var(--ui-color-warning); }
    .problem.err hugeicons-icon { color: var(--ui-color-danger); }
    .problem:hover { background: color-mix(in srgb, var(--ui-color-warning) 14%, var(--ui-color-surface)); }
    .problem.err:hover { background: color-mix(in srgb, var(--ui-color-danger) 14%, var(--ui-color-surface)); }
    .problem:focus-visible, .entry:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .bar { display: flex; align-items: center; gap: var(--ui-space-3); flex-wrap: wrap; }
    .count { font-size: 12px; color: var(--ui-color-text-muted); }
    .search { position: relative; margin-left: auto; display: flex; align-items: center; }
    .search hugeicons-icon { position: absolute; left: 9px; color: var(--ui-color-text-muted); pointer-events: none; }
    .search input { width: 200px; height: 30px; padding: 0 var(--ui-space-2) 0 28px; box-sizing: border-box; border: 1px solid var(--ui-control-border);
      border-radius: var(--ui-radius); background: var(--ui-color-surface); color: var(--ui-color-text); font: inherit; font-size: calc(13px * var(--ui-font-scale)); }
    .search input:focus { outline: none; border-color: var(--ui-color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary) 28%, transparent); }
    .entry { display: flex; flex-direction: column; gap: 6px; width: 100%; padding: var(--ui-space-2) var(--ui-space-3); text-align: left;
      border: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); border-radius: var(--ui-radius); background: var(--ui-color-surface);
      color: var(--ui-color-text); font: inherit; cursor: pointer; }
    .entry:hover { border-color: var(--ui-color-border-strong, var(--ui-color-border)); }
    .entry-head { display: flex; align-items: baseline; gap: var(--ui-space-2); min-width: 0; }
    .entry-name, .text, .problem span { min-width: 0; overflow-wrap: anywhere; }
    .entry-name { font-size: calc(13px * var(--ui-font-scale)); font-weight: 600; }
    .entry-where { font-size: 12px; color: var(--ui-color-text-muted); }
    .line { display: flex; align-items: flex-start; gap: var(--ui-space-2); }
    .line .fb-chip { flex: none; margin-top: 1px; }
    .text { font-size: calc(13px * var(--ui-font-scale)); line-height: 1.45; color: var(--ui-color-text-secondary); }
    .empty { padding: var(--ui-space-6) var(--ui-space-4); text-align: center; font-size: calc(13px * var(--ui-font-scale)); color: var(--ui-color-text-muted);
      border: 1px dashed var(--ui-color-border); border-radius: var(--ui-radius); line-height: 1.5; }
    @media (max-width: 560px) { .search { margin-left: 0; width: 100%; } .search input { width: 100%; } }
  `],
})
export class FbLogicOverview {
  protected readonly store = inject(FbBuilderStore);
  /** Someone picked a question or page to go and edit. */
  readonly open = output<string>();

  protected readonly errorIcon = FB_ICONS.CancelCircleIcon;
  protected readonly warnIcon = FB_ICONS.Alert02Icon;
  protected readonly searchIcon = FB_ICONS.Search01Icon;
  protected readonly query = signal('');

  protected readonly entries = computed<RuleEntry[]>(() => {
    const def = this.store.def();
    const s = this.store;
    const out: RuleEntry[] = [];
    const pageName = (p: UiFbPage) => p.title || `Page ${def.pages.indexOf(p) + 1}`;
    for (const p of def.pages) {
      const lines: RuleLine[] = [];
      if (p.visibility) lines.push({ kind: p.visibility.action === 'show' ? 'Shown' : 'Skipped', text: `${p.visibility.action === 'show' ? 'Only when' : 'When'} ${s.describe(p.visibility.when)}` });
      for (const j of p.jumps ?? []) {
        const to = j.to === 'end' ? 'the end' : `“${s.name(j.to)}”`;
        lines.push({ kind: 'Jump', text: `Go to ${to} when ${s.describe(j.when)}` });
      }
      if (lines.length) out.push({ id: p.id, name: pageName(p), where: 'Page', lines });
    }
    for (const el of allElements(def)) {
      const lines = this.linesFor(el);
      if (!lines.length) continue;
      const entry = s.index().get(el.id);
      out.push({ id: el.id, name: s.name(el.id), where: entry ? pageName(entry.page) : '', lines });
    }
    return out;
  });

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.entries();
    return this.entries().filter((e) => e.name.toLowerCase().includes(q) || e.lines.some((l) => l.text.toLowerCase().includes(q)));
  });

  private linesFor(el: UiFbElement): RuleLine[] {
    const s = this.store;
    const lines: RuleLine[] = [];
    if (el.visibility) lines.push({ kind: el.visibility.action === 'show' ? 'Shown' : 'Hidden', text: `${el.visibility.action === 'show' ? 'Only when' : 'When'} ${s.describe(el.visibility.when)}` });
    if (el.kind === 'static') return lines;
    if (el.disabled === true) lines.push({ kind: 'Read-only', text: 'Always' });
    else if (el.disabled) lines.push({ kind: 'Read-only', text: `When ${s.describe(el.disabled.when)}` });
    if (el.kind === 'group') return lines;
    if (el.required && typeof el.required === 'object') lines.push({ kind: 'Required', text: `When ${s.describe(el.required.when)}` });
    if (el.type === 'calculated') lines.push({ kind: 'Calculated', text: s.describeCalc(el) });
    for (const sv of el.setValue ?? []) {
      const v = 'const' in sv.value ? JSON.stringify(sv.value.const) : 'ref' in sv.value ? `the answer to “${s.name(sv.value.ref)}”` : 'a date';
      lines.push({ kind: 'Fills in', text: `${v} when ${s.describe(sv.when)}` });
    }
    for (const v of el.validators ?? []) {
      if (!v.when) continue;
      const d = s.validatorDefs().find((x) => x.type === v.type);
      lines.push({ kind: 'Check', text: `${d?.label ?? v.type}, only when ${s.describe(v.when)}` });
    }
    return lines;
  }
}
