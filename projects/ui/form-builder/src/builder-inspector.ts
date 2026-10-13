import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiButton, UiSegmented } from '@zouriel/ui/button';
import { UiInput, UiNumberInput, UiSwitch, UiTextarea } from '@zouriel/ui/form';
import { FIELD_ICONS, GROUP_ICON, REPEAT_ICON, STATIC_ICONS, FB_ICONS } from './builder-icons';
import { FbConditionEditor, FbValueInput } from './builder-condition';
import { FbCalcEditor, FbChecksEditor, FbOptionsEditor } from './builder-editors';
import { FbBuilderStore, type UiFbRefOption } from './builder-store';
import { FB_SHARED_STYLES } from './builder-styles';
import { UI_FB_SOURCE_FIELD_TYPES } from './option-sources';
import { createField, fbKeyValid, fbSlug, fbUid, uniqueKey, type UiFbRefKind } from './definition';
import { fieldTypeInfo, typesCompatible, UI_FB_FIELD_TYPES, valueKindOf } from './field-types';
import type {
  UiFbCondition,
  UiFbElement,
  UiFbField,
  UiFbFieldProps,
  UiFbFieldType,
  UiFbGroup,
  UiFbJump,
  UiFbOperand,
  UiFbPage,
  UiFbSetValue,
  UiFbStatic,
  UiFbToggle,
  UiFbVisibility,
} from './schema';

type Tab = 'settings' | 'logic' | 'checks';

const REF_WORDS: Record<UiFbRefKind, string> = {
  visibility: 'when it shows',
  required: 'when it’s required',
  disabled: 'when it’s read-only',
  setValue: 'to fill itself in',
  validator: 'in a check',
  calc: 'in its calculation',
  jump: 'in a page jump',
  source: 'to narrow its list',
};

const AUTOCOMPLETE = [
  { value: '', label: 'Let the browser decide' },
  { value: 'off', label: 'Off' },
  { value: 'name', label: 'Full name' },
  { value: 'given-name', label: 'First name' },
  { value: 'family-name', label: 'Last name' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Phone' },
  { value: 'street-address', label: 'Street address' },
  { value: 'address-level2', label: 'Town or city' },
  { value: 'postal-code', label: 'Postcode' },
  { value: 'country-name', label: 'Country' },
  { value: 'organization', label: 'Organisation' },
  { value: 'bday', label: 'Date of birth' },
];

/**
 * `ui-fb-inspector` — settings for whatever is selected: a field, section,
 * text block, page, or (with nothing selected) the form itself.
 */
@Component({
  selector: 'ui-fb-inspector',
  imports: [
    NgTemplateOutlet, FormsModule, HugeiconsIconComponent, UiButton, UiSegmented, UiInput, UiNumberInput, UiSwitch, UiTextarea,
    FbConditionEditor, FbValueInput, FbOptionsEditor, FbChecksEditor, FbCalcEditor,
  ],
  template: `
    @let sel = store.selected();
    @if (showHead()) {
    <header class="head">
      <span class="head-ico"><hugeicons-icon aria-hidden="true" [icon]="headIcon()" [size]="15" [strokeWidth]="1.8" /></span>
      <div class="head-txt">
        <span class="head-kind">{{ headKind() }}</span>
        <span class="head-name">{{ headName() }}</span>
      </div>
    </header>
    }
    @if (tabs().length > 1) {
      <div class="tabs" role="tablist" aria-label="Settings sections" (keydown)="tabKeys($event)">
        @for (t of tabs(); track t.id) {
          <button type="button" role="tab" class="tab" [class.on]="tab() === t.id" [attr.aria-selected]="tab() === t.id" (click)="tab.set(t.id)"
            [id]="store.uid + '-itab-' + t.id" [attr.aria-controls]="store.uid + '-ipanel'" [tabindex]="tab() === t.id ? 0 : -1">
            {{ t.label }}@if (t.count) {<span class="count">{{ t.count }}</span>}
          </button>
        }
      </div>
    }

    <div class="body" [attr.role]="tabs().length > 1 ? 'tabpanel' : null" [id]="store.uid + '-ipanel'"
      [attr.aria-labelledby]="tabs().length > 1 ? store.uid + '-itab-' + tab() : null">
      @if (!sel) {
        <ng-container *ngTemplateOutlet="formTpl" />
      } @else {
        @switch (sel.kind) {
          @case ('field') { <ng-container *ngTemplateOutlet="fieldTpl; context: { $implicit: asField(sel.element) }" /> }
          @case ('group') { <ng-container *ngTemplateOutlet="groupTpl; context: { $implicit: asGroup(sel.element) }" /> }
          @case ('static') { <ng-container *ngTemplateOutlet="staticTpl; context: { $implicit: asStatic(sel.element) }" /> }
          @case ('page') { <ng-container *ngTemplateOutlet="pageTpl; context: { $implicit: asPage(sel.element) }" /> }
        }
      }
    </div>

    <!-- Field -->
    <ng-template #fieldTpl let-f>
      @let info = typeInfo(f.type);
      @if (tab() === 'settings') {
        <div class="fb-stack">
          @if (f.archived) { <p class="fb-warn">This question is archived: new answers can’t be given, old ones are kept. <button type="button" class="fb-link" (click)="store.setArchived(f.id, false)">Restore it</button></p> }
          <label class="fld"><span class="fb-label">{{ f.type === 'hidden' ? 'Name' : 'Question' }}</span>
            <ui-input [ngModel]="f.label" (ngModelChange)="setLabel(f, $event)" placeholder="What do you want to ask?" />
          </label>
          @if (f.type !== 'hidden') {
            <label class="fld"><span class="fb-label">Help text</span>
              <ui-textarea [ngModel]="f.help ?? ''" (ngModelChange)="store.updateField(f.id, { help: $event || undefined }, 'help:' + f.id)" [rows]="2" [autosize]="true" [maxRows]="6" placeholder="Optional. Shown under the box." />
            </label>
          }
          @if (info.placeholder) {
            <label class="fld"><span class="fb-label">Placeholder</span>
              <ui-input [ngModel]="f.placeholder ?? ''" (ngModelChange)="store.updateField(f.id, { placeholder: $event || undefined }, 'ph:' + f.id)" placeholder="Example text shown in the empty box" />
            </label>
          }
          <label class="fld"><span class="fb-label">Type</span>
            <select class="fb-native-select" (change)="changeType(f, $any($event.target).value)">
              @for (t of typeChoices(f); track t.type) { <option [value]="t.type" [selected]="t.type === f.type">{{ t.label }}</option> }
            </select>
            @if (store.hasAnswers(f.id)) { <span class="fb-hint">This question has answers, so it can only change to a similar type.</span> }
          </label>

          @if (info.hasOptions) {
            <div class="fld"><span class="fb-label">Options</span><ui-fb-options [field]="f" /></div>
          }

          @switch (f.type) {
            @case ('number') { <ng-container *ngTemplateOutlet="numberProps; context: { $implicit: f }" /> }
            @case ('currency') { <ng-container *ngTemplateOutlet="numberProps; context: { $implicit: f }" /> }
            @case ('slider') { <ng-container *ngTemplateOutlet="numberProps; context: { $implicit: f }" /> }
            @case ('textarea') {
              <div class="fb-grid2">
                <label class="fld"><span class="fb-label">Starts with lines</span><ui-number-input [ngModel]="f.props?.rows ?? 3" (ngModelChange)="prop(f, 'rows', $event)" [min]="1" [max]="20" ariaLabel="Lines" /></label>
                <label class="fld"><span class="fb-label">Grows up to</span><ui-number-input [ngModel]="f.props?.maxRows ?? 8" (ngModelChange)="prop(f, 'maxRows', $event)" [min]="1" [max]="40" ariaLabel="Most lines" /></label>
              </div>
            }
            @case ('rating') {
              <label class="fld"><span class="fb-label">Number of stars</span><ui-number-input [ngModel]="f.props?.maxRating ?? 5" (ngModelChange)="prop(f, 'maxRating', $event)" [min]="2" [max]="10" ariaLabel="Stars" /></label>
            }
            @case ('file') {
              <ui-switch [ngModel]="!!f.props?.multiple" (ngModelChange)="prop(f, 'multiple', $event || undefined)">Allow several files</ui-switch>
              <label class="fld"><span class="fb-label">Accepted files</span>
                <ui-input [ngModel]="f.props?.accept ?? ''" (ngModelChange)="prop(f, 'accept', $event || undefined)" placeholder=".pdf, .docx, image/*" />
                <span class="fb-hint">Leave empty to accept any file. Add a “File types” check to enforce it.</span>
              </label>
            }
            @case ('checkbox') { <ng-container *ngTemplateOutlet="captionProp; context: { $implicit: f }" /> }
            @case ('toggle') { <ng-container *ngTemplateOutlet="captionProp; context: { $implicit: f }" /> }
            @case ('radio') { <ng-container *ngTemplateOutlet="orientProp; context: { $implicit: f }" /> }
            @case ('checkboxes') {
              <ng-container *ngTemplateOutlet="orientProp; context: { $implicit: f }" />
              <ui-switch [ngModel]="!!f.props?.selectAll" (ngModelChange)="prop(f, 'selectAll', $event || undefined)">Offer “Select all”</ui-switch>
            }
            @case ('calculated') {
              <div class="fld"><ui-fb-calc [field]="f" /></div>
              <label class="fld"><span class="fb-label">Show the result as</span>
                <select class="fb-native-select" (change)="prop(f, 'format', $any($event.target).value)">
                  <option value="number" [selected]="(f.props?.format ?? 'number') === 'number'">A number</option>
                  <option value="currency" [selected]="f.props?.format === 'currency'">Money</option>
                  <option value="text" [selected]="f.props?.format === 'text'">Text</option>
                </select>
              </label>
              @if (f.props?.format === 'currency') {
                <label class="fld"><span class="fb-label">Currency code</span><ui-input [ngModel]="f.props?.currency ?? 'USD'" (ngModelChange)="prop(f, 'currency', ($event || '').toUpperCase())" placeholder="USD" /></label>
              } @else if (f.props?.format !== 'text') {
                <div class="fb-grid2">
                  <label class="fld"><span class="fb-label">Before it</span><ui-input [ngModel]="f.props?.prefix ?? ''" (ngModelChange)="prop(f, 'prefix', $event || undefined)" placeholder="e.g. #" /></label>
                  <label class="fld"><span class="fb-label">After it</span><ui-input [ngModel]="f.props?.suffix ?? ''" (ngModelChange)="prop(f, 'suffix', $event || undefined)" placeholder="e.g. years" /></label>
                </div>
              }
              <ui-switch [ngModel]="!!f.props?.excludeFromData" (ngModelChange)="prop(f, 'excludeFromData', $event || undefined)">Show it, but don’t save it</ui-switch>
            }
          }

          @if (canDefault(f)) {
            <div class="fld">
              <span class="fb-label">{{ f.type === 'hidden' ? 'Value' : 'Starts with' }}</span>
              <ui-fb-value [subject]="selfRef(f)" [op]="isMulti(f) ? 'includesAny' : 'eq'" [operand]="defaultOperand(f)" [constOnly]="true" [label]="f.type === 'hidden' ? 'Value' : 'Starts with'" (operandChange)="setDefault(f, $event)" />
              @if (f.defaultValue != null && f.defaultValue !== '') { <button type="button" class="fb-link clear" (click)="store.updateField(f.id, { defaultValue: undefined })">Clear</button> }
              @if (f.type === 'hidden') { <span class="fb-hint">Saved with every answer, e.g. a campaign name. Apps can also fill it in.</span> }
            </div>
          }

          @if (f.type !== 'hidden') {
            <section class="group-sec">
              <h4>Layout</h4>
              <div class="fld"><span class="fb-label">Width</span>
                <ui-segmented size="sm" label="Width" [options]="widths" [value]="f.layout?.width ?? 'full'" (valueChange)="layout(f, 'width', $event === 'full' ? undefined : $event)" />
              </div>
              @if (f.type !== 'calculated') {
                <div class="fb-grid2">
                  <label class="fld"><span class="fb-label">Question text</span>
                    <select class="fb-native-select" (change)="layout(f, 'labelPlacement', $any($event.target).value || undefined)">
                      <option value="" [selected]="!f.layout?.labelPlacement">Form default</option>
                      <option value="top" [selected]="f.layout?.labelPlacement === 'top'">Above the box</option>
                      <option value="inside" [selected]="f.layout?.labelPlacement === 'inside'" [disabled]="!info.textLike">Inside the box</option>
                      <option value="left" [selected]="f.layout?.labelPlacement === 'left'">To the left</option>
                      <option value="hidden" [selected]="f.layout?.labelPlacement === 'hidden'">Hidden</option>
                    </select>
                  </label>
                  <label class="fld"><span class="fb-label">Error message</span>
                    <select class="fb-native-select" (change)="layout(f, 'errorPlacement', $any($event.target).value || undefined)">
                      <option value="" [selected]="!f.layout?.errorPlacement">Form default</option>
                      <option value="below" [selected]="f.layout?.errorPlacement === 'below'">Below the box</option>
                      <option value="inside" [selected]="f.layout?.errorPlacement === 'inside'" [disabled]="!info.textLike">Inside the box</option>
                    </select>
                  </label>
                </div>
                @if (!info.textLike) { <p class="fb-hint">“Inside the box” works for text, number and email boxes; this field shows them above and below.</p> }
                @if (f.layout?.labelPlacement === 'hidden') { <p class="fb-hint">Screen readers still read the question. Use it when the heading above already says it.</p> }
              }
            </section>
          }

          <section class="group-sec">
            <h4>Saved data</h4>
            <label class="fld"><span class="fb-label">Saved as</span>
              <input class="key" [value]="keyDraft()" (input)="keyDraft.set($any($event.target).value)" (blur)="commitKey(f)" (keydown.enter)="commitKey(f)"
                [class.bad]="keyError()" [attr.aria-invalid]="keyError() ? true : null" spellcheck="false" autocomplete="off" [attr.aria-describedby]="store.uid + '-key-hint'" />
              <span class="fb-hint" [id]="store.uid + '-key-hint'">{{ keyError() || 'The name this answer has in the saved JSON.' }}</span>
              @if (store.hasAnswers(f.id) && keyDraft() !== f.key) { <p class="fb-warn">Answers already use “{{ f.key }}”. Old answers still load: the old name is remembered.</p> }
            </label>
            @if (info.textLike && f.type !== 'number' && f.type !== 'currency') {
              <label class="fld"><span class="fb-label">Browser autofill</span>
                <select class="fb-native-select" (change)="prop(f, 'autocomplete', $any($event.target).value || undefined)">
                  @for (a of autocomplete; track a.value) { <option [value]="a.value" [selected]="(f.props?.autocomplete ?? '') === a.value">{{ a.label }}</option> }
                </select>
              </label>
            }
          </section>
          <ng-container *ngTemplateOutlet="actions; context: { $implicit: f }" />
        </div>
      }
      @if (tab() === 'logic') { <ng-container *ngTemplateOutlet="logicTpl; context: { $implicit: f }" /> }
      @if (tab() === 'checks') { <ui-fb-checks [field]="f" /> }
    </ng-template>

    <ng-template #numberProps let-f>
      <div class="fb-grid2">
        <label class="fld"><span class="fb-label">Lowest</span><ui-number-input [ngModel]="f.props?.min ?? null" (ngModelChange)="prop(f, 'min', $event ?? undefined)" ariaLabel="Lowest" placeholder="Any" /></label>
        <label class="fld"><span class="fb-label">Highest</span><ui-number-input [ngModel]="f.props?.max ?? null" (ngModelChange)="prop(f, 'max', $event ?? undefined)" ariaLabel="Highest" placeholder="Any" /></label>
        @if (f.type !== 'currency') {
          <label class="fld"><span class="fb-label">Steps of</span><ui-number-input [ngModel]="f.props?.step ?? 1" (ngModelChange)="prop(f, 'step', $event ?? undefined)" [min]="0" ariaLabel="Step" /></label>
        }
        @if (f.type === 'currency') {
          <label class="fld"><span class="fb-label">Currency</span><ui-input [ngModel]="f.props?.currency ?? 'USD'" (ngModelChange)="prop(f, 'currency', ($event || '').toUpperCase())" placeholder="USD" /></label>
        }
        @if (f.type !== 'slider') {
          <label class="fld"><span class="fb-label">Decimals</span><ui-number-input [ngModel]="f.props?.decimals ?? null" (ngModelChange)="prop(f, 'decimals', $event ?? undefined)" [min]="0" [max]="6" ariaLabel="Decimals" placeholder="Any" /></label>
        }
        @if (f.type === 'number') {
          <label class="fld"><span class="fb-label">Unit</span><ui-input [ngModel]="f.props?.suffix ?? ''" (ngModelChange)="prop(f, 'suffix', $event || undefined)" placeholder="e.g. kg" /></label>
        }
      </div>
      @if (f.type !== 'slider') { <p class="fb-hint">Lowest and highest guide the arrows. Add a check to enforce them.</p> }
    </ng-template>

    <ng-template #captionProp let-f>
      <label class="fld"><span class="fb-label">Text next to it</span>
        <ui-input [ngModel]="f.props?.caption ?? ''" (ngModelChange)="prop(f, 'caption', $event || undefined)" placeholder="I agree" />
      </label>
    </ng-template>

    <ng-template #orientProp let-f>
      <div class="fld"><span class="fb-label">Arrange options</span>
        <ui-segmented size="sm" label="Arrange options" [options]="orientations" [value]="f.props?.orientation ?? 'vertical'" (valueChange)="prop(f, 'orientation', $any($event))" />
      </div>
    </ng-template>

    <ng-template #actions let-el>
      <div class="actions">
        <ui-button size="sm" variant="outline" (click)="store.duplicate(el.id)"><hugeicons-icon aria-hidden="true" [icon]="copyIcon" [size]="14" [strokeWidth]="1.8" />Duplicate</ui-button>
        <ui-button size="sm" variant="outline" (click)="deleteRequest.emit(el.id)"><hugeicons-icon aria-hidden="true" [icon]="deleteIcon" [size]="14" [strokeWidth]="1.8" />Delete</ui-button>
      </div>
    </ng-template>

    <!-- Logic (fields, sections, text) -->
    <ng-template #logicTpl let-el>
      <div class="fb-stack">
        <section class="group-sec first">
          <h4>{{ el.kind === 'group' ? 'Show this section' : el.kind === 'static' ? 'Show this' : 'Show this question' }}</h4>
          <ui-segmented size="sm" label="When to show it" [options]="visModes" [value]="visMode(el.visibility)" (valueChange)="setVisMode(el, $event)" />
          @if (el.visibility) {
            <ui-fb-condition [condition]="el.visibility.when" [forId]="el.id" (conditionChange)="setVisWhen(el, $event)" />
            <p class="sentence">{{ el.visibility.action === 'show' ? 'Shown only when' : 'Hidden when' }} {{ store.describe(el.visibility.when) }}.</p>
          }
        </section>

        @if (el.kind !== 'static') {
          <section class="group-sec">
            <h4>Can people change it?</h4>
            <ui-segmented size="sm" label="Can people change it" [options]="lockModes" [value]="lockMode(el.disabled)" (valueChange)="setLock(el, $event)" />
            @if (isObj(el.disabled)) {
              <ui-fb-condition [condition]="el.disabled.when" [forId]="el.id" (conditionChange)="setLockWhen(el, $event)" />
            }
            <p class="fb-hint">Read-only answers are still saved, but not checked.</p>
          </section>
        }

        @if (el.kind === 'field' && el.type !== 'calculated') {
          <section class="group-sec">
            <h4>Fill in automatically</h4>
            @for (sv of el.setValue ?? []; track sv.id) {
              <div class="setv">
                <div class="fb-row"><span class="fb-label grow">When</span>
                  <button type="button" class="fb-icon-btn danger" (click)="removeSetValue(el, sv)" aria-label="Remove this rule"><hugeicons-icon aria-hidden="true" [icon]="removeIcon" [size]="14" [strokeWidth]="1.8" /></button>
                </div>
                <ui-fb-condition [condition]="sv.when" [forId]="el.id" (conditionChange)="patchSetValue(el, sv, { when: $event })" />
                <span class="fb-label">set this to</span>
                <ui-fb-value [subject]="selfRef(el)" [op]="isMulti(el) ? 'includesAny' : 'eq'" [operand]="sv.value" [forId]="el.id" label="Set this to" (operandChange)="patchSetValue(el, sv, { value: $event })" />
              </div>
            }
            <button type="button" class="fb-link" (click)="addSetValue(el)"><hugeicons-icon aria-hidden="true" [icon]="addIcon" [size]="13" [strokeWidth]="2" /> Add a rule</button>
            <p class="fb-hint">The answer is set once each time the rule starts to apply. People can still change it.</p>
          </section>
        }

        <section class="group-sec">
          <h4>Used by</h4>
          @for (r of usedBy(); track r.ownerId + r.kind) {
            <button type="button" class="ref" (click)="store.select(r.ownerId)">“{{ store.name(r.ownerId) }}” <span>{{ refWords[r.kind] }}</span></button>
          } @empty {
            <p class="fb-hint">No other rules depend on this.</p>
          }
        </section>
      </div>
    </ng-template>

    <!-- Section -->
    <ng-template #groupTpl let-g>
      @if (tab() === 'settings') {
        <div class="fb-stack">
          @if (g.archived) { <p class="fb-warn">This section is archived. <button type="button" class="fb-link" (click)="store.setArchived(g.id, false)">Restore it</button></p> }
          <label class="fld"><span class="fb-label">Title</span>
            <ui-input [ngModel]="g.title ?? ''" (ngModelChange)="store.updateGroup(g.id, { title: $event || undefined }, 'title:' + g.id)" placeholder="e.g. Contact details" />
          </label>
          <label class="fld"><span class="fb-label">Description</span>
            <ui-textarea [ngModel]="g.description ?? ''" (ngModelChange)="store.updateGroup(g.id, { description: $event || undefined }, 'desc:' + g.id)" [rows]="2" [autosize]="true" [maxRows]="6" placeholder="Optional" />
          </label>
          <div class="fld"><span class="fb-label">Columns inside</span>
            <ui-segmented size="sm" label="Columns" [options]="columns" [value]="'' + (g.columns ?? 1)" (valueChange)="store.updateGroup(g.id, { columns: $event === '1' ? undefined : $any(+$event!) })" />
          </div>
          <div class="fld"><span class="fb-label">Width</span>
            <ui-segmented size="sm" label="Width" [options]="widths" [value]="g.layout?.width ?? 'full'" (valueChange)="store.updateGroup(g.id, { layout: $event === 'full' ? undefined : { width: $any($event) } })" />
          </div>
          <section class="group-sec">
            <h4>Repeating</h4>
            <ui-switch [ngModel]="!!g.repeat" (ngModelChange)="setRepeat(g, $event)" [disabled]="!!nestedRepeat(g)">People can add this section more than once</ui-switch>
            @if (nestedRepeat(g)) { <p class="fb-hint">A section inside a repeating section can’t repeat itself.</p> }
            @if (g.repeat) {
              <div class="fb-grid2">
                <label class="fld"><span class="fb-label">At least</span><ui-number-input [ngModel]="g.repeat.min ?? 0" (ngModelChange)="repeat(g, { min: $event ?? 0 })" [min]="0" ariaLabel="At least" /></label>
                <label class="fld"><span class="fb-label">At most</span><ui-number-input [ngModel]="g.repeat.max ?? null" (ngModelChange)="repeat(g, { max: $event ?? undefined })" [min]="1" ariaLabel="At most" placeholder="No limit" /></label>
              </div>
              <label class="fld"><span class="fb-label">Add button</span><ui-input [ngModel]="g.repeat.addLabel ?? ''" (ngModelChange)="repeat(g, { addLabel: $event || undefined })" placeholder="Add another" /></label>
              <label class="fld"><span class="fb-label">Each entry is called</span><ui-input [ngModel]="g.repeat.itemLabel ?? ''" (ngModelChange)="repeat(g, { itemLabel: $event || undefined })" placeholder="Entry {n}" />
                <span class="fb-hint">{{ '{n}' }} becomes the entry’s number.</span></label>
            }
          </section>
          <section class="group-sec">
            <h4>Saved data</h4>
            <ui-switch [ngModel]="!!g.key" (ngModelChange)="setGroupKey(g, $event)" [disabled]="!!g.repeat">Keep its answers together</ui-switch>
            <p class="fb-hint">{{ g.repeat ? 'Entries are saved as a list under this name.' : 'Saves this section’s answers inside one object, e.g. address.street.' }}</p>
            @if (g.key) {
              <input class="key" [value]="keyDraft()" (input)="keyDraft.set($any($event.target).value)" (blur)="commitKey(g)" (keydown.enter)="commitKey(g)" [class.bad]="keyError()" [attr.aria-invalid]="keyError() ? true : null" spellcheck="false" autocomplete="off" aria-label="Saved as" />
              @if (keyError()) { <span class="fb-hint bad">{{ keyError() }}</span> }
            }
          </section>
          <ng-container *ngTemplateOutlet="actions; context: { $implicit: g }" />
        </div>
      }
      @if (tab() === 'logic') { <ng-container *ngTemplateOutlet="logicTpl; context: { $implicit: g }" /> }
    </ng-template>

    <!-- Heading / text / divider -->
    <ng-template #staticTpl let-s>
      @if (tab() === 'settings') {
        <div class="fb-stack">
          <div class="fld"><span class="fb-label">Kind</span>
            <ui-segmented size="sm" label="Kind" [options]="staticKinds" [value]="s.type" (valueChange)="store.updateStatic(s.id, { type: $any($event) })" />
          </div>
          @if (s.type === 'heading') {
            <label class="fld"><span class="fb-label">Heading</span><ui-input [ngModel]="s.text ?? ''" (ngModelChange)="store.updateStatic(s.id, { text: $event }, 'text:' + s.id)" /></label>
          } @else if (s.type === 'paragraph') {
            <label class="fld"><span class="fb-label">Text</span><ui-textarea [ngModel]="s.text ?? ''" (ngModelChange)="store.updateStatic(s.id, { text: $event }, 'text:' + s.id)" [rows]="4" [autosize]="true" [maxRows]="14" /></label>
            <div class="fld"><span class="fb-label">Width</span>
              <ui-segmented size="sm" label="Width" [options]="widths" [value]="s.layout?.width ?? 'full'" (valueChange)="store.updateStatic(s.id, { layout: $event === 'full' ? undefined : { width: $any($event) } })" />
            </div>
          }
          <ng-container *ngTemplateOutlet="actions; context: { $implicit: s }" />
        </div>
      }
      @if (tab() === 'logic') { <ng-container *ngTemplateOutlet="logicTpl; context: { $implicit: s }" /> }
    </ng-template>

    <!-- Page -->
    <ng-template #pageTpl let-p>
      @let i = pageIndexOf(p);
      @if (tab() === 'settings') {
        <div class="fb-stack">
          <label class="fld"><span class="fb-label">Page title</span>
            <ui-input [ngModel]="p.title ?? ''" (ngModelChange)="store.updatePage(p.id, { title: $event || undefined }, 'ptitle:' + p.id)" [placeholder]="'Page ' + (i + 1)" />
          </label>
          <label class="fld"><span class="fb-label">Description</span>
            <ui-textarea [ngModel]="p.description ?? ''" (ngModelChange)="store.updatePage(p.id, { description: $event || undefined }, 'pdesc:' + p.id)" [rows]="2" [autosize]="true" [maxRows]="6" placeholder="Optional" />
          </label>
          <div class="actions">
            <ui-button size="sm" variant="outline" [disabled]="i === 0" (click)="store.movePage(p.id, -1)"><hugeicons-icon aria-hidden="true" [icon]="leftIcon" [size]="14" [strokeWidth]="1.8" />Earlier</ui-button>
            <ui-button size="sm" variant="outline" [disabled]="i === store.def().pages.length - 1" (click)="store.movePage(p.id, 1)">Later<hugeicons-icon aria-hidden="true" [icon]="rightIcon" [size]="14" [strokeWidth]="1.8" /></ui-button>
            @if (store.def().pages.length > 1) {
              <ui-button size="sm" variant="outline" (click)="deleteRequest.emit(p.id)"><hugeicons-icon aria-hidden="true" [icon]="deleteIcon" [size]="14" [strokeWidth]="1.8" />Delete page</ui-button>
            }
          </div>
        </div>
      }
      @if (tab() === 'logic') {
        <div class="fb-stack">
          <section class="group-sec first">
            <h4>Show this page</h4>
            <ui-segmented size="sm" label="When to show the page" [options]="pageVisModes" [value]="visMode(p.visibility)" (valueChange)="setPageVis(p, $event)" />
            @if (p.visibility) {
              <ui-fb-condition [condition]="p.visibility.when" [forId]="p.id" (conditionChange)="store.updatePage(p.id, { visibility: { action: p.visibility!.action, when: $event } }, 'pvis:' + p.id)" />
              <p class="sentence">{{ p.visibility.action === 'show' ? 'Shown only when' : 'Skipped when' }} {{ store.describe(p.visibility.when) }}.</p>
            }
          </section>
          <section class="group-sec">
            <h4>After this page</h4>
            @for (j of p.jumps ?? []; track j.id) {
              <div class="setv">
                <div class="fb-row"><span class="fb-label grow">When</span>
                  <button type="button" class="fb-icon-btn danger" (click)="removeJump(p, j)" aria-label="Remove this jump"><hugeicons-icon aria-hidden="true" [icon]="removeIcon" [size]="14" [strokeWidth]="1.8" /></button>
                </div>
                <ui-fb-condition [condition]="j.when" [forId]="p.id" (conditionChange)="patchJump(p, j, { when: $event })" />
                <label class="fld"><span class="fb-label">go to</span>
                  <select class="fb-native-select" (change)="patchJump(p, j, { to: $any($event.target).value })">
                    @for (q of laterPages(i); track q.id) { <option [value]="q.id" [selected]="q.id === j.to">{{ q.label }}</option> }
                    <option value="end" [selected]="j.to === 'end'">The end (submit)</option>
                  </select>
                </label>
              </div>
            }
            <button type="button" class="fb-link" (click)="addJump(p, i)"><hugeicons-icon aria-hidden="true" [icon]="addIcon" [size]="13" [strokeWidth]="2" /> Add a jump</button>
            <p class="fb-hint">Without a jump, people continue to the next page. The first jump that matches wins; pages jumped over are skipped.</p>
          </section>
        </div>
      }
    </ng-template>

    <!-- Form -->
    <ng-template #formTpl>
      @let def = store.def();
      @let s = def.settings ?? {};
      <div class="fb-stack">
        <label class="fld"><span class="fb-label">Form title</span>
          <ui-input [ngModel]="def.title" (ngModelChange)="store.updateForm({ title: $event }, 'ftitle')" />
        </label>
        <label class="fld"><span class="fb-label">Description</span>
          <ui-textarea [ngModel]="def.description ?? ''" (ngModelChange)="store.updateForm({ description: $event || undefined }, 'fdesc')" [rows]="2" [autosize]="true" [maxRows]="6" placeholder="Shown at the top of the form" />
        </label>
        <section class="group-sec">
          <h4>Questions</h4>
          <div class="fb-grid2">
            <label class="fld"><span class="fb-label">Question text</span>
              <select class="fb-native-select" (change)="store.updateSettings({ labelPlacement: $any($event.target).value })">
                <option value="top" [selected]="(s.labelPlacement ?? 'top') === 'top'">Above the box</option>
                <option value="inside" [selected]="s.labelPlacement === 'inside'">Inside the box</option>
                <option value="left" [selected]="s.labelPlacement === 'left'">To the left</option>
              </select>
            </label>
            <label class="fld"><span class="fb-label">Error messages</span>
              <select class="fb-native-select" (change)="store.updateSettings({ errorPlacement: $any($event.target).value })">
                <option value="below" [selected]="(s.errorPlacement ?? 'below') === 'below'">Below the box</option>
                <option value="inside" [selected]="s.errorPlacement === 'inside'">Inside the box</option>
              </select>
            </label>
          </div>
          <p class="fb-hint">Each question can override these. “Inside the box” applies to text boxes only.</p>
          <label class="fld"><span class="fb-label">Mark questions</span>
            <select class="fb-native-select" (change)="store.updateSettings({ requiredMarker: $any($event.target).value })">
              <option value="asterisk" [selected]="(s.requiredMarker ?? 'asterisk') === 'asterisk'">Required ones with *</option>
              <option value="optional" [selected]="s.requiredMarker === 'optional'">Optional ones with “(optional)”</option>
              <option value="none" [selected]="s.requiredMarker === 'none'">Don’t mark</option>
            </select>
          </label>
        </section>
        <section class="group-sec">
          <h4>Checking answers</h4>
          <label class="fld"><span class="fb-label">Show problems</span>
            <select class="fb-native-select" (change)="store.updateSettings({ validateOn: $any($event.target).value })">
              <option value="blur" [selected]="(s.validateOn ?? 'blur') === 'blur'">When someone leaves a question</option>
              <option value="submit" [selected]="s.validateOn === 'submit'">Only when they continue or submit</option>
            </select>
          </label>
          <ui-switch [ngModel]="s.errorSummary !== false" (ngModelChange)="store.updateSettings({ errorSummary: $event ? undefined : false })">List all problems at the top</ui-switch>
          <label class="fld"><span class="fb-label">Answers to hidden questions</span>
            <select class="fb-native-select" (change)="store.updateSettings({ clearHidden: $any($event.target).value })">
              <option value="onSubmit" [selected]="(s.clearHidden ?? 'onSubmit') === 'onSubmit'">Leave them out when saving</option>
              <option value="never" [selected]="s.clearHidden === 'never'">Keep them</option>
            </select>
            <span class="fb-hint">Saved answers that were already hidden when someone opened the form are always kept.</span>
          </label>
        </section>
        <section class="group-sec">
          <h4>Buttons and steps</h4>
          <ui-switch [ngModel]="s.showProgress !== false" (ngModelChange)="store.updateSettings({ showProgress: $event ? undefined : false })">Show progress on multi-page forms</ui-switch>
          <div class="fb-grid2">
            <label class="fld"><span class="fb-label">Submit button</span><ui-input [ngModel]="s.submitLabel ?? ''" (ngModelChange)="store.updateSettings({ submitLabel: $event || undefined }, 'sl')" placeholder="Submit" /></label>
            <label class="fld"><span class="fb-label">Next button</span><ui-input [ngModel]="s.nextLabel ?? ''" (ngModelChange)="store.updateSettings({ nextLabel: $event || undefined }, 'nl')" placeholder="Continue" /></label>
            <label class="fld"><span class="fb-label">Back button</span><ui-input [ngModel]="s.backLabel ?? ''" (ngModelChange)="store.updateSettings({ backLabel: $event || undefined }, 'bl')" placeholder="Back" /></label>
          </div>
        </section>
      </div>
    </ng-template>
  `,
  styles: [FB_SHARED_STYLES, `
    :host { display: flex; flex-direction: column; min-height: 0; background: var(--ui-color-surface); }
    .head { display: flex; align-items: center; gap: var(--ui-space-2); padding: var(--ui-space-3) var(--ui-space-3) var(--ui-space-2); flex: none; }
    .head-ico { display: inline-grid; place-items: center; width: 28px; height: 28px; flex: none; border-radius: var(--ui-radius);
      background: var(--ui-color-surface-hover); color: var(--ui-color-text-secondary); }
    .head-txt { display: flex; flex-direction: column; min-width: 0; }
    .head-kind { font-size: 11px; font-weight: 600; color: var(--ui-color-text-muted); }
    .head-name { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tabs { display: flex; gap: 2px; padding: 0 var(--ui-space-3); border-bottom: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); flex: none; }
    .tab { position: relative; display: inline-flex; align-items: center; gap: 5px; height: 32px; padding: 0 var(--ui-space-2); border: 0; background: transparent;
      color: var(--ui-color-text-secondary); font: inherit; font-size: 13px; cursor: pointer; }
    .tab:hover { color: var(--ui-color-text); }
    .tab.on { color: var(--ui-color-text); font-weight: 550; }
    .tab.on::after { content: ''; position: absolute; left: 6px; right: 6px; bottom: -1px; height: 2px; border-radius: 1px; background: var(--ui-color-primary); }
    .tab:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); border-radius: var(--ui-radius-xs); }
    .count { display: inline-grid; place-items: center; min-width: 16px; height: 16px; padding: 0 var(--ui-space-1); border-radius: var(--ui-radius-pill); font-size: 11px; font-weight: 600;
      background: color-mix(in srgb, var(--ui-color-primary) 16%, transparent); color: var(--ui-color-primary); box-sizing: border-box; }
    .body { flex: 1; min-height: 0; overflow: auto; padding: var(--ui-space-3) var(--ui-space-3) var(--ui-space-8); overscroll-behavior: contain; }
    .fld { display: flex; flex-direction: column; min-width: 0; }
    .group-sec { display: flex; flex-direction: column; gap: var(--ui-space-2); padding-top: var(--ui-space-3); border-top: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); }
    .group-sec.first { border-top: 0; padding-top: 0; }
    .group-sec h4 { margin: 0; font-size: 12px; font-weight: 600; color: var(--ui-color-text); }
    .key { height: 30px; padding: 0 var(--ui-space-2); box-sizing: border-box; border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius);
      background: var(--ui-color-surface); color: var(--ui-color-text); font-family: var(--ui-font-mono); font-size: 12px; }
    .key:focus { outline: none; border-color: var(--ui-color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary) 28%, transparent); }
    .key.bad { border-color: var(--ui-color-danger); }
    .fb-hint.bad { color: var(--ui-color-danger); }
    .actions { display: flex; flex-wrap: wrap; gap: var(--ui-space-2); padding-top: var(--ui-space-3); border-top: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); }
    .actions ui-button hugeicons-icon { margin: 0 4px 0 -2px; }
    .setv { display: flex; flex-direction: column; gap: var(--ui-space-2); padding: var(--ui-space-2); border: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); border-radius: var(--ui-radius); }
    .grow { flex: 1; margin: 0; }
    .sentence { margin: 0; padding: 6px var(--ui-space-2); border-radius: var(--ui-radius-xs); background: color-mix(in srgb, var(--ui-color-primary) 8%, transparent);
      font-size: 12px; line-height: 1.4; color: var(--ui-color-text-secondary); }
    .ref { display: block; width: 100%; padding: 5px var(--ui-space-2); border: 0; border-radius: var(--ui-radius-xs); background: transparent; text-align: left;
      color: var(--ui-color-text); font: inherit; font-size: 13px; cursor: pointer; }
    .ref span { color: var(--ui-color-text-muted); }
    .ref:hover { background: var(--ui-color-surface-hover); }
    .ref:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .fb-link { display: inline-flex; align-items: center; gap: 3px; align-self: flex-start; }
    .clear { margin-top: 4px; }
    ui-switch { font-size: 13px; }
  `],
})
export class FbInspector {
  protected readonly store = inject(FbBuilderStore);
  /** Hide the header when something around it already names the selection (the phone sheet). */
  readonly showHead = input(true);
  readonly deleteRequest = output<string>();

  protected readonly addIcon = FB_ICONS.Add01Icon;
  protected readonly removeIcon = FB_ICONS.Cancel01Icon;
  protected readonly copyIcon = FB_ICONS.Copy01Icon;
  protected readonly deleteIcon = FB_ICONS.Delete02Icon;
  protected readonly leftIcon = FB_ICONS.ArrowLeft01Icon;
  protected readonly rightIcon = FB_ICONS.ArrowRight01Icon;
  protected readonly refWords = REF_WORDS;
  protected readonly autocomplete = AUTOCOMPLETE;

  protected readonly widths = [
    { value: 'full', label: 'Full' },
    { value: 'two-thirds', label: '2/3' },
    { value: 'half', label: '1/2' },
    { value: 'third', label: '1/3' },
  ];
  protected readonly columns = [{ value: '1', label: 'One' }, { value: '2', label: 'Two' }, { value: '3', label: 'Three' }];
  protected readonly orientations = [{ value: 'vertical', label: 'Stacked' }, { value: 'horizontal', label: 'In a row' }];
  protected readonly visModes = [{ value: 'always', label: 'Always' }, { value: 'show', label: 'Only when…' }, { value: 'hide', label: 'Hide when…' }];
  protected readonly pageVisModes = [{ value: 'always', label: 'Always' }, { value: 'show', label: 'Only when…' }, { value: 'hide', label: 'Skip when…' }];
  protected readonly lockModes = [{ value: 'no', label: 'Yes' }, { value: 'yes', label: 'Read-only' }, { value: 'when', label: 'Read-only when…' }];
  protected readonly staticKinds = [{ value: 'heading', label: 'Heading' }, { value: 'paragraph', label: 'Text' }, { value: 'divider', label: 'Divider' }];

  protected readonly tab = signal<Tab>('settings');

  /** The selected thing's key, edited locally and saved on blur/Enter. */
  protected readonly keyDraft = linkedSignal(() => {
    const el = this.store.selected()?.element;
    return el && 'kind' in el && (el.kind === 'field' || el.kind === 'group') ? el.key ?? '' : '';
  });
  protected readonly keyError = computed(() => {
    const k = this.keyDraft().trim();
    const sel = this.store.selected();
    if (!sel || (sel.kind !== 'field' && sel.kind !== 'group')) return '';
    if (!k) return 'Give it a name.';
    if (!fbKeyValid(k)) return 'Use letters, numbers and _ only, starting with a letter.';
    if (uniqueKey(this.store.def(), k, sel.id) !== k) return `Another question in the same place is already saved as “${k}”.`;
    return '';
  });

  protected readonly tabs = computed<{ id: Tab; label: string; count?: number }[]>(() => {
    const sel = this.store.selected();
    if (!sel) return [];
    const el = sel.element as UiFbElement | UiFbPage;
    const logic = this.logicCount(el);
    const out: { id: Tab; label: string; count?: number }[] = [{ id: 'settings', label: 'Settings' }, { id: 'logic', label: 'Logic', count: logic || undefined }];
    if (sel.kind === 'field') {
      const f = el as UiFbField;
      out.push({ id: 'checks', label: 'Checks', count: (f.validators?.length ?? 0) + (f.required ? 1 : 0) || undefined });
    }
    return out;
  });

  protected readonly headIcon = computed(() => {
    const sel = this.store.selected();
    if (!sel) return FB_ICONS.Settings02Icon;
    const el = sel.element as UiFbElement;
    if (sel.kind === 'page') return FB_ICONS.FileEditIcon;
    if (el.kind === 'field') return FIELD_ICONS[el.type];
    if (el.kind === 'group') return el.repeat ? REPEAT_ICON : GROUP_ICON;
    return STATIC_ICONS[el.type];
  });
  protected readonly headKind = computed(() => {
    const sel = this.store.selected();
    if (!sel) return 'Form settings';
    const el = sel.element as UiFbElement;
    if (sel.kind === 'page') return 'Page';
    if (el.kind === 'field') return fieldTypeInfo(el.type).label;
    if (el.kind === 'group') return el.repeat ? 'Repeating section' : 'Section';
    return el.type === 'heading' ? 'Heading' : el.type === 'paragraph' ? 'Text block' : 'Divider';
  });
  protected readonly headName = computed(() => {
    const sel = this.store.selected();
    return sel ? this.store.name(sel.id) : this.store.def().title || 'Untitled form';
  });

  protected readonly usedBy = computed(() => {
    const sel = this.store.selected();
    return sel ? this.store.externalRefs(sel.id) : [];
  });

  constructor() {
    // A tab that doesn't exist for the new selection falls back to Settings.
    effect(() => {
      const ids = this.tabs().map((t) => t.id);
      if (!ids.includes(this.tab())) this.tab.set('settings');
    });
  }

  /** Arrow keys move between the Settings / Logic / Checks tabs. */
  protected tabKeys(e: KeyboardEvent): void {
    const ids = this.tabs().map((t) => t.id);
    const i = ids.indexOf(this.tab());
    const to = e.key === 'ArrowRight' ? (i + 1) % ids.length : e.key === 'ArrowLeft' ? (i - 1 + ids.length) % ids.length : e.key === 'Home' ? 0 : e.key === 'End' ? ids.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    this.tab.set(ids[to]);
    const list = e.currentTarget as HTMLElement;
    requestAnimationFrame(() => list.querySelector<HTMLElement>('[role=tab][tabindex="0"]')?.focus());
  }

  private logicCount(el: UiFbElement | UiFbPage): number {
    let n = el.visibility ? 1 : 0;
    if ('kind' in el) {
      if (el.kind !== 'static' && el.disabled) n++;
      if (el.kind === 'field') n += el.setValue?.length ?? 0;
    } else n += el.jumps?.length ?? 0;
    return n;
  }

  // ── Fields ──────────────────────────────────────────────────────────────

  protected typeInfo(t: UiFbFieldType) {
    return fieldTypeInfo(t);
  }

  /** Every type while there are no answers; only similar ones after. */
  protected typeChoices(f: UiFbField) {
    if (!this.store.hasAnswers(f.id)) return UI_FB_FIELD_TYPES;
    return UI_FB_FIELD_TYPES.filter((t) => typesCompatible(f.type, t.type) && valueKindOf(t.type) === valueKindOf(f.type));
  }

  protected setLabel(f: UiFbField, label: string): void {
    // Keys follow labels until the form has answers or someone named it by hand.
    const auto = !this.store.hasAnswers(f.id) && (f.key === fbSlug(f.label) || f.key.startsWith(`${fbSlug(f.label)}_`) || f.key === fbSlug(fieldTypeInfo(f.type).defaultLabel));
    const key = auto && label.trim() ? uniqueKey(this.store.def(), fbSlug(label), f.id) : f.key;
    this.store.updateField(f.id, { label, key }, `label:${f.id}`);
  }

  protected changeType(f: UiFbField, type: UiFbFieldType): void {
    const info = fieldTypeInfo(type);
    const fresh = createField(type);
    this.store.updateField(f.id, (old) => {
      const next: UiFbField = { ...old, type, props: { ...(fresh.props ?? {}), ...pickProps(old.props, type) } };
      if (info.hasOptions && !old.options?.length) next.options = fresh.options;
      if (!info.hasOptions) delete next.options;
      // Radio buttons and tick boxes show every option, so a searchable list doesn't fit them.
      if (!(UI_FB_SOURCE_FIELD_TYPES as readonly string[]).includes(type)) delete next.source;
      if (type === 'calculated' && !old.calc) next.calc = fresh.calc;
      if (type !== 'calculated') delete next.calc;
      if (valueKindOf(type) !== valueKindOf(old.type)) { delete next.defaultValue; delete next.setValue; }
      if (!info.textLike && next.layout) next.layout = { ...next.layout, labelPlacement: next.layout.labelPlacement === 'inside' ? undefined : next.layout.labelPlacement, errorPlacement: undefined };
      // Checks that don't fit the new type are dropped.
      const fits = new Set(this.store.validatorsFor(next).map((d) => d.type));
      next.validators = old.validators?.filter((v) => fits.has(v.type) || !this.store.validatorDefs().some((d) => d.type === v.type));
      if (!next.validators?.length) delete next.validators;
      return next;
    });
  }

  protected prop<K extends keyof UiFbFieldProps>(f: UiFbField, key: K, value: UiFbFieldProps[K]): void {
    this.store.updateField(f.id, (old) => {
      const props = { ...(old.props ?? {}), [key]: value };
      if (value === undefined) delete props[key];
      return { ...old, props: Object.keys(props).length ? props : undefined };
    }, `prop:${f.id}:${key}`);
  }

  protected layout(f: UiFbField, key: 'width' | 'labelPlacement' | 'errorPlacement', value: string | null | undefined): void {
    this.store.updateField(f.id, (old) => {
      const layout = { ...(old.layout ?? {}), [key]: value ?? undefined };
      for (const k of Object.keys(layout) as (keyof typeof layout)[]) if (layout[k] === undefined) delete layout[k];
      return { ...old, layout: Object.keys(layout).length ? layout : undefined };
    });
  }

  protected commitKey(el: UiFbField | UiFbGroup): void {
    const k = this.keyDraft().trim();
    if (this.keyError() || k === el.key) { if (this.keyError()) this.keyDraft.set(el.key ?? ''); return; }
    // Only remember old names when saved answers might use them.
    if (this.store.hasAnswers(el.id)) this.store.rename(el.id, k);
    else this.store.updateAny(el.id, (x) => ({ ...x, key: k }) as UiFbElement);
  }

  protected canDefault(f: UiFbField): boolean {
    return !['file', 'calculated'].includes(f.type);
  }

  protected isMulti(f: UiFbField): boolean {
    return valueKindOf(f.type) === 'multi';
  }

  /** The field itself as a rule subject, so value inputs know its options and kind. */
  protected selfRef(f: UiFbField): UiFbRefOption {
    return { id: f.id, label: f.label, kind: valueKindOf(f.type, f.props?.format), where: '' };
  }

  protected defaultOperand(f: UiFbField): UiFbOperand | undefined {
    return f.defaultValue === undefined ? undefined : { const: f.defaultValue };
  }

  protected setDefault(f: UiFbField, o: UiFbOperand): void {
    const v = 'const' in o ? o.const : undefined;
    this.store.updateField(f.id, { defaultValue: v === '' || v === null ? undefined : v }, `def:${f.id}`);
  }

  // ── Logic ───────────────────────────────────────────────────────────────

  protected visMode(v: UiFbVisibility | undefined): string {
    return v ? v.action : 'always';
  }

  protected setVisMode(el: UiFbElement, mode: string | null): void {
    const visibility: UiFbVisibility | undefined = mode === 'show' || mode === 'hide' ? { action: mode, when: el.visibility?.when ?? { match: 'all', conditions: [] } } : undefined;
    this.store.updateAny(el.id, (x) => ({ ...x, visibility }));
  }

  protected setVisWhen(el: UiFbElement, when: UiFbCondition): void {
    this.store.updateAny(el.id, (x) => ({ ...x, visibility: { action: x.visibility?.action ?? 'show', when } }), `vis:${el.id}`);
  }

  protected setPageVis(p: UiFbPage, mode: string | null): void {
    const visibility: UiFbVisibility | undefined = mode === 'show' || mode === 'hide' ? { action: mode, when: p.visibility?.when ?? { match: 'all', conditions: [] } } : undefined;
    this.store.updatePage(p.id, { visibility });
  }

  protected lockMode(t: UiFbToggle | undefined): string {
    return t === true ? 'yes' : t && typeof t === 'object' ? 'when' : 'no';
  }

  protected setLock(el: UiFbField | UiFbGroup, mode: string | null): void {
    const disabled: UiFbToggle | undefined = mode === 'yes' ? true : mode === 'when' ? { when: this.isObj(el.disabled) ? (el.disabled as { when: UiFbCondition }).when : { match: 'all', conditions: [] } } : undefined;
    this.store.updateAny(el.id, (x) => ({ ...x, disabled }) as UiFbElement);
  }

  protected setLockWhen(el: UiFbField | UiFbGroup, when: UiFbCondition): void {
    this.store.updateAny(el.id, (x) => ({ ...x, disabled: { when } }) as UiFbElement, `lock:${el.id}`);
  }

  protected addSetValue(f: UiFbField): void {
    const sv: UiFbSetValue = { id: fbUid('set'), when: { match: 'all', conditions: [] }, value: { const: '' } };
    this.store.updateField(f.id, { setValue: [...(f.setValue ?? []), sv] });
  }

  protected patchSetValue(f: UiFbField, sv: UiFbSetValue, patch: Partial<UiFbSetValue>): void {
    this.store.updateField(f.id, (old) => ({ ...old, setValue: (old.setValue ?? []).map((x) => (x.id === sv.id ? { ...x, ...patch } : x)) }), `sv:${sv.id}`);
  }

  protected removeSetValue(f: UiFbField, sv: UiFbSetValue): void {
    this.store.updateField(f.id, (old) => {
      const list = (old.setValue ?? []).filter((x) => x.id !== sv.id);
      return { ...old, setValue: list.length ? list : undefined };
    });
  }

  // ── Sections ────────────────────────────────────────────────────────────

  protected nestedRepeat(g: UiFbGroup): UiFbGroup | null {
    return this.store.index().get(g.id)?.repeat ?? null;
  }

  protected setRepeat(g: UiFbGroup, on: boolean): void {
    if (on) {
      const key = g.key ?? uniqueKey(this.store.def(), fbSlug(g.title || 'items'), g.id);
      this.store.updateGroup(g.id, { repeat: { min: 1, addLabel: 'Add another', itemLabel: 'Entry {n}' }, key });
    } else {
      this.store.updateGroup(g.id, { repeat: undefined });
    }
  }

  protected repeat(g: UiFbGroup, patch: Partial<NonNullable<UiFbGroup['repeat']>>): void {
    this.store.updateGroup(g.id, (old) => ({ ...old, repeat: { ...(old.repeat ?? {}), ...patch } }), `rep:${g.id}`);
  }

  protected setGroupKey(g: UiFbGroup, on: boolean): void {
    this.store.updateGroup(g.id, { key: on ? uniqueKey(this.store.def(), fbSlug(g.title || 'section'), g.id) : undefined });
  }

  // ── Pages ───────────────────────────────────────────────────────────────

  protected pageIndexOf(p: UiFbPage): number {
    return this.store.def().pages.findIndex((x) => x.id === p.id);
  }

  protected laterPages(i: number) {
    return this.store.def().pages.slice(i + 1).map((p, k) => ({ id: p.id, label: p.title || `Page ${i + k + 2}` }));
  }

  protected addJump(p: UiFbPage, i: number): void {
    const to = this.store.def().pages[i + 2]?.id ?? this.store.def().pages[i + 1]?.id ?? 'end';
    const j: UiFbJump = { id: fbUid('jmp'), when: { match: 'all', conditions: [] }, to };
    this.store.updatePage(p.id, { jumps: [...(p.jumps ?? []), j] });
  }

  protected patchJump(p: UiFbPage, j: UiFbJump, patch: Partial<UiFbJump>): void {
    this.store.updatePage(p.id, (old) => ({ ...old, jumps: (old.jumps ?? []).map((x) => (x.id === j.id ? { ...x, ...patch } : x)) }), `jump:${j.id}`);
  }

  protected removeJump(p: UiFbPage, j: UiFbJump): void {
    this.store.updatePage(p.id, (old) => {
      const jumps = (old.jumps ?? []).filter((x) => x.id !== j.id);
      return { ...old, jumps: jumps.length ? jumps : undefined };
    });
  }

  // ── Template helpers ────────────────────────────────────────────────────

  protected isObj(v: unknown): boolean {
    return !!v && typeof v === 'object';
  }
  protected asField(el: unknown): UiFbField { return el as UiFbField; }
  protected asGroup(el: unknown): UiFbGroup { return el as UiFbGroup; }
  protected asStatic(el: unknown): UiFbStatic { return el as UiFbStatic; }
  protected asPage(el: unknown): UiFbPage { return el as UiFbPage; }
}

/** Keeps the settings that still mean something after a type change. */
function pickProps(props: UiFbFieldProps | undefined, type: UiFbFieldType): UiFbFieldProps {
  if (!props) return {};
  const keep: (keyof UiFbFieldProps)[] = ['autocomplete'];
  if (['number', 'currency', 'slider'].includes(type)) keep.push('min', 'max', 'step', 'decimals');
  if (['radio', 'checkboxes'].includes(type)) keep.push('orientation');
  if (['checkbox', 'toggle'].includes(type)) keep.push('caption');
  return Object.fromEntries(keep.filter((k) => props[k] !== undefined).map((k) => [k, props[k]]));
}
