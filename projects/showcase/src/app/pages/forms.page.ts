import { Component, computed, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import Attachment01Icon from '@hugeicons/core-free-icons/Attachment01Icon';
import SentIcon from '@hugeicons/core-free-icons/SentIcon';
import Mail01Icon from '@hugeicons/core-free-icons/Mail01Icon';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  UiFormField, UiInput, UiTextarea, UiCheckbox, UiSwitch, UiRadioGroup, UiSelect,
  UiNumberInput, UiPasswordInput, UiSearchInput, UiSlider, UiCheckboxGroup, UiRating, UiOtpInput,
  UiChipInput, UiEditableText, UiColorPicker, UiFileUpload, UiTimePicker, UiChoiceGrid, UiAnchorPicker, UiTokenInput,
  type UiChoice, type UiAnchor, type UiTokenRun,
} from '@zouriel/ui/form';
import { UiButton, UiIconButton } from '@zouriel/ui/button';
import { UiCombobox, UiMultiSelect } from '@zouriel/ui/combobox';
import { UiDatePicker, UiCalendar, UiDateRangePicker } from '@zouriel/ui/datepicker';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

const SIZE = "'sm' | 'md' | 'lg'";
const OPTION = "interface UiSelectOption {\n  label: string;\n  value: string;\n  disabled?: boolean;\n  fontFamily?: string;   // show this option in this font\n}";
const COMBO = "interface UiComboboxOption {   // from @zouriel/ui/combobox\n  label: string;\n  value: string;\n  fontFamily?: string;   // show this option in this font\n}";
const CHOICE = `interface UiChoice {
  value: string;
  label: string;
  description?: string;   // a second line under the label
  group?: string;         // tiles with the same group sit under that heading
  disabled?: boolean;
}
// context of the #tile template
interface UiChoiceTileContext { $implicit: UiChoice; selected: boolean; }`;
const TOKEN = `interface UiTokenRun {
  text?: string;     // literal text ('\\n' for a line break)
  token?: string;    // or an atomic token's machine value, e.g. 'event.date'
  bold?: boolean;
  italic?: boolean;
}
// Also exported: normalizeRuns(runs) merges neighbouring text runs with the same marks and drops empty ones.`;

@Component({
  selector: 'page-forms',
  imports: [
    ReactiveFormsModule, FormsModule, UiButton, UiIconButton, HugeiconsIconComponent, UiTokenInput,
    UiFormField, UiInput, UiTextarea, UiCheckbox, UiSwitch, UiRadioGroup, UiSelect,
    UiNumberInput, UiPasswordInput, UiSearchInput, UiSlider, UiCheckboxGroup, UiRating, UiOtpInput,
    UiChipInput, UiEditableText, UiColorPicker, UiFileUpload, UiTimePicker, UiChoiceGrid, UiAnchorPicker,
    UiCombobox, UiMultiSelect, UiDatePicker, UiCalendar, UiDateRangePicker,
    DocPage, DocSection, DocDemo,
  ],
  template: `
    <doc-page eyebrow="Components" title="Form controls"
      lead="Every value control implements ControlValueAccessor, so it works with [(ngModel)], [formControl] and formControlName, including disable() and touched. The file upload is the exception: it emits files instead. Wrap a control in ui-form-field for a label, hint and error. Most fields also take size ('sm' | 'md' | 'lg'), invalid and radius (defaults to UiConfig.radius); each table lists exactly what that control takes.">

      <doc-section name="Forms integration" summary="Every control in the form below is bound with formControlName to one FormGroup. The switch is bound with ngModel and calls form.disable() / form.enable(), so you can check that each control greys out and stops responding. The live form value is printed underneath.">
        <doc-demo lang="ts + html" code="<ui-switch [ngModel]=&quot;locked()&quot; (ngModelChange)=&quot;lock($event)&quot;>Disable every control</ui-switch>

lock(off: boolean) { off ? this.form.disable() : this.form.enable(); }">
          <ui-switch [ngModel]="locked()" (ngModelChange)="lock($event)">Disable every control</ui-switch>
          <pre class="json" dir="ltr">{{ formJson() }}</pre>
        </doc-demo>
      </doc-section>

      <form [formGroup]="form">

      <doc-section name="Form field" selector="ui-form-field" [api]="fieldApi"
        summary="Label, hint and error around one control. The projected control sits inside a <label> whose for points at the control's text field (input, select or textarea; given an id if it has none), so the label names that field and clicking the label focuses it, even in ui-chip-input or ui-multi-select where chip remove buttons come first. A custom control can mark the element to name with a data-ui-field-control attribute; with no text field (e.g. ui-rating) the label wraps the control as before. When error is set it replaces the hint and is announced (role=alert). required only draws the * marker; validation stays with your form.">
        <doc-demo code="<ui-form-field label=&quot;Email&quot; hint=&quot;Work address&quot; [required]=&quot;true&quot; [error]=&quot;err()&quot;>
  <ui-input type=&quot;email&quot; formControlName=&quot;email&quot; [invalid]=&quot;!!err()&quot; />
</ui-form-field>">
          <ui-form-field label="Email" [required]="true" [error]="emailError()" hint="Work address">
            <ui-input type="email" formControlName="email" autocomplete="email" [invalid]="!!emailError()" placeholder="you@example.com" />
          </ui-form-field>
        </doc-demo>
      </doc-section>

      <doc-section name="Input" selector="ui-input" [api]="inputApi"
        summary="Single-line text field. Value type: string. autocomplete and name pass straight to the native input, so browsers can autofill.">
        <doc-demo code="<ui-input formControlName=&quot;name&quot; placeholder=&quot;Ada&quot; size=&quot;md&quot; />">
          <ui-input formControlName="name" placeholder="Full name" />
        </doc-demo>
      </doc-section>

      <doc-section name="Textarea" selector="ui-textarea" [api]="textareaApi"
        summary="Multi-line text field. Value type: string. It has no resize handle; with autosize it grows with the text from rows up to maxRows lines.">
        <doc-demo code="<ui-textarea formControlName=&quot;bio&quot; [rows]=&quot;3&quot; [autosize]=&quot;true&quot; [maxRows]=&quot;8&quot; />">
          <ui-textarea formControlName="bio" [rows]="2" placeholder="About you…" />
        </doc-demo>
      </doc-section>

      <doc-section name="Field slots" anchor="field-slots" selector="[textarea-leading] · [textarea-trailing] · [input-leading] · [input-trailing]" [api]="slotApi"
        summary="Content inside the border of a textarea or input: an icon, or a ui-icon-button to attach or send. Leading sits at the inline start and trailing at the inline end, so they swap sides in RTL; on the textarea both are aligned to the last line and stay at the bottom while autosize grows. The text keeps clear of them, the focus ring and the invalid border go round the whole field, a click on a slot's empty space focuses the field (buttons in it take their own clicks), and an icon button keeps its 44px touch target on touch screens without making the field taller. dir is passed to the native field; auto follows what is typed, so a Thaana message turns the field right to left, and while the field is empty it follows the page, so the placeholder sits at the start (0.46.1).">
        <doc-demo code="<ui-textarea [autosize]=&quot;true&quot; [rows]=&quot;1&quot; dir=&quot;auto&quot; placeholder=&quot;Message…&quot;>
  <ui-icon-button textarea-leading label=&quot;Attach a file&quot; size=&quot;sm&quot;>
    <hugeicons-icon [icon]=&quot;attachIcon&quot; [size]=&quot;16&quot; [strokeWidth]=&quot;1.8&quot; />
  </ui-icon-button>
  <ui-icon-button textarea-trailing label=&quot;Send&quot; size=&quot;sm&quot; variant=&quot;primary&quot;>
    <hugeicons-icon [icon]=&quot;sendIcon&quot; [size]=&quot;16&quot; [strokeWidth]=&quot;1.8&quot; />
  </ui-icon-button>
</ui-textarea>

<ui-input type=&quot;email&quot; placeholder=&quot;you@example.com&quot;>
  <hugeicons-icon input-leading [icon]=&quot;mailIcon&quot; [size]=&quot;16&quot; [strokeWidth]=&quot;1.8&quot; />
</ui-input>">
          <div class="slot-demos">
            <ui-textarea [autosize]="true" [rows]="1" [maxRows]="5" dir="auto" placeholder="Message… (try ދިވެހި)" ariaLabel="Message">
              <ui-icon-button textarea-leading label="Attach a file" size="sm"><hugeicons-icon [icon]="icons.attach" [size]="16" [strokeWidth]="1.8" /></ui-icon-button>
              <ui-icon-button textarea-trailing label="Send" size="sm" variant="primary"><hugeicons-icon [icon]="icons.send" [size]="16" [strokeWidth]="1.8" /></ui-icon-button>
            </ui-textarea>
            <div dir="rtl">
              <ui-textarea [autosize]="true" [rows]="1" placeholder="ސިޓީ ލިޔުއްވާ…" ariaLabel="Message, right to left">
                <ui-icon-button textarea-leading label="Attach a file" size="sm"><hugeicons-icon [icon]="icons.attach" [size]="16" [strokeWidth]="1.8" /></ui-icon-button>
                <ui-icon-button textarea-trailing label="Send" size="sm" variant="primary"><hugeicons-icon [icon]="icons.send" [size]="16" [strokeWidth]="1.8" /></ui-icon-button>
              </ui-textarea>
            </div>
            <ui-input type="email" placeholder="you@example.com" ariaLabel="Email">
              <hugeicons-icon input-leading [icon]="icons.mail" [size]="16" [strokeWidth]="1.8" />
            </ui-input>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Number input" selector="ui-number-input" [api]="numberApi"
        summary="Numeric field with decrement and increment buttons side by side at its right end, each at least 24x24. Value type: number | null. A value is passed on while typing once it is in range; Enter or leaving the field clamps to min/max and rounds to precision. Focus selects the number. Give it a label to get a handle you drag sideways to scrub the value (Shift for 10x, Alt for 0.1x); project an svg with uiNumberLabel to show an icon there instead.">
        <doc-demo code="<ui-number-input formControlName=&quot;age&quot; [min]=&quot;0&quot; [max]=&quot;120&quot; [step]=&quot;1&quot; />
<ui-number-input formControlName=&quot;width&quot; label=&quot;W&quot; suffix=&quot;px&quot; [steppers]=&quot;false&quot; />">
          <ui-number-input formControlName="age" [min]="0" [max]="120" />
          <ui-number-input formControlName="width" label="W" suffix="px" [steppers]="false" />
        </doc-demo>
      </doc-section>

      <doc-section name="Password input" selector="ui-password-input" [api]="passwordApi"
        summary="Password field with a show/hide toggle. Value type: string. autocomplete defaults to current-password; pass new-password on sign-up forms.">
        <doc-demo code="<ui-password-input formControlName=&quot;password&quot; />">
          <ui-password-input formControlName="password" />
        </doc-demo>
      </doc-section>

      <doc-section name="Search input" selector="ui-search-input" [api]="searchApi"
        summary="Search field (type=search) with a search icon and a clear button that appears once there is text; clearing puts focus back in the field. Value type: string. Name it with ui-form-field, or with label when there is no visible label.">
        <doc-demo code="<ui-search-input formControlName=&quot;search&quot; placeholder=&quot;Search…&quot; />">
          <ui-search-input formControlName="search" />
        </doc-demo>
      </doc-section>

      <doc-section name="Time picker" selector="ui-time-picker" [api]="timeApi"
        summary="Native time field. Value type: string, 'HH:MM' (24-hour, whatever the display format); with a step under 60 the browser shows seconds and the value can be 'HH:MM:SS'.">
        <doc-demo code="<ui-time-picker formControlName=&quot;time&quot; [step]=&quot;60&quot; />">
          <ui-time-picker formControlName="time" />
        </doc-demo>
      </doc-section>

      <doc-section name="Select" selector="ui-select" [api]="selectApi"
        summary="Single choice on a native <select>, so the keyboard and screen readers work as the platform does; the option list takes the theme colours. Value type: string. A placeholder adds an empty, unselectable first option. For a font picker set fontPreview: each option, and the closed field, is drawn in the font it names (its fontFamily, or its value as a family name). Desktop Chrome and Firefox style native options, and browsers with appearance: base-select get a page-drawn list; phone and macOS native pickers ignore option fonts, so use the combobox when the preview must show everywhere." [shapes]="OPTION">
        <doc-demo code="<ui-select formControlName=&quot;role&quot; [options]=&quot;roles&quot; placeholder=&quot;Choose…&quot; />">
          <ui-select formControlName="role" [options]="roles" placeholder="Choose…" />
        </doc-demo>
        <doc-demo code="<ui-select [options]=&quot;fonts&quot; [fontPreview]=&quot;true&quot; [(ngModel)]=&quot;font&quot; label=&quot;Font&quot; />
<!-- each option: { label: 'Space Grotesk', value: 'Space Grotesk' } or a fontFamily stack -->">
          <ui-select [options]="fonts" [fontPreview]="true" [(ngModel)]="fontSel" [ngModelOptions]="{ standalone: true }" label="Font" />
        </doc-demo>
      </doc-section>

      <doc-section name="Combobox" selector="ui-combobox" [api]="comboApi"
        summary="Filterable autocomplete (CDK Overlay, WAI-ARIA combobox). Value type: string | null. Focus or click opens the list; type to filter by label; ArrowUp/Down move, Enter chooses, Escape, Tab or a click outside closes. Leaving the field puts the chosen label back, so typed text never becomes the value. Opening lists every option with the chosen one active; typing filters. fontPreview draws each option and the chosen value in the font it names, on every platform. With clearable (the default) a Clear button (aria-label Clear) shows while a value is chosen; it, or emptying the text and leaving the field, sets the value to null and keeps focus in the field. Name it with ui-form-field, or with label when there is no visible label." [shapes]="COMBO">
        <doc-demo code="<ui-combobox formControlName=&quot;country&quot; [options]=&quot;countries&quot; />">
          <ui-combobox formControlName="country" [options]="countries" />
        </doc-demo>
        <doc-demo code="<ui-combobox [options]=&quot;fonts&quot; [fontPreview]=&quot;true&quot; [(ngModel)]=&quot;font&quot; label=&quot;Font&quot; />">
          <ui-combobox [options]="fonts" [fontPreview]="true" [(ngModel)]="fontCombo" [ngModelOptions]="{ standalone: true }" label="Font" />
        </doc-demo>
      </doc-section>

      <doc-section name="Multi-select" selector="ui-multi-select" [api]="multiApi"
        summary="Choose several options; selections render as chips with a remove button. Value type: string[], in the order chosen. Type to filter; ArrowUp/Down move, Enter toggles the active option, Backspace in an empty field removes the last chip, Escape, Tab or a click outside closes. With clearable (the default) a Clear all button at the end of the field empties the selection. size matches the other fields; chips may wrap onto more rows." [shapes]="COMBO">
        <doc-demo code="<ui-multi-select formControlName=&quot;skills&quot; [options]=&quot;countries&quot; />">
          <ui-multi-select formControlName="skills" [options]="countries" />
        </doc-demo>
      </doc-section>

      <doc-section name="Checkbox & switch" selector="ui-checkbox · ui-switch" [api]="checkApi"
        summary="Boolean controls (value type: boolean), each built on a native checkbox, so Space toggles. ui-switch adds role=switch. Project the label as content.">
        <doc-demo code="<ui-checkbox formControlName=&quot;terms&quot;>Accept terms</ui-checkbox>
<ui-switch formControlName=&quot;news&quot;>Subscribe</ui-switch>">
          <div class="stack">
            <ui-checkbox formControlName="terms">Accept terms</ui-checkbox>
            <ui-switch formControlName="news">Subscribe</ui-switch>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Radio group" selector="ui-radio-group" [api]="radioApi"
        summary="Single choice from options. Value type: string | null. Built on native radios sharing a generated name, so arrow keys move the choice and the group is one tab stop." [shapes]="'interface UiRadioOption { label: string; value: string; disabled?: boolean; }'">
        <doc-demo code="<ui-radio-group formControlName=&quot;plan&quot; orientation=&quot;horizontal&quot; [options]=&quot;plans&quot; />">
          <ui-radio-group formControlName="plan" orientation="horizontal" [options]="plans" />
        </doc-demo>
      </doc-section>

      <doc-section name="Checkbox group" selector="ui-checkbox-group" [api]="checkGroupApi"
        summary="Multi-select checkbox set. Value type: string[]. selectAll adds a master checkbox that ticks or clears every enabled option and shows a mixed state when some are ticked; it never changes disabled options." [shapes]="'interface UiCheckboxOption { label: string; value: string; disabled?: boolean; }'">
        <doc-demo code="<ui-checkbox-group formControlName=&quot;tags&quot; orientation=&quot;horizontal&quot; [options]=&quot;interests&quot; />">
          <ui-checkbox-group formControlName="tags" orientation="horizontal" [options]="interests" />
        </doc-demo>
      </doc-section>

      <doc-section name="Slider" selector="ui-slider" [api]="sliderApi"
        summary="Themed native range input (arrow keys, Page Up/Down, Home/End). Value type: number; a null value shows min. The filled part of the track follows the value.">
        <doc-demo code="<ui-slider formControlName=&quot;volume&quot; [min]=&quot;0&quot; [max]=&quot;100&quot; [step]=&quot;1&quot; />">
          <ui-slider formControlName="volume" />
        </doc-demo>
      </doc-section>

      <doc-section name="Rating" selector="ui-rating" [api]="ratingApi"
        summary="Star rating. Value type: number (0 to max, 0 meaning none). A radiogroup with one tab stop: arrow keys and Home/End move the rating, a click sets it, clicking the current star again clears it to 0.">
        <doc-demo code="<ui-rating formControlName=&quot;rating&quot; [max]=&quot;5&quot; />">
          <ui-rating formControlName="rating" />
        </doc-demo>
      </doc-section>

      <doc-section name="OTP input" selector="ui-otp-input" [api]="otpApi"
        summary="Fixed-length one-time-code entry. Value type: string, one character per cell in position: an empty cell before a filled one is a space and empty cells at the end are dropped, so 1, 2, empty, 4 reads '12 4' and writing '12 4' back fills the same cells. The control validates itself: a non-empty value with fewer than length filled cells gives the error otpIncomplete: { filled, length }; an empty value is valid, so add Validators.required to make it mandatory. Typing moves to the next cell; Backspace in an empty cell and ArrowLeft/Right move between cells. Pasting or autofilling a whole code fills every cell from the first. The first cell has autocomplete=one-time-code.">
        <doc-demo code="<ui-otp-input formControlName=&quot;otp&quot; [length]=&quot;6&quot; [numeric]=&quot;true&quot; />">
          <ui-otp-input formControlName="otp" [length]="6" />
        </doc-demo>
      </doc-section>

      <doc-section name="Chip input" selector="ui-chip-input" [api]="chipApi"
        summary="Free-text tags. Value type: string[]. Enter or comma adds the typed text (trimmed); Backspace in an empty field removes the last chip, and each chip has a remove button. Duplicates are kept.">
        <doc-demo code="<ui-chip-input formControlName=&quot;chips&quot; placeholder=&quot;Add tag…&quot; />">
          <ui-chip-input formControlName="chips" />
        </doc-demo>
      </doc-section>

      <doc-section name="Editable text" selector="ui-editable-text" [api]="editApi"
        summary="Click-to-edit inline text. Value type: string. Shows as a button; clicking (or Enter/Space) opens a field with the text selected. Enter or leaving the field commits, Escape cancels.">
        <doc-demo code="<ui-editable-text formControlName=&quot;nick&quot; placeholder=&quot;Empty&quot; />">
          <ui-editable-text formControlName="nick" />
        </doc-demo>
      </doc-section>

      <doc-section name="Color picker" selector="ui-color-picker" [api]="colorApi"
        summary="Native colour well, a hex field and preset swatches. Value type: string (hex). The hex field passes a colour on only once it is a whole #rgb or #rrggbb (the # is optional) and sends it as lower-case #rrggbb; leaving the field restores the current colour.">
        <doc-demo code="<ui-color-picker formControlName=&quot;color&quot; [swatches]=&quot;['#3d5afe','#2faa6e']&quot; />">
          <ui-color-picker formControlName="color" [swatches]="swatches" />
        </doc-demo>
      </doc-section>

      <doc-section name="File upload" selector="ui-file-upload" [api]="uploadApi" [outputs]="uploadOut"
        summary="Drag-and-drop or click dropzone (a native file input underneath, so it is keyboard-reachable) that lists the chosen files with their sizes. Emits (filesSelected) with a File[] (only the first file unless multiple). Not a form control: it has no value or ngModel, but it has a disabled input. accept filters the file dialog, and dropped files are checked against it the same way; files that don't match go to (rejected).">
        <doc-demo code="<ui-file-upload [multiple]=&quot;true&quot; accept=&quot;image/*&quot; (filesSelected)=&quot;onFiles($event)&quot; />">
          <ui-file-upload [multiple]="true" accept="image/*" />
        </doc-demo>
      </doc-section>

      <doc-section name="Date picker" selector="ui-date-picker" [api]="dateApi"
        summary="Calendar popover (CDK Overlay). Value type: ISO string 'YYYY-MM-DD' (or null; an empty or malformed string counts as no date). Click the field, or press Enter, Space or ArrowDown on it, to open; focus goes to the chosen day (or today). Arrow keys move by day and week, PageUp/PageDown by month, Home/End to the ends of the month, Enter picks. Tab stays inside the popover; Escape closes it and returns to the field, as does a click outside. The month and year in the header open month and year grids, which focus the month or year in view and keep one tab stop: arrow keys move (Up/Down by a row of three), Home/End go to the first and last cell, PageUp/PageDown change the year (month grid) or the page of 12 years (year grid), Enter or Space picks. min/max limit which days can be picked. Month and day names come from the built-in strings (Dhivehi in uiStringsDv) or Intl in the app's LOCALE_ID, and the weeks start on the locale's first day (Sunday in en-US and in uiStringsDv); in RTL the grid, the arrows and the arrow keys read right to left (0.46.0).">
        <doc-demo code="<ui-date-picker formControlName=&quot;date&quot; />">
          <ui-date-picker formControlName="date" />
        </doc-demo>
      </doc-section>

      <doc-section name="Calendar" selector="ui-calendar" [api]="calendarApi"
        summary="Inline month calendar. Value type: ISO string 'YYYY-MM-DD' (or null; an empty or malformed string counts as no date); it opens on the month of its value. Each day is a button named with its full date; the chosen day is aria-pressed and today is aria-current. Month and day names come from the built-in strings (Dhivehi in uiStringsDv) or Intl in the app's LOCALE_ID, and the weeks start on the locale's first day (Sunday in en-US and in uiStringsDv); in RTL the grid, the arrows and the arrow keys read right to left (0.46.0).">
        <doc-demo code="<ui-calendar formControlName=&quot;date2&quot; />">
          <ui-calendar formControlName="date2" />
        </doc-demo>
      </doc-section>

      <doc-section name="Date range picker" selector="ui-date-range-picker"
        summary="Inline range selection; no inputs beyond the form control. Click a start day, then an end day (an earlier end swaps them); a third click starts a new range. While choosing the end, hovering previews the band. Value type: UiDateRange (ISO days); it opens on the month the range starts in. Month and day names come from the built-in strings (Dhivehi in uiStringsDv) or Intl in the app's LOCALE_ID, and the weeks start on the locale's first day (Sunday in en-US and in uiStringsDv); in RTL the grid, the arrows and the arrow keys read right to left (0.46.0)."
        [shapes]="'type UiDateRange = { start: string | null; end: string | null };'">
        <doc-demo code="<ui-date-range-picker formControlName=&quot;range&quot; />">
          <ui-date-range-picker formControlName="range" />
        </doc-demo>
      </doc-section>

      </form>

      <doc-section name="Choice grid" selector="ui-choice-grid" [api]="choiceApi" [outputs]="choiceOut"
        summary="One of many options as tiles, grouped under headings; a radio group underneath (form control or [(value)]). Arrow keys (and Home/End) move through the enabled tiles in reading order and choose as they go, only the chosen tile is in the tab order, Enter/Space choose. Project #tile (let-item, let-selected) to draw a picture above each label. (picked) fires on every choice, even the selected tile again."
        [shapes]="CHOICE">
        <doc-demo code="<ui-choice-grid [options]=&quot;presets&quot; [(value)]=&quot;preset&quot; label=&quot;Motion preset&quot;>
  <ng-template #tile let-item let-selected=&quot;selected&quot;><img [src]=&quot;item.value + '.png'&quot; alt=&quot;&quot; /></ng-template>
</ui-choice-grid>">
          <ui-choice-grid [options]="choices" [(value)]="choice" label="Motion preset" minTile="120px" (picked)="lastPick.set($event.label)">
            <ng-template #tile let-item let-selected="selected"><span class="swatch" [class.on]="selected">{{ item.label[0] }}</span></ng-template>
          </ui-choice-grid>
          <span class="muted">value: {{ choice() }} · picked: {{ lastPick() }}</span>
        </doc-demo>
      </doc-section>

      <doc-section name="Anchor picker" selector="ui-anchor-picker" [api]="anchorApi" shapes="interface UiAnchor { x: number; y: number }   // fractions of the box: 0, 0.5 or 1 for the dots"
        summary="The nine-dot grid for picking a point of a box, such as a pivot or an alignment. Value is {x, y} in fractions of the box; a point between dots shows none chosen. A radiogroup with one tab stop; arrow keys move the choice, and each dot is named (Top left, Centre…). Also a form control.">
        <doc-demo code="<ui-anchor-picker [(value)]=&quot;pivot&quot; label=&quot;Pivot&quot; />">
          <div class="row"><ui-anchor-picker [(value)]="anchor" label="Pivot" /> <span class="muted">x {{ anchor()?.x }}, y {{ anchor()?.y }}</span></div>
        </doc-demo>
      </doc-section>
      <doc-section name="Token input" selector="ui-token-input" [api]="tokenApi" [outputs]="tokenOut" [shapes]="TOKEN"
        summary="Rich text where some pieces are atomic tokens (variables, mentions) shown as chips. Value type: UiTokenRun[]. A chip acts like one character: the caret steps over it and one Backspace removes it. Ctrl/⌘+B and Ctrl/⌘+I toggle bold and italic; pasting always inserts plain text. Call insertToken() on the component to drop a chip at the caret (or at the end when the field has no caret). Built on a contenteditable div with role=textbox; give it a label for its accessible name. The design tools page shows it in a template editor.">
        <doc-demo lang="ts + html" code="<ui-token-input #msg [(ngModel)]=&quot;runs&quot; [tokenLabel]=&quot;labelFor&quot; label=&quot;Message&quot; placeholder=&quot;Write a message&quot; />
<ui-button (mousedown)=&quot;$event.preventDefault()&quot; (click)=&quot;msg.insertToken('guest.name')&quot;>Insert guest name</ui-button>

labelFor = (token: string) => ({ 'guest.name': 'Guest name', 'event.date': 'Date' })[token] ?? token;">
          <ui-token-input #msg [(ngModel)]="runs" [tokenLabel]="labelFor" label="Message" placeholder="Write a message" (tokenClick)="tokenClicked.set($event)" />
          <div class="row">
            <ui-button size="sm" variant="outline" (mousedown)="$event.preventDefault()" (click)="msg.insertToken('guest.name')">Insert guest name</ui-button>
            <ui-button size="sm" variant="outline" (mousedown)="$event.preventDefault()" (click)="msg.insertToken('event.date')">Insert date</ui-button>
            <span class="muted">last chip clicked: {{ tokenClicked() }}</span>
          </div>
          <pre class="json" dir="ltr">{{ runsJson(runs) }}</pre>
        </doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .slot-demos { display: grid; gap: var(--ui-space-4); max-width: 420px; }
    .stack { display: flex; flex-direction: column; gap: var(--ui-space-3); }
    .row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ui-space-3); }
    .muted { color: var(--ui-color-text-muted); font: var(--ui-font-size-sm) var(--ui-font-mono); }
    .json { margin: 0; padding: var(--ui-space-2) var(--ui-space-3); max-height: 160px; overflow: auto; border-radius: var(--ui-radius);
      background: var(--ui-color-surface-subtle); color: var(--ui-color-text-muted); font: var(--ui-font-size-sm) var(--ui-font-mono);
      white-space: pre; }
    .swatch { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: var(--ui-color-surface-raised);
      color: var(--ui-color-text-muted); font-weight: 600; transition: background var(--ui-motion-fast) var(--ui-ease-standard), color var(--ui-motion-fast) var(--ui-ease-standard); }
    .swatch.on { background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); }
  `,
})
export class FormsPage {
  protected readonly choices: UiChoice[] = [
    // A full first group and wider tiles (minTile 120px), so the grid fills the demo instead of a corner of it.
    { value: 'fade', label: 'Fade', group: 'Entrances' }, { value: 'rise', label: 'Rise', group: 'Entrances' },
    { value: 'zoom', label: 'Zoom', group: 'Entrances' }, { value: 'slide', label: 'Slide', group: 'Entrances' },
    { value: 'blur', label: 'Blur', group: 'Entrances' }, { value: 'drop', label: 'Drop', group: 'Entrances' },
    { value: 'pulse', label: 'Pulse', group: 'Loops', description: 'A gentle beat' }, { value: 'float', label: 'Float', group: 'Loops' },
    { value: 'spin', label: 'Spin', group: 'Loops', disabled: true },
  ];
  protected readonly choice = signal<string | null>('rise');
  protected readonly lastPick = signal('—');
  protected readonly anchor = signal<UiAnchor | null>({ x: 0.5, y: 0 });
  protected readonly COMBO = COMBO;
  protected readonly CHOICE = CHOICE;
  protected readonly TOKEN = TOKEN;
  protected runs: UiTokenRun[] = [{ text: 'Hi ' }, { token: 'guest.name', bold: true }, { text: ', see you on ' }, { token: 'event.date' }, { text: '.' }];
  protected readonly tokenClicked = signal('—');
  protected readonly labelFor = (t: string) => ({ 'event.date': 'Date', 'guest.name': 'Guest name' } as Record<string, string>)[t] ?? t;
  protected runsJson(runs: UiTokenRun[]): string { return JSON.stringify(runs, null, 2); }
  protected readonly locked = signal(false);
  protected lock(off: boolean): void {
    this.locked.set(off);
    if (off) this.form.disable(); else this.form.enable();
  }
  protected readonly choiceApi: ApiRow[] = [
    { name: 'options', type: 'readonly UiChoice[]', default: '[]', desc: 'The tiles; items with a group sit under its heading, groups in order of first appearance.' },
    { name: 'value', type: 'string | null (model)', default: 'null', desc: 'Two-way (`[(value)]`). The chosen value. Also a form control (ngModel, formControl).' },
    { name: 'label', type: 'string', default: "'Choices'", desc: 'Accessible name of the group.' },
    { name: 'minTile', type: 'string', default: "'88px'", desc: 'Narrowest a tile may get (CSS length).' },
    { name: '#tile', type: 'slot (ng-template)', default: '—', desc: 'Picture above each label; context is UiChoiceTileContext.' },
  ];
  protected readonly choiceOut: ApiRow[] = [
    { name: 'picked', type: 'UiChoice', default: '—', desc: 'Every choice, including the chosen one again.' },
  ];
  protected readonly anchorApi: ApiRow[] = [
    { name: 'value', type: 'UiAnchor | null (model)', default: '{ x: 0.5, y: 0.5 }', desc: 'Two-way (`[(value)]`). Fractions of the box; a point between dots shows none chosen. Also a form control (ngModel, formControl).' },
    { name: 'label', type: 'string', default: "'Point'", desc: 'Accessible name of the group.' },
  ];
  protected readonly tokenApi: ApiRow[] = [
    { name: 'ngModel / formControl', type: 'UiTokenRun[]', default: '[]', desc: 'The content, as runs of text and tokens (see Data shapes).' },
    { name: 'tokenLabel', type: '(token: string) => string', default: 'token => token', desc: 'The text a chip shows for a token value.' },
    { name: 'label', type: 'string', default: "''", desc: 'Accessible name (aria-label).' },
    { name: 'placeholder', type: 'string', default: "''", desc: 'Shown while empty.' },
    { name: 'multiline', type: 'boolean', default: 'true', desc: 'Enter inserts a line break; false keeps one line, one field high, and pastes newlines as spaces.' },
    { name: 'minHeight', type: 'string | null', default: 'null', desc: 'CSS min-height of the field.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
    { name: 'insertToken(token)', type: 'method', default: '—', desc: 'Insert a chip at the caret, or at the end when the field has no caret.' },
    { name: 'focus()', type: 'method', default: '—', desc: 'Focus the field with the caret at the end.' },
  ];
  protected readonly tokenOut: ApiRow[] = [
    { name: 'tokenClick', type: 'string', default: '—', desc: 'A chip was clicked; its token value.' },
    { name: 'focusChange', type: 'boolean', default: '—', desc: 'The field gained (true) or lost (false) focus.' },
  ];
  protected readonly formJson = computed(() => JSON.stringify(this.formValue(), null, 2));
  protected readonly OPTION = OPTION;
  /** Fonts the docs page has loaded (the Dark Orange theme brings three) plus generic families. */
  protected readonly fonts = [
    { label: 'System UI', value: 'system', fontFamily: 'system-ui, sans-serif' },
    { label: 'Space Grotesk', value: 'Space Grotesk' },
    { label: 'Bricolage Grotesque', value: 'Bricolage Grotesque' },
    { label: 'JetBrains Mono', value: 'JetBrains Mono' },
    { label: 'Serif', value: 'serif', fontFamily: 'Georgia, "Times New Roman", serif' },
    { label: 'Monospace', value: 'monospace', fontFamily: 'ui-monospace, monospace' },
  ];
  protected fontSel = 'Space Grotesk';
  protected fontCombo: string | null = 'Bricolage Grotesque';
  protected readonly roles = [{ label: 'Engineer', value: 'eng' }, { label: 'Designer', value: 'design' }, { label: 'PM', value: 'pm' }];
  protected readonly plans = [{ label: 'Free', value: 'free' }, { label: 'Pro', value: 'pro' }, { label: 'Enterprise', value: 'ent' }];
  protected readonly interests = [{ label: 'Design', value: 'design' }, { label: 'Code', value: 'code' }, { label: 'Data', value: 'data' }];
  protected readonly countries = [
    { label: 'Australia', value: 'au' }, { label: 'Canada', value: 'ca' }, { label: 'Germany', value: 'de' },
    { label: 'Japan', value: 'jp' }, { label: 'United States', value: 'us' },
  ];
  protected readonly swatches = ['#3d5afe', '#2faa6e'];
  protected readonly form = new FormGroup({
    name: new FormControl('Ada Lovelace'), email: new FormControl(''), bio: new FormControl(''),
    age: new FormControl<number | null>(30), width: new FormControl<number | null>(320), password: new FormControl(''), search: new FormControl(''), time: new FormControl('09:30'),
    role: new FormControl('eng'), country: new FormControl('ca'), skills: new FormControl<string[]>(['ca', 'jp']),
    terms: new FormControl(false), news: new FormControl(true), plan: new FormControl('pro'), tags: new FormControl<string[]>(['code']),
    volume: new FormControl(60), rating: new FormControl(4), otp: new FormControl(''), chips: new FormControl<string[]>(['angular']),
    nick: new FormControl('ada'), color: new FormControl('#3d5afe'),
    date: new FormControl(''), date2: new FormControl(''), range: new FormControl<{ start: string | null; end: string | null }>({ start: null, end: null }),
  });
  private readonly formValue = signal<unknown>(null);
  constructor() {
    this.formValue.set(this.form.getRawValue());
    this.form.valueChanges.subscribe(() => this.formValue.set(this.form.getRawValue()));
  }
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
    { name: 'autocomplete', type: 'string', default: '—', desc: "Native autocomplete, e.g. 'email'." },
    { name: 'name', type: 'string', default: '—', desc: 'Native name, used by browser autofill.' },
    { name: 'dir', type: "'ltr' | 'rtl' | 'auto' | null", default: 'null', desc: 'Writing direction of the native input (see Field slots).' },
    ...this.common,
  ];
  protected readonly icons = { attach: Attachment01Icon, send: SentIcon, mail: Mail01Icon };
  protected readonly slotApi: ApiRow[] = [
    { name: '[textarea-leading] / [input-leading]', type: 'content', default: '—', desc: 'Shown inside the border at the inline start (the left in LTR, the right in RTL), aligned to the last line.' },
    { name: '[textarea-trailing] / [input-trailing]', type: 'content', default: '—', desc: 'Shown inside the border at the inline end, aligned to the last line.' },
    { name: 'dir', type: "UiTextDir: 'ltr' | 'rtl' | 'auto' | null", default: 'null (inherit)', desc: 'Passed to the native field; auto follows the first strong character typed, and the slots follow the resolved direction.' },
    { name: 'focus()', type: 'method', default: '—', desc: 'Focuses the native field.' },
    { name: '--ui-field-font', type: 'CSS custom property', default: 'var(--ui-font-default)', desc: "Set on ui-input / ui-textarea to type, and show the placeholder, in an app font, e.g. style=\"--ui-field-font: Faruma, 'Noto Sans Thaana'\"." },
  ];
  protected readonly textareaApi: ApiRow[] = [
    { name: 'placeholder', type: 'string', default: "''", desc: 'Placeholder text.' },
    { name: 'rows', type: 'number', default: '4', desc: 'Visible rows (the starting height with autosize).' },
    { name: 'autosize', type: 'boolean', default: 'false', desc: 'Grow with the text from rows up to maxRows lines.' },
    { name: 'maxRows', type: 'number', default: '8', desc: 'With autosize: most lines before it scrolls.' },
    { name: 'autocomplete', type: 'string', default: '—', desc: 'Native autocomplete.' },
    { name: 'name', type: 'string', default: '—', desc: 'Native name.' },
    { name: 'invalid', type: 'boolean', default: 'false', desc: 'Error styling.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
    { name: 'dir', type: "'ltr' | 'rtl' | 'auto' | null", default: 'null', desc: 'Writing direction of the native textarea (see Field slots).' },
  ];
  protected readonly numberApi: ApiRow[] = [
    { name: 'min', type: 'number', default: '—', desc: 'Minimum (clamped).' },
    { name: 'max', type: 'number', default: '—', desc: 'Maximum (clamped).' },
    { name: 'step', type: 'number', default: '1', desc: 'Stepper and scrub increment.' },
    { name: 'placeholder', type: 'string', default: "''", desc: 'Placeholder.' },
    { name: 'label', type: 'string', default: "''", desc: 'Short label before the number (e.g. "X", "W"); drag it to scrub.' },
    { name: 'ariaLabel', type: 'string', default: "''", desc: 'Accessible name when the label is too terse.' },
    { name: 'suffix', type: 'string', default: "''", desc: 'Unit after the number, e.g. "px".' },
    { name: 'precision', type: 'number | null', default: 'null', desc: 'Decimal places kept; values are rounded to this.' },
    { name: 'steppers', type: 'boolean', default: 'true', desc: 'Show the decrement/increment buttons (side by side, 24px wide each).' },
    { name: '[uiNumberLabel] (slot)', type: 'content', default: '—', desc: 'An icon (e.g. svg) shown in place of the text label; needs label or ariaLabel set.' },
    ...this.common,
  ];
  protected readonly passwordApi: ApiRow[] = [
    { name: 'placeholder', type: 'string', default: "''", desc: 'Placeholder.' },
    { name: 'autocomplete', type: 'string', default: "'current-password'", desc: "Use 'new-password' for sign-up or change-password." },
    { name: 'name', type: 'string', default: '—', desc: 'Native name.' },
    ...this.common,
  ];
  protected readonly searchApi: ApiRow[] = [
    { name: 'placeholder', type: 'string', default: "'Search…'", desc: 'Placeholder.' },
    { name: 'label', type: 'string', default: '—', desc: 'aria-label for the text field, when no ui-form-field label names it.' },
    { name: 'size', type: SIZE, default: "'md'", desc: 'Control height.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly timeApi: ApiRow[] = [
    { name: 'size', type: SIZE, default: "'md'", desc: 'Control height.' },
    { name: 'step', type: 'number', default: '60', desc: 'Step in seconds; under 60 shows seconds.' },
    { name: 'invalid', type: 'boolean', default: 'false', desc: 'Error styling.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly selectApi: ApiRow[] = [
    { name: 'options', type: 'UiSelectOption[]', default: '[]', desc: 'Choices (see Data shapes).' },
    { name: 'placeholder', type: 'string', default: '—', desc: 'Text of an empty first option, shown while no value is chosen.' },
    { name: 'label', type: 'string', default: '—', desc: 'aria-label (not needed inside ui-form-field).' },
    { name: 'fontPreview', type: 'boolean', default: 'false', desc: 'Font picker: draw each option and the closed field in the font it names (fontFamily, else the value).' },
    ...this.common,
  ];
  protected readonly comboApi: ApiRow[] = [
    { name: 'options', type: 'UiComboboxOption[]', default: '[]', desc: 'Choices; filtered by label. Options that arrive after the value still show its label.' },
    { name: 'placeholder', type: 'string', default: "'Search…'", desc: 'Placeholder.' },
    { name: 'label', type: 'string', default: '—', desc: 'aria-label for the text field, when no ui-form-field label names it.' },
    { name: 'clearable', type: 'boolean', default: 'true', desc: 'Show a Clear button while a value is chosen (hidden when disabled), and clear the value when the text is emptied and the field is left. Off: leaving the field always restores the chosen label.' },
    { name: 'clear()', type: 'method', default: '—', desc: 'Set the value to null, notify the form and focus the field.' },
    { name: 'fontPreview', type: 'boolean', default: 'false', desc: 'Font picker: draw each option and the chosen value in the font it names (fontFamily, else the value).' },
    ...this.common,
  ];
  protected readonly multiApi: ApiRow[] = [
    { name: 'options', type: 'UiComboboxOption[]', default: '[]', desc: 'Choices; filtered by label. A value missing from options shows as its raw value.' },
    { name: 'placeholder', type: 'string', default: "'Select…'", desc: 'Shown while nothing is chosen.' },
    { name: 'label', type: 'string', default: '—', desc: 'aria-label for the text field, when no ui-form-field label names it.' },
    { name: 'clearable', type: 'boolean', default: 'true', desc: 'Show a Clear all button while anything is selected (hidden when disabled).' },
    { name: 'clear()', type: 'method', default: '—', desc: 'Empty the selection, notify the form and focus the field.' },
    ...this.common,
  ];
  protected readonly checkApi: ApiRow[] = [
    { name: 'invalid', type: 'boolean (ui-checkbox only)', default: 'false', desc: 'Error styling and aria-invalid.' },
    { name: '(content)', type: 'slot', default: '—', desc: 'The label text.' },
    { name: 'ariaLabel', type: 'string (ui-switch)', default: '—', desc: 'Accessible name for the switch when it has no label text (a plain aria-label works too).' },
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
    { name: 'selectAll', type: 'boolean', default: 'false', desc: 'Add a master checkbox for every enabled option.' },
    { name: 'selectAllLabel', type: 'string', default: "'Select all'", desc: 'Label of the master checkbox.' },
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
    { name: 'invalid', type: 'boolean', default: 'false', desc: 'Error styling.' },
  ];
  protected readonly chipApi: ApiRow[] = [
    { name: 'placeholder', type: 'string', default: "'Add tag…'", desc: 'Placeholder.' },
    { name: 'label', type: 'string', default: '—', desc: 'aria-label for the text field, when no ui-form-field label names it.' },
    { name: 'invalid', type: 'boolean', default: 'false', desc: 'Error styling.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly editApi: ApiRow[] = [
    { name: 'placeholder', type: 'string', default: "'Empty'", desc: 'Shown (muted) when the value is empty.' },
  ];
  protected readonly colorApi: ApiRow[] = [
    { name: 'swatches', type: 'string[]', default: '6 fixed presets', desc: 'Preset colours; each is a button named by its hex and aria-pressed when it matches the value.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly uploadApi: ApiRow[] = [
    { name: 'multiple', type: 'boolean', default: 'false', desc: 'Allow multiple files.' },
    { name: 'accept', type: 'string', default: '—', desc: 'Accept filter (e.g. image/*); also shown under the hint.' },
    { name: 'acceptLabel', type: 'string', default: '—', desc: 'Text shown for the accepted types instead of accept, e.g. "PNG, JPEG or WebP".' },
    { name: 'label', type: 'string', default: "strings.uploadLabel ('Click to upload')", desc: 'The action, in bold. Translate here or app-wide with provideUiStrings.' },
    { name: 'hint', type: 'string', default: "strings.uploadHint ('or drag & drop')", desc: "What follows it; '' hides it (a phone has nothing to drag)." },
    { name: 'radius', type: 'boolean', default: 'true', desc: 'Rounded corners.' },
    { name: 'disabled', type: 'boolean', default: 'false', desc: 'Greys out the dropzone and ignores clicks and drops.' },
  ];
  protected readonly uploadOut: ApiRow[] = [
    { name: 'filesSelected', type: 'File[]', default: '—', desc: 'Chosen files.' },
    { name: 'rejected', type: 'File[]', default: '—', desc: 'Dropped files that did not match accept.' },
  ];
  protected readonly dateApi: ApiRow[] = [
    { name: 'placeholder', type: 'string', default: "'Select a date'", desc: 'Placeholder.' },
    { name: 'min', type: 'string | null', default: 'null', desc: 'Earliest pickable day (ISO); earlier days show but are disabled.' },
    { name: 'max', type: 'string | null', default: 'null', desc: 'Latest pickable day (ISO).' },
    { name: 'size', type: SIZE, default: "'md'", desc: 'Control height.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly calendarApi: ApiRow[] = [
    { name: 'min', type: 'string | null', default: 'null', desc: 'Earliest selectable day (ISO).' },
    { name: 'max', type: 'string | null', default: 'null', desc: 'Latest selectable day (ISO).' },
  ];
}
