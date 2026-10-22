import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import Settings02Icon from '@hugeicons/core-free-icons/Settings02Icon';
import Add01Icon from '@hugeicons/core-free-icons/Add01Icon';
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon';
import TextBoldIcon from '@hugeicons/core-free-icons/TextBoldIcon';
import Alert02Icon from '@hugeicons/core-free-icons/Alert02Icon';
import BubbleChatIcon from '@hugeicons/core-free-icons/BubbleChatIcon';
import { uiBadgeCount } from '@zouriel/ui';
import { UiFabHold } from '@zouriel/ui/hold-button';
import { UiText } from '@zouriel/ui/text';
import { UiSwitch } from '@zouriel/ui/form';
import {
  UiButton, UiIconButton, UiButtonGroup, UiToggleButton, UiSplitButton, UiSegmented, UiFab,
  type UiSegmentedOption, type UiFabPlacement,
} from '@zouriel/ui/button';
import { UiDropdownButton, type UiDropdownItem } from '@zouriel/ui/dropdown-button';
import { UiHoldButton } from '@zouriel/ui/hold-button';
import {
  UI_GOOGLE_IDENTITY, UiGoogleAuthorization, UiGoogleAuthorizationError, UiGoogleButton, UiGoogleSignIn,
  type UiGoogleButtonTheme, type UiGoogleIdentity,
} from '@zouriel/ui/google-sign-in';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

const VARIANT = 'UiButtonVariant';
const SIZE = "'sm' | 'md' | 'lg'";
const BUTTON_SIZE = "UiButtonSize: 'sm' | 'md' | 'lg' | 'xl'";
const SLOT = 'Projected content is the label (text, or an icon followed by text).';

/**
 * The showcase has no Google client ID, so ui-google-sign-in gets a stand-in for Google Identity
 * Services: it draws a clearly marked placeholder where Google's button would be, and "signs in"
 * with a fake token when clicked. A real app leaves UI_GOOGLE_IDENTITY alone.
 */
function demoIdentity(): UiGoogleIdentity {
  let callback: ((r: { credential: string }) => void) | null = null;
  return {
    initialize: (c) => (callback = c.callback),
    renderButton: (el, o) => {
      const b = el.ownerDocument.createElement('button');
      b.type = 'button';
      b.textContent = `Demo placeholder: Google's own button renders here (${o.theme}, ${o.text}, ${o.shape})`;
      b.style.cssText = 'min-height: 40px; padding: 0 var(--ui-space-3); border: 1px dashed var(--ui-color-border); border-radius: var(--ui-radius);'
        + ' background: transparent; color: var(--ui-color-text-muted); font: inherit; font-size: 13px; cursor: pointer; text-align: start;';
      b.onclick = () => callback?.({ credential: 'demo.header.payload' });
      el.appendChild(b);
    },
  };
}

@Component({
  selector: 'demo-google-sign-in',
  imports: [UiGoogleSignIn],
  providers: [{ provide: UI_GOOGLE_IDENTITY, useValue: () => Promise.resolve(demoIdentity()) }],
  template: `<ui-google-sign-in clientId="demo-placeholder.apps.googleusercontent.com" [theme]="theme()" (credential)="credential.emit($event)" />`,
})
export class DemoGoogleSignIn {
  theme = input<UiGoogleButtonTheme>('auto');
  readonly credential = output<string>();
}

@Component({
  selector: 'demo-google-sign-in-blocked',
  imports: [UiGoogleSignIn],
  providers: [{ provide: UI_GOOGLE_IDENTITY, useValue: () => Promise.reject(new Error('Google sign-in could not load (blocked or offline)')) }],
  template: `<ui-google-sign-in clientId="demo-placeholder.apps.googleusercontent.com" text="continue_with" (failed)="failed.emit($event.message)" />`,
})
export class DemoGoogleSignInBlocked {
  readonly failed = output<string>();
}

/**
 * UiGoogleAuthorization with a stand-in token client: "grants" the birthday scope and leaves the
 * phone scope unticked, or reports a closed popup, so the demo runs without a client ID.
 */
@Component({
  selector: 'demo-google-authorization',
  imports: [UiButton, UiText],
  providers: [{
    provide: UI_GOOGLE_IDENTITY,
    useValue: (): Promise<UiGoogleIdentity> => Promise.resolve({
      initialize: () => {},
      renderButton: () => {},
      oauth2: {
        initTokenClient: (c) => ({
          requestAccessToken: () => setTimeout(() => c.prompt === 'consent'
            ? c.error_callback?.({ type: 'popup_closed', message: 'Popup window closed' })
            : c.callback({ access_token: 'demo-access-token', expires_in: 3599, scope: c.scope.split(' ')[0] }), 400),
        }),
      },
    }),
  },
  // The service is providedIn root, where it would use the real loader: give this demo its own
  // instance, which picks up the stand-in above.
  UiGoogleAuthorization],
  template: `
    <div style="display: flex; flex-wrap: wrap; gap: var(--ui-space-3)">
      <ui-button [loading]="busy()" (click)="ask('')">Add birthday and phone</ui-button>
      <ui-button variant="outline" [disabled]="busy()" (click)="ask('consent')">Ask, then close the popup</ui-button>
    </div>
    <ui-text variant="caption" aria-live="polite">{{ result() }}</ui-text>
  `,
  host: { style: 'display: grid; gap: var(--ui-space-3)' },
})
export class DemoGoogleAuthorization {
  private readonly auth = inject(UiGoogleAuthorization);
  protected readonly busy = signal(false);
  protected readonly result = signal('No request yet.');
  constructor() { void this.auth.preload(); }
  protected async ask(prompt: '' | 'consent'): Promise<void> {
    this.busy.set(true);
    try {
      const t = await this.auth.requestAccessToken({
        clientId: 'demo-placeholder.apps.googleusercontent.com',
        scopes: ['https://www.googleapis.com/auth/user.birthday.read', 'https://www.googleapis.com/auth/user.phonenumbers.read'],
        prompt,
      });
      this.result.set(`Granted ${t.grantedScopes.map((s) => s.split('/').pop()).join(', ')} for ${t.expiresIn}s (phone was not granted).`);
    } catch (e) {
      this.result.set(e instanceof UiGoogleAuthorizationError ? `Failed: ${e.kind} (${e.message})` : 'Failed');
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  selector: 'page-buttons',
  imports: [HugeiconsIconComponent, ReactiveFormsModule, UiSwitch,
    UiText, UiHoldButton, UiGoogleButton, DemoGoogleSignIn, DemoGoogleSignInBlocked, DemoGoogleAuthorization, UiButton, UiIconButton, UiButtonGroup, UiToggleButton, UiSplitButton, UiDropdownButton, UiSegmented, UiFab, UiFabHold,
    DocPage, DocSection, DocDemo,
  ],
  template: `
    <doc-page eyebrow="Components" title="Buttons & actions"
      lead="Action primitives. All wire radius from UiConfig and use only design tokens, so they re-skin with the active theme.">

      <doc-section name="Button" selector="ui-button" [api]="buttonApi"
        shapes="// exported from @zouriel/ui/button; the variant input of every button here takes it
type UiButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive' | 'brand' | 'accent';"
        summary="Eight variants, four sizes (xl is 56px, for the one big action on a phone screen), loading and block states. Brand is a pill with the theme's --ui-gradient-brand fill; keep it for the one action per view that should stand out. Accent fills with the theme's --ui-color-accent (the coral call to action in maldives; secondary in themes without an accent of their own). Loading shows a spinner, sets aria-busy and disables the button. Glass is opt-in (buttons are solid by default). The link variant is sized to its text but never smaller than 24x24. On coarse pointers the hit area grows to 44px tall. Projects its label as content.">
        <doc-demo code="<ui-button variant=&quot;primary&quot;>Primary</ui-button>
<ui-button variant=&quot;outline&quot; size=&quot;sm&quot;>Outline</ui-button>
<ui-button variant=&quot;destructive&quot;>Delete</ui-button>
<ui-button variant=&quot;brand&quot;>Get started</ui-button>
<ui-button variant=&quot;accent&quot;>Get guidance</ui-button>
<ui-button type=&quot;submit&quot; [loading]=&quot;true&quot;>Saving</ui-button>
<ui-button [block]=&quot;true&quot;>Full width</ui-button>
<ui-button size=&quot;xl&quot;>Start visit</ui-button>">
          <div class="row items-center">
            <ui-button variant="primary">Primary</ui-button>
            <ui-button variant="secondary">Secondary</ui-button>
            <ui-button variant="outline">Outline</ui-button>
            <ui-button variant="destructive">Delete</ui-button>
            <ui-button variant="brand">Get started</ui-button>
            <ui-button variant="accent">Get guidance</ui-button>
          </div>
          <!-- The borderless variants get their own row: wrapped to the start of a line they read as stray text. -->
          <div class="row items-center">
            <ui-button variant="ghost">Ghost</ui-button>
            <ui-button variant="link">Link</ui-button>
          </div>
          <div class="row items-center">
            <ui-button size="sm">Small</ui-button>
            <ui-button size="md">Medium</ui-button>
            <ui-button size="lg">Large</ui-button>
            <ui-button [loading]="true">Saving</ui-button>
            <ui-button [disabled]="true">Disabled</ui-button>
          </div>
          <ui-button variant="outline" [block]="true">Full width</ui-button>
          <div class="row items-center">
            <ui-button size="sm">Small</ui-button><ui-button>Medium</ui-button><ui-button size="lg">Large</ui-button><ui-button size="xl">Start visit</ui-button>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Hold button" anchor="hold-button" selector="ui-hold-button" [api]="holdApi" [outputs]="holdOut"
        summary="Press and hold to confirm, for an action that shouldn't happen on a stray tap (start a visit, mark as arrived). A fill grows across the button while it is held; letting go early cancels it. Space or Enter held does the same from the keyboard. Holding isn't accessible to everyone, so a tap (shorter than 300ms), a quick Enter or a screen reader's activation opens a confirm dialog instead, which confirms the same way. The button is described by holdHint. From @zouriel/ui/hold-button.">
        <doc-demo lang="ts + html" code="import { UiHoldButton } from '@zouriel/ui/hold-button';

<ui-hold-button size=&quot;xl&quot; [block]=&quot;true&quot; [hold]=&quot;2000&quot; (confirmed)=&quot;arrive()&quot;>I've arrived</ui-hold-button>">
          <div style="display: grid; gap: var(--ui-space-3); max-width: 360px">
            <ui-hold-button size="xl" [block]="true" (confirmed)="held.set(held() + 1)">I've arrived</ui-hold-button>
            <ui-hold-button variant="destructive" [hold]="1500" [destructive]="true" confirmTitle="Cancel the visit?" (confirmed)="held.set(held() + 1)">Hold to cancel the visit</ui-hold-button>
            <ui-text variant="caption">Confirmed {{ held() }} times</ui-text>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Google button" anchor="google-button" selector="ui-google-button" [api]="googleButtonApi" [outputs]="googleButtonOut"
        shapes="// from @zouriel/ui/google-sign-in
type UiGoogleButtonText = 'signIn' | 'signUp' | 'continueWith' | 'signInShort';
type UiGoogleButtonTheme = 'auto' | 'light' | 'dark' | 'neutral';
type UiGoogleButtonShape = 'rectangular' | 'pill';"
        summary="Google's sign-in button drawn to its branding guidelines: the official multicolour G, Google's light (white, grey stroke), dark and neutral (light grey, no stroke) colours, 40px high, Google Sans Medium 14/20 (Roboto, then the library font, when Google Sans isn't installed; the library ships neither), rectangular or pill. auto is dark on a dark theme and light otherwise, and follows theme changes. It is a plain button that emits (pressed), for apps running their own OAuth flow; to get an ID token in the browser use ui-google-sign-in below. loading swaps the G for a spinner at the same width. The words come from the library strings (googleSignIn, googleSignUp, googleContinue, googleSignInShort); Google allows only its approved wordings, translated. The Flutter twin is UiGoogleSignInButton, paired with the google_sign_in package. From @zouriel/ui/google-sign-in.">
        <doc-demo lang="ts + html" code="import { UiGoogleButton } from '@zouriel/ui/google-sign-in';

<ui-google-button [loading]=&quot;busy()&quot; (pressed)=&quot;startOAuth()&quot; />
<ui-google-button theme=&quot;dark&quot; shape=&quot;pill&quot; text=&quot;continueWith&quot; />
<ui-google-button theme=&quot;neutral&quot; text=&quot;signUp&quot; [expand]=&quot;true&quot; />">
          <div style="display: grid; gap: var(--ui-space-3); max-width: 400px">
            <div class="row items-center">
              <ui-google-button [loading]="googleBusy()" (pressed)="fakeGoogle()" />
              <ui-google-button theme="light" shape="pill" text="continueWith" />
            </div>
            <div class="row items-center">
              <ui-google-button theme="dark" text="signUp" />
              <ui-google-button theme="neutral" shape="pill" text="signInShort" />
              <ui-google-button [disabled]="true" />
            </div>
            <ui-google-button [expand]="true" text="continueWith" />
            <ui-text variant="caption">Pressed {{ googlePresses() }} times</ui-text>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Google sign-in" anchor="google-sign-in" selector="ui-google-sign-in" [api]="gsiApi" [outputs]="gsiOut"
        summary="Google's own Sign in with Google button (Google Identity Services), the only way to get a Google ID token in the browser without a client secret. It loads https://accounts.google.com/gsi/client once (a skeleton holds the space meanwhile), initializes with your web client ID, ux_mode popup and FedCM, and renders the button; (credential) gives the ID token for your API to verify. theme auto is filled_black on a dark theme and outline otherwise, and re-renders when the theme changes; GIS has no neutral theme, so neutral renders as outline. If the script is blocked it shows a disabled drawn button and emits (failed). One per page: GIS's initialize is page-wide. The showcase has no client ID, so the demos below use a stand-in loader (UI_GOOGLE_IDENTITY) that draws a placeholder; tests do the same. Flutter apps get the token from google_sign_in (authenticate(), serverClientId = this web client ID) behind UiGoogleSignInButton.">
        <doc-demo lang="ts + html" code="import { UiGoogleSignIn } from '@zouriel/ui/google-sign-in';

<ui-google-sign-in
  clientId=&quot;1234-abc.apps.googleusercontent.com&quot;
  text=&quot;continue_with&quot;
  [nonce]=&quot;nonce&quot;
  (credential)=&quot;signIn($event)&quot;
  (failed)=&quot;showError($event.message)&quot; />">
          <div style="display: grid; gap: var(--ui-space-3); max-width: 400px">
            <demo-google-sign-in (credential)="gsiToken.set($event)" />
            <ui-text variant="caption">credential: {{ gsiToken() ?? 'none yet (click the placeholder)' }}</ui-text>
            <demo-google-sign-in-blocked (failed)="gsiError.set($event)" />
            <ui-text variant="caption">When the script is blocked: {{ gsiError() ?? '…' }}</ui-text>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Google authorization" anchor="google-authorization" selector="UiGoogleAuthorization" [api]="gauthApi"
        shapes="// from @zouriel/ui/google-sign-in
interface UiGoogleAccessRequest { clientId: string; scopes: string[]; hint?: string; prompt?: '' | 'consent' }
interface UiGoogleAccessToken { accessToken: string; grantedScopes: string[]; expiresIn: number }
type UiGoogleAuthorizationErrorKind = 'cancelled' | 'popup_blocked' | 'unavailable' | 'failed';
class UiGoogleAuthorizationError extends Error { kind: UiGoogleAuthorizationErrorKind; googleError?: string }"
        summary="Sign-in only gives an ID token with name, email and picture. To ask the signed-in user for more Google data (birthday, phone number, contacts), UiGoogleAuthorization (providedIn root) opens Google's consent popup through Google Identity Services' token client (google.accounts.oauth2.initTokenClient) and resolves with an access token, its lifetime and the scopes the user actually granted, since they can untick some. It loads GIS through the same UI_GOOGLE_IDENTITY loader as ui-google-sign-in. A closed popup or declined consent rejects with kind 'cancelled', a blocked popup with 'popup_blocked', a script that can't load with 'unavailable'. Browsers allow the popup only from a click: call preload() early and requestAccessToken() in the click handler. The demo uses a stand-in token client. Flutter has no library equivalent: apps use google_sign_in's authorizationClient.">
        <doc-demo lang="ts" code="import { UiGoogleAuthorization, UiGoogleAuthorizationError } from '@zouriel/ui/google-sign-in';

private auth = inject(UiGoogleAuthorization);
ngOnInit() { this.auth.preload(); }

async addBirthday() {   // from a (click)
  try {
    const t = await this.auth.requestAccessToken({
      clientId: '1234-abc.apps.googleusercontent.com',
      scopes: ['https://www.googleapis.com/auth/user.birthday.read'],
      hint: this.user.email,
    });
    if (t.grantedScopes.includes('https://www.googleapis.com/auth/user.birthday.read')) {
      await this.api.importBirthday(t.accessToken);
    }
  } catch (e) {
    if (e instanceof UiGoogleAuthorizationError && e.kind === 'cancelled') return;
    this.toast.error('Google could not be reached');
  }
}">
          <demo-google-authorization />
        </doc-demo>
      </doc-section>

      <doc-section name="Icon button" selector="ui-icon-button" [api]="iconApi"
        summary="Square, icon-only action. label is required and becomes the aria-label, so the control has a name for assistive tech. badge (0.44.0, on ui-button too) puts a small count bubble at the top-end corner, the bottom nav's badge look, danger or primary (badgeTone); it is hidden from screen readers and added to the name instead (badgeLabel, else its text: Chat, 2 unread). uiBadgeCount(n) gives the text: none at 0, 9+ above 9. Takes every button variant (link draws like ghost). Project an icon as content; projected SVGs are sized to the button (14, 16 or 18px). On coarse pointers an invisible hit area brings it up to 44px.">
        <doc-demo code="<!-- import Settings02Icon from '@hugeicons/core-free-icons/Settings02Icon' and expose it on the component -->
<ui-icon-button label=&quot;Settings&quot; variant=&quot;outline&quot;><hugeicons-icon [icon]=&quot;Settings02Icon&quot; /></ui-icon-button>
<ui-icon-button label=&quot;Add&quot; variant=&quot;primary&quot; [round]=&quot;true&quot;><hugeicons-icon [icon]=&quot;Add01Icon&quot; /></ui-icon-button>">
          <div class="row items-center">
            <ui-icon-button label="Settings" variant="outline"><hugeicons-icon aria-hidden="true" [icon]="icons.settings" [strokeWidth]="1.8" /></ui-icon-button>
            <ui-icon-button label="Add" variant="primary" [round]="true"><hugeicons-icon aria-hidden="true" [icon]="icons.add" [strokeWidth]="1.8" /></ui-icon-button>
            <ui-icon-button label="Delete" variant="ghost"><hugeicons-icon aria-hidden="true" [icon]="icons.remove" [strokeWidth]="1.8" /></ui-icon-button>
          </div>
        </doc-demo>
        <doc-demo code="<!-- 0.44.0: a count badge, read with the name: &quot;Chat, 2 unread&quot;. -->
<ui-icon-button label=&quot;Chat&quot; [badge]=&quot;uiBadgeCount(unread())&quot; [badgeLabel]=&quot;unread() + ' unread'&quot;>…</ui-icon-button>
<ui-button variant=&quot;outline&quot; [badge]=&quot;uiBadgeCount(unread())&quot; [badgeLabel]=&quot;unread() + ' unread'&quot;>Chat</ui-button>">
          <div class="row items-center badge-row">
            <ui-icon-button label="Chat" variant="outline" [badge]="badgeText()" [badgeLabel]="unread() + ' unread'"><hugeicons-icon aria-hidden="true" [icon]="icons.chat" [strokeWidth]="1.8" /></ui-icon-button>
            <ui-icon-button label="Alerts" variant="ghost" [badge]="badgeText()" badgeTone="primary" [badgeLabel]="unread() + ' new'"><hugeicons-icon aria-hidden="true" [icon]="icons.settings" [strokeWidth]="1.8" /></ui-icon-button>
            <ui-button variant="outline" [badge]="badgeText()" [badgeLabel]="unread() + ' unread'">Chat</ui-button>
            <ui-button size="sm" variant="ghost" (click)="unread.set(unread() + 1)">Add a message</ui-button>
            <ui-button size="sm" variant="ghost" (click)="unread.set(0)">Read all</ui-button>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Button group" selector="ui-button-group" [api]="groupApi"
        summary="Joins a row of ui-button elements: inner corners go square and borders overlap. It is role=group with label as its aria-label; it does not manage selection (use Segmented for one-of-many). Project the buttons as content.">
        <doc-demo code="<ui-button-group label=&quot;Range&quot;>
  <ui-button variant=&quot;outline&quot; size=&quot;sm&quot;>Day</ui-button>
  <ui-button variant=&quot;outline&quot; size=&quot;sm&quot;>Week</ui-button>
  <ui-button variant=&quot;outline&quot; size=&quot;sm&quot;>Month</ui-button>
</ui-button-group>">
          <ui-button-group label="Range">
            <ui-button variant="outline" size="sm">Day</ui-button>
            <ui-button variant="outline" size="sm">Week</ui-button>
            <ui-button variant="outline" size="sm">Month</ui-button>
          </ui-button-group>
        </doc-demo>
      </doc-section>

      <doc-section name="Segmented" selector="ui-segmented" [api]="segmentedApi"
        shapes="interface UiSegmentedOption {
  value: string;
  label: string;
  glyph?: string;      // short visible content; label stays the accessible name
  disabled?: boolean;
}"
        summary="Pick one of a few options, joined into one control. A radiogroup: arrow keys move the choice (skipping disabled options), only the chosen option is in the tab order, Tab leaves the group. Bind [(value)], or ngModel / formControl, which can also disable it. An option can show short glyph text instead of its label (the label stays the accessible name). Use it for modes and view switches; use toggle buttons when several can be on.">
        <doc-demo code="<ui-segmented label=&quot;Preview with&quot; [options]=&quot;[{ value: 'filled', label: 'Filled' }, { value: 'empty', label: 'Empty' }]&quot; [(value)]=&quot;mode&quot; />">
          <div class="row items-center">
            <ui-segmented label="Preview with" [options]="segOptions" [(value)]="segValue" />
            <ui-segmented size="sm" label="Mode" [options]="segModes" [(value)]="segMode" />
          </div>
          <div class="row"><span class="muted">value: {{ segValue() }} · {{ segMode() }}</span></div>
        </doc-demo>
        <doc-demo code="<ui-segmented label=&quot;Align&quot; [options]=&quot;aligns&quot; [formControl]=&quot;align&quot; />
<!-- align.disable() / align.enable() disables every option -->">
          <div class="row items-center">
            <ui-segmented label="Align" [options]="segAlign" [formControl]="align" />
            <ui-switch [formControl]="alignLocked">Disabled</ui-switch>
            <span class="muted">formControl: {{ alignValue() }}</span>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Toggle button" selector="ui-toggle-button" [api]="toggleApi"
        summary="Two-state button with aria-pressed. pressed is a two-way model, so bind [(pressed)]. It is not a form control (no ngModel). On coarse pointers the hit area grows to 44px tall. Projects its label as content.">
        <doc-demo code="<ui-toggle-button [(pressed)]=&quot;bold&quot;>Bold</ui-toggle-button>">
          <div class="row items-center">
            <ui-toggle-button [(pressed)]="bold"><hugeicons-icon aria-hidden="true" [icon]="icons.bold" [size]="16" [strokeWidth]="1.8" />Bold</ui-toggle-button>
            <span class="muted">pressed: {{ bold() }}</span>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Split button" selector="ui-split-button" [api]="splitApi" [outputs]="splitOut"
        summary="Primary action plus a caret button. (action) fires for the main click; (menu) fires for the caret (aria-label &quot;More actions&quot;, aria-haspopup=menu) so you can open your own menu. It draws no menu itself; for a built-in menu use the dropdown button. Projects the main label as content.">
        <doc-demo code="<ui-split-button (action)=&quot;save()&quot; (menu)=&quot;openMenu()&quot;>Save</ui-split-button>">
          <div class="row items-center">
            <ui-split-button (action)="msg.set('action')" (menu)="msg.set('menu')">Save</ui-split-button>
            <ui-split-button variant="outline" (action)="msg.set('action (outline)')" (menu)="msg.set('menu (outline)')">Export</ui-split-button>
          </div>
          <ui-text variant="caption">last: {{ msg() }}</ui-text>
        </doc-demo>
      </doc-section>

      <doc-section name="Dropdown button" selector="ui-dropdown-button" [api]="ddApi" [outputs]="ddOut"
        summary="A button that opens a menu of actions (CDK Overlay). Pass items; listen to (select). Opening moves focus to the first enabled item; ArrowUp/Down (wrapping), Home and End move between items, Enter chooses, Escape closes and returns focus to the trigger, Tab or a click outside closes. The menu flips to stay on screen. Projects the trigger label as content. Import it from @zouriel/ui/dropdown-button (since 0.33.1; it was in @zouriel/ui/button, which then put the CDK overlay in every app's first download)."
        shapes="interface UiDropdownItem {
  label: string;
  value: string;
  disabled?: boolean;
  danger?: boolean;   // renders the item in the danger color
}">
        <doc-demo code="<ui-dropdown-button [items]=&quot;items&quot; (select)=&quot;run($event)&quot;>Actions</ui-dropdown-button>">
          <div class="row items-center">
            <ui-dropdown-button variant="primary" [items]="ddItems" (select)="msg.set($event.label)">Actions</ui-dropdown-button>
            <span class="muted">last: {{ msg() }}</span>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="FAB" selector="ui-fab" [api]="fabApi"
        summary="Floating action button pinned to a screen corner or centred at the top or bottom (position: fixed), offset from the edge by 24px plus the device safe area, so a top one sits below the status bar and notch, never over them. position takes top-start, top-center, top-end, bottom-start, bottom-center or bottom-end (0.44.0; start and end follow the reading direction), and the older physical corners. label is required (aria-label). Project an icon as content; text adds a visible word beside it and makes it a pill (keep the word in label too). tone danger (0.44.0) is the high-visibility style for an SOS button: the danger colour with a ring in the raised surface colour and a soft danger halo outside it, so it stands off any page or map. aboveOverlays keeps it above bottom sheets, drawers and modal backdrops (the overlay layer plus one), below floating windows and toasts. topOffset adds px below the top edge for a top fab, so it sits under the app's own top bar. hold (0.44.0, with UiFabHold from @zouriel/ui/hold-button) makes it press-and-hold like ui-hold-button: a fill in the contrast colour grows across it while held, letting go early cancels, Space or Enter held works the same, and a tap, a quick key press or a screen reader's activation opens the confirm dialog (confirmTitle, confirmMessage, confirmLabel, destructive); it emits confirmed. The sm size grows to 44px on coarse pointers. The demo frames below are their own containing blocks, so the buttons sit in the frame rather than the window.">
        <doc-demo code="<ui-fab label=&quot;New item&quot; position=&quot;bottom-right&quot; (click)=&quot;create()&quot;>
  <hugeicons-icon [icon]=&quot;Add01Icon&quot; />
</ui-fab>">
          <div class="fab-frame">
            <span class="muted">clicks: {{ fabClicks() }}</span>
            <ui-fab label="New item" (click)="fabClicks.set(fabClicks() + 1)"><hugeicons-icon aria-hidden="true" [icon]="icons.add" [size]="22" [strokeWidth]="1.8" /></ui-fab>
            <ui-fab label="New item (small)" size="sm" position="top-right"><hugeicons-icon aria-hidden="true" [icon]="icons.add" [size]="18" [strokeWidth]="1.8" /></ui-fab>
          </div>
        </doc-demo>
        <doc-demo lang="html" code="<!-- An SOS button floating at the top of the screen, over sheets and drawers. -->
<!-- import { UiFabHold } from '@zouriel/ui/hold-button' for [hold]. -->
<ui-fab label=&quot;SOS, call for help&quot; position=&quot;top-center&quot; [topOffset]=&quot;56&quot; tone=&quot;danger&quot; text=&quot;SOS&quot; aboveOverlays
  [hold]=&quot;2000&quot; confirmTitle=&quot;Send an SOS?&quot; confirmLabel=&quot;Send SOS&quot; [destructive]=&quot;true&quot; (confirmed)=&quot;sos()&quot;>
  <hugeicons-icon [icon]=&quot;Alert02Icon&quot; aria-hidden=&quot;true&quot; />
</ui-fab>">
          <div class="fab-frame fab-phone">
            <span class="muted">Hold SOS for 2 s (or tap it to confirm): {{ sosClicks() }}</span>
            <ui-fab label="SOS, call for help" [position]="sosPlace()" tone="danger" text="SOS" aboveOverlays [hold]="2000"
              confirmTitle="Send an SOS?" confirmMessage="Your clinic and emergency contact are told where you are." confirmLabel="Send SOS" [destructive]="true"
              (confirmed)="sosClicks.set(sosClicks() + 1)">
              <hugeicons-icon aria-hidden="true" [icon]="icons.sos" [size]="20" [strokeWidth]="2" />
            </ui-fab>
            <ui-fab label="New message" position="bottom-end" size="sm"><hugeicons-icon aria-hidden="true" [icon]="icons.add" [size]="18" [strokeWidth]="1.8" /></ui-fab>
          </div>
          <div class="row fab-acts">
            <ui-segmented label="SOS position (demo)" size="sm" [options]="sosOptions" [value]="sosPlace()" (valueChange)="sosPlace.set($any($event))" />
          </div>
        </doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .row { display: flex; flex-wrap: wrap; gap: var(--ui-space-3); }
    .items-center { align-items: center; }
    .muted { color: var(--ui-color-text-muted); font: var(--ui-font-size-sm) var(--ui-font-mono); }
    /* transform makes this box the containing block for the fixed-position FABs inside it. */
    .fab-frame { position: relative; transform: translateZ(0); height: 160px; padding: var(--ui-space-3); overflow: hidden;
      border: 1px dashed var(--ui-color-border); border-radius: var(--ui-radius); }
    .fab-phone { height: 240px; max-width: 390px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; }
    .fab-acts { margin-top: var(--ui-space-3); }
    /* Room above the badges so they don't touch the demo's top edge. */
    .badge-row { padding-top: var(--ui-space-2); }
  `,
})
export class ButtonsPage {
  protected readonly icons = { settings: Settings02Icon, add: Add01Icon, remove: Delete02Icon, bold: TextBoldIcon, sos: Alert02Icon, chat: BubbleChatIcon };
  protected readonly unread = signal(2);
  protected readonly badgeText = computed(() => uiBadgeCount(this.unread()));
  protected readonly fabClicks = signal(0);
  protected readonly sosClicks = signal(0);
  protected readonly sosPlace = signal<UiFabPlacement>('top-center');
  protected readonly sosOptions = [{ value: 'top-start', label: 'Start' }, { value: 'top-center', label: 'Centre' }, { value: 'top-end', label: 'End' }, { value: 'bottom-center', label: 'Bottom' }];
  protected readonly bold = signal(false);
  protected readonly msg = signal('—');
  protected readonly ddItems: UiDropdownItem[] = [
    { label: 'Rename', value: 'rename' }, { label: 'Duplicate', value: 'dup' }, { label: 'Delete', value: 'del', danger: true },
  ];

  protected readonly held = signal(0);
  protected readonly googleBusy = signal(false);
  protected readonly googlePresses = signal(0);
  protected readonly gsiToken = signal<string | null>(null);
  protected readonly gsiError = signal<string | null>(null);
  protected fakeGoogle(): void {
    this.googleBusy.set(true);
    setTimeout(() => {
      this.googleBusy.set(false);
      this.googlePresses.update((n) => n + 1);
    }, 1000);
  }
  protected readonly googleButtonApi: ApiRow[] = [
    { name: 'text', type: 'UiGoogleButtonText', default: "'signIn'", desc: "'signIn' (Sign in with Google), 'signUp', 'continueWith', 'signInShort' (Sign in)." },
    { name: 'theme', type: 'UiGoogleButtonTheme', default: "'auto'", desc: "Google's 'light', 'dark' or 'neutral'; 'auto' is dark on a dark library theme." },
    { name: 'shape', type: 'UiGoogleButtonShape', default: "'rectangular'", desc: "'rectangular' (4px corners) or 'pill'." },
    { name: 'loading', type: 'boolean', default: 'false', desc: 'Spinner in place of the G, same width, aria-busy, not clickable.' },
    { name: 'disabled', type: 'boolean', default: 'false', desc: 'Disable the button.' },
    { name: 'expand', type: 'boolean', default: 'false', desc: 'Full width; the G stays at the start, the words centre.' },
    { name: 'ariaLabel', type: 'string', default: 'the words', desc: 'Accessible name on the native button.' },
  ];
  protected readonly googleButtonOut: ApiRow[] = [{ name: 'pressed', type: 'void', default: '—', desc: 'Clicked (or Enter/Space).' }];
  protected readonly gsiApi: ApiRow[] = [
    { name: 'clientId', type: 'string (required)', default: '—', desc: 'Your OAuth web client ID.' },
    { name: 'text', type: "'signin_with' | 'signup_with' | 'continue_with' | 'signin'", default: "'signin_with'", desc: "GIS's wording." },
    { name: 'theme', type: 'UiGoogleButtonTheme', default: "'auto'", desc: "light and neutral → 'outline', dark → 'filled_black'; auto follows the library theme and re-renders." },
    { name: 'shape', type: 'UiGoogleButtonShape', default: "'rectangular'", desc: "'rectangular' or 'pill'." },
    { name: 'width', type: 'number (px)', default: 'the host width', desc: "Kept within GIS's 200–400px." },
    { name: 'locale', type: 'string', default: "the browser's", desc: "The button's language (GIS locale)." },
    { name: 'nonce', type: 'string', default: '—', desc: 'Bound into the ID token, for your server to check.' },
  ];
  protected readonly gsiOut: ApiRow[] = [
    { name: 'credential', type: 'string', default: '—', desc: 'The Google ID token (JWT) after sign-in.' },
    { name: 'failed', type: '{ message: string }', default: '—', desc: 'The script could not load, or GIS failed to set up.' },
  ];
  protected readonly gauthApi: ApiRow[] = [
    { name: 'requestAccessToken(req)', type: 'Promise<UiGoogleAccessToken>', default: '—', desc: 'Opens the consent popup for req.scopes (joined with spaces, include_granted_scopes on). Rejects with a UiGoogleAuthorizationError.' },
    { name: 'req.hint', type: 'string', default: '—', desc: "The signed-in user's email or sub, so Google skips the account chooser." },
    { name: 'req.prompt', type: "'' | 'consent'", default: "Google's ('')", desc: "'consent' always shows the consent screen." },
    { name: 'preload()', type: 'Promise<void>', default: '—', desc: 'Loads GIS ahead of the click, so the popup opens inside the user gesture.' },
  ];
  protected readonly holdApi: ApiRow[] = [
    { name: 'hold', type: 'number (ms)', default: '2000', desc: 'How long to hold.' },
    { name: 'variant / size / block / disabled', type: 'as ui-button', default: "'primary' / 'md' / false / false", desc: 'Look of the button; size takes xl.' },
    { name: 'ariaLabel', type: 'string', default: '—', desc: 'Accessible name when the text does not say enough.' },
    { name: 'holdHint', type: 'string', default: "strings.holdHint ('Press and hold to confirm')", desc: 'Read with the button (aria-describedby).' },
    { name: 'confirmTitle / confirmMessage / confirmLabel', type: 'string', default: "strings.confirmTitle / '' / strings.confirm", desc: 'The tap fallback dialog.' },
    { name: 'destructive', type: 'boolean', default: 'false', desc: 'The dialog\'s confirm button is destructive.' },
  ];
  protected readonly holdOut: ApiRow[] = [{ name: 'confirmed', type: 'void', default: '—', desc: 'Held to the end, or confirmed in the dialog.' }];
  protected readonly buttonApi: ApiRow[] = [
    { name: 'ariaLabel', type: 'string', default: '—', desc: 'Accessible name for the inner native control when its text does not say enough (a plain aria-label="…" works too). Never put it on the wrapper.' },
    { name: 'variant', type: VARIANT, default: "'primary'", desc: 'Visual style.' },
    { name: 'size', type: BUTTON_SIZE, default: "'md'", desc: 'Control height & font size; xl is 56px.' },
    { name: 'type', type: "'button' | 'submit' | 'reset'", default: "'button'", desc: 'Native button type.' },
    { name: 'disabled', type: 'boolean', default: 'false', desc: 'Disable interaction.' },
    { name: 'loading', type: 'boolean', default: 'false', desc: 'Show spinner & disable.' },
    { name: 'block', type: 'boolean', default: 'false', desc: 'Stretch to full width.' },
    { name: 'glass', type: 'boolean', default: 'false', desc: 'Opt-in translucent glass.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners (brand stays a pill unless this is false).' },
    { name: '(content)', type: 'slot', default: '—', desc: SLOT },
  ];
  protected readonly iconApi: ApiRow[] = [
    { name: 'label', type: 'string (required)', default: '—', desc: 'Accessible name (aria-label).' },
    { name: 'badge', type: 'string | null', default: 'null', desc: 'A count bubble at the top-end corner (0.44.0, also on ui-button); hidden from screen readers, added to the name. uiBadgeCount(n) gives "2", "9+" or null.' },
    { name: 'badgeTone', type: "'danger' | 'primary'", default: "'danger'", desc: 'The bubble\'s colour.' },
    { name: 'badgeLabel', type: 'string | null', default: 'null', desc: 'What screen readers hear for it ("2 unread"); null: the badge text. The name becomes "Chat, 2 unread".' },
    { name: 'variant', type: VARIANT, default: "'ghost'", desc: 'Visual style.' },
    { name: 'size', type: BUTTON_SIZE, default: "'md'", desc: 'Square dimension; xl is 56px.' },
    { name: 'type', type: "'button' | 'submit' | 'reset'", default: "'button'", desc: 'Native button type.' },
    { name: 'disabled', type: 'boolean', default: 'false', desc: 'Disable interaction.' },
    { name: 'round', type: 'boolean', default: 'false', desc: 'Fully circular (pill).' },
    { name: 'glass', type: 'boolean', default: 'false', desc: 'Opt-in glass.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners (ignored when round).' },
    { name: '(content)', type: 'slot', default: '—', desc: 'The icon. Give it aria-hidden; label names the button.' },
  ];
  protected readonly segAlign: UiSegmentedOption[] = [
    { value: 'left', label: 'Left' }, { value: 'center', label: 'Centre' }, { value: 'right', label: 'Right' }, { value: 'justify', label: 'Justify', disabled: true },
  ];
  protected readonly align = new FormControl<string | null>('center');
  protected readonly alignValue = signal<string | null>('center');
  protected readonly alignLocked = new FormControl(false, { nonNullable: true });
  constructor() {
    this.align.valueChanges.subscribe((v) => this.alignValue.set(v));
    this.alignLocked.valueChanges.subscribe((off) => (off ? this.align.disable() : this.align.enable()));
  }
  protected readonly segOptions = [{ value: 'filled', label: 'Filled' }, { value: 'empty', label: 'Empty fields' }, { value: 'roles', label: 'Two roles' }];
  protected readonly segModes = [{ value: 'edit', label: 'Edit' }, { value: 'interact', label: 'Interact' }];
  protected readonly segValue = signal<string | null>('filled');
  protected readonly segMode = signal<string | null>('edit');
  protected readonly segmentedApi: ApiRow[] = [
    { name: 'options', type: 'readonly UiSegmentedOption[]', default: '[]', desc: 'The choices, in order (see Data shapes).' },
    { name: 'value', type: 'string | null (model)', default: 'null', desc: 'Two-way (`[(value)]`). The chosen option. Also a form control: ngModel, formControl, formControlName (which also disable it).' },
    { name: 'label', type: 'string', default: "'Options'", desc: 'aria-label for the radiogroup.' },
    { name: 'size', type: SIZE, default: "'md'", desc: 'Control height. Options are never under 24px tall, so sm is 28px overall.' },
  ];
  protected readonly groupApi: ApiRow[] = [
    { name: 'label', type: 'string', default: '—', desc: 'aria-label for the group.' },
    { name: '(content)', type: 'slot', default: '—', desc: 'The ui-button elements to join.' },
  ];
  protected readonly toggleApi: ApiRow[] = [
    { name: 'ariaLabel', type: 'string', default: '—', desc: 'Accessible name for the inner native control when its text does not say enough (a plain aria-label="…" works too). Never put it on the wrapper.' },
    { name: 'pressed', type: 'boolean (model)', default: 'false', desc: 'Two-way (`[(pressed)]`). Whether it is on; mirrored to aria-pressed.' },
    { name: 'size', type: SIZE, default: "'md'", desc: 'Control height.' },
    { name: 'disabled', type: 'boolean', default: 'false', desc: 'Disable interaction.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
    { name: '(content)', type: 'slot', default: '—', desc: SLOT },
  ];
  protected readonly splitApi: ApiRow[] = [
    { name: 'ariaLabel', type: 'string', default: '—', desc: 'Accessible name for the main button when its text does not say enough (a plain aria-label="…" works too). Never put it on the wrapper.' },
    { name: 'menuLabel', type: 'string', default: "strings.moreActions ('More actions')", desc: 'The menu (caret) button\'s accessible name.' },
    { name: 'variant', type: VARIANT, default: "'primary'", desc: 'Visual style. link, brand and accent have no style of their own here and draw as a plain surface button.' },
    { name: 'size', type: SIZE, default: "'md'", desc: 'Control height.' },
    { name: 'disabled', type: 'boolean', default: 'false', desc: 'Disable both buttons.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
    { name: '(content)', type: 'slot', default: '—', desc: 'The main button label.' },
  ];
  protected readonly splitOut: ApiRow[] = [
    { name: 'action', type: 'void', default: '—', desc: 'Main button clicked.' },
    { name: 'menu', type: 'void', default: '—', desc: 'Caret clicked (open a dropdown).' },
  ];
  protected readonly ddApi: ApiRow[] = [
    { name: 'items', type: 'UiDropdownItem[]', default: '[]', desc: 'Menu items (see Data shapes).' },
    { name: 'variant', type: VARIANT, default: "'secondary'", desc: 'Trigger style. link, brand and accent have no style of their own here and draw as a plain surface button.' },
    { name: 'size', type: SIZE, default: "'md'", desc: 'Trigger height.' },
    { name: 'disabled', type: 'boolean', default: 'false', desc: 'Disable the trigger.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
    { name: '(content)', type: 'slot', default: '—', desc: 'The trigger label (a caret is drawn after it).' },
  ];
  protected readonly ddOut: ApiRow[] = [
    { name: 'select', type: 'UiDropdownItem', default: '—', desc: 'Chosen item. Disabled items never emit.' },
  ];
  protected readonly fabApi: ApiRow[] = [
    { name: 'label', type: 'string (required)', default: '—', desc: 'Accessible name (aria-label).' },
    { name: 'position', type: "UiFabPlacement: 'top-start' | 'top-center' | 'top-end' | 'bottom-start' | 'bottom-center' | 'bottom-end' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'", default: "'bottom-right'", desc: 'Where it is fixed: start/end follow the reading direction (0.44.0), the others are physical corners. 24px from the edges plus the safe area.' },
    { name: 'tone', type: "'primary' | 'danger'", default: "'primary'", desc: 'danger (0.44.0): the high-visibility SOS style, danger fill with a ring and a halo.' },
    { name: 'text', type: 'string | null', default: 'null', desc: 'A visible word beside the icon, making it a pill (0.44.0). Keep it in label too.' },
    { name: 'topOffset', type: 'number', default: '0', desc: 'Px below the top edge for top placements, on top of the 24px gap and the safe area: an app bar\'s height (0.44.0).' },
    { name: 'hold', type: 'number | null', default: '—', desc: 'With UiFabHold (@zouriel/ui/hold-button): hold this many ms to activate; a tap opens the confirm dialog. null: a plain fab (0.44.0).' },
    { name: 'holdHint / confirmTitle / confirmMessage / confirmLabel / destructive', type: 'string / boolean', default: 'the strings', desc: 'As on ui-hold-button: the hint read with it and the tap fallback\'s dialog (with UiFabHold).' },
    { name: '(confirmed)', type: 'void', default: '—', desc: 'Held to the end, or confirmed in the dialog (with UiFabHold). Use it instead of (click).' },
    { name: 'aboveOverlays', type: 'boolean', default: 'false', desc: 'Above sheets, drawers and modal backdrops (--ui-z-overlay + 1), below windows and toasts (0.44.0).' },
    { name: 'size', type: "'sm' | 'md'", default: "'md'", desc: 'Diameter: 40px or 52px.' },
    { name: 'disabled', type: 'boolean', default: 'false', desc: 'Disable interaction.' },
    { name: '(content)', type: 'slot', default: '—', desc: 'The icon. Give it aria-hidden; label names the button.' },
  ];
}
