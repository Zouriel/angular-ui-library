import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  Injector,
  ViewEncapsulation,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiButton } from '@zouriel/ui/button';
import { UiReadAloud } from '@zouriel/ui/assistance';
import { UiFormSummary } from './form-summary';
import { UiFormEngine, type UiFbRemovedRow, type UiFbServerErrorItem, type UiFormMode } from './engine';
import { formatValue } from './format';
import { UiFbFieldView, type UiFbUploader } from './renderer-field';
import type { UiFbChange, UiFbElement, UiFbField, UiFbGroup, UiFbSubmissionLink, UiFormDefinition, UiFormSubmission } from './schema';
import { fbLocaleDir, fbResolveLocale } from './localize';
import { fbFormat, mergeFbStringOverrides, UI_FB_STRINGS_EN, UI_FORM_STRINGS, type UiFbStringOverrides } from './form-strings';
import { UI_FB_VALIDATORS, type UiFbValidatorDef } from './validators';
import { UI_FB_OPTION_SOURCES, type UiFbOptionSourceDef } from './option-sources';
import { sourcesFromSettings, type UiFormGlobalSettings } from './global-settings';
import { UI_FB_HTTP_SOURCES } from './http-sources';
import { FB_ICONS } from './builder-icons';

export type UiFbPresentation = 'page' | 'one-question';
interface UiFbQuestion {
  elements: UiFbElement[];
  pageIndex: number;
}

let rendererSeq = 0;

const SPAN: Record<string, number> = { full: 12, 'two-thirds': 8, half: 6, third: 4 };

/**
 * `ui-form-renderer` — fills in a form built with `ui-form-builder`.
 *
 * Give it a definition, and (to edit or view saved answers) the saved `values`.
 * It emits `submitted` with JSON ready to store: `{ formId, revision, values, … }`.
 */
@Component({
  selector: 'ui-form-renderer',
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet, HugeiconsIconComponent, UiButton, UiFbFieldView, UiReadAloud, UiFormSummary],
  host: { class: 'ui-fr-host', '[attr.dir]': 'dir()', '[attr.lang]': 'lang()' },
  template: `
    @if (engine(); as e) {
      @let def = e.definition;
      @let page = e.page();
      <form class="ui-fr" novalidate (submit)="$event.preventDefault(); primary()" [attr.aria-labelledby]="oneQuestion() ? uid + '-question-title' : (showTitle() ? uid + '-title' : null)">
        @if (showTitle() && (e.text(def.title) || e.text(def.description))) {
          <header class="ui-fr-header">
            @if (e.text(def.title)) { <h2 class="ui-fr-title" [id]="uid + '-title'">{{ e.text(def.title) }}</h2> }
            @if (e.text(def.description)) { <p class="ui-fr-desc">{{ e.text(def.description) }}</p> }
          </header>
        }

        @if (e.mode === 'view') {
          <!-- Reading saved answers: every page on the route, one after another, no steps. -->
          @for (i of e.path(); track i) {
            @let p = def.pages[i];
            <section class="ui-fr-view-page" [attr.aria-label]="e.text(p.title) || null">
              @if (multiPage() && (e.text(p.title) || e.text(p.description))) {
                <div class="ui-fr-page-head">
                  @if (e.text(p.title)) { <h3 class="ui-fr-page-title">{{ e.text(p.title) }}</h3> }
                  @if (e.text(p.description)) { <p class="ui-fr-desc">{{ e.text(p.description) }}</p> }
                </div>
              }
              <div class="ui-fr-grid">
                <ng-container [ngTemplateOutlet]="elements" [ngTemplateOutletContext]="{ $implicit: p.elements, row: null, cols: 1 }" />
              </div>
            </section>
          }
        } @else {
        @if (presentation() === 'one-question' && oneReview()) {
          <section class="ui-fr-review" [attr.aria-labelledby]="uid + '-review-title'">
            <h3 class="ui-fr-question-title" [id]="uid + '-review-title'" tabindex="-1">{{ s().review }}</h3>
            <ui-form-summary [definition]="e.definition" [answers]="e.values()" [language]="activeLocale()" [showTitle]="false" />
          </section>
        } @else if (presentation() === 'one-question' && question(); as q) {
          <section class="ui-fr-question" #questionBlock [attr.aria-labelledby]="uid + '-question-title'">
            <div class="ui-fr-progress">
              <div class="ui-fr-progress-track"><span [style.width.%]="questionProgress()"></span></div>
              <p class="ui-fr-step">{{ fmt(s().questionOf, { n: questionCursor() + 1, total: questions().length }) }}</p>
            </div>
            <h3 class="ui-fr-question-title" [id]="uid + '-question-title'" #questionHeading tabindex="-1">{{ questionTitle(q) }}</h3>
            @if (!isDhivehi()) {
              <button type="button" class="ui-fr-read" uiReadAloud [for]="questionBlock" [lang]="activeLocale()">{{ s().readAloud }}</button>
            }
            <div class="ui-fr-grid">
              <ng-container [ngTemplateOutlet]="elements" [ngTemplateOutletContext]="{ $implicit: q.elements, row: null, cols: 1 }" />
            </div>
          </section>
        }
        @if (presentation() === 'page') {
        @if (multiPage() && def.settings?.showProgress !== false) {
          <div class="ui-fr-progress">
            <div class="ui-fr-steps" aria-hidden="true">
              @for (i of e.path(); track i; let n = $index) {
                <span class="seg" [class.done]="n < e.step()" [class.on]="n === e.step()"></span>
              }
            </div>
            <p class="ui-fr-step">{{ fmt(s().stepOf, { n: e.step() + 1, total: e.path().length }) }}@if (e.text(page.title)) {<span class="sep">:</span> {{ e.text(page.title) }}}</p>
          </div>
        }

        @if (presentation() === 'page' && (summary().length || unmatched().length)) {
          @let count = summary().length + unmatched().length;
          <div class="ui-fr-summary" role="alert" tabindex="-1" #summaryBox [attr.aria-labelledby]="uid + '-sum'">
            <h3 class="ui-fr-summary-title" [id]="uid + '-sum'">{{ count === 1 ? s().problemOne : fmt(s().problemMany, { n: count }) }}</h3>
            <ul>
              <!-- Server errors that name no field: said here, with nothing to jump to. -->
              @for (item of unmatched(); track item.path) { <li class="ui-fr-summary-plain">{{ item.message }}</li> }
              @for (item of summary(); track item.addr) {
                <li><a [href]="'#' + uid + '-' + item.addr" (click)="$event.preventDefault(); focusField(item.addr)">{{ item.message }}</a></li>
              }
            </ul>
          </div>
        }

        @if (multiPage() && (e.text(page.title) || e.text(page.description))) {
          <div class="ui-fr-page-head">
            @if (e.text(page.title) && def.settings?.showProgress === false) { <h3 class="ui-fr-page-title">{{ e.text(page.title) }}</h3> }
            @if (e.text(page.description)) { <p class="ui-fr-desc">{{ e.text(page.description) }}</p> }
          </div>
        }

        <div class="ui-fr-grid">
          <ng-container [ngTemplateOutlet]="elements" [ngTemplateOutletContext]="{ $implicit: page.elements, row: null, cols: 1 }" />
        </div>
        }
        }

        @if (showActions() && e.mode !== 'view') {
          <footer class="ui-fr-footer">
            <div class="ui-fr-footer-start">
              @if ((presentation() === 'one-question' && questionCursor() > 0) || (presentation() === 'page' && multiPage() && e.step() > 0)) {
                <ui-button variant="outline" type="button" (click)="back()"><hugeicons-icon aria-hidden="true" [icon]="backIcon" [size]="14" [strokeWidth]="1.8" />{{ e.text(def.settings?.backLabel) || s().back }}</ui-button>
              }
              @if (cancelLabel()) {
                <ui-button variant="ghost" type="button" (click)="cancelled.emit()">{{ cancelLabel() }}</ui-button>
              }
              @if (presentation() === 'page') {
                <button type="button" class="ui-fr-link" (click)="switchPresentation('one-question')">{{ s().switchToOneQuestion }}</button>
              } @else if (!oneReview()) {
                <button type="button" class="ui-fr-link" (click)="switchPresentation('page')">{{ s().switchToPage }}</button>
              }
            </div>
            <div class="ui-fr-footer-end">
              @if (e.mode === 'edit') {
                @if (e.dirty()) {
                  <details class="ui-fr-changes">
                    <summary>{{ e.changes().length === 1 ? s().changeOne : fmt(s().changeMany, { n: e.changes().length }) }}</summary>
                    <ul>
                      @for (c of e.changes(); track c.path) {
                        <li><span class="what">{{ c.label }}</span><span class="from">{{ show(c, c.from) }}</span><span class="to">{{ show(c, c.to) }}</span></li>
                      }
                    </ul>
                  </details>
                } @else {
                  <span class="ui-fr-saved">{{ s().noChanges }}</span>
                }
              }
              @if (showSaveAndExit()) { <ui-button variant="outline" type="button" (click)="saveAndExit.emit()">{{ s().saveAndExit }}</ui-button> }
              <ui-button type="submit" [loading]="busy()">{{ primaryLabel() }}@if ((presentation() === 'page' && !e.isLastPage()) || (presentation() === 'one-question' && !oneReview())) {<hugeicons-icon aria-hidden="true" [icon]="nextIcon" [size]="14" [strokeWidth]="1.8" />}</ui-button>
            </div>
          </footer>
        }
      </form>

      <ng-template #elements let-els let-row="row" let-cols="cols">
        @for (el of els; track el.id) {
          @if (!el.archived && e.instanceState(el.id, row).visible && !(el.kind === 'field' && el.type === 'hidden')) {
            <div class="ui-fr-cell" [style.grid-column]="'span ' + span(el, cols)" [attr.data-kind]="el.kind" animate.enter="ui-fr-enter">
              @switch (el.kind) {
                @case ('field') {
                  <ui-fb-field [engine]="e" [field]="asField(el)" [row]="row" [idPrefix]="uid" [uploader]="uploader()" />
                }
                @case ('static') {
                  @switch (el.type) {
                    @case ('heading') { <h3 class="ui-fr-heading">{{ e.text(el.text) }}</h3> }
                    @case ('paragraph') { <p class="ui-fr-para">{{ e.text(el.text) }}</p> }
                    @default { <hr class="ui-fr-hr" /> }
                  }
                }
                @case ('group') {
                  @let g = asGroup(el);
                  <fieldset class="ui-fr-group" [class.is-repeat]="!!g.repeat" [disabled]="e.instanceState(g.id, row).disabled && e.mode !== 'view'">
                    @if (e.text(g.title)) { <legend class="ui-fr-legend">{{ e.text(g.title) }}</legend> }
                    @if (e.text(g.description)) { <p class="ui-fr-desc">{{ e.text(g.description) }}</p> }
                    @if (g.repeat) {
                      @let rows = e.rows(g.id);
                      @for (r of rows; track r; let n = $index) {
                        <section class="ui-fr-entry" [attr.aria-label]="entryLabel(g, n)" animate.enter="ui-fr-enter">
                          <header class="ui-fr-entry-head">
                            <h4>{{ entryLabel(g, n) }}</h4>
                            @if (e.mode !== 'view') {
                              <div class="ui-fr-entry-tools">
                                @if (rows.length > 1) {
                                  <button type="button" class="ui-fr-icon" [disabled]="n === 0" (click)="e.moveRow(g.id, r, -1)" [attr.aria-label]="fmt(s().moveUp, { name: entryLabel(g, n) })">
                                    <hugeicons-icon aria-hidden="true" [icon]="upIcon" [size]="15" [strokeWidth]="1.8" />
                                  </button>
                                  <button type="button" class="ui-fr-icon" [disabled]="n === rows.length - 1" (click)="e.moveRow(g.id, r, 1)" [attr.aria-label]="fmt(s().moveDown, { name: entryLabel(g, n) })">
                                    <hugeicons-icon aria-hidden="true" [icon]="downIcon" [size]="15" [strokeWidth]="1.8" />
                                  </button>
                                }
                                @if (e.canRemoveRow(g.id)) {
                                  <button type="button" class="ui-fr-icon danger" (click)="removeRow(g, r, n)" [attr.aria-label]="fmt(s().remove, { name: entryLabel(g, n) })">
                                    <hugeicons-icon aria-hidden="true" [icon]="deleteIcon" [size]="15" [strokeWidth]="1.8" />
                                  </button>
                                }
                              </div>
                            }
                          </header>
                          <div class="ui-fr-grid">
                            <ng-container [ngTemplateOutlet]="elements" [ngTemplateOutletContext]="{ $implicit: g.elements, row: r, cols: g.columns ?? 1 }" />
                          </div>
                        </section>
                      } @empty {
                        <p class="ui-fr-empty">{{ e.mode === 'view' ? s().noneAdded : s().nothingAdded }}</p>
                      }
                      @if (e.mode !== 'view') {
                        @if (removed()?.groupId === g.id) {
                          <p class="ui-fr-undo">{{ fmt(s().entryRemoved, { name: removed()!.label }) }}
                            <button type="button" class="ui-fr-link" (click)="undoRemove()">{{ s().undo }}</button></p>
                        }
                        <div class="ui-fr-add" [attr.data-fr-add]="g.id">
                          <ui-button variant="outline" size="sm" type="button" [disabled]="!e.canAddRow(g.id) || e.instanceState(g.id, row).disabled" (click)="addRow(g)">
                            <hugeicons-icon aria-hidden="true" [icon]="addIcon" [size]="15" [strokeWidth]="1.8" />{{ e.text(g.repeat.addLabel) || s().addAnother }}
                          </ui-button>
                          @if (g.repeat.max) { <span class="ui-fr-count">{{ rows.length }} of {{ g.repeat.max }}</span> }
                        </div>
                      }
                    } @else {
                      <div class="ui-fr-grid">
                        <ng-container [ngTemplateOutlet]="elements" [ngTemplateOutletContext]="{ $implicit: g.elements, row: row, cols: g.columns ?? 1 }" />
                      </div>
                    }
                  </fieldset>
                }
              }
            </div>
          }
        }
      </ng-template>
      <div class="ui-fr-live" aria-live="polite">{{ announce() }}</div>
    }
  `,
  styles: `
    .ui-fr-host { display: block; container: ui-fr / inline-size; color: var(--ui-color-text); font-family: var(--ui-font-default); }
    .ui-fr { display: flex; flex-direction: column; gap: var(--ui-space-4); }
    .ui-fr-header { display: flex; flex-direction: column; gap: var(--ui-space-1); }
    .ui-fr-title, .ui-fr-heading, .ui-fr-legend, .ui-fr-desc, .ui-fr-para, .ui-fr-page-title, .ui-fr-entry-head h4 { overflow-wrap: anywhere; }
    .ui-fr-title { margin: 0; font-family: var(--ui-font-display); font-size: calc(20px * var(--ui-font-scale)); font-weight: 600; letter-spacing: var(--ui-tracking-tight, -0.01em); }
    .ui-fr-desc { margin: 0; color: var(--ui-color-text-secondary); font-size: var(--ui-font-size-sm); line-height: 1.45; white-space: pre-wrap; }
    .ui-fr-progress { display: flex; flex-direction: column; gap: var(--ui-space-2); }
    .ui-fr-steps { display: flex; gap: 4px; }
    .ui-fr-steps .seg { flex: 1; height: 4px; border-radius: 2px; background: var(--ui-color-track, var(--ui-color-border)); transition: background var(--ui-motion-base) var(--ui-ease-standard); }
    .ui-fr-steps .seg.done { background: color-mix(in srgb, var(--ui-color-primary) 55%, var(--ui-color-track, var(--ui-color-border))); }
    .ui-fr-steps .seg.on { background: var(--ui-color-primary); }
    .ui-fr-step { margin: 0; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-secondary); font-weight: 500; }
    .ui-fr-step .sep { margin-inline-end: 2px; }
    .ui-fr-question { display: flex; flex-direction: column; gap: var(--ui-space-4); }
    .ui-fr-question-title { margin: 0; font-family: var(--ui-font-display); font-size: calc(22px * var(--ui-font-scale)); font-weight: 600; letter-spacing: var(--ui-tracking-tight, -0.01em); overflow-wrap: anywhere; }
    .ui-fr-question-title:focus { outline: none; }
    .ui-fr-progress-track { height: 5px; overflow: hidden; border-radius: 3px; background: var(--ui-color-track, var(--ui-color-border)); }
    .ui-fr-progress-track span { display: block; height: 100%; border-radius: inherit; background: var(--ui-color-primary); transition: width var(--ui-motion-base) var(--ui-ease-standard); }
    .ui-fr-read { align-self: flex-start; border: 0; border-radius: var(--ui-radius-pill, 999px); padding: var(--ui-space-2) var(--ui-space-3); color: var(--ui-color-primary); background: color-mix(in srgb, var(--ui-color-primary) 10%, var(--ui-color-surface)); font: inherit; font-size: var(--ui-font-size-sm); cursor: pointer; }
    .ui-fr-read:hover { background: color-mix(in srgb, var(--ui-color-primary) 16%, var(--ui-color-surface)); }
    .ui-fr-read:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .ui-fr-review { display: flex; flex-direction: column; gap: var(--ui-space-4); }
    .ui-fr-view-page > .ui-fr-page-head { margin-bottom: var(--ui-space-3); }
    .ui-fr-view-page + .ui-fr-view-page { margin-top: var(--ui-space-6); padding-top: var(--ui-space-6); border-top: 1px solid var(--ui-color-border); }
    .ui-fr-page-title { margin: 0 0 2px; font-size: var(--ui-font-size-lg); font-weight: 600; }
    .ui-fr-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: var(--ui-space-4) var(--ui-space-3); }
    .ui-fr-cell { min-width: 0; }
    @container ui-fr (max-width: 560px) { .ui-fr-cell { grid-column: span 12 !important; } }
    .ui-fr-heading { margin: var(--ui-space-2) 0 0; font-family: var(--ui-font-display); font-size: var(--ui-font-size-lg); font-weight: 600; }
    .ui-fr-para { margin: 0; color: var(--ui-color-text-secondary); font-size: var(--ui-font-size-sm); line-height: 1.5; white-space: pre-wrap; }
    .ui-fr-hr { border: 0; border-top: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); margin: var(--ui-space-1) 0; }
    .ui-fr-group { margin: 0; padding: var(--ui-space-3); border: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); border-radius: var(--ui-radius);
      display: flex; flex-direction: column; gap: var(--ui-space-3); min-width: 0; }
    .ui-fr-group:disabled { opacity: 0.6; }
    .ui-fr-legend { padding: 0 var(--ui-space-1); margin-inline-start: calc(-1 * var(--ui-space-1)); font-weight: 600; font-size: var(--ui-font-size-md); }
    .ui-fr-entry { display: flex; flex-direction: column; gap: var(--ui-space-3); padding: var(--ui-space-3); border-radius: var(--ui-radius); background: var(--ui-color-surface-subtle, var(--ui-color-surface)); }
    .ui-fr-entry-head { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-2); min-height: 24px; }
    .ui-fr-entry-head h4 { margin: 0; font-size: var(--ui-font-size-sm); font-weight: 600; color: var(--ui-color-text-secondary); }
    .ui-fr-entry-tools { display: flex; gap: 2px; }
    .ui-fr-icon { display: inline-grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: var(--ui-radius-xs); background: transparent; color: var(--ui-color-text-muted); cursor: pointer; }
    .ui-fr-icon:hover:not(:disabled) { background: var(--ui-color-surface-hover); color: var(--ui-color-text); }
    .ui-fr-icon.danger:hover:not(:disabled) { color: var(--ui-color-danger); }
    .ui-fr-icon:disabled { opacity: 0.35; cursor: default; }
    .ui-fr-icon:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    @media (pointer: coarse) { .ui-fr-icon { width: 40px; height: 40px; } }
    .ui-fr-add { display: flex; align-items: center; gap: var(--ui-space-3); }
    .ui-fr-undo { margin: 0; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-secondary); }
    .ui-fr-link { border: 0; background: none; padding: 0 2px; color: var(--ui-color-primary); font: inherit; font-weight: 600; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
    .ui-fr-link:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); border-radius: 2px; }
    .ui-fr-count, .ui-fr-empty { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); margin: 0; }
    .ui-fr-summary { padding: var(--ui-space-3); border: 1px solid color-mix(in srgb, var(--ui-color-danger) 55%, transparent); border-inline-start-width: 4px;
      border-radius: var(--ui-radius); background: color-mix(in srgb, var(--ui-color-danger) 8%, var(--ui-color-surface)); }
    /* Focused by the form (tabindex -1) so it's read out; its red frame already marks it, a ring would double it. */
    .ui-fr-summary:focus { outline: none; }
    .ui-fr-summary-title { margin: 0 0 var(--ui-space-1); font-size: var(--ui-font-size-md); font-weight: 600; }
    .ui-fr-summary ul { margin: 0; padding-inline-start: var(--ui-space-4); display: flex; flex-direction: column; gap: 2px; }
    .ui-fr-summary a { color: var(--ui-color-danger); font-size: var(--ui-font-size-sm); text-underline-offset: 2px; }
    .ui-fr-summary-plain { color: var(--ui-color-danger); font-size: var(--ui-font-size-sm); }
    .ui-fr-footer { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-3); flex-wrap: wrap;
      padding-top: var(--ui-space-3); border-top: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); }
    .ui-fr-footer-start, .ui-fr-footer-end { display: flex; align-items: center; gap: var(--ui-space-2); }
    .ui-fr-footer-end { margin-inline-start: auto; }
    .ui-fr-saved { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .ui-fr-changes { position: relative; font-size: var(--ui-font-size-sm); }
    .ui-fr-changes summary { cursor: pointer; color: var(--ui-color-text-secondary); list-style: none; padding: 4px var(--ui-space-2); border-radius: var(--ui-radius-xs); }
    .ui-fr-changes summary::-webkit-details-marker { display: none; }
    .ui-fr-changes summary:hover { background: var(--ui-color-surface-hover); }
    .ui-fr-changes ul { position: absolute; inset-inline-end: 0; bottom: calc(100% + 6px); z-index: 2; width: min(360px, 80vw); max-height: 260px; overflow: auto; margin: 0; padding: var(--ui-space-2);
      list-style: none; display: flex; flex-direction: column; gap: 6px; background: var(--ui-color-surface-raised, var(--ui-color-surface)); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); box-shadow: var(--ui-shadow-2); }
    .ui-fr-changes li { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1px; overflow-wrap: anywhere; }
    .ui-fr-changes .what { font-weight: 550; }
    .ui-fr-changes .from { color: var(--ui-color-text-muted); text-decoration: line-through; }
    .ui-fr-changes .to { color: var(--ui-color-text); }
    .ui-fr-live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .ui-fr-enter { animation: ui-fr-in var(--ui-motion-base) var(--ui-ease-decelerate, ease-out); }
    @keyframes ui-fr-in { from { opacity: 0; transform: translateY(-4px); } }
    @media (prefers-reduced-motion: reduce) { .ui-fr-enter { animation: none; } .ui-fr-steps .seg { transition: none; } }
  `,
})
export class UiFormRenderer {
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly registered = (inject(UI_FB_VALIDATORS, { optional: true }) ?? []).flat();
  private readonly registeredSources = (inject(UI_FB_OPTION_SOURCES, { optional: true }) ?? []).flat();
  private readonly http = inject(UI_FB_HTTP_SOURCES, { optional: true }) ?? {};
  private readonly providedStrings = inject(UI_FORM_STRINGS, { optional: true });

  readonly definition = input.required<UiFormDefinition>();
  /** Saved answers to edit or view. */
  readonly values = input<Record<string, unknown> | null>(null);
  /**
   * Starting answers for a new submission (create mode): filled in without making it an edit (no
   * change list, the normal Submit label); defaults still apply to fields without one. E.g. details
   * from a sign-in, or the answers given to an older version of the form (0.87.0).
   */
  readonly prefill = input<Record<string, unknown> | null>(null);
  /**
   * Errors from the server by data path (`full_name`, `address.city`, `dependants[1].name`; a 422's
   * `errors`, with any request prefix such as `data.` taken off). Shown on their fields like the
   * form's own errors and listed in the error summary; a field's message goes away when its answer
   * changes. Paths that match no field are listed at the top of the summary and reported by
   * `serverErrorsUnmatched`. Give a new object for each response (0.87.0).
   */
  readonly serverErrors = input<Readonly<Record<string, string | readonly string[]>> | null>(null);
  /** Defaults to `edit` when `values` are given, otherwise `create`. */
  readonly mode = input<UiFormMode | null>(null);
  /** Extra app checks, on top of the ones from `provideUiFormValidators`. */
  readonly validators = input<readonly UiFbValidatorDef[]>([]);
  /** Extra option sources, on top of the ones from `provideUiFormOptionSources`. */
  readonly optionSources = input<readonly UiFbOptionSourceDef[]>([]);
  /** App-wide settings from `ui-form-global-settings`: their lists are searched here. */
  readonly globalSettings = input<UiFormGlobalSettings | null>(null);
  /** Uploads files as they're picked; without it, files ride along in the submission. */
  readonly uploader = input<UiFbUploader | null>(null);
  readonly showTitle = input(true);
  readonly showActions = input(true);
  /** Shows one visible question at a time, followed by a review screen. */
  readonly presentation = input<UiFbPresentation>('page');
  /** Lets the host offer a save-and-exit action alongside navigation. */
  readonly showSaveAndExit = input(false);
  readonly submitLabel = input<string | null>(null);
  readonly cancelLabel = input<string | null>(null);
  /** Shows the primary button as busy (e.g. while the host saves). */
  readonly busy = input(false);
  /** The language to show the form in. Falls back to the form's default language. Switching keeps the answers. */
  readonly locale = input<string | null>(null);
  /**
   * The renderer's own words (buttons, step text, messages) per language code, on top of the built-in
   * English and Dhivehi, e.g. `{ fr: { submit: 'Envoyer' } }`. Wins over `provideUiFormStrings`.
   */
  readonly strings = input<UiFbStringOverrides | null>(null);
  /** Copied onto each submission (`workflowId`, `serviceCode`). */
  readonly link = input<UiFbSubmissionLink | null>(null);
  /** Fixes "today" (previews and tests). */
  readonly today = input<(() => string) | null>(null);

  readonly submitted = output<UiFormSubmission>();
  readonly cancelled = output<void>();
  /** The answers as they'd be saved, after every change. */
  readonly valueChange = output<Record<string, unknown>>();
  readonly dirtyChange = output<boolean>();
  readonly presentationChange = output<UiFbPresentation>();
  readonly saveAndExit = output<void>();
  /** After `serverErrors` were applied: the ones that matched no field (empty when all did). */
  readonly serverErrorsUnmatched = output<UiFbServerErrorItem[]>();

  protected readonly uid = `fr${++rendererSeq}`;
  protected readonly addIcon = FB_ICONS.Add01Icon;
  protected readonly deleteIcon = FB_ICONS.Delete02Icon;
  protected readonly upIcon = FB_ICONS.ArrowUp01Icon;
  protected readonly backIcon = FB_ICONS.ArrowLeft01Icon;
  protected readonly nextIcon = FB_ICONS.ArrowRight01Icon;
  protected readonly downIcon = FB_ICONS.ArrowDown01Icon;

  /** The running form. Hosts can read `values()`, `dirty()`, `changes()` from it. */
  readonly engine = signal<UiFormEngine | null>(null);
  protected readonly announce = signal('');
  /** The repeat entry removed last, for its Undo. */
  protected readonly removed = signal<(UiFbRemovedRow & { label: string }) | null>(null);
  private removedTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly resetTick = signal(0);
  private readonly questionCursorRaw = signal(0);
  private readonly summaryBox = viewChild<ElementRef<HTMLElement>>('summaryBox');
  private readonly fields = viewChildren(UiFbFieldView);

  private readonly stringOverrides = computed(() => mergeFbStringOverrides(this.providedStrings, this.strings()));
  /** The language in use. */
  readonly activeLocale = computed(() => fbResolveLocale(this.definition(), this.locale()));
  protected readonly dir = computed(() => fbLocaleDir(this.definition(), this.activeLocale()));
  protected readonly lang = computed(() => this.activeLocale());

  /** The renderer's own words in the language in use. */
  protected readonly s = computed(() => this.engine()?.strings() ?? UI_FB_STRINGS_EN);
  protected readonly fmt = fbFormat;
  protected readonly multiPage = computed(() => (this.engine()?.path().length ?? 0) > 1);
  protected readonly questions = computed<UiFbQuestion[]>(() => {
    const e = this.engine();
    if (!e) return [];
    const out: UiFbQuestion[] = [];
    for (const pageIndex of e.path()) {
      const els = e.definition.pages[pageIndex]?.elements ?? [];
      for (let i = 0; i < els.length; i++) {
        const el = els[i];
        if (el.archived || !e.instanceState(el.id, null).visible || (el.kind === 'field' && el.type === 'hidden')) continue;
        if (el.kind === 'static' && i + 1 < els.length) {
          const next = els[i + 1];
          if (!next.archived && next.kind === 'field' && next.type !== 'hidden' && e.instanceState(next.id, null).visible) {
            out.push({ pageIndex, elements: [el, next] });
            i++;
            continue;
          }
        }
        out.push({ pageIndex, elements: [el] });
      }
    }
    return out;
  });
  protected readonly questionCursor = computed(() => Math.min(this.questionCursorRaw(), this.questions().length));
  protected readonly question = computed(() => this.questions()[this.questionCursor()] ?? null);
  protected readonly oneQuestion = computed(() => this.presentation() === 'one-question' && this.engine()?.mode !== 'view' && !!this.question());
  protected readonly oneReview = computed(() => this.presentation() === 'one-question' && this.engine()?.mode !== 'view' && this.questionCursor() >= this.questions().length);
  protected readonly questionProgress = computed(() => {
    const total = this.questions().length;
    return total ? ((this.questionCursor() + 1) / (total + 1)) * 100 : 100;
  });
  protected readonly isDhivehi = computed(() => this.activeLocale().toLowerCase().split(/[-_]/)[0] === 'dv');
  /** Server errors that name no field (shown when the form has an error summary). */
  protected readonly unmatched = computed(() => (this.engine()?.settings.errorSummary ? this.engine()?.serverUnmatched() ?? [] : []));
  protected readonly summary = computed(() => {
    const e = this.engine();
    if (!e || !e.settings.errorSummary) return [];
    const page = e.page();
    return e.attempted().has(page.id) ? e.pageErrors(e.pageIndex()) : [];
  });
  protected readonly primaryLabel = computed(() => {
    const e = this.engine();
    if (!e) return '';
    if (!e.isLastPage()) return e.text(e.definition.settings?.nextLabel) || e.strings().next;
    return this.submitLabel() || e.text(e.definition.settings?.submitLabel) || (e.mode === 'edit' ? e.strings().saveChanges : e.strings().submit);
  });

  constructor() {
    effect((onCleanup) => {
      this.resetTick();
      const definition = this.definition();
      const values = this.values();
      const prefill = this.prefill();
      const mode = this.mode();
      const validators = [...this.registered, ...this.validators()];
      const optionSources = [...this.registeredSources, ...sourcesFromSettings(this.globalSettings(), this.http), ...this.optionSources()];
      const today = this.today();
      const e = untracked(() => new UiFormEngine({
        definition, values, prefill, mode: mode ?? undefined, validators, optionSources, injector: this.injector, today: today ?? undefined,
        locale: this.locale(), link: this.link(), strings: untracked(() => this.stringOverrides()),
      }));
      this.engine.set(e);
      this.questionCursorRaw.set(0);
      onCleanup(() => e.destroy());
    });
    effect(() => {
      const count = this.questions().length;
      if (this.questionCursorRaw() > count) this.questionCursorRaw.set(count);
    });
    // Language and link follow their inputs without restarting the form, so answers survive.
    effect(() => {
      const e = this.engine();
      const locale = this.locale();
      if (e) untracked(() => e.setLocale(locale));
    });
    effect(() => {
      const e = this.engine();
      const overrides = this.stringOverrides();
      if (e) untracked(() => e.setStrings(overrides));
    });
    effect(() => {
      const e = this.engine();
      const link = this.link();
      if (e) untracked(() => e.setLink(link));
    });
    // Server errors go onto the running form (again after it restarts); the summary takes focus.
    effect(() => {
      const e = this.engine();
      const errors = this.serverErrors();
      if (!e) return;
      untracked(() => {
        const unmatched = e.setServerErrors(errors);
        if (errors && Object.keys(errors).length) {
          this.serverErrorsUnmatched.emit(unmatched);
          this.showSummary();
        }
      });
    });
    let first = true;
    effect(() => {
      const e = this.engine();
      if (!e) return;
      const values = e.values();
      const dirty = e.dirty();
      if (first) { first = false; return; }
      untracked(() => { this.valueChange.emit(values); this.dirtyChange.emit(dirty); });
    });
  }

  /** Starts over from the values the form was given (or blank), back on the first page. */
  reset(): void {
    this.resetTick.update((n) => n + 1);
  }

  /** Continue on inner pages, submit on the last. */
  protected primary(): void {
    const e = this.engine();
    if (!e) return;
    if (this.presentation() === 'one-question') {
      if (this.oneReview()) { this.submit(); return; }
      this.nextQuestion();
      return;
    }
    if (!e.isLastPage()) {
      if (e.next()) this.pageChanged();
      else this.showSummary();
      return;
    }
    this.submit();
  }

  /** Validates everything and emits `submitted` when it's all fine. Returns the submission. */
  submit(): UiFormSubmission | null {
    const e = this.engine();
    if (!e) return null;
    const before = e.pageIndex();
    const s = e.submit();
    if (!s) {
      if (e.pageIndex() !== before) this.pageChanged();
      this.showSummary();
      return null;
    }
    this.submitted.emit(s);
    return s;
  }

  protected back(): void {
    if (this.presentation() === 'one-question') {
      if (this.questionCursor() > 0) {
        this.questionCursorRaw.update((n) => Math.max(0, n - 1));
        this.questionChanged();
      }
      return;
    }
    if (this.engine()?.back()) this.pageChanged();
  }

  protected questionTitle(q: UiFbQuestion): string {
    const e = this.engine();
    if (!e) return '';
    const first = q.elements[0];
    if (first.kind === 'field') return e.text(first.label) || first.key || first.id;
    if (first.kind === 'static') return e.text(first.text) || '';
    return e.text(first.title) || '';
  }

  protected switchPresentation(next: UiFbPresentation): void {
    this.presentationChange.emit(next);
  }

  private nextQuestion(): void {
    const e = this.engine();
    const q = this.question();
    if (!e || !q) return;
    e.attempted.update((s) => new Set(s).add(e.definition.pages[q.pageIndex].id));
    const fields = e.instancesOn(q.pageIndex).filter((inst) => q.elements.some((el) => this.containsElement(el, inst.id)));
    const bad = fields.filter((inst) => {
      const st = e.instanceState(inst.id, inst.row);
      return st.visible && (st.errors.length > 0 || st.pending);
    });
    if (bad.length) {
      afterNextRender(() => this.fields().find((f) => f.addr() === bad[0].addr)?.focus(), { injector: this.injector });
      return;
    }
    this.questionCursorRaw.update((n) => Math.min(this.questions().length, n + 1));
    this.questionChanged();
  }

  private containsElement(parent: UiFbElement, id: string): boolean {
    if (parent.id === id) return true;
    return parent.kind === 'group' && parent.elements.some((el) => this.containsElement(el, id));
  }

  private questionChanged(): void {
    const e = this.engine();
    if (!e) return;
    const total = this.questions().length;
    this.announce.set(this.questionCursor() >= total ? e.strings().review : fbFormat(e.strings().questionOf, { n: this.questionCursor() + 1, total }));
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('.ui-fr-question-title')?.focus(), { injector: this.injector });
  }

  protected addRow(g: UiFbGroup): void {
    const e = this.engine();
    if (!e?.addRow(g.id)) return;
    this.announce.set(fbFormat(e.strings().entryAdded, { name: this.entryLabel(g, e.rows(g.id).length - 1) }));
  }

  protected removeRow(g: UiFbGroup, row: string, n: number): void {
    const snapshot = this.engine()?.removeRow(g.id, row);
    if (!snapshot) return;
    const label = this.entryLabel(g, n);
    this.removed.set({ ...snapshot, label });
    this.announce.set(fbFormat(this.s().entryRemovedAnnounce, { name: label }));
    if (this.removedTimer) clearTimeout(this.removedTimer);
    this.removedTimer = setTimeout(() => this.removed.set(null), 12000);
    // The button that was pressed is gone; keep focus in the same place in the form.
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(`[data-fr-add="${g.id}"] button`)?.focus(), { injector: this.injector });
  }

  protected undoRemove(): void {
    const r = this.removed();
    if (!r) return;
    this.engine()?.restoreRow(r);
    this.removed.set(null);
    this.announce.set(fbFormat(this.s().entryRestored, { name: r.label }));
  }

  protected focusField(addr: string): void {
    this.fields().find((f) => f.addr() === addr)?.focus();
  }

  protected entryLabel(g: UiFbGroup, n: number): string {
    return (this.engine()?.text(g.repeat?.itemLabel) || this.s().entryTitle).replace('{n}', String(n + 1));
  }

  protected span(el: UiFbElement, cols: number): number {
    const w = el.kind === 'static' && el.type !== 'paragraph' ? undefined : el.layout?.width;
    if (w) return SPAN[w] ?? 12;
    if (el.kind === 'static' && el.type !== 'paragraph') return 12;
    return cols > 1 ? Math.round(12 / cols) : 12;
  }

  protected show(c: UiFbChange, v: unknown): string {
    const w = this.s();
    if (v === null || v === undefined || v === '') return w.empty;
    const id = [...(this.engine()?.index.values() ?? [])].find((x) => x.kind === 'field' && this.engine()?.valuePath(x.id, null) === c.path.replace(/\[\d+\]/g, ''))?.id;
    const field = id ? this.engine()?.field(id) : undefined;
    return field ? formatValue(field, v, this.engine()?.locale(), this.engine()?.defaultLocale, w) || w.empty : typeof v === 'object' ? JSON.stringify(v) : String(v);
  }

  protected asField(el: UiFbElement): UiFbField {
    return el as UiFbField;
  }

  protected asGroup(el: UiFbElement): UiFbGroup {
    return el as UiFbGroup;
  }

  private showSummary(): void {
    if (!this.engine()?.settings.errorSummary) {
      afterNextRender(() => this.fields().find((f) => this.summaryFirst() === f.addr())?.focus(), { injector: this.injector });
      return;
    }
    afterNextRender(() => this.summaryBox()?.nativeElement.focus(), { injector: this.injector });
  }

  private summaryFirst(): string | undefined {
    const e = this.engine();
    return e?.pageErrors(e.pageIndex())[0]?.addr;
  }

  private pageChanged(): void {
    const e = this.engine();
    if (!e) return;
    const page = e.page();
    const title = e.text(page.title);
    this.announce.set(`${fbFormat(e.strings().stepOf, { n: e.step() + 1, total: e.path().length })}${title ? `: ${title}` : ''}`);
    afterNextRender(() => {
      const el = this.host.nativeElement;
      if (el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' });
      el.querySelector<HTMLElement>('input, textarea, select, [tabindex="0"]')?.focus({ preventScroll: true });
    }, { injector: this.injector });
  }
}
