import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, computed, inject, output } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiMenu, type UiMenuItem } from '@zouriel/ui/overlay';
import { FIELD_ICONS, GROUP_ICON, REPEAT_ICON, STATIC_ICONS, FB_ICONS } from './builder-icons';
import { FbDnd } from './builder-dnd';
import { FbBuilderStore } from './builder-store';
import { FB_SHARED_STYLES } from './builder-styles';
import { createField, createGroup, type UiFbDropTarget } from './definition';
import { fieldTypeInfo } from './field-types';
import type { UiFbElement, UiFbField, UiFbFieldType, UiFbGroup, UiFbStatic } from './schema';

const SPAN: Record<string, number> = { full: 12, 'two-thirds': 8, half: 6, third: 4 };

/** One-click starters for an empty form. */
const STARTERS: { type: UiFbFieldType | 'group'; label: string }[] = [
  { type: 'text', label: 'Short text' },
  { type: 'email', label: 'Email' },
  { type: 'select', label: 'Dropdown' },
  { type: 'radio', label: 'Single choice' },
  { type: 'date', label: 'Date' },
  { type: 'group', label: 'Section' },
];

/** How long a finger rests on a card before its settings open (matches the platform's long press). */
const LONG_PRESS_MS = 450;

export interface FbDeleteRequest {
  id: string;
}

/**
 * `ui-fb-canvas` — the form as it's being built: page tabs, then each
 * question as a card (a small preview of how it will look), with sections as
 * drop zones. Selecting a card opens it in the inspector.
 */
@Component({
  selector: 'ui-fb-canvas',
  imports: [NgTemplateOutlet, HugeiconsIconComponent, UiMenu],
  host: { 'data-fb-canvas': '' },
  template: `
    @let def = store.def();
    @let page = store.page();
    <div class="tabs">
      <div class="tablist" role="tablist" aria-label="Pages" (keydown)="tabKeys($event)">
        @for (p of def.pages; track p.id; let i = $index) {
          <button type="button" role="tab" class="tab" [class.on]="i === store.pageIndex()" [class.over]="dropOver() === 'tab:' + p.id"
            [id]="store.uid + '-tab-' + p.id" [attr.aria-controls]="store.uid + '-page'" [tabindex]="i === store.pageIndex() ? 0 : -1"
            [attr.aria-selected]="i === store.pageIndex()" [attr.data-fb-page-drop]="p.id" (click)="openPage(i)">
            <span class="tab-name">{{ p.title || 'Page ' + (i + 1) }}</span>
            @if (p.visibility || p.jumps?.length) { <span class="dot-logic" title="This page has rules"></span><span class="fb-sr">, has rules</span> }
          </button>
        }
      </div>
      <button type="button" class="tab add" (click)="store.addPage()" title="Add a page (a new step)">
        <hugeicons-icon aria-hidden="true" [icon]="addIcon" [size]="14" [strokeWidth]="1.8" /><span>Page</span>
      </button>
    </div>

    <div class="scroll" data-fb-scroll tabindex="-1" role="tabpanel" [id]="store.uid + '-page'"
      [attr.aria-labelledby]="store.uid + '-tab-' + page.id" (click)="backgroundClick($event)">
      <div class="paper">
        <button type="button" class="form-head" [class.selected]="store.selectedId() === null" (click)="store.select(null); $event.stopPropagation()">
          <span class="form-title">{{ def.title || 'Untitled form' }}</span>
          @if (def.description) { <span class="form-desc">{{ def.description }}</span> }
        </button>
        @if (def.pages.length > 1) {
          <div class="page-head" [class.selected]="store.selectedId() === page.id">
            <button type="button" class="page-open" (click)="openSettings(page.id, $event)" title="Page settings">
              <span class="page-title">{{ page.title || 'Page ' + (store.pageIndex() + 1) }}</span>
              @if (page.visibility) { <span class="fb-chip logic" [title]="pageRule()">{{ page.visibility.action === 'show' ? 'Shown when…' : 'Skipped when…' }}</span> }
              @if (page.jumps?.length) { <span class="fb-chip logic">{{ page.jumps!.length }} jump{{ page.jumps!.length > 1 ? 's' : '' }}</span> }
            </button>
            <ui-menu [items]="pageItems()" (select)="pageAction(page.id, $event)">
              <button menu-trigger type="button" class="fb-icon-btn page-more" [attr.aria-label]="'Actions for ' + (page.title || 'this page')" title="Page actions">
                <hugeicons-icon aria-hidden="true" [icon]="moreIcon" [size]="16" [strokeWidth]="1.8" />
              </button>
            </ui-menu>
          </div>
        }

        <div class="list" [attr.data-fb-list]="page.id" [class.over]="dropOver() === page.id">
          <ng-container [ngTemplateOutlet]="items" [ngTemplateOutletContext]="{ $implicit: page.elements, cols: 1 }" />
        </div>

        @if (!page.elements.length) {
          <div class="empty">
            <p class="empty-title">{{ def.pages.length > 1 ? 'This page is empty' : 'Start your form' }}</p>
            <p class="empty-text">Drag a field from the left, or start with one of these.</p>
            <div class="starters">
              @for (s of starters; track s.type) {
                <button type="button" class="starter" (click)="addStarter(s.type)">
                  <hugeicons-icon aria-hidden="true" [icon]="s.type === 'group' ? groupIcon : fieldIcons[s.type]" [size]="15" [strokeWidth]="1.8" />{{ s.label }}
                </button>
              }
            </div>
          </div>
        } @else {
          <button type="button" class="add-end" (click)="addAt.emit({ containerId: page.id, index: page.elements.length }); $event.stopPropagation()">
            <hugeicons-icon aria-hidden="true" [icon]="addIcon" [size]="15" [strokeWidth]="1.8" />Add a field
          </button>
        }
      </div>
    </div>

    <ng-template #items let-els let-cols="cols">
      @for (el of els; track el.id) {
        <div class="item" animate.enter="fb-item-in" [attr.data-fb-item]="el.id" [style.grid-column]="'span ' + span(el, cols)"
          [class.selected]="store.selectedId() === el.id" [class.dragging]="dragId() === el.id" [class.archived]="el.archived"
          [class.problem]="store.problemIds().has(el.id)">
          @switch (el.kind) {
            @case ('group') { <ng-container [ngTemplateOutlet]="groupCard" [ngTemplateOutletContext]="{ $implicit: el }" /> }
            @case ('static') { <ng-container [ngTemplateOutlet]="staticCard" [ngTemplateOutletContext]="{ $implicit: el }" /> }
            @default { <ng-container [ngTemplateOutlet]="fieldCard" [ngTemplateOutletContext]="{ $implicit: el }" /> }
          }
        </div>
      }
    </ng-template>

    <ng-template #grip let-el>
      <button type="button" class="grip" [attr.aria-label]="'Drag ' + store.name(el.id) + ' to move it'" title="Drag to move"
        (pointerdown)="startMove(el, $event)" (click)="$event.stopPropagation()" tabindex="-1">
        <hugeicons-icon aria-hidden="true" [icon]="gripIcon" [size]="14" [strokeWidth]="1.8" />
      </button>
    </ng-template>

    <ng-template #tools let-el>
      @if (store.selectedId() === el.id) {
        <div class="tools" (click)="$event.stopPropagation()">
          <button type="button" class="fb-icon-btn" (click)="open.emit(el.id)" [attr.aria-label]="'Settings for ' + store.name(el.id)" title="Settings (double-click, or hold on a touch screen)">
            <hugeicons-icon aria-hidden="true" [icon]="settingsIcon" [size]="15" [strokeWidth]="1.8" />
          </button>
          <button type="button" class="fb-icon-btn" (click)="store.nudge(el.id, -1)" [attr.aria-label]="'Move ' + store.name(el.id) + ' up'" title="Move up (Alt+↑)">
            <hugeicons-icon aria-hidden="true" [icon]="upIcon" [size]="15" [strokeWidth]="1.8" />
          </button>
          <button type="button" class="fb-icon-btn" (click)="store.nudge(el.id, 1)" [attr.aria-label]="'Move ' + store.name(el.id) + ' down'" title="Move down (Alt+↓)">
            <hugeicons-icon aria-hidden="true" [icon]="downIcon" [size]="15" [strokeWidth]="1.8" />
          </button>
          <button type="button" class="fb-icon-btn" (click)="store.duplicate(el.id)" [attr.aria-label]="'Duplicate ' + store.name(el.id)" title="Duplicate (Ctrl+D)">
            <hugeicons-icon aria-hidden="true" [icon]="copyIcon" [size]="15" [strokeWidth]="1.8" />
          </button>
          <button type="button" class="fb-icon-btn danger" (click)="deleteRequest.emit({ id: el.id })" [attr.aria-label]="'Delete ' + store.name(el.id)" title="Delete (Del)">
            <hugeicons-icon aria-hidden="true" [icon]="deleteIcon" [size]="15" [strokeWidth]="1.8" />
          </button>
          <ui-menu [items]="moreItems(el)" (select)="more(el, $event)">
            <button menu-trigger type="button" class="fb-icon-btn" aria-label="More actions" title="More">
              <hugeicons-icon aria-hidden="true" [icon]="moreIcon" [size]="15" [strokeWidth]="1.8" />
            </button>
          </ui-menu>
        </div>
      }
    </ng-template>

    <ng-template #badges let-el>
      @let f = asField(el);
      <span class="badges">
        @if (el.archived) { <span class="fb-chip warn">Archived</span> }
        @if (store.problemIds().has(el.id)) { <span class="fb-chip bad" title="Something needs fixing. Select to see.">Needs attention</span> }
        @if (el.visibility) { <span class="fb-chip logic" [title]="(el.visibility.action === 'show' ? 'Shown when ' : 'Hidden when ') + store.describe(el.visibility.when)">{{ el.visibility.action === 'show' ? 'Shown when…' : 'Hidden when…' }}</span> }
        @if (el.kind === 'field') {
          @if (isObj(f.required)) { <span class="fb-chip logic" [title]="'Required when ' + store.describe($any(f.required).when)">Required when…</span> }
          @if (f.disabled) { <span class="fb-chip" [title]="isObj(f.disabled) ? 'Locked when ' + store.describe($any(f.disabled).when) : 'Can’t be changed'">Locked{{ isObj(f.disabled) ? ' when…' : '' }}</span> }
          @if (f.setValue?.length) { <span class="fb-chip logic">Fills itself</span> }
          @if (f.validators?.length) { <span class="fb-chip">{{ f.validators!.length }} check{{ f.validators!.length > 1 ? 's' : '' }}</span> }
        }
        @if (el.kind === 'group' && el.disabled) { <span class="fb-chip">Locked{{ isObj(el.disabled) ? ' when…' : '' }}</span> }
      </span>
    </ng-template>

    <ng-template #fieldCard let-el>
      @let f = asField(el);
      @let info = typeInfo(f.type);
      <div class="card field" tabindex="0" role="group" [attr.aria-current]="store.selectedId() === f.id ? true : null"
        [attr.aria-label]="(f.label || info.label) + ', ' + info.label + ' field'"
        (click)="pick(f.id, $event)" (dblclick)="openSettings(f.id, $event)" (pointerdown)="pressStart(f.id, $event)" (contextmenu)="noTouchMenu($event)" (keydown)="keys(f.id, $event)">
        <ng-container [ngTemplateOutlet]="grip" [ngTemplateOutletContext]="{ $implicit: f }" />
        <div class="main">
          <div class="head">
            <span class="type-ico" [title]="info.label"><hugeicons-icon aria-hidden="true" [icon]="fieldIcons[f.type]" [size]="13" [strokeWidth]="1.8" /></span>
            <span class="label" [class.muted]="!f.label">{{ f.label || 'No label' }}@if (f.required === true) {<span class="req">*</span>}</span>
            <ng-container [ngTemplateOutlet]="badges" [ngTemplateOutletContext]="{ $implicit: f }" />
          </div>
          <div class="mock" aria-hidden="true" [attr.data-type]="f.type">
            @switch (f.type) {
              @case ('textarea') { <div class="box tall">{{ f.placeholder }}</div> }
              @case ('select') { <div class="box chev">{{ f.placeholder || 'Choose…' }}</div> }
              @case ('multiselect') { <div class="box chev">{{ f.placeholder || 'Choose…' }}</div> }
              @case ('radio') { <ng-container [ngTemplateOutlet]="opts" [ngTemplateOutletContext]="{ $implicit: f, round: true }" /> }
              @case ('checkboxes') { <ng-container [ngTemplateOutlet]="opts" [ngTemplateOutletContext]="{ $implicit: f, round: false }" /> }
              @case ('checkbox') { <div class="choice"><span class="tick"></span>{{ f.props?.caption || f.label }}</div> }
              @case ('toggle') { <div class="choice"><span class="switch"></span>{{ f.props?.caption || 'Yes' }}</div> }
              @case ('date') { <div class="box icon">{{ f.placeholder || 'Select a date' }}<hugeicons-icon aria-hidden="true" [icon]="calIcon" [size]="13" [strokeWidth]="1.8" /></div> }
              @case ('time') { <div class="box icon">--:--<hugeicons-icon aria-hidden="true" [icon]="clockIcon" [size]="13" [strokeWidth]="1.8" /></div> }
              @case ('rating') {
                <div class="stars">@for (s of stars(f); track $index) { <hugeicons-icon aria-hidden="true" [icon]="starIcon" [size]="15" [strokeWidth]="1.6" /> }</div>
              }
              @case ('slider') { <div class="slider"><span class="track"></span><span class="knob"></span><span class="range">{{ f.props?.min ?? 0 }} to {{ f.props?.max ?? 10 }}</span></div> }
              @case ('file') { <div class="box drop"><hugeicons-icon aria-hidden="true" [icon]="fileIcon" [size]="14" [strokeWidth]="1.8" />Drop files or browse</div> }
              @case ('calculated') { <div class="box calc">= {{ store.describeCalc(f) }}</div> }
              @case ('hidden') { <div class="hidden-note">Stored as “{{ f.key }}”, never shown{{ f.defaultValue != null && f.defaultValue !== '' ? ': ' + f.defaultValue : '' }}</div> }
              @case ('currency') { <div class="box">{{ f.placeholder }}<span class="suffix">{{ f.props?.currency }}</span></div> }
              @default { <div class="box">{{ f.placeholder }}</div> }
            }
          </div>
          @if (f.help) { <p class="help">{{ f.help }}</p> }
        </div>
        <ng-container [ngTemplateOutlet]="tools" [ngTemplateOutletContext]="{ $implicit: f }" />
      </div>
    </ng-template>

    <ng-template #opts let-f let-round="round">
      <div class="opts">
        @for (o of liveOptions(f).slice(0, 3); track o.id) {
          <span class="choice"><span [class]="round ? 'dot' : 'tick'"></span>{{ o.label }}</span>
        }
        @if (liveOptions(f).length > 3) { <span class="more-opts">+{{ liveOptions(f).length - 3 }} more</span> }
      </div>
    </ng-template>

    <ng-template #staticCard let-el>
      @let s = asStatic(el);
      <div class="card static" tabindex="0" role="group" [attr.aria-current]="store.selectedId() === s.id ? true : null"
        [attr.aria-label]="store.name(s.id)" (click)="pick(s.id, $event)" (dblclick)="openSettings(s.id, $event)" (pointerdown)="pressStart(s.id, $event)" (contextmenu)="noTouchMenu($event)" (keydown)="keys(s.id, $event)">
        <ng-container [ngTemplateOutlet]="grip" [ngTemplateOutletContext]="{ $implicit: s }" />
        <div class="main">
          @switch (s.type) {
            @case ('heading') { <div class="head"><span class="st-heading">{{ s.text || 'Heading' }}</span><ng-container [ngTemplateOutlet]="badges" [ngTemplateOutletContext]="{ $implicit: s }" /></div> }
            @case ('paragraph') { <div class="head"><span class="st-para">{{ s.text || 'Text block' }}</span><ng-container [ngTemplateOutlet]="badges" [ngTemplateOutletContext]="{ $implicit: s }" /></div> }
            @default { <div class="head"><span class="st-divider"></span><ng-container [ngTemplateOutlet]="badges" [ngTemplateOutletContext]="{ $implicit: s }" /></div> }
          }
        </div>
        <ng-container [ngTemplateOutlet]="tools" [ngTemplateOutletContext]="{ $implicit: s }" />
      </div>
    </ng-template>

    <ng-template #groupCard let-el>
      @let g = asGroup(el);
      <div class="card group" [class.repeat]="!!g.repeat">
        <div class="group-head" tabindex="0" role="group" [attr.aria-current]="store.selectedId() === g.id ? true : null"
          [attr.aria-label]="store.name(g.id) + (g.repeat ? ', repeating section' : ', section')"
          (click)="pick(g.id, $event)" (dblclick)="openSettings(g.id, $event)" (pointerdown)="pressStart(g.id, $event)" (contextmenu)="noTouchMenu($event)" (keydown)="keys(g.id, $event)">
          <ng-container [ngTemplateOutlet]="grip" [ngTemplateOutletContext]="{ $implicit: g }" />
          <span class="type-ico"><hugeicons-icon aria-hidden="true" [icon]="g.repeat ? repeatIcon : groupIcon" [size]="13" [strokeWidth]="1.8" /></span>
          <span class="label strong">{{ g.title || (g.repeat ? 'Repeating section' : 'Section') }}</span>
          @if (g.repeat) { <span class="fb-chip">{{ repeatText(g) }}</span> }
          <ng-container [ngTemplateOutlet]="badges" [ngTemplateOutletContext]="{ $implicit: g }" />
          <ng-container [ngTemplateOutlet]="tools" [ngTemplateOutletContext]="{ $implicit: g }" />
        </div>
        <div class="list inner" [attr.data-fb-list]="g.id" [class.over]="dropOver() === g.id" (click)="pick(g.id, $event)">
          <ng-container [ngTemplateOutlet]="items" [ngTemplateOutletContext]="{ $implicit: g.elements, cols: g.columns ?? 1 }" />
        </div>
        @if (!g.elements.length) {
          <p class="group-empty">Drag fields here, or <button type="button" class="fb-link" (click)="addAt.emit({ containerId: g.id, index: 0 }); $event.stopPropagation()">add one</button>.</p>
        } @else {
          <button type="button" class="add-in" (click)="addAt.emit({ containerId: g.id, index: g.elements.length }); $event.stopPropagation()">
            <hugeicons-icon aria-hidden="true" [icon]="addIcon" [size]="14" [strokeWidth]="1.8" />Add to {{ g.repeat ? 'each entry' : 'section' }}
          </button>
        }
      </div>
    </ng-template>
  `,
  styles: [FB_SHARED_STYLES, `
    :host { display: flex; flex-direction: column; min-height: 0; min-width: 0; background: var(--ui-color-bg); }
    .tablist { display: flex; align-items: flex-end; gap: 2px; }
    .scroll:focus { outline: none; }
    .form-title, .form-desc, .page-title, .st-heading, .st-para { overflow-wrap: anywhere; min-width: 0; }
    .tabs { display: flex; align-items: flex-end; gap: 2px; padding: var(--ui-space-2) var(--ui-space-3) 0; overflow-x: auto; flex: none;
      border-bottom: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); scrollbar-width: none; }
    .tab { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 var(--ui-space-3); flex: none; max-width: 200px;
      border: 1px solid transparent; border-bottom: 0; border-radius: var(--ui-radius) var(--ui-radius) 0 0; margin-bottom: -1px;
      background: transparent; color: var(--ui-color-text-secondary); font: inherit; font-size: 13px; cursor: pointer; }
    .tab:hover { color: var(--ui-color-text); background: var(--ui-color-surface-hover); }
    .tab.on { color: var(--ui-color-text); background: var(--ui-color-surface); border-color: var(--ui-color-border-subtle, var(--ui-color-border)); font-weight: 550; }
    .tab.over { box-shadow: inset 0 0 0 2px var(--ui-color-primary); }
    .tab:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .tab-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tab.add { color: var(--ui-color-text-muted); }
    .dot-logic { width: 6px; height: 6px; border-radius: 50%; background: var(--ui-color-primary); flex: none; }
    .scroll { flex: 1; min-height: 0; overflow: auto; padding: var(--ui-space-4) var(--ui-space-3) var(--ui-space-12); overscroll-behavior: contain; }
    .paper { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--ui-space-3); container: fb-paper / inline-size; }
    .form-head, .page-open { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%; padding: var(--ui-space-2) var(--ui-space-3);
      border: 1px solid transparent; border-radius: var(--ui-radius); background: transparent; color: var(--ui-color-text); font: inherit; text-align: left; cursor: pointer; }
    .page-head { display: flex; align-items: center; gap: var(--ui-space-1); border: 1px solid transparent; border-radius: var(--ui-radius); padding-right: var(--ui-space-1); }
    .page-open { flex: 1; min-width: 0; flex-direction: row; align-items: center; gap: var(--ui-space-2); flex-wrap: wrap; padding-top: 4px; padding-bottom: 4px; border: 0; }
    .form-head:hover, .page-head:hover { border-color: var(--ui-color-border); }
    .form-head.selected, .page-head.selected { border-color: var(--ui-color-primary); }
    .form-head:focus-visible, .page-open:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .form-title { font-family: var(--ui-font-display); font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
    .form-desc { color: var(--ui-color-text-secondary); font-size: 13px; }
    .page-title { font-size: 15px; font-weight: 600; }
    .list { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: var(--ui-space-2); border-radius: var(--ui-radius); min-height: 8px; transition: background var(--ui-motion-fast); }
    .list.over { background: color-mix(in srgb, var(--ui-color-primary) 6%, transparent); }
    @container fb-paper (max-width: 520px) { .item { grid-column: span 12 !important; } }
    .item { min-width: 0; position: relative; }
    .item.dragging { opacity: 0.4; }
    .card { position: relative; display: flex; align-items: flex-start; gap: 4px; padding: var(--ui-space-2) var(--ui-space-2) var(--ui-space-2) 2px;
      border: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); border-radius: var(--ui-radius); background: var(--ui-color-surface);
      cursor: pointer; transition: border-color var(--ui-motion-fast), box-shadow var(--ui-motion-fast); }
    /* Holding a card opens its settings: keep the phone's own text-selection / callout menu out of it. */
    @media (pointer: coarse) { .card, .group-head { -webkit-touch-callout: none; user-select: none; -webkit-user-select: none; } }
    @media (hover: hover) { .card:hover, .card.group:has(> .group-head:hover) { border-color: var(--ui-color-border-strong, var(--ui-color-border)); } }
    .fb-item-in { animation: fb-item-in 160ms var(--ui-ease-decelerate, ease-out); }
    @keyframes fb-item-in { from { opacity: 0; transform: scale(0.98); } }
    @media (prefers-reduced-motion: reduce) { .fb-item-in { animation: none; } }
    .card:focus-visible, .group-head:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .item.selected > .card { border-color: var(--ui-color-primary); box-shadow: 0 0 0 1px var(--ui-color-primary); }
    .item.problem > .card { border-color: color-mix(in srgb, var(--ui-color-danger) 60%, var(--ui-color-border)); }
    .item.archived > .card { opacity: 0.55; border-style: dashed; }
    .grip { display: inline-grid; place-items: center; width: 20px; height: 24px; flex: none; padding: 0; border: 0; border-radius: var(--ui-radius-xs);
      background: transparent; color: var(--ui-color-text-muted); cursor: grab; touch-action: none; opacity: 0.5; }
    .card:hover .grip, .item.selected .grip, .group-head:hover .grip { opacity: 1; }
    .grip:hover { background: var(--ui-color-surface-hover); color: var(--ui-color-text); }
    .grip:active { cursor: grabbing; }
    @media (pointer: coarse) { .grip { width: 32px; height: 36px; opacity: 0.8; } }
    .main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; padding-top: 2px; }
    .head { display: flex; align-items: center; gap: 6px; min-height: 20px; flex-wrap: wrap; padding-right: 4px; }
    .type-ico { display: inline-grid; place-items: center; width: 20px; height: 20px; flex: none; border-radius: var(--ui-radius-xs); color: var(--ui-color-text-muted); background: var(--ui-color-surface-hover); }
    .label { font-size: 13px; font-weight: 550; color: var(--ui-color-text); min-width: 0; overflow-wrap: anywhere; }
    .label.strong { font-weight: 600; }
    .label.muted { color: var(--ui-color-text-muted); font-style: italic; font-weight: 400; }
    .req { color: var(--ui-color-danger); margin-left: 3px; }
    .badges { display: inline-flex; flex-wrap: wrap; gap: 4px; }
    .help { margin: 0; font-size: 12px; color: var(--ui-color-text-muted); line-height: 1.35; }
    .mock { pointer-events: none; }
    .box { display: flex; align-items: center; gap: 6px; height: 28px; padding: 0 var(--ui-space-2); box-sizing: border-box;
      border: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); border-radius: var(--ui-radius-xs); background: var(--ui-color-bg);
      font-size: 12px; color: var(--ui-color-text-muted); overflow: hidden; white-space: nowrap; }
    .box.tall { height: 52px; align-items: flex-start; padding-top: 6px; }
    .box.chev::after { content: ''; margin-left: auto; width: 6px; height: 6px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: translateY(-2px) rotate(45deg); }
    .box.icon hugeicons-icon, .box .suffix { margin-left: auto; }
    .box.drop { border-style: dashed; justify-content: center; height: 36px; }
    .box.calc { border-style: dashed; background: transparent; color: var(--ui-color-text-secondary); }
    .opts { display: flex; flex-wrap: wrap; gap: 4px var(--ui-space-3); }
    .choice { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ui-color-text-secondary); }
    .dot, .tick { width: 12px; height: 12px; flex: none; border: 1.5px solid var(--ui-color-border-strong, var(--ui-color-border)); box-sizing: border-box; }
    .dot { border-radius: 50%; }
    .tick { border-radius: 3px; }
    .switch { width: 24px; height: 14px; border-radius: 7px; background: var(--ui-color-track, var(--ui-color-border)); position: relative; }
    .switch::after { content: ''; position: absolute; left: 2px; top: 2px; width: 10px; height: 10px; border-radius: 50%; background: var(--ui-color-text-muted); }
    .more-opts { font-size: 12px; color: var(--ui-color-text-muted); }
    .stars { display: flex; gap: 2px; color: var(--ui-color-text-muted); }
    .slider { position: relative; display: flex; align-items: center; gap: var(--ui-space-2); height: 20px; }
    .slider .track { flex: 1; height: 4px; border-radius: 2px; background: var(--ui-color-track, var(--ui-color-border)); }
    .slider .knob { position: absolute; left: 30%; width: 12px; height: 12px; border-radius: 50%; background: var(--ui-color-text-muted); }
    .slider .range { font-size: 11px; color: var(--ui-color-text-muted); }
    .hidden-note { font-size: 12px; color: var(--ui-color-text-muted); font-style: italic; }
    .static .main { padding: 2px 0; }
    .st-heading { font-family: var(--ui-font-display); font-size: 15px; font-weight: 600; }
    .st-para { font-size: 12px; color: var(--ui-color-text-secondary); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .st-divider { flex: 1; min-width: 60px; height: 1px; background: var(--ui-color-border); }
    .tools { position: absolute; top: -13px; right: 6px; z-index: 2; display: flex; gap: 1px; padding: 1px;
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); background: var(--ui-color-surface-raised, var(--ui-color-surface)); box-shadow: var(--ui-shadow-1); }
    .card.group { flex-direction: column; align-items: stretch; gap: var(--ui-space-2); padding: 0 var(--ui-space-2) var(--ui-space-2); cursor: default;
      background: color-mix(in srgb, var(--ui-color-surface) 55%, var(--ui-color-bg)); }
    .card.group.repeat { background-image: linear-gradient(90deg, color-mix(in srgb, var(--ui-color-primary) 40%, transparent) 0 2px, transparent 2px); }
    .group-head { position: relative; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; min-height: 34px; margin: 0 calc(-1 * var(--ui-space-2)); padding: 4px var(--ui-space-2) 4px 2px;
      border-bottom: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); border-radius: var(--ui-radius) var(--ui-radius) 0 0; cursor: pointer; }
    .list.inner { min-height: 36px; }
    .group-empty { margin: 0; padding: var(--ui-space-3); text-align: center; font-size: 12px; color: var(--ui-color-text-muted);
      border: 1px dashed var(--ui-color-border); border-radius: var(--ui-radius-xs); }
    .list.inner:not(:empty) + .group-empty { display: none; }
    .add-in, .add-end { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; height: 28px; padding: 0 var(--ui-space-2);
      border: 1px dashed transparent; border-radius: var(--ui-radius-xs); background: transparent; color: var(--ui-color-text-muted); font: inherit; font-size: 12px; cursor: pointer; }
    .add-in:hover, .add-end:hover { color: var(--ui-color-text); border-color: var(--ui-color-border); background: var(--ui-color-surface); }
    .add-in:focus-visible, .add-end:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .add-end { height: 34px; width: 100%; justify-content: center; border-color: var(--ui-color-border-subtle, var(--ui-color-border)); font-size: 13px; }
    .empty { display: flex; flex-direction: column; align-items: center; gap: var(--ui-space-2); padding: var(--ui-space-8) var(--ui-space-4); text-align: center;
      border: 1px dashed var(--ui-color-border); border-radius: var(--ui-radius); }
    .empty-title { margin: 0; font-size: 15px; font-weight: 600; }
    .empty-text { margin: 0; font-size: 13px; color: var(--ui-color-text-secondary); }
    .starters { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--ui-space-2); margin-top: var(--ui-space-2); }
    .starter { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 var(--ui-space-3); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      background: var(--ui-color-surface); color: var(--ui-color-text); font: inherit; font-size: 13px; cursor: pointer; }
    .starter:hover { border-color: var(--ui-color-border-strong, var(--ui-color-primary)); background: var(--ui-color-surface-hover); }
    .starter:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    @media (pointer: coarse) { .starter, .add-in { min-height: 40px; } .tools { top: -20px; } }
  `],
})
export class FbCanvas {
  protected readonly store = inject(FbBuilderStore);
  private readonly dnd = inject(FbDnd);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Someone wants to add a field at a specific place (the shell shows the palette). */
  readonly addAt = output<UiFbDropTarget>();
  readonly deleteRequest = output<FbDeleteRequest>();
  /** A card was chosen (selected, showing its toolbar). */
  readonly picked = output<string | null>();
  /** Open the settings of a card or page: its toolbar's settings button, a double-click, a long press, or Enter. */
  readonly open = output<string>();

  protected readonly fieldIcons = FIELD_ICONS;
  protected readonly groupIcon = GROUP_ICON;
  protected readonly repeatIcon = REPEAT_ICON;
  protected readonly addIcon = FB_ICONS.Add01Icon;
  protected readonly gripIcon = FB_ICONS.DragDropVerticalIcon;
  protected readonly upIcon = FB_ICONS.ArrowUp01Icon;
  protected readonly downIcon = FB_ICONS.ArrowDown01Icon;
  protected readonly copyIcon = FB_ICONS.Copy01Icon;
  protected readonly deleteIcon = FB_ICONS.Delete02Icon;
  protected readonly moreIcon = FB_ICONS.MoreHorizontalIcon;
  protected readonly settingsIcon = FB_ICONS.Settings02Icon;
  private pressCleanup: (() => void) | null = null;
  private suppressPick = false;
  private touchPress = false;
  protected readonly calIcon = FB_ICONS.Calendar01Icon;
  protected readonly clockIcon = FB_ICONS.Clock02Icon;
  protected readonly starIcon = FB_ICONS.StarIcon;
  protected readonly fileIcon = FB_ICONS.FileUploadIcon;
  protected readonly starters = STARTERS;

  protected readonly dropOver = computed(() => this.dnd.drop()?.over ?? null);
  protected readonly dragId = computed(() => {
    const d = this.dnd.drag();
    return d?.payload.kind === 'move' ? d.payload.id : null;
  });
  protected readonly pageRule = computed(() => {
    const p = this.store.page();
    return p.visibility ? `${p.visibility.action === 'show' ? 'Shown when' : 'Skipped when'} ${this.store.describe(p.visibility.when)}` : '';
  });

  protected openPage(i: number): void {
    if (this.dnd.consumeClick()) return;
    if (this.store.pageIndex() === i) {
      this.store.select(this.store.def().pages[i].id);
      this.open.emit(this.store.def().pages[i].id);
    } else {
      this.store.pageIndex.set(i);
      this.store.select(null);
    }
  }

  /** Arrow keys move between page tabs (and open them), Home/End jump to the ends. */
  protected tabKeys(e: KeyboardEvent): void {
    const n = this.store.def().pages.length;
    const i = this.store.pageIndex();
    const to = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    this.store.pageIndex.set(to);
    this.store.select(null);
    requestAnimationFrame(() => this.host.nativeElement.querySelector<HTMLElement>(`[role=tab][tabindex="0"]`)?.focus());
  }

  protected backgroundClick(e: MouseEvent): void {
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('paper')) {
      if (this.dnd.consumeClick()) return;
      this.store.select(null);
    }
  }

  protected pick(id: string, e: Event): void {
    e.stopPropagation();
    if (this.dnd.consumeClick() || this.suppressPick) return;
    this.store.select(id);
    this.picked.emit(id);
  }

  protected openSettings(id: string, e: Event): void {
    e.stopPropagation();
    if (this.dnd.consumeClick()) return;
    this.store.select(id);
    this.open.emit(id);
  }

  /**
   * On a touch screen, holding a card still opens its settings; a tap only selects it (and shows
   * its toolbar). Moving the finger first means a scroll, so the hold is dropped. Dragging is done
   * from the grip, which stops the press before it gets here.
   */
  protected pressStart(id: string, e: PointerEvent): void {
    this.touchPress = e.pointerType !== 'mouse';
    if (e.pointerType === 'mouse' || !e.isPrimary) return;
    this.pressCleanup?.();
    const x = e.clientX;
    const y = e.clientY;
    const timer = setTimeout(() => {
      this.pressCleanup?.();
      this.suppressPick = true;
      setTimeout(() => (this.suppressPick = false), 500);
      navigator.vibrate?.(8);
      this.store.select(id);
      this.open.emit(id);
    }, LONG_PRESS_MS);
    const move = (ev: PointerEvent) => { if (Math.hypot(ev.clientX - x, ev.clientY - y) > 8) this.pressCleanup?.(); };
    const stop = () => this.pressCleanup?.();
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('scroll', stop, true);
    this.pressCleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('scroll', stop, true);
      this.pressCleanup = null;
    };
  }

  /** A held finger also fires the browser's context menu; on a card the hold means "settings". */
  protected noTouchMenu(e: Event): void {
    if (this.touchPress) e.preventDefault();
  }

  protected pageItems(): UiMenuItem[] {
    const i = this.store.pageIndex();
    const n = this.store.def().pages.length;
    return [
      { label: 'Page settings', value: 'settings' },
      { label: 'Move earlier', value: 'earlier', disabled: i === 0 },
      { label: 'Move later', value: 'later', disabled: i === n - 1 },
      { label: 'Delete page', value: 'delete', danger: true, disabled: n < 2 },
    ];
  }

  protected pageAction(id: string, item: UiMenuItem): void {
    if (item.value === 'settings') {
      this.store.select(id);
      this.open.emit(id);
    } else if (item.value === 'earlier' || item.value === 'later') {
      this.store.movePage(id, item.value === 'earlier' ? -1 : 1);
    } else if (item.value === 'delete') {
      this.deleteRequest.emit({ id });
    }
  }

  protected keys(id: string, e: KeyboardEvent): void {
    if (e.target !== e.currentTarget) return;
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Enter') {
      e.preventDefault();
      this.store.select(id);
      this.open.emit(id);
    } else if (e.key === ' ') {
      e.preventDefault();
      this.store.select(id);
      this.picked.emit(id);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.deleteRequest.emit({ id });
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      this.store.select(id);
      if (this.store.nudge(id, e.key === 'ArrowUp' ? -1 : 1)) this.refocus(id);
    } else if (mod && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      this.store.duplicate(id);
    }
  }

  protected startMove(el: UiFbElement, e: PointerEvent): void {
    e.stopPropagation();
    const icon = el.kind === 'field' ? FIELD_ICONS[el.type] : el.kind === 'group' ? (el.repeat ? REPEAT_ICON : GROUP_ICON) : STATIC_ICONS[el.type];
    this.dnd.begin({ kind: 'move', id: el.id, label: this.store.name(el.id), icon }, e, { immediate: true });
  }

  protected addStarter(type: UiFbFieldType | 'group'): void {
    const el = type === 'group' ? createGroup(this.store.def()) : createField(type, this.store.def());
    this.store.add(el, { containerId: this.store.page().id, index: this.store.page().elements.length });
  }

  protected moreItems(el: UiFbElement): UiMenuItem[] {
    const entry = this.store.index().get(el.id);
    const items: UiMenuItem[] = [];
    if (entry?.parentId && this.store.index().get(entry.parentId)?.kind === 'group') items.push({ label: 'Move out of the section', value: 'out' });
    this.store.def().pages.forEach((p, i) => {
      if (p.id !== entry?.page.id) items.push({ label: `Move to ${p.title || 'Page ' + (i + 1)}`, value: `page:${p.id}` });
    });
    items.push(el.archived ? { label: 'Restore', value: 'restore' } : { label: 'Archive (hide, keep answers)', value: 'archive' });
    return items;
  }

  protected more(el: UiFbElement, item: UiMenuItem): void {
    const v = item.value;
    const entry = this.store.index().get(el.id);
    if (!entry) return;
    if (v === 'out') {
      const parent = this.store.index().get(entry.parentId)!;
      this.store.move(el.id, { containerId: parent.parentId, index: parent.index + 1 });
    } else if (v.startsWith('page:')) {
      const pageId = v.slice(5);
      const page = this.store.def().pages.find((p) => p.id === pageId);
      if (this.store.move(el.id, { containerId: pageId, index: page?.elements.length ?? 0 })) this.store.select(el.id);
    } else if (v === 'archive') this.store.setArchived(el.id, true);
    else if (v === 'restore') this.store.setArchived(el.id, false);
  }

  protected span(el: UiFbElement, cols: number): number {
    const w = el.kind === 'static' && el.type !== 'paragraph' ? undefined : el.layout?.width;
    if (w) return SPAN[w] ?? 12;
    if (el.kind === 'static' && el.type !== 'paragraph') return 12;
    return cols > 1 ? Math.round(12 / cols) : 12;
  }

  protected repeatText(g: UiFbGroup): string {
    const min = g.repeat?.min ?? 0;
    const max = g.repeat?.max;
    if (max) return min ? `${min} to ${max} entries` : `Up to ${max} entries`;
    return min > 1 ? `At least ${min} entries` : 'Repeats';
  }

  protected liveOptions(f: UiFbField) {
    return (f.options ?? []).filter((o) => !o.archived);
  }

  protected stars(f: UiFbField): number[] {
    return Array.from({ length: Math.min(10, f.props?.maxRating ?? 5) });
  }

  protected typeInfo(t: UiFbFieldType) {
    return fieldTypeInfo(t);
  }

  protected isObj(v: unknown): boolean {
    return !!v && typeof v === 'object';
  }

  protected asField(el: UiFbElement): UiFbField {
    return el as UiFbField;
  }

  protected asGroup(el: UiFbElement): UiFbGroup {
    return el as UiFbGroup;
  }

  protected asStatic(el: UiFbElement): UiFbStatic {
    return el as UiFbStatic;
  }

  /** Keeps keyboard focus on a card after it moved. */
  private refocus(id: string): void {
    requestAnimationFrame(() => {
      const card = this.host.nativeElement.querySelector<HTMLElement>(`[data-fb-item="${id}"] > .card, [data-fb-item="${id}"] .group-head`);
      card?.focus();
      card?.scrollIntoView({ block: 'nearest' });
    });
  }
}
