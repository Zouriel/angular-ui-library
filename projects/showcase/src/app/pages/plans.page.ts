import { Component } from '@angular/core';
import { UiButton } from '@zouriel/ui/button';
import { UiBadge } from '@zouriel/ui/badge';
import { UiPlanCard, UiPlanCompare, UiPlanGrid, type UiPlanColumn, type UiPlanRow } from '@zouriel/ui/plans';
import { UiThemeProvider } from '@zouriel/ui/theme';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

const TIER = "'gold' | 'platinum' | 'premium' | null";

@Component({
  selector: 'page-plans',
  imports: [UiButton, UiBadge, UiPlanCard, UiPlanGrid, UiPlanCompare, UiThemeProvider, DocPage, DocSection, DocDemo],
  template: `
    <doc-page eyebrow="Components" title="Plans"
      lead="Pricing pages: plan cards in a grid, a comparison table, and buttons in a plan tier's metal. The metals are tokens (gold, platinum, premium), the same in every theme, with AA text on every stop.">

      <doc-section name="Plan cards" selector="ui-plan-grid · ui-plan-card" [api]="cardApi"
        summary="One card per plan or pass. A tier adds a slim strip of its metal along the top and a metal dot by the name; the card stays on the theme's surface. highlight puts one label on the top edge and strengthens the border: use it on one card per grid. current shows a Your plan badge; what the action says is up to you. The button goes in [plan-action] and sits at the bottom; small print goes in [plan-fineprint] under it. Buttons in a row line up when the cards in it have the same slots, so give every card fine print or none. ui-plan-grid shows one column under 600px, two under 912px and at most three, with cards in a row the same height. Each card is a group named by the plan, and the price is read as one phrase (MVR 499 per event).">
        <doc-demo code="<ui-plan-grid>
  <ui-plan-card name=&quot;Free&quot; price=&quot;MVR 0&quot; period=&quot;per event&quot; [features]=&quot;['1 GB of photos', 'Invitation and RSVP']&quot; [current]=&quot;true&quot;>
    <ui-button plan-action variant=&quot;outline&quot; [block]=&quot;true&quot; [disabled]=&quot;true&quot;>Your plan</ui-button>
  </ui-plan-card>
  <ui-plan-card name=&quot;Gold pass&quot; tier=&quot;gold&quot; price=&quot;MVR 499&quot; period=&quot;per event&quot; note=&quot;about $32&quot; [features]=&quot;gold&quot;>
    <ui-button plan-action tier=&quot;gold&quot; [block]=&quot;true&quot;>Get Gold</ui-button>
    <span plan-fineprint>One payment, no subscription</span>
  </ui-plan-card>
  <ui-plan-card name=&quot;Platinum pass&quot; tier=&quot;platinum&quot; highlight=&quot;For weddings&quot; price=&quot;MVR 899&quot; period=&quot;per event&quot; [features]=&quot;platinum&quot;>
    <ui-button plan-action tier=&quot;platinum&quot; [block]=&quot;true&quot;>Get Platinum</ui-button>
  </ui-plan-card>
</ui-plan-grid>">
          <ui-plan-grid>
            <ui-plan-card name="Free" tagline="For a small get-together" price="MVR 0" period="per event" [features]="freeFeatures" [current]="true">
              <ui-button plan-action variant="outline" [block]="true" [disabled]="true">Your plan</ui-button>
              <span plan-fineprint>Free for every event</span>
            </ui-plan-card>
            <ui-plan-card name="Gold pass" tier="gold" tagline="For parties and birthdays" price="MVR 499" period="per event" note="about $32" [features]="goldFeatures">
              <ui-button plan-action tier="gold" [block]="true">Get Gold</ui-button>
              <span plan-fineprint>One payment, no subscription</span>
            </ui-plan-card>
            <ui-plan-card name="Platinum pass" tier="platinum" highlight="For weddings" tagline="For the big day" price="MVR 899" period="per event" note="about $58" [features]="platinumFeatures">
              <ui-button plan-action tier="platinum" [block]="true">Get Platinum</ui-button>
              <span plan-fineprint>One payment, no subscription</span>
            </ui-plan-card>
          </ui-plan-grid>
        </doc-demo>
      </doc-section>

      <doc-section name="Premium" selector="ui-plan-card tier=&quot;premium&quot;"
        summary="Premium is a deep violet with white text, for a subscription that sits beside the passes. On its own a card is as wide as its container; put it in a ui-plan-grid to line it up with others.">
        <doc-demo code="<ui-plan-card name=&quot;Premium&quot; tier=&quot;premium&quot; price=&quot;MVR 199&quot; period=&quot;a month&quot; [features]=&quot;premium&quot;>
  <ui-button plan-action tier=&quot;premium&quot; [block]=&quot;true&quot;>Go Premium</ui-button>
  <span plan-fineprint>Cancel any time</span>
</ui-plan-card>">
          <div class="single">
            <ui-plan-card name="Premium" tier="premium" tagline="Keep every event's photos" price="MVR 199" period="a month" note="about $13" [features]="premiumFeatures">
              <ui-button plan-action tier="premium" [block]="true">Go Premium</ui-button>
              <span plan-fineprint>Cancel any time</span>
            </ui-plan-card>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Compare plans" selector="ui-plan-compare" [api]="compareApi"
        shapes="interface UiPlanColumn { key: string; name: string; tier?: UiTier | null; }
interface UiPlanRow { label: string; values: Record<string, string | boolean | null>; }"
        summary="A plain table, feature by feature. true shows a check read as Included, false or null a dash read as Not included, and text is shown as it is. Column headers carry a slim underline in the plan's metal; highlight tints one column. On a narrow screen the table scrolls sideways inside itself while the feature column stays put.">
        <doc-demo code="<ui-plan-compare [plans]=&quot;plans&quot; [rows]=&quot;rows&quot; highlight=&quot;platinum&quot; caption=&quot;Compare passes&quot; />">
          <ui-plan-compare [plans]="comparePlans" [rows]="compareRows" highlight="platinum" caption="Compare passes" />
        </doc-demo>
      </doc-section>

      <doc-section name="Tier buttons" selector="ui-button tier"
        summary="tier fills a button with the tier's metal and its contrast label, and wins over variant. Hover brightens toward the light stop and press darkens toward the base, so the label keeps AA in every state; focus rings in the tier's edge colour. Platinum catches a soft sweep of light on hover (none with reduced motion). Sizes, block, icons, loading and disabled work as on any button. The metals look the same on a light and a dark page.">
        <doc-demo code="<ui-button tier=&quot;gold&quot;>Get Gold</ui-button>
<ui-button tier=&quot;platinum&quot;>Get Platinum</ui-button>
<ui-button tier=&quot;premium&quot;>Go Premium</ui-button>
<ui-button tier=&quot;gold&quot; [loading]=&quot;true&quot;>Paying</ui-button>
<ui-button tier=&quot;platinum&quot; [disabled]=&quot;true&quot;>Sold out</ui-button>">
          <div class="islands">
            @for (theme of islands; track theme) {
              <ui-theme-provider [theme]="theme" class="ui-surface island">
                <div class="island-body">
                  <div class="row">
                    <ui-button tier="gold">Get Gold</ui-button>
                    <ui-button tier="platinum">Get Platinum</ui-button>
                    <ui-button tier="premium">Go Premium</ui-button>
                  </div>
                  <div class="row">
                    <ui-button tier="gold" size="sm">Small</ui-button>
                    <ui-button tier="platinum" size="lg">Large</ui-button>
                    <ui-button tier="gold" [loading]="true">Paying</ui-button>
                    <ui-button tier="platinum" [disabled]="true">Sold out</ui-button>
                  </div>
                  <div class="row">
                    <ui-badge tier="gold">Gold</ui-badge><ui-badge tier="platinum">Platinum</ui-badge><ui-badge tier="premium">Premium</ui-badge>
                  </div>
                </div>
              </ui-theme-provider>
            }
          </div>
        </doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .single { max-width: 360px; }
    .islands { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 288px), 1fr)); gap: var(--ui-space-4); width: 100%; }
    /* The theme provider draws the island's ground (display: block); the layout is on the inner box. */
    .island { border-radius: var(--ui-radius-lg); border: 1px solid var(--ui-color-border); }
    .island-body { display: flex; flex-direction: column; gap: var(--ui-space-3); padding: var(--ui-space-4); }
    .row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ui-space-2); }
  `,
})
export class PlansPage {
  protected readonly islands = ['light', 'dark'] as const;
  protected readonly freeFeatures = ['1 GB of photos', 'Invitation and RSVP', 'Guest list'];
  protected readonly goldFeatures = ['25 GB of photos', 'Guest camera', 'Photos kept for a year', 'Everything in Free'];
  protected readonly platinumFeatures = ['50 GB of photos', 'Guest camera and videos', 'Photos kept for a year', 'Save the date', 'Everything in Gold'];
  protected readonly premiumFeatures = ['3 GB on every event', 'Photos kept while subscribed', 'Your own designs'];

  protected readonly comparePlans: UiPlanColumn[] = [
    { key: 'free', name: 'Free' },
    { key: 'gold', name: 'Gold pass', tier: 'gold' },
    { key: 'platinum', name: 'Platinum pass', tier: 'platinum' },
    { key: 'premium', name: 'Premium', tier: 'premium' },
  ];
  protected readonly compareRows: UiPlanRow[] = [
    { label: 'Photo space', values: { free: '1 GB', gold: '25 GB', platinum: '50 GB', premium: '3 GB per event' } },
    { label: 'Invitation and RSVP', values: { free: true, gold: true, platinum: true, premium: true } },
    { label: 'Guest camera', values: { free: false, gold: true, platinum: true, premium: true } },
    { label: 'Videos', values: { free: false, gold: false, platinum: true, premium: null } },
    { label: 'Photos kept', values: { free: '30 days', gold: '1 year', platinum: '1 year', premium: 'While subscribed' } },
  ];

  protected readonly cardApi: ApiRow[] = [
    { name: 'name', type: 'string (required)', default: '—', desc: 'The plan name; also names the card (a group) for screen readers.' },
    { name: 'price', type: 'string (required)', default: '—', desc: 'The price, already formatted ("MVR 499").' },
    { name: 'period', type: 'string | null', default: 'null', desc: 'What the price covers ("per event", "a month"); read with the price.' },
    { name: 'note', type: 'string | null', default: 'null', desc: 'A small line under the price ("about $32").' },
    { name: 'tagline', type: 'string | null', default: 'null', desc: 'One line under the name.' },
    { name: 'features', type: 'string[]', default: '[]', desc: 'What is included, as a check list.' },
    { name: 'tier', type: TIER, default: 'null', desc: 'A strip of the metal along the top and a metal dot by the name. The body stays on the surface.' },
    { name: 'highlight', type: 'string | null', default: 'null', desc: 'One label on the top edge ("Most popular") and a stronger border. One card per grid.' },
    { name: 'current', type: 'boolean', default: 'false', desc: 'Shows currentLabel as a badge. The action is yours to choose.' },
    { name: 'currentLabel', type: 'string', default: "'Your plan'", desc: 'The current badge text.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
    { name: '[plan-action]', type: 'slot', default: '—', desc: 'The button; sits at the bottom, lined up across a grid.' },
    { name: '[plan-fineprint]', type: 'slot', default: '—', desc: 'Small muted text under the action.' },
    { name: 'ui-plan-grid (content)', type: 'slot', default: '—', desc: 'The cards. 1 column under 600px, 2 under 912px, at most 3; equal heights.' },
  ];
  protected readonly compareApi: ApiRow[] = [
    { name: 'plans', type: 'UiPlanColumn[] (required)', default: '—', desc: 'The plans, one column each.' },
    { name: 'rows', type: 'UiPlanRow[] (required)', default: '—', desc: 'The features, one row each; values by plan key.' },
    { name: 'highlight', type: 'string | null', default: 'null', desc: 'A plan key whose column is tinted.' },
    { name: 'caption', type: 'string | null', default: 'null', desc: 'Names the table (and its scroll region) for screen readers.' },
    { name: 'includedLabel', type: 'string', default: "'Included'", desc: 'What screen readers hear for true.' },
    { name: 'notIncludedLabel', type: 'string', default: "'Not included'", desc: 'What screen readers hear for false or null.' },
  ];
}
