import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  UiFormField, UiInput, UiTextarea, UiCheckbox, UiSwitch, UiRadioGroup, UiSelect,
  UiNumberInput, UiPasswordInput, UiSearchInput, UiSlider, UiCheckboxGroup, UiRating, UiOtpInput,
  UiChipInput, UiEditableText, UiColorPicker, UiFileUpload, UiTimePicker,
} from 'ui/form';
import { UiCombobox, UiMultiSelect } from 'ui/combobox';
import { UiDatePicker, UiCalendar, UiDateRangePicker } from 'ui/datepicker';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

const SIZE = "'sm' | 'md' | 'lg'";
const OPTION = "interface UiSelectOption { label: string; value: string; disabled?: boolean; }";

@Component({
  selector: 'page-forms',
  imports: [
    ReactiveFormsModule,
    UiFormField, UiInput, UiTextarea, UiCheckbox, UiSwitch, UiRadioGroup, UiSelect,
    UiNumberInput, UiPasswordInput, UiSearchInput, UiSlider, UiCheckboxGroup, UiRating, UiOtpInput,
    UiChipInput, UiEditableText, UiColorPicker, UiFileUpload, UiTimePicker,
    UiCombobox, UiMultiSelect, UiDatePicker, UiCalendar, UiDateRangePicker,
    DocPage, DocSection, DocDemo,
  ],
  template: `
    <doc-page eyebrow="Components" title="Form controls"
      lead="Every control implements ControlValueAccessor, so it works with template-driven, reactive, and Signal Forms via formControlName / [(ngModel)] / [formControl]. Wrap any control with ui-form-field for label + hint + error. Common inputs: size ('sm'|'md'|'lg'), invalid (boolean), radius (boolean, defaults to UiConfig.radius).">
      <form [formGroup]="form">

      <doc-section name="Form field" selector="ui-form-field" [api]="fieldApi"
        summary="Label + hint + error wrapper. Wraps its projected control in a <label> for implicit accessible-name association. When error is set it replaces the hint and is announced (role=alert).">
        <doc-demo code="<ui-form-field label=&quot;Email&quot; hint=&quot;Work address&quot; [required]=&quot;true&quot; [error]=&quot;err()&quot;>
  <ui-input type=&quot;email&quot; formControlName=&quot;email&quot; [invalid]=&quot;!!err()&quot; />
</ui-form-field>">
          <ui-form-field label="Email" [required]="true" [error]="emailError()" hint="Work address">
            <ui-input type="email" formControlName="email" [invalid]="!!emailError()" placeholder="you@x.com" />
          </ui-form-field>
        </doc-demo>
      </doc-section>

      <doc-section name="Input" selector="ui-input" [api]="inputApi"
        summary="Single-line text field. Value type: string.">
        <doc-demo code="<ui-input formControlName=&quot;name&quot; placeholder=&quot;Ada&quot; size=&quot;md&quot; />">
          <ui-input formControlName="name" placeholder="Full name" />
        </doc-demo>
      </doc-section>

      <doc-section name="Textarea" selector="ui-textarea" [api]="textareaApi"
        summary="Multi-line text field. Value type: string.">
        <doc-demo code="<ui-textarea formControlName=&quot;bio&quot; [rows]=&quot;3&quot; />">
          <ui-textarea formControlName="bio" [rows]="2" placeholder="About you…" />
        </doc-demo>
      </doc-section>

      <doc-section name="Number input" selector="ui-number-input" [api]="numberApi"
        summary="Numeric field with stepper buttons. Value type: number | null. Clamps to min/max.">
        <doc-demo code="<ui-number-input formControlName=&quot;age&quot; [min]=&quot;0&quot; [max]=&quot;120&quot; [step]=&quot;1&quot; />">
          <ui-number-input formControlName="age" [min]="0" [max]="120" />
        </doc-demo>
      </doc-section>

      <doc-section name="Password input" selector="ui-password-input" [api]="passwordApi"
        summary="Password field with a show/hide toggle. Value type: string.">
        <doc-demo code="<ui-password-input formControlName=&quot;password&quot; />">
          <ui-password-input formControlName="password" />
        </doc-demo>
      </doc-section>

      <doc-section name="Search input" selector="ui-search-input" [api]="searchApi"
        summary="Search field with icon and clear button. Value type: string.">
        <doc-demo code="<ui-search-input formControlName=&quot;search&quot; placeholder=&quot;Search…&quot; />">
          <ui-search-input formControlName="search" />
        </doc-demo>
      </doc-section>

      <doc-section name="Time picker" selector="ui-time-picker" [api]="timeApi"
        summary="Native time field. Value type: string ('HH:MM', or 'HH:MM:SS' when step=1).">
        <doc-demo code="<ui-time-picker formControlName=&quot;time&quot; [step]=&quot;60&quot; />">
          <ui-time-picker formControlName="time" />
        </doc-demo>
      </doc-section>

      <doc-section name="Select" selector="ui-select" [api]="selectApi"
        summary="Single-choice native dropdown. Value type: string. Options are {label,value,disabled?}." [shapes]="OPTION">
        <doc-demo code="<ui-select formControlName=&quot;role&quot; [options]=&quot;roles&quot; placeholder=&quot;Choose…&quot; />">
          <ui-select formControlName="role" [options]="roles" placeholder="Choose…" />
        </doc-demo>
      </doc-section>

      <doc-section name="Combobox" selector="ui-combobox" [api]="comboApi"
        summary="Filterable autocomplete (CDK Overlay). Value type: string. Type to filter; Arrow/Enter to choose." [shapes]="'interface UiComboboxOption { label: string; value: string; }'">
        <doc-demo code="<ui-combobox formControlName=&quot;country&quot; [options]=&quot;countries&quot; />">
          <ui-combobox formControlName="country" [options]="countries" />
        </doc-demo>
      </doc-section>

      <doc-section name="Multi-select" selector="ui-multi-select" [api]="multiApi"
        summary="Choose several options; selections render as chips. Value type: string[].">
        <doc-demo code="<ui-multi-select formControlName=&quot;skills&quot; [options]=&quot;countries&quot; />">
          <ui-multi-select formControlName="skills" [options]="countries" />
        </doc-demo>
      </doc-section>

      <doc-section name="Checkbox & switch" selector="ui-checkbox · ui-switch" [api]="checkApi"
        summary="Boolean controls (value type: boolean), built on a native checkbox for a11y. ui-switch adds role=switch. Project the label as content.">
        <doc-demo code="<ui-checkbox formControlName=&quot;terms&quot;>Accept terms</ui-checkbox>
<ui-switch formControlName=&quot;news&quot;>Subscribe</ui-switch>">
          <div class="stack">
            <ui-checkbox formControlName="terms">Accept terms</ui-checkbox>
            <ui-switch formControlName="news">Subscribe</ui-switch>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Radio group" selector="ui-radio-group" [api]="radioApi"
        summary="Single-choice from options. Value type: string | null. Built on native radios." [shapes]="'interface UiRadioOption { label: string; value: string; disabled?: boolean; }'">
        <doc-demo code="<ui-radio-group formControlName=&quot;plan&quot; orientation=&quot;horizontal&quot; [options]=&quot;plans&quot; />">
          <ui-radio-group formControlName="plan" orientation="horizontal" [options]="plans" />
        </doc-demo>
      </doc-section>

      <doc-section name="Checkbox group" selector="ui-checkbox-group" [api]="checkGroupApi"
        summary="Multi-select checkbox set. Value type: string[]." [shapes]="'interface UiCheckboxOption { label: string; value: string; disabled?: boolean; }'">
        <doc-demo code="<ui-checkbox-group formControlName=&quot;tags&quot; orientation=&quot;horizontal&quot; [options]=&quot;interests&quot; />">
          <ui-checkbox-group formControlName="tags" orientation="horizontal" [options]="interests" />
        </doc-demo>
      </doc-section>

      <doc-section name="Slider" selector="ui-slider" [api]="sliderApi"
        summary="Themed range slider. Value type: number.">
        <doc-demo code="<ui-slider formControlName=&quot;volume&quot; [min]=&quot;0&quot; [max]=&quot;100&quot; [step]=&quot;1&quot; />">
          <ui-slider formControlName="volume" />
        </doc-demo>
      </doc-section>

      <doc-section name="Rating" selector="ui-rating" [api]="ratingApi"
        summary="Star rating. Value type: number (0–max). Click an active star again to clear.">
        <doc-demo code="<ui-rating formControlName=&quot;rating&quot; [max]=&quot;5&quot; />">
          <ui-rating formControlName="rating" />
        </doc-demo>
      </doc-section>

      <doc-section name="OTP input" selector="ui-otp-input" [api]="otpApi"
        summary="Fixed-length one-time-code entry. Value type: string (joined). Auto-advances; Backspace/Arrows navigate.">
        <doc-demo code="<ui-otp-input formControlName=&quot;otp&quot; [length]=&quot;6&quot; [numeric]=&quot;true&quot; />">
          <ui-otp-input formControlName="otp" [length]="6" />
        </doc-demo>
      </doc-section>

      <doc-section name="Chip input" selector="ui-chip-input" [api]="chipApi"
        summary="Tokenized text entry. Value type: string[]. Enter or comma adds; Backspace removes the last.">
        <doc-demo code="<ui-chip-input formControlName=&quot;chips&quot; placeholder=&quot;Add tag…&quot; />">
          <ui-chip-input formControlName="chips" />
        </doc-demo>
      </doc-section>

      <doc-section name="Editable text" selector="ui-editable-text" [api]="editApi"
        summary="Click-to-edit inline text. Value type: string. Enter commits, Escape cancels.">
        <doc-demo code="<ui-editable-text formControlName=&quot;nick&quot; placeholder=&quot;Empty&quot; />">
          <ui-editable-text formControlName="nick" />
        </doc-demo>
      </doc-section>

      <doc-section name="Color picker" selector="ui-color-picker" [api]="colorApi"
        summary="Native color well + hex field + preset swatches. Value type: string (hex).">
        <doc-demo code="<ui-color-picker formControlName=&quot;color&quot; [swatches]=&quot;['#3d5afe','#2faa6e']&quot; />">
          <ui-color-picker formControlName="color" />
        </doc-demo>
      </doc-section>

      <doc-section name="File upload" selector="ui-file-upload" [api]="uploadApi" [outputs]="uploadOut"
        summary="Drag-and-drop / click dropzone. Emits (filesSelected) with a File[]; not a CVA control.">
        <doc-demo code="<ui-file-upload [multiple]=&quot;true&quot; accept=&quot;image/*&quot; (filesSelected)=&quot;onFiles($event)&quot; />">
          <ui-file-upload [multiple]="true" />
        </doc-demo>
      </doc-section>

      <doc-section name="Date picker" selector="ui-date-picker" [api]="dateApi"
        summary="Calendar popover (CDK Overlay). Value type: ISO string 'YYYY-MM-DD'.">
        <doc-demo code="<ui-date-picker formControlName=&quot;date&quot; />">
          <ui-date-picker formControlName="date" />
        </doc-demo>
      </doc-section>

      <doc-section name="Calendar" selector="ui-calendar"
        summary="Inline month calendar (no inputs beyond CVA). Value type: ISO string 'YYYY-MM-DD'.">
        <doc-demo code="<ui-calendar formControlName=&quot;date2&quot; />">
          <ui-calendar formControlName="date2" />
        </doc-demo>
      </doc-section>

      <doc-section name="Date range picker" selector="ui-date-range-picker"
        summary="Inline range selection. Value type: { start: string | null; end: string | null } (ISO)."
        [shapes]="'type UiDateRange = { start: string | null; end: string | null };'">
        <doc-demo code="<ui-date-range-picker formControlName=&quot;range&quot; />">
          <ui-date-range-picker formControlName="range" />
        </doc-demo>
      </doc-section>

      </form>
    </doc-page>
  `,
  styles: `.stack { display: flex; flex-direction: column; gap: var(--ui-space-3); }`,
})
export class FormsPage {
  protected readonly OPTION = OPTION;
  protected readonly roles = [{ label: 'Engineer', value: 'eng' }, { label: 'Designer', value: 'design' }, { label: 'PM', value: 'pm' }];
  protected readonly plans = [{ label: 'Free', value: 'free' }, { label: 'Pro', value: 'pro' }, { label: 'Enterprise', value: 'ent' }];
  protected readonly interests = [{ label: 'Design', value: 'design' }, { label: 'Code', value: 'code' }, { label: 'Data', value: 'data' }];
  protected readonly countries = [
    { label: 'Australia', value: 'au' }, { label: 'Canada', value: 'ca' }, { label: 'Germany', value: 'de' },
    { label: 'Japan', value: 'jp' }, { label: 'United States', value: 'us' },
  ];
  protected readonly form = new FormGroup({
    name: new FormControl('Ada Lovelace'), email: new FormControl(''), bio: new FormControl(''),
    age: new FormControl<number | null>(30), password: new FormControl(''), search: new FormControl(''), time: new FormControl('09:30'),
    role: new FormControl('eng'), country: new FormControl('ca'), skills: new FormControl<string[]>(['ca', 'jp']),
    terms: new FormControl(false), news: new FormControl(true), plan: new FormControl('pro'), tags: new FormControl<string[]>(['code']),
    volume: new FormControl(60), rating: new FormControl(4), otp: new FormControl(''), chips: new FormControl<string[]>(['angular']),
    nick: new FormControl('ada'), color: new FormControl('#3d5afe'),
    date: new FormControl(''), date2: new FormControl(''), range: new FormControl<{ start: string | null; end: string | null }>({ start: null, end: null }),
  });
  protected emailError(): string {
    const v = this.form.controls.email.value ?? '';
    return v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? 'Enter a valid email' : '';
  }

  private readonly common: ApiRow[] = [
    { name: 'size', type: SIZE, default: "'md'", desc: 'Control height & font.' },
    { name: 'invalid', type: 'boolean', default: 'false', desc: 'Error styling (red border).' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly fieldApi: ApiRow[] = [
    { name: 'label', type: 'string', default: '—', desc: 'Field label.' },
    { name: 'hint', type: 'string', default: '—', desc: 'Helper text (hidden when error set).' },
    { name: 'error', type: 'string', default: '—', desc: 'Error message (role=alert).' },
    { name: 'required', type: 'boolean', default: 'false', desc: 'Show required * marker.' },
  ];
  protected readonly inputApi: ApiRow[] = [
    { name: 'type', type: "'text'|'email'|'url'|'tel'|'password'|'search'", default: "'text'", desc: 'Input type.' },
    { name: 'placeholder', type: 'string', default: "''", desc: 'Placeholder text.' },
    { name: 'inputmode', type: 'string', default: '—', desc: 'Virtual keyboard hint.' },
    ...this.common,
  ];
  protected readonly textareaApi: ApiRow[] = [
    { name: 'placeholder', type: 'string', default: "''", desc: 'Placeholder text.' },
    { name: 'rows', type: 'number', default: '4', desc: 'Visible rows.' },
    { name: 'invalid', type: 'boolean', default: 'false', desc: 'Error styling.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly numberApi: ApiRow[] = [
    { name: 'min', type: 'number', default: '—', desc: 'Minimum (clamped).' },
    { name: 'max', type: 'number', default: '—', desc: 'Maximum (clamped).' },
    { name: 'step', type: 'number', default: '1', desc: 'Stepper increment.' },
    { name: 'placeholder', type: 'string', default: "''", desc: 'Placeholder.' },
    ...this.common,
  ];
  protected readonly passwordApi: ApiRow[] = [
    { name: 'placeholder', type: 'string', default: "''", desc: 'Placeholder.' },
    ...this.common,
  ];
  protected readonly searchApi: ApiRow[] = [
    { name: 'placeholder', type: 'string', default: "'Search…'", desc: 'Placeholder.' },
    { name: 'size', type: SIZE, default: "'md'", desc: 'Control height.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly timeApi: ApiRow[] = [
    { name: 'size', type: SIZE, default: "'md'", desc: 'Control height.' },
    { name: 'step', type: 'number', default: '60', desc: 'Seconds granularity (1 shows seconds).' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly selectApi: ApiRow[] = [
    { name: 'options', type: 'UiSelectOption[]', default: '[]', desc: 'Choices (see Data shapes).' },
    { name: 'placeholder', type: 'string', default: '—', desc: 'Empty-state option.' },
    { name: 'label', type: 'string', default: '—', desc: 'aria-label.' },
    ...this.common,
  ];
  protected readonly comboApi: ApiRow[] = [
    { name: 'options', type: 'UiComboboxOption[]', default: '[]', desc: 'Choices.' },
    { name: 'placeholder', type: 'string', default: "'Search…'", desc: 'Placeholder.' },
    { name: 'size', type: SIZE, default: "'md'", desc: 'Control height.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly multiApi: ApiRow[] = [
    { name: 'options', type: 'UiComboboxOption[]', default: '[]', desc: 'Choices.' },
    { name: 'placeholder', type: 'string', default: "'Select…'", desc: 'Placeholder.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly checkApi: ApiRow[] = [
    { name: 'invalid', type: 'boolean (checkbox only)', default: 'false', desc: 'Error styling.' },
  ];
  protected readonly radioApi: ApiRow[] = [
    { name: 'options', type: 'UiRadioOption[]', default: '[]', desc: 'Choices.' },
    { name: 'label', type: 'string', default: '—', desc: 'Group aria-label.' },
    { name: 'orientation', type: "'vertical' | 'horizontal'", default: "'vertical'", desc: 'Layout.' },
  ];
  protected readonly checkGroupApi: ApiRow[] = [
    { name: 'options', type: 'UiCheckboxOption[]', default: '[]', desc: 'Choices.' },
    { name: 'label', type: 'string', default: '—', desc: 'Group aria-label.' },
    { name: 'orientation', type: "'vertical' | 'horizontal'", default: "'vertical'", desc: 'Layout.' },
  ];
  protected readonly sliderApi: ApiRow[] = [
    { name: 'min', type: 'number', default: '0', desc: 'Minimum value.' },
    { name: 'max', type: 'number', default: '100', desc: 'Maximum value.' },
    { name: 'step', type: 'number', default: '1', desc: 'Increment.' },
    { name: 'label', type: 'string', default: "'Slider'", desc: 'aria-label.' },
    { name: 'showValue', type: 'boolean', default: 'true', desc: 'Show numeric value.' },
  ];
  protected readonly ratingApi: ApiRow[] = [
    { name: 'max', type: 'number', default: '5', desc: 'Number of stars.' },
    { name: 'label', type: 'string', default: "'Rating'", desc: 'aria-label.' },
  ];
  protected readonly otpApi: ApiRow[] = [
    { name: 'length', type: 'number', default: '6', desc: 'Number of cells.' },
    { name: 'numeric', type: 'boolean', default: 'true', desc: 'Restrict to digits.' },
  ];
  protected readonly chipApi: ApiRow[] = [
    { name: 'placeholder', type: 'string', default: "'Add tag…'", desc: 'Placeholder.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly editApi: ApiRow[] = [
    { name: 'placeholder', type: 'string', default: "'Empty'", desc: 'Shown when empty.' },
  ];
  protected readonly colorApi: ApiRow[] = [
    { name: 'swatches', type: 'string[]', default: '6 presets', desc: 'Preset hex swatches.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly uploadApi: ApiRow[] = [
    { name: 'multiple', type: 'boolean', default: 'false', desc: 'Allow multiple files.' },
    { name: 'accept', type: 'string', default: '—', desc: 'Accept filter (e.g. image/*).' },
    { name: 'radius', type: 'boolean', default: 'true', desc: 'Rounded corners.' },
  ];
  protected readonly uploadOut: ApiRow[] = [
    { name: 'filesSelected', type: 'File[]', default: '—', desc: 'Chosen files.' },
  ];
  protected readonly dateApi: ApiRow[] = [
    { name: 'placeholder', type: 'string', default: "'Select a date'", desc: 'Placeholder.' },
    { name: 'size', type: SIZE, default: "'md'", desc: 'Control height.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
}
