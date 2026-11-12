import { Component, inject, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import Add01Icon from '@hugeicons/core-free-icons/Add01Icon';
import Calendar03Icon from '@hugeicons/core-free-icons/Calendar03Icon';
import Home01Icon from '@hugeicons/core-free-icons/Home01Icon';
import InboxIcon from '@hugeicons/core-free-icons/InboxIcon';
import Settings02Icon from '@hugeicons/core-free-icons/Settings02Icon';
import SparklesIcon from '@hugeicons/core-free-icons/SparklesIcon';
import UserIcon from '@hugeicons/core-free-icons/UserIcon';
import ViewIcon from '@hugeicons/core-free-icons/ViewIcon';
import { UiButton } from '@zouriel/ui/button';
import { UiEmptyState, UiStarterCard } from '@zouriel/ui/feedback';
import {
  UiChecklist, UiGuidance, UiHintOnce, UiMemoryGuidanceStore, UiOfferCard, UiTourAnchor, UiTourService,
  UI_GUIDANCE, type UiChecklistItem, type UiTourOutcome, type UiTourSpec,
} from '@zouriel/ui/guidance';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

const TOUR: UiTourSpec = {
  id: 'tour.welcome',
  steps: [
    { anchor: 'demo.feed', text: 'Your events and the people in them show up here.' },
    { anchor: 'demo.inbox', text: 'Invitations sent to you land here.' },
    { anchor: 'demo.new', text: 'Start an event: pick a design, add guests, send.' },
    { anchor: 'demo.me', text: 'Events you host, your plan and settings.' },
  ],
};

const CHECKLIST: UiChecklistItem[] = [
  { id: 'name', label: 'Add your name and photo', done: true },
  { id: 'event', label: 'Start an event', done: false },
  { id: 'guests', label: 'Add your guests', done: false },
  { id: 'send', label: 'Send it or share the link', done: false },
  { id: 'photo', label: 'Get your first photo', description: 'Guests add theirs with the QR code', done: false },
];

@Component({
  selector: 'page-guidance',
  imports: [HugeiconsIconComponent, UiButton, UiEmptyState, UiStarterCard, UiChecklist, UiOfferCard, UiTourAnchor, UiHintOnce, DocPage, DocSection, DocDemo],
  // The page's own guidance controller, in memory: reload the page (or press Show tips again) to start over.
  providers: [{ provide: UI_GUIDANCE, useFactory: () => new UiGuidance(new UiMemoryGuidanceStore()) }],
  template: `
    <doc-page eyebrow="Components" title="Guidance"
      lead="Help that shows itself once: a coach-mark tour with a spotlight, a card that offers help, a getting-started checklist, empty pages with a picture and ways to start, and UiGuidance, which decides what may show and remembers what was seen. Coach marks use the primary colour as their fill, so they never pass for the app's own controls.">

      <doc-section name="Tour" selector="uiTourAnchor · UiTourService" [api]="tourApi" [shapes]="tourShapes"
        summary="Mark elements with uiTourAnchor and a shared id, then start a tour from code. The page dims, a rounded cut-out frames each anchor with a breathing ring, and a bubble beside it shows the text, '2 of 4', Back, Next (Done on the last), Skip and a small Turn off tips. It scrolls each anchor into view first and leaves out steps whose anchor isn't on the page. It is a modal dialog: focus moves to Next and stays in the bubble, Escape closes it, a screen reader hears 'Step 2 of 4: text', and focus goes back where it was. Under reduced motion the spotlight jumps instead of gliding. At most 5 steps. start() resolves with finished, skipped, turnedOff or closed.">
        <doc-demo code="<nav>
  <a uiTourAnchor=&quot;nav.feed&quot; routerLink=&quot;/feed&quot;>Feed</a>
  <a uiTourAnchor=&quot;nav.inbox&quot; routerLink=&quot;/inbox&quot;>Inbox</a>
</nav>

const outcome = await inject(UiTourService).start({
  id: 'tour.welcome',
  steps: [
    { anchor: 'nav.feed', text: 'Your events and the people in them show up here.' },
    { anchor: 'nav.inbox', text: 'Invitations sent to you land here.' },
  ],
}); // 'finished' | 'skipped' | 'turnedOff' | 'closed'">
          <div class="phone">
            <div class="phone-top">
              <span class="brand">invites</span>
              <ui-button size="sm" (click)="startTour()">Start the tour</ui-button>
            </div>
            <div class="phone-body">
              @if (tourOutcome()) { <p class="note">Last tour: {{ tourOutcome() }}</p> }
              <div class="post"></div>
              <div class="post short"></div>
            </div>
            <nav class="tabs" aria-label="Demo app">
              <button type="button" class="tab" uiTourAnchor="demo.feed"><hugeicons-icon [icon]="icons.home" [size]="20" [strokeWidth]="1.8" aria-hidden="true" /><span>Feed</span></button>
              <button type="button" class="tab" uiTourAnchor="demo.inbox"><hugeicons-icon [icon]="icons.inbox" [size]="20" [strokeWidth]="1.8" aria-hidden="true" /><span>Inbox</span></button>
              <button type="button" class="tab" uiTourAnchor="demo.new"><hugeicons-icon [icon]="icons.add" [size]="20" [strokeWidth]="1.8" aria-hidden="true" /><span>New</span></button>
              <button type="button" class="tab" uiTourAnchor="demo.me"><hugeicons-icon [icon]="icons.user" [size]="20" [strokeWidth]="1.8" aria-hidden="true" /><span>Me</span></button>
            </nav>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Offer card" selector="ui-offer-card" [api]="offerApi" [outputs]="offerOutputs"
        summary="A card that offers help, for the top of a feed or list: art in [offer-art], a heading, one line, a main and a quiet button, a close ×, and optionally a small Turn off tips link. It has the coach-mark tint, so it reads as help rather than content. variant='role' frames a bigger avatar or cover picture, for 'Aisha added you to her event'. Fits a 360px phone: the buttons wrap under the text.">
        <doc-demo code="<ui-offer-card heading=&quot;New to invites.blog?&quot; body=&quot;Take a quick tour.&quot;
  primaryLabel=&quot;Show me&quot; secondaryLabel=&quot;Not now&quot; [tipsOff]=&quot;true&quot;
  (primaryClick)=&quot;tour()&quot; (secondaryClick)=&quot;seen()&quot; (dismissed)=&quot;seen()&quot; (tipsOffClick)=&quot;tipsOff()&quot;>
  <hugeicons-icon offer-art [icon]=&quot;SparklesIcon&quot; />
</ui-offer-card>

<ui-offer-card variant=&quot;role&quot; heading=&quot;Aisha added you to &quot;Our wedding&quot; as a celebrant.&quot;
  body=&quot;You can see who's coming and all the photos.&quot; primaryLabel=&quot;Open event&quot; secondaryLabel=&quot;Show me around&quot;>
  <img offer-art src=&quot;cover.jpg&quot; alt=&quot;&quot; />
</ui-offer-card>">
          <div class="narrow">
            @if (offerOpen()) {
              <ui-offer-card heading="New to invites.blog?" body="Take a quick tour." primaryLabel="Show me" secondaryLabel="Not now" [tipsOff]="true"
                (primaryClick)="offerOpen.set(false); startTour()" (secondaryClick)="offerOpen.set(false)" (dismissed)="offerOpen.set(false)" (tipsOffClick)="offerOpen.set(false)">
                <hugeicons-icon offer-art [icon]="icons.sparkles" [size]="20" [strokeWidth]="1.8" aria-hidden="true" />
              </ui-offer-card>
            } @else {
              <ui-button size="sm" variant="outline" (click)="offerOpen.set(true)">Show the offer again</ui-button>
            }
            <ui-offer-card variant="role" heading="Aisha added you to “Our wedding” as a celebrant." body="You can see who's coming and all the photos."
              primaryLabel="Open event" secondaryLabel="Show me around">
              <svg offer-art class="cover" viewBox="0 0 56 56" aria-hidden="true">
                <rect class="c-bg" width="56" height="56" /><circle class="c-sun" cx="40" cy="16" r="7" /><path class="c-hill" d="M0 44 L18 28 L30 38 L40 30 L56 42 V56 H0Z" />
              </svg>
            </ui-offer-card>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Checklist" selector="ui-checklist" [api]="checklistApi" [outputs]="checklistOutputs" [shapes]="checklistShapes"
        summary="A short getting-started list: title, '2 of 5' and a progress bar, then one row per step with a round check that fills when it's done; done rows go quiet. The app sets done (from the account's progress), so steps can be finished in any order and the list follows. When every step is done it shows a finished state. Each row is a button; a screen reader hears 'Start an event, Not done yet'.">
        <doc-demo code="<ui-checklist heading=&quot;Getting started&quot; [items]=&quot;items&quot; [dismissible]=&quot;true&quot;
  (itemClick)=&quot;open($event.id)&quot; (dismissed)=&quot;guidance.markSeen(['guide.checklist'])&quot; />">
          <div class="narrow">
            <ui-checklist heading="Getting started" [items]="items()" [dismissible]="true" (itemClick)="tick($event)" (dismissed)="resetChecklist()" />
            <p class="note">Tap a step to tick it here; the × starts over.</p>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Empty state with art and starters" anchor="empty-art" selector="ui-empty-state [empty-art] [empty-starters]"
        summary="An empty page shows a picture of what will fill it (at most 320 x 200, scaled down on a phone) in [empty-art], a heading, one line on how it fills, then one to three ways to start in [empty-starters]: ui-starter-cards that stack on a phone and sit two or three across on a wider screen. The old [empty-icon] and [empty-actions] slots still work.">
        <doc-demo code="<ui-empty-state heading=&quot;Your feed is quiet&quot; description=&quot;Events you host or are invited to show up here.&quot;>
  <img empty-art src=&quot;empty-feed-light.svg&quot; alt=&quot;&quot; />
  <ui-starter-card empty-starters heading=&quot;Start an event&quot; description=&quot;Pick a design, add guests, send&quot; (pressed)=&quot;create()&quot;>
    <hugeicons-icon starter-icon [icon]=&quot;Add01Icon&quot; />
  </ui-starter-card>
  …
</ui-empty-state>">
          <ui-empty-state heading="Your feed is quiet" description="Events you host or are invited to show up here." class="wide">
            <svg empty-art class="art" viewBox="0 0 320 200" role="img" aria-label="An empty feed post">
              <rect class="a-back" x="66" y="24" width="200" height="160" rx="14" transform="rotate(-6 166 104)" />
              <rect class="a-card" x="56" y="14" width="208" height="172" rx="14" />
              <rect class="a-cover" x="68" y="26" width="184" height="92" rx="8" />
              <circle class="a-dot" cx="226" cy="50" r="10" />
              <path class="a-hill" d="M68 104 L112 70 L142 94 L170 76 L252 112 V110 A8 8 0 0 1 244 118 H76 A8 8 0 0 1 68 110Z" />
              <rect class="a-line" x="68" y="130" width="120" height="10" rx="5" />
              <rect class="a-line soft" x="68" y="148" width="84" height="8" rx="4" />
              <path class="a-heart" d="M232 166 c-6-5-12-9-12-14 a5.5 5.5 0 0 1 12-2 a5.5 5.5 0 0 1 12 2 c0 5-6 9-12 14z" />
            </svg>
            <ui-starter-card empty-starters heading="Start an event" description="Pick a design, add guests, send">
              <hugeicons-icon starter-icon [icon]="icons.add" [size]="20" [strokeWidth]="1.8" aria-hidden="true" />
            </ui-starter-card>
            <ui-starter-card empty-starters heading="See an example event" description="A wedding, filled in">
              <hugeicons-icon starter-icon [icon]="icons.view" [size]="20" [strokeWidth]="1.8" aria-hidden="true" />
            </ui-starter-card>
            <ui-starter-card empty-starters heading="Browse templates" description="Designs for every occasion">
              <hugeicons-icon starter-icon [icon]="icons.calendar" [size]="20" [strokeWidth]="1.8" aria-hidden="true" />
            </ui-starter-card>
          </ui-empty-state>
        </doc-demo>
      </doc-section>

      <doc-section name="Starter card" selector="ui-starter-card" [api]="starterApi" [outputs]="starterOutputs"
        summary="One way to start: an icon in [starter-icon], a heading and one line, the whole card one button (pressed), or a link with href. Made for [empty-starters], and fine on its own.">
        <doc-demo code="<ui-starter-card heading=&quot;Add a guest&quot; description=&quot;One by one, with a name&quot; (pressed)=&quot;add()&quot;>
  <hugeicons-icon starter-icon [icon]=&quot;UserIcon&quot; />
</ui-starter-card>">
          <div class="narrow">
            <ui-starter-card heading="Add a guest" description="One by one, with a name">
              <hugeicons-icon starter-icon [icon]="icons.user" [size]="20" [strokeWidth]="1.8" aria-hidden="true" />
            </ui-starter-card>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Guidance controller" anchor="guidance" selector="UiGuidance · provideUiGuidance" [api]="guidanceApi" [shapes]="guidanceShapes"
        summary="Decides what may show and remembers what was seen, the same way on web and Flutter. Give it a store (your server, the device, or both): it never shows anything while tips are off or an id is seen; skipWhen marks an id seen silently (its action is already done); one thing on screen at a time, other requests are refused, not queued; one offer a session; at most 3 new one-off tips a day. Whatever the outcome, the id is seen for good, and Turn off tips turns tips off in the store.">
        <doc-demo code="providers: [provideUiGuidance(() => new ServerGuidanceStore(inject(HttpClient)))]

const guidance = injectUiGuidance()!;
await guidance.requestTip('tour.welcome', () => tours.start(TOUR), { kind: 'tour' });
await guidance.requestTip('tip.feed.templates', () => showHint(), { skipWhen: progress.hasEvent });">
          <div class="ctl">
            <div class="row">
              <ui-button size="sm" (click)="request('tour.welcome', 'tour')">Request the tour</ui-button>
              <ui-button size="sm" variant="outline" (click)="request('offer.welcome', 'offer')">Request an offer</ui-button>
              <ui-button size="sm" variant="outline" (click)="request('tip.' + (tipN + 1), 'tip')">Request a new tip</ui-button>
              <ui-button size="sm" variant="ghost" (click)="resetGuidance()">Show tips again</ui-button>
            </div>
            <ol class="log" aria-live="polite">
              @for (line of log(); track $index) { <li>{{ line }}</li> }
            </ol>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="One-off hint" anchor="hint-once" selector="uiHintOnce" [api]="hintOnceApi"
        summary="A uiHint that goes through the page's UiGuidance: it shows once uiHintOnceWhen is true, if the rules allow, and then never again on this account, however it closed. Placement, duration and the × are uiHint's.">
        <doc-demo code="<ui-button uiHintOnce=&quot;tip.me.settings&quot; uiHintOnceText=&quot;Your plan, sign-in and tips live here.&quot;
  [uiHintOnceWhen]=&quot;!loading()&quot; [uiHintOnceSkipWhen]=&quot;false&quot;>Settings</ui-button>">
          <div class="row">
            @if (hintShown()) {
              <ui-button variant="outline" uiHintOnce="tip.demo.settings" uiHintOnceText="Your plan, sign-in and tips live here." uiHintOncePlacement="bottom"
                (uiHintOnceDone)="hintDone.set($event)">
                <hugeicons-icon [icon]="icons.settings" [size]="16" [strokeWidth]="1.8" aria-hidden="true" /> Settings
              </ui-button>
            } @else {
              <ui-button size="sm" (click)="hintShown.set(true)">Open the screen</ui-button>
            }
            @if (hintShown()) { <ui-button size="sm" variant="ghost" (click)="hintShown.set(false)">Leave the screen</ui-button> }
            <span class="note">{{ hintDone() === undefined ? '' : 'Hint: ' + (hintDone() ?? 'not shown (seen, busy or capped)') }}</span>
          </div>
        </doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .phone {
      position: relative; width: min(100%, 360px); height: 420px; margin-inline: auto; display: flex; flex-direction: column;
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-lg); overflow: hidden; background: var(--ui-color-bg);
    }
    .phone-top { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-2); padding: var(--ui-space-2) var(--ui-space-3); border-bottom: 1px solid var(--ui-color-border); }
    .brand { font-weight: 700; color: var(--ui-color-primary); }
    .phone-body { flex: 1; overflow: auto; display: flex; flex-direction: column; gap: var(--ui-space-3); padding: var(--ui-space-3); }
    .post { height: 150px; flex: none; border-radius: var(--ui-radius); background: var(--ui-color-surface-subtle); }
    .post.short { height: 90px; }
    .tabs { display: flex; border-top: 1px solid var(--ui-color-border); background: var(--ui-color-surface); }
    .tab {
      flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: var(--ui-space-2) 0; min-height: 52px;
      border: 0; background: transparent; color: var(--ui-color-text-secondary); font: inherit; font-size: var(--ui-font-size-sm); cursor: pointer;
    }
    .tab:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .note { margin: 0; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .narrow { width: min(100%, 360px); display: flex; flex-direction: column; gap: var(--ui-space-3); align-items: stretch; }
    .narrow > ui-button { align-self: flex-start; }
    .wide { width: 100%; }
    .row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ui-space-2); }
    .ctl { display: flex; flex-direction: column; gap: var(--ui-space-3); width: 100%; }
    .log { margin: 0; padding-inline-start: var(--ui-space-6); font-size: var(--ui-font-size-sm); color: var(--ui-color-text-secondary); min-height: 1.4em; }
    .art .a-back { fill: var(--ui-color-surface-subtle); }
    .art .a-card { fill: var(--ui-color-surface); stroke: var(--ui-color-border); stroke-width: 1.5; }
    .art .a-cover { fill: color-mix(in srgb, var(--ui-color-primary) 16%, var(--ui-color-surface)); }
    .art .a-hill { fill: color-mix(in srgb, var(--ui-color-primary) 34%, var(--ui-color-surface)); }
    .art .a-dot { fill: color-mix(in srgb, var(--ui-color-primary) 45%, var(--ui-color-surface)); }
    .art .a-line { fill: var(--ui-color-border-strong); }
    .art .a-line.soft { fill: var(--ui-color-border); }
    .art .a-heart { fill: var(--ui-color-primary); }
    .cover .c-bg { fill: color-mix(in srgb, var(--ui-color-primary) 22%, var(--ui-color-surface)); }
    .cover .c-sun { fill: color-mix(in srgb, var(--ui-color-primary) 55%, var(--ui-color-surface)); }
    .cover .c-hill { fill: var(--ui-color-primary); }
  `,
})
export class GuidancePage {
  private readonly tours = inject(UiTourService);
  private readonly guidance = inject(UI_GUIDANCE);
  protected readonly icons = {
    add: Add01Icon, calendar: Calendar03Icon, home: Home01Icon, inbox: InboxIcon, settings: Settings02Icon,
    sparkles: SparklesIcon, user: UserIcon, view: ViewIcon,
  };
  protected readonly tourOutcome = signal<UiTourOutcome | null>(null);
  protected readonly offerOpen = signal(true);
  protected readonly items = signal<UiChecklistItem[]>(CHECKLIST);
  protected readonly log = signal<string[]>([]);
  protected readonly hintShown = signal(false);
  protected readonly hintDone = signal<UiTourOutcome | null | undefined>(undefined);
  protected tipN = 0;

  protected async startTour(): Promise<void> {
    this.tourOutcome.set(await this.tours.start(TOUR));
  }

  protected tick(item: UiChecklistItem): void {
    this.items.update((xs) => xs.map((x) => (x.id === item.id ? { ...x, done: true } : x)));
  }

  protected resetChecklist(): void {
    this.items.set(CHECKLIST);
  }

  protected async request(id: string, kind: 'tip' | 'offer' | 'tour'): Promise<void> {
    if (kind === 'tip') this.tipN++;
    // A stand-in for a real tip: "shown" for a moment, then closed.
    const outcome = await this.guidance.requestTip(id, () => new Promise((r) => setTimeout(() => r(kind === 'tour' ? 'finished' : 'closed'), 400)), { kind });
    this.log.update((l) => [...l.slice(-5), `${id} (${kind}): ${outcome ?? 'refused'}`]);
  }

  protected async resetGuidance(): Promise<void> {
    await this.guidance.reset();
    this.log.update((l) => [...l.slice(-5), 'Show tips again: everything unseen, tips on']);
  }

  protected readonly tourShapes = `type UiTourOutcome = 'finished' | 'skipped' | 'turnedOff' | 'closed';
interface UiTourSpec { id: string; steps: UiTourStep[]; labels?: UiTourLabels; turnOff?: boolean; }
interface UiTourStep { anchor: string; text: string; title?: string; placement?: 'auto' | 'top' | 'bottom' | 'start' | 'end'; }
interface UiTourLabels { back?: string; next?: string; done?: string; skip?: string; turnOff?: string; step?: string; }`;
  protected readonly tourApi: ApiRow[] = [
    { name: 'uiTourAnchor', type: 'string (required)', default: '—', desc: 'The anchor id a step points at (shared with the other app). Several elements may share one; the first on screen wins.' },
    { name: 'UiTourService.start(spec)', type: 'Promise<UiTourOutcome>', default: '—', desc: 'Runs a tour (1 to 5 steps). A tour already running ends with closed; no step on the page resolves closed at once.' },
    { name: 'UiTourService.stop()', type: 'void', default: '—', desc: 'Ends the running tour with closed.' },
    { name: 'UiTourService.active', type: 'Signal<string | null>', default: 'null', desc: 'The id of the tour on screen.' },
    { name: 'spec.turnOff', type: 'boolean', default: 'true', desc: 'Show the Turn off tips action.' },
    { name: 'spec.labels', type: 'UiTourLabels', default: 'built-in', desc: 'Words for this tour; by default the built-in tourBack, tourNext, tourDone, tourSkip, tourStep and tipsOff.' },
    { name: 'step.placement', type: "'auto' | 'top' | 'bottom' | 'start' | 'end'", default: "'auto'", desc: 'The side the bubble prefers (auto: below, else above). It moves to another side, or over the page, when there is no room, and never leaves the screen.' },
  ];

  protected readonly offerApi: ApiRow[] = [
    { name: 'heading', type: 'string (required)', default: '—', desc: 'The offer; also names the card.' },
    { name: 'body', type: 'string | null', default: 'null', desc: 'One line under it.' },
    { name: 'variant', type: "'default' | 'role'", default: "'default'", desc: 'default: a small round icon in [offer-art]; role: a bigger avatar or cover picture.' },
    { name: 'primaryLabel / secondaryLabel', type: 'string | null', default: 'null', desc: 'The two buttons; each shows only when given.' },
    { name: 'dismissible', type: 'boolean', default: 'true', desc: 'Show the × (named Dismiss).' },
    { name: 'tipsOff', type: 'boolean', default: 'false', desc: 'Show the small Turn off tips link.' },
    { name: 'tipsOffLabel', type: 'string | null', default: 'built-in tipsOff', desc: 'Its words.' },
    { name: '[offer-art]', type: 'slot', default: '—', desc: 'An icon, or an img for the role variant.' },
  ];
  protected readonly offerOutputs: ApiRow[] = [
    { name: 'primaryClick / secondaryClick', type: 'void', default: '—', desc: 'A button was pressed.' },
    { name: 'dismissed', type: 'void', default: '—', desc: 'The × was pressed: mark the offer seen.' },
    { name: 'tipsOffClick', type: 'void', default: '—', desc: 'Turn off tips was pressed.' },
  ];

  protected readonly checklistShapes = `interface UiChecklistItem { id: string; label: string; description?: string; done: boolean; }`;
  protected readonly checklistApi: ApiRow[] = [
    { name: 'heading', type: 'string (required)', default: '—', desc: 'The list title ("Getting started").' },
    { name: 'items', type: 'UiChecklistItem[]', default: '[]', desc: 'The steps; done ones tick and go quiet.' },
    { name: 'dismissible', type: 'boolean', default: 'false', desc: 'Show the ×.' },
    { name: 'allDoneText', type: 'string | null', default: 'built-in checklistAllDone', desc: 'The finished state\'s words (All set).' },
  ];
  protected readonly checklistOutputs: ApiRow[] = [
    { name: 'itemClick', type: 'UiChecklistItem', default: '—', desc: 'A row was pressed: open where that step is done.' },
    { name: 'dismissed', type: 'void', default: '—', desc: 'The × was pressed.' },
  ];

  protected readonly starterApi: ApiRow[] = [
    { name: 'heading', type: 'string (required)', default: '—', desc: 'What it starts.' },
    { name: 'description', type: 'string | null', default: 'null', desc: 'One line under it.' },
    { name: 'href', type: 'string | null', default: 'null', desc: 'Makes the card a link.' },
    { name: 'disabled', type: 'boolean', default: 'false', desc: 'Greys the button out.' },
    { name: '[starter-icon]', type: 'slot', default: '—', desc: 'An icon on a tinted square.' },
  ];
  protected readonly starterOutputs: ApiRow[] = [{ name: 'pressed', type: 'void', default: '—', desc: 'The card was pressed.' }];

  protected readonly guidanceShapes = `interface UiGuidanceStore {
  tipsOn(): boolean | Promise<boolean>;
  seen(id: string): boolean | Promise<boolean>;
  markSeen(ids: readonly string[]): void | Promise<void>;
  setTipsOn(on: boolean): void | Promise<void>;
  reset(): void | Promise<void>;
  readDayCount?(day: string): number | Promise<number>;   // optional: else kept in memory
  writeDayCount?(day: string, count: number): void | Promise<void>;
}
interface UiGuidanceCheck { skipWhen?: boolean; kind?: 'tip' | 'offer' | 'tour'; }   // kind defaults to 'tip'`;
  protected readonly guidanceApi: ApiRow[] = [
    { name: 'new UiGuidance(store, options?)', type: '{ maxTipsPerDay?: number; now?: () => Date }', default: 'maxTipsPerDay 3', desc: 'One per app session; provideUiGuidance(storeFactory, options) provides it as UI_GUIDANCE (injectUiGuidance()).' },
    { name: 'requestTip(id, show, check?)', type: 'Promise<UiTourOutcome | null>', default: '—', desc: 'Shows it through show() if the rules allow; null when refused. Marks it seen on any outcome; turnedOff turns tips off.' },
    { name: 'canShow(id, check?)', type: 'Promise<boolean>', default: '—', desc: 'The same rules, without showing or changing anything.' },
    { name: 'markSeen(ids) / isSeen(id)', type: 'Promise', default: '—', desc: 'For offers whose action happened elsewhere, a checklist closed.' },
    { name: 'tipsOn() / setTipsOn(on) / reset()', type: 'Promise', default: '—', desc: 'The Settings switch and Show tips again.' },
    { name: 'active', type: 'Signal<string | null>', default: 'null', desc: 'The id on screen.' },
    { name: 'UiMemoryGuidanceStore', type: 'class', default: '—', desc: 'A store in memory, for tests, demos and a signed-out first run.' },
  ];

  protected readonly hintOnceApi: ApiRow[] = [
    { name: 'uiHintOnce', type: 'string (required)', default: '—', desc: 'The tip id.' },
    { name: 'uiHintOnceText', type: 'string (required)', default: '—', desc: 'The hint\'s text.' },
    { name: 'uiHintOnceWhen', type: 'boolean', default: 'true', desc: 'Waits until true (page loaded, no dialog open).' },
    { name: 'uiHintOnceSkipWhen', type: 'boolean', default: 'false', desc: 'Its action is already done: never shown, marked seen silently.' },
    { name: 'uiHintOncePlacement / Duration / Dismissible', type: 'as uiHint', default: "'top' / 6000 / false", desc: 'Passed to uiHint.' },
    { name: '(uiHintOnceDone)', type: 'UiTourOutcome | null', default: '—', desc: 'closed once it closes, or null when it wasn\'t shown.' },
  ];
}
