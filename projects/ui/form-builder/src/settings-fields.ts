import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiInput, UiSwitch } from '@zouriel/ui/form';
import { FB_SHARED_STYLES } from './builder-styles';
import type { UiFbSettings } from './schema';

/**
 * `ui-fb-settings-fields` — the form-wide options (where labels and errors
 * go, when problems show, buttons and steps). Used for one form in the
 * builder, and for the defaults of new forms in `ui-form-global-settings`.
 */
@Component({
  selector: 'ui-fb-settings-fields',
  imports: [FormsModule, UiInput, UiSwitch],
  template: `
    @let s = settings();
        <section class="group-sec">
          <h4>Questions</h4>
          <div class="fb-grid2">
            <label class="fld"><span class="fb-label">Question text</span>
              <select class="fb-native-select" (change)="set({ labelPlacement: $any($event.target).value })">
                <option value="top" [selected]="(s.labelPlacement ?? 'top') === 'top'">Above the box</option>
                <option value="inside" [selected]="s.labelPlacement === 'inside'">Inside the box</option>
                <option value="left" [selected]="s.labelPlacement === 'left'">To the left</option>
              </select>
            </label>
            <label class="fld"><span class="fb-label">Error messages</span>
              <select class="fb-native-select" (change)="set({ errorPlacement: $any($event.target).value })">
                <option value="below" [selected]="(s.errorPlacement ?? 'below') === 'below'">Below the box</option>
                <option value="inside" [selected]="s.errorPlacement === 'inside'">Inside the box</option>
              </select>
            </label>
          </div>
          <p class="fb-hint">Each question can override these. “Inside the box” applies to text boxes only.</p>
          <label class="fld"><span class="fb-label">Mark questions</span>
            <select class="fb-native-select" (change)="set({ requiredMarker: $any($event.target).value })">
              <option value="asterisk" [selected]="(s.requiredMarker ?? 'asterisk') === 'asterisk'">Required ones with *</option>
              <option value="optional" [selected]="s.requiredMarker === 'optional'">Optional ones with “(optional)”</option>
              <option value="none" [selected]="s.requiredMarker === 'none'">Don’t mark</option>
            </select>
          </label>
        </section>
        <section class="group-sec">
          <h4>Checking answers</h4>
          <label class="fld"><span class="fb-label">Show problems</span>
            <select class="fb-native-select" (change)="set({ validateOn: $any($event.target).value })">
              <option value="blur" [selected]="(s.validateOn ?? 'blur') === 'blur'">When someone leaves a question</option>
              <option value="submit" [selected]="s.validateOn === 'submit'">Only when they continue or submit</option>
            </select>
          </label>
          <ui-switch [ngModel]="s.errorSummary !== false" (ngModelChange)="set({ errorSummary: $event ? undefined : false })">List all problems at the top</ui-switch>
          <label class="fld"><span class="fb-label">Answers to hidden questions</span>
            <select class="fb-native-select" (change)="set({ clearHidden: $any($event.target).value })">
              <option value="onSubmit" [selected]="(s.clearHidden ?? 'onSubmit') === 'onSubmit'">Leave them out when saving</option>
              <option value="never" [selected]="s.clearHidden === 'never'">Keep them</option>
            </select>
            <span class="fb-hint">Saved answers that were already hidden when someone opened the form are always kept.</span>
          </label>
        </section>
        <section class="group-sec">
          <h4>Buttons and steps</h4>
          <ui-switch [ngModel]="s.showProgress !== false" (ngModelChange)="set({ showProgress: $event ? undefined : false })">Show progress on multi-page forms</ui-switch>
          <div class="fb-grid2">
            <label class="fld"><span class="fb-label">Submit button</span><ui-input [ngModel]="s.submitLabel ?? ''" (ngModelChange)="set({ submitLabel: $event || undefined }, 'sl')" placeholder="Submit" /></label>
            <label class="fld"><span class="fb-label">Next button</span><ui-input [ngModel]="s.nextLabel ?? ''" (ngModelChange)="set({ nextLabel: $event || undefined }, 'nl')" placeholder="Continue" /></label>
            <label class="fld"><span class="fb-label">Back button</span><ui-input [ngModel]="s.backLabel ?? ''" (ngModelChange)="set({ backLabel: $event || undefined }, 'bl')" placeholder="Back" /></label>
          </div>
        </section>
  `,
  styles: [FB_SHARED_STYLES, `
    :host { display: flex; flex-direction: column; gap: var(--ui-space-3); }
    .fld { display: flex; flex-direction: column; min-width: 0; }
    .group-sec { display: flex; flex-direction: column; gap: var(--ui-space-2); padding-top: var(--ui-space-3); border-top: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); }
    .group-sec h4 { margin: 0; font-size: 12px; font-weight: 600; color: var(--ui-color-text); }
  `],
})
export class FbSettingsFields {
  readonly settings = input<UiFbSettings>({});
  /** A change to merge into the settings; quick typing in one box shares a `mergeKey`. */
  readonly patch = output<{ patch: Partial<UiFbSettings>; mergeKey?: string }>();

  protected set(patch: Partial<UiFbSettings>, mergeKey?: string): void {
    this.patch.emit({ patch, mergeKey });
  }
}
