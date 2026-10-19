import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import AiBrain01Icon from '@hugeicons/core-free-icons/AiBrain01Icon';
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import Bookmark02Icon from '@hugeicons/core-free-icons/Bookmark02Icon';
import Calendar03Icon from '@hugeicons/core-free-icons/Calendar03Icon';
import FavouriteIcon from '@hugeicons/core-free-icons/FavouriteIcon';
import FilterHorizontalIcon from '@hugeicons/core-free-icons/FilterHorizontalIcon';
import Home01Icon from '@hugeicons/core-free-icons/Home01Icon';
import Location01Icon from '@hugeicons/core-free-icons/Location01Icon';
import Notification01Icon from '@hugeicons/core-free-icons/Notification01Icon';
import Search01Icon from '@hugeicons/core-free-icons/Search01Icon';
import SentIcon from '@hugeicons/core-free-icons/SentIcon';
import StarIcon from '@hugeicons/core-free-icons/StarIcon';
import Stethoscope02Icon from '@hugeicons/core-free-icons/Stethoscope02Icon';
import User03Icon from '@hugeicons/core-free-icons/User03Icon';
import { UiAvatar, UiChip } from '@zouriel/ui/badge';
import { UiButton, UiIconButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiSearchInput, UiTextarea } from '@zouriel/ui/form';
import { UiOceanHero, UiSeaSurface, UiSunrise, UiTide } from '@zouriel/ui/fx';
import { UiBottomNav, type UiBottomNavItem } from '@zouriel/ui/navigation';
import { UiTab, UiTabs } from '@zouriel/ui/tabs';
import { UiText } from '@zouriel/ui/text';
import { DocDemo, DocPage, DocSection } from '../docs/docs-ui';

interface Doctor {
  name: string;
  /** The name without the title, for the avatar's initials. */
  person: string;
  specialty: string;
  place: string;
  rating: string;
}

/**
 * The Find Doctor reference screens, rebuilt from library components inside ui-sea-surface. Nothing
 * here is custom UI beyond layout: every colour, font and motion comes from the maldives theme.
 */
@Component({
  selector: 'page-find-doctor',
  imports: [
    FormsModule,
    HugeiconsIconComponent,
    UiAvatar,
    UiChip,
    UiButton,
    UiIconButton,
    UiCard,
    UiSearchInput,
    UiTextarea,
    UiOceanHero,
    UiSeaSurface,
    UiSunrise,
    UiTide,
    UiBottomNav,
    UiTab,
    UiTabs,
    UiText,
    DocPage,
    DocSection,
    DocDemo,
  ],
  template: `
    <doc-page
      eyebrow="Themes"
      title="Find Doctor"
      lead="The Maldives theme in use: the five Find Doctor app screens rebuilt from existing components inside ui-sea-surface. White cards on Mist, Ocean Deep ink and buttons, a Coral call to action, Poppins, and the sea backdrops from @zouriel/ui/fx. Each screen is its own Maldives island, so it looks the same whatever theme the page is in."
    >
      <doc-section
        name="Splash"
        selector="ui-ocean-hero · ui-sunrise"
        summary="An ocean hero with the sunrise and the wordmark, over a sheet holding the two first actions. The sunrise rises once on load; the light sweeps across the sky every 8 seconds."
      >
        <doc-demo
          code='<ui-sea-surface>
  <ui-ocean-hero>
    <ui-sunrise [size]="96">…logo…</ui-sunrise>
  </ui-ocean-hero>
  <ui-button [block]="true" size="lg">Get started</ui-button>
</ui-sea-surface>'
        >
          <div class="phones">
            <ui-sea-surface class="phone" [waveHeight]="70" [waveOpacity]="0.4">
              <div class="splash">
                <ui-ocean-hero class="splash-hero">
                  <div class="splash-brand">
                    <ui-sunrise [size]="80"
                      ><hugeicons-icon
                        aria-hidden="true"
                        [icon]="icons.stethoscope"
                        [size]="32"
                        [strokeWidth]="1.8"
                    /></ui-sunrise>
                    <span class="brand-text"
                      ><span class="wordmark">Find Doctor</span
                      ><span class="tagline">Care across the atolls</span></span
                    >
                  </div>
                </ui-ocean-hero>
                <div class="sheet">
                  <ui-text variant="h3" as="h2">Your health, close to home</ui-text>
                  <ui-text variant="body" class="muted"
                    >Find and book doctors near you, and get guidance when you are not sure who to
                    see.</ui-text
                  >
                  <ui-button size="lg" [block]="true">Get started</ui-button>
                  <ui-button size="lg" variant="ghost" [block]="true"
                    >I already have an account</ui-button
                  >
                </div>
              </div>
            </ui-sea-surface>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section
        name="Home"
        selector="ui-search-input · ui-card · ui-bottom-nav"
        summary="Greeting, search, the coral guidance card (the accent button), specialty chips and the top doctors as white list cards with a bookmark and a chevron, entering one after another with uiTide. The bottom navigation marks the current page in Ocean Deep."
      >
        <doc-demo
          code='@for (d of doctors; track d.name; let i = $index) {
  <ui-card [uiTide]="i" padding="sm">…</ui-card>
}
<ui-bottom-nav [items]="nav" active="home" />'
        >
          <div class="phones">
            <ui-sea-surface class="phone" [waves]="false">
              <div class="screen">
                <div class="topline">
                  <ui-avatar name="Aminath Zahir" size="md" />
                  <div class="hello">
                    <ui-text variant="caption">Good morning</ui-text
                    ><ui-text variant="h4" as="h2">Aminath</ui-text>
                  </div>
                  <ui-icon-button label="Notifications" variant="ghost"
                    ><hugeicons-icon
                      aria-hidden="true"
                      [icon]="icons.bell"
                      [size]="20"
                      [strokeWidth]="1.8"
                  /></ui-icon-button>
                </div>
                <ui-search-input
                  placeholder="Search doctors, specialties"
                  label="Search doctors"
                  [(ngModel)]="homeQuery"
                />
                <ui-card class="guide" padding="sm">
                  <div class="guide-row">
                    <hugeicons-icon
                      class="ui-pulse guide-icon"
                      aria-hidden="true"
                      [icon]="icons.ai"
                      [size]="28"
                      [strokeWidth]="1.8"
                    />
                    <div class="grow">
                      <ui-text variant="label">Not sure who to see?</ui-text
                      ><ui-text variant="caption"
                        >Describe how you feel and we will suggest a specialist.</ui-text
                      >
                    </div>
                  </div>
                  <ui-button variant="accent" [block]="true">Get guidance</ui-button>
                </ui-card>
                <ui-text variant="h5" as="h3">Specialties</ui-text>
                <div class="chips">
                  @for (s of specialties; track s) {
                    <ui-chip>{{ s }}</ui-chip>
                  }
                </div>
                <ui-text variant="h5" as="h3">Top doctors</ui-text>
                <div class="list">
                  @for (d of doctors; track d.name; let i = $index) {
                    <ui-card padding="sm" [uiTide]="i" [tideDelay]="80">
                      <div class="doc">
                        <ui-avatar [name]="d.person" />
                        <div class="grow">
                          <ui-text variant="label">{{ d.name }}</ui-text>
                          <ui-text variant="caption">{{ d.specialty }} · {{ d.place }}</ui-text>
                          <span class="stars"
                            ><hugeicons-icon
                              aria-hidden="true"
                              [icon]="icons.star"
                              [size]="14"
                              [strokeWidth]="2"
                            />{{ d.rating }}</span
                          >
                        </div>
                        <ui-icon-button [label]="'Save ' + d.name" variant="ghost" size="sm"
                          ><hugeicons-icon
                            aria-hidden="true"
                            [icon]="icons.bookmark"
                            [size]="16"
                            [strokeWidth]="1.8"
                        /></ui-icon-button>
                        <hugeicons-icon
                          class="chev"
                          aria-hidden="true"
                          [icon]="icons.chevron"
                          [size]="18"
                          [strokeWidth]="1.8"
                        />
                      </div>
                    </ui-card>
                  }
                </div>
              </div>
              <ui-bottom-nav class="tabbar" label="Main" [items]="nav" active="home" />
            </ui-sea-surface>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section
        name="Doctor profile"
        selector="ui-avatar · ui-tabs · ui-button"
        summary="The doctor's card over the waves, three facts, tabs underlined in Ocean Deep, and the full-width booking button (size lg, which this demo sets to the brand's 50px with --ui-size-lg)."
      >
        <doc-demo
          code='<ui-tabs>
  <ui-tab label="About">…</ui-tab>
  <ui-tab label="Reviews">…</ui-tab>
</ui-tabs>
<ui-button size="lg" [block]="true">Book appointment</ui-button>'
        >
          <div class="phones">
            <ui-sea-surface class="phone" [waveHeight]="80">
              <div class="screen">
                <div class="topline">
                  <ui-icon-button label="Back" variant="ghost"
                    ><hugeicons-icon
                      aria-hidden="true"
                      [icon]="icons.back"
                      [size]="20"
                      [strokeWidth]="1.8"
                  /></ui-icon-button>
                  <span class="grow"></span>
                  <ui-icon-button label="Favourite" variant="ghost"
                    ><hugeicons-icon
                      class="fav"
                      aria-hidden="true"
                      [icon]="icons.heart"
                      [size]="20"
                      [strokeWidth]="1.8"
                  /></ui-icon-button>
                </div>
                <div class="profile">
                  <ui-avatar name="Aisha Rasheed" size="lg" />
                  <ui-text variant="h3" as="h2">Dr. Aisha Rasheed</ui-text>
                  <ui-text variant="caption">Cardiologist</ui-text>
                  <span class="where"
                    ><hugeicons-icon
                      aria-hidden="true"
                      [icon]="icons.pin"
                      [size]="14"
                      [strokeWidth]="1.8"
                    />IGMH, Malé</span
                  >
                </div>
                <ui-card padding="sm">
                  <div class="facts">
                    <div>
                      <ui-text variant="label">1.2k</ui-text
                      ><ui-text variant="caption">Patients</ui-text>
                    </div>
                    <div>
                      <ui-text variant="label">12 yrs</ui-text
                      ><ui-text variant="caption">Experience</ui-text>
                    </div>
                    <div>
                      <span class="stars big"
                        ><hugeicons-icon
                          aria-hidden="true"
                          [icon]="icons.star"
                          [size]="14"
                          [strokeWidth]="2"
                        />4.9</span
                      ><ui-text variant="caption">Rating</ui-text>
                    </div>
                  </div>
                </ui-card>
                <ui-tabs label="Doctor details">
                  <ui-tab label="About"
                    ><ui-text variant="body" class="muted tab-copy"
                      >Consultant cardiologist with a focus on prevention and heart rhythm. Speaks
                      Dhivehi and English.</ui-text
                    ></ui-tab
                  >
                  <ui-tab label="Reviews"
                    ><ui-text variant="body" class="muted tab-copy"
                      >“Took the time to explain everything.” · 214 reviews</ui-text
                    ></ui-tab
                  >
                  <ui-tab label="Location"
                    ><ui-text variant="body" class="muted tab-copy"
                      >Indira Gandhi Memorial Hospital, Kanbaa Aisa Rani Hingun, Malé.</ui-text
                    ></ui-tab
                  >
                </ui-tabs>
                <span class="grow"></span>
                <ui-button size="lg" [block]="true"
                  ><hugeicons-icon
                    aria-hidden="true"
                    [icon]="icons.calendar"
                    [size]="18"
                    [strokeWidth]="1.8"
                  />Book appointment</ui-button
                >
              </div>
            </ui-sea-surface>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section
        name="AI symptom checker"
        selector="ui-textarea · .ui-pulse"
        summary="A short conversation: the assistant's mark pulses while it is thinking (.ui-pulse), quick answers are chips, and the reply box is a textarea with a send button. The coral decor sits in the corner; the waves stay low so the input reads clearly."
      >
        <doc-demo
          code='<hugeicons-icon class="ui-pulse" [icon]="aiIcon" />
<ui-textarea [rows]="2" placeholder="Describe your symptoms" />'
        >
          <div class="phones">
            <ui-sea-surface
              class="phone"
              coral="br"
              [decorScale]="0.5"
              [waveLayers]="2"
              [waveHeight]="60"
              [waveOpacity]="0.35"
            >
              <div class="screen above-decor">
                <div class="topline">
                  <ui-icon-button label="Back" variant="ghost"
                    ><hugeicons-icon
                      aria-hidden="true"
                      [icon]="icons.back"
                      [size]="20"
                      [strokeWidth]="1.8"
                  /></ui-icon-button>
                  <ui-text variant="h4" as="h2" class="grow">Symptom checker</ui-text>
                  <hugeicons-icon
                    class="ui-pulse guide-icon"
                    aria-hidden="true"
                    [icon]="icons.ai"
                    [size]="22"
                    [strokeWidth]="1.8"
                  />
                </div>
                <div class="chat" role="log" aria-label="Conversation">
                  <div class="bubble bot" uiTide>Hi Aminath. What is bothering you today?</div>
                  <div class="bubble me" [uiTide]="1">
                    I have had a headache and a mild fever since yesterday.
                  </div>
                  <div class="bubble bot" [uiTide]="2">
                    Thanks. Do you also have a stiff neck or a rash?
                  </div>
                  <div class="chips" [uiTide]="3">
                    <ui-chip>No</ui-chip><ui-chip>Stiff neck</ui-chip><ui-chip>Rash</ui-chip>
                  </div>
                  <div class="bubble bot thinking" [uiTide]="4">
                    <hugeicons-icon
                      class="ui-pulse"
                      aria-hidden="true"
                      [icon]="icons.ai"
                      [size]="16"
                      [strokeWidth]="1.8"
                    />Thinking…
                  </div>
                </div>
                <span class="grow"></span>
                <div class="reply">
                  <ui-textarea
                    class="grow"
                    [rows]="2"
                    placeholder="Describe your symptoms"
                    ariaLabel="Describe your symptoms"
                    [(ngModel)]="symptoms"
                  />
                  <ui-icon-button label="Send" variant="primary"
                    ><hugeicons-icon
                      aria-hidden="true"
                      [icon]="icons.send"
                      [size]="18"
                      [strokeWidth]="1.8"
                  /></ui-icon-button>
                </div>
                <ui-text variant="caption" class="note"
                  >Guidance only, not a diagnosis. In an emergency call 102.</ui-text
                >
              </div>
            </ui-sea-surface>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section
        name="Search results"
        selector="ui-search-input · ui-chip · [uiTide]"
        summary="The query, filter chips and a count, then the matching doctors as list cards entering with uiTide, and the bottom navigation on Search."
      >
        <doc-demo
          code='<ui-search-input [(ngModel)]="query" />
@for (d of results; track d.name; let i = $index) { <ui-card [uiTide]="i">…</ui-card> }'
        >
          <div class="phones">
            <ui-sea-surface class="phone" [waves]="false">
              <div class="screen">
                <div class="topline">
                  <ui-search-input class="grow" label="Search doctors" [(ngModel)]="query" />
                  <ui-icon-button label="Filters" variant="outline"
                    ><hugeicons-icon
                      aria-hidden="true"
                      [icon]="icons.filter"
                      [size]="18"
                      [strokeWidth]="1.8"
                  /></ui-icon-button>
                </div>
                <div class="chips">
                  <ui-chip tone="primary">Malé</ui-chip><ui-chip>Available today</ui-chip
                  ><ui-chip>Video visit</ui-chip>
                </div>
                <ui-text variant="caption">{{ doctors.length }} cardiologists near you</ui-text>
                <div class="list">
                  @for (d of doctors; track d.name; let i = $index) {
                    <ui-card padding="sm" [uiTide]="i">
                      <div class="doc">
                        <ui-avatar [name]="d.person" />
                        <div class="grow">
                          <ui-text variant="label">{{ d.name }}</ui-text>
                          <ui-text variant="caption">{{ d.specialty }} · {{ d.place }}</ui-text>
                          <span class="stars"
                            ><hugeicons-icon
                              aria-hidden="true"
                              [icon]="icons.star"
                              [size]="14"
                              [strokeWidth]="2"
                            />{{ d.rating }}</span
                          >
                        </div>
                        <ui-icon-button [label]="'Save ' + d.name" variant="ghost" size="sm"
                          ><hugeicons-icon
                            aria-hidden="true"
                            [icon]="icons.bookmark"
                            [size]="16"
                            [strokeWidth]="1.8"
                        /></ui-icon-button>
                        <hugeicons-icon
                          class="chev"
                          aria-hidden="true"
                          [icon]="icons.chevron"
                          [size]="18"
                          [strokeWidth]="1.8"
                        />
                      </div>
                    </ui-card>
                  }
                </div>
              </div>
              <ui-bottom-nav class="tabbar" label="Main" [items]="nav" active="search" />
            </ui-sea-surface>
          </div>
        </doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .phones {
      display: flex;
      justify-content: center;
    }
    /* A phone-sized screen. The brand's 50px buttons: the lg size token, set for these screens only. */
    .phone {
      --ui-size-lg: 50px;
      width: 100%;
      max-width: 360px;
      height: 720px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius-lg);
      box-shadow: var(--ui-shadow-2);
    }
    .phone ::ng-deep > .content {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .screen {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: var(--ui-space-3);
      padding: var(--ui-space-4);
      overflow: auto;
    }
    .grow {
      flex: 1;
      min-width: 0;
    }
    .muted {
      color: var(--ui-color-text-muted);
    }
    .topline {
      display: flex;
      align-items: center;
      gap: var(--ui-space-2);
    }
    .hello {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ui-space-2);
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: var(--ui-space-2);
    }
    .doc {
      display: flex;
      align-items: center;
      gap: var(--ui-space-3);
    }
    .doc .grow {
      display: flex;
      flex-direction: column;
    }
    .stars {
      display: inline-flex;
      align-items: center;
      gap: var(--ui-space-1);
      color: var(--ui-color-text);
      font-family: var(--ui-font-default);
      font-size: var(--ui-font-size-sm);
      font-weight: 600;
    }
    .stars hugeicons-icon {
      color: var(--ui-rating-fill);
    }
    .stars hugeicons-icon ::ng-deep path {
      fill: currentColor;
    }
    .chev {
      color: var(--ui-color-text-muted);
      flex: none;
    }
    .guide {
      display: block;
    }
    .guide ::ng-deep .ui-card {
      background: var(--ui-color-accent-subtle);
      border-color: transparent;
    }
    .guide ::ng-deep .bd {
      display: flex;
      flex-direction: column;
      gap: var(--ui-space-3);
    }
    .guide-row {
      display: flex;
      align-items: center;
      gap: var(--ui-space-3);
    }
    .guide-row .grow {
      display: flex;
      flex-direction: column;
    }
    .guide-icon {
      color: var(--ui-color-secondary);
      flex: none;
    }
    .tabbar {
      flex: none;
      margin: 0 var(--ui-space-3) var(--ui-space-3);
    }

    .splash {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .splash-hero {
      flex: 1.3;
    }
    /* The sun rises in the sky; the wordmark sits low, over the deep water where white text reads. */
    .splash-brand {
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      gap: var(--ui-space-2);
      padding: var(--ui-space-8) var(--ui-space-4) var(--ui-space-12);
      color: var(--ui-color-primary-contrast);
    }
    .brand-text {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--ui-space-1);
    }
    .wordmark {
      font-family: var(--ui-font-display);
      font-weight: 600;
      font-size: 1.75rem;
    }
    .tagline {
      font-family: var(--ui-font-default);
      font-size: var(--ui-font-size-sm);
      letter-spacing: var(--ui-tracking-wide);
      text-transform: uppercase;
    }
    .sheet {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: var(--ui-space-3);
      padding: var(--ui-space-6) var(--ui-space-4) var(--ui-space-12);
      margin-top: calc(-1 * var(--ui-space-6));
      position: relative;
      background: var(--ui-color-bg);
      border-radius: var(--ui-radius-lg) var(--ui-radius-lg) 0 0;
    }

    .profile {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: var(--ui-space-1);
    }
    .where {
      display: inline-flex;
      align-items: center;
      gap: var(--ui-space-1);
      color: var(--ui-color-text-muted);
      font-family: var(--ui-font-default);
      font-size: var(--ui-font-size-sm);
    }
    .facts {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      text-align: center;
    }
    .facts > div {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .stars.big {
      font-size: var(--ui-font-size-md);
    }
    .fav {
      color: var(--ui-color-danger);
    }
    .tab-copy {
      display: block;
      padding-top: var(--ui-space-2);
    }

    .chat {
      display: flex;
      flex-direction: column;
      gap: var(--ui-space-2);
    }
    .bubble {
      max-width: 82%;
      padding: var(--ui-space-2) var(--ui-space-3);
      border-radius: var(--ui-radius-lg);
      font-family: var(--ui-font-default);
      font-size: var(--ui-font-size-sm);
      line-height: 1.45;
    }
    .bubble.bot {
      align-self: flex-start;
      background: var(--ui-color-surface-raised);
      color: var(--ui-color-text);
      box-shadow: var(--ui-shadow-1);
      border-bottom-left-radius: var(--ui-radius-xs);
    }
    .bubble.me {
      align-self: flex-end;
      background: var(--ui-color-primary);
      color: var(--ui-color-primary-contrast);
      border-bottom-right-radius: var(--ui-radius-xs);
    }
    .thinking {
      display: inline-flex;
      align-items: center;
      gap: var(--ui-space-2);
      color: var(--ui-color-text-muted);
    }
    .reply {
      display: flex;
      align-items: flex-end;
      gap: var(--ui-space-2);
    }
    .note {
      text-align: center;
    }
    /* Keeps the reply box and the note clear of the corner coral and the low waves. */
    .above-decor {
      padding-bottom: var(--ui-space-12);
    }
  `,
})
export class FindDoctorPage {
  protected readonly icons = {
    ai: AiBrain01Icon,
    back: ArrowLeft01Icon,
    chevron: ArrowRight01Icon,
    bookmark: Bookmark02Icon,
    calendar: Calendar03Icon,
    heart: FavouriteIcon,
    filter: FilterHorizontalIcon,
    pin: Location01Icon,
    bell: Notification01Icon,
    send: SentIcon,
    star: StarIcon,
    stethoscope: Stethoscope02Icon,
  };
  protected readonly homeQuery = signal('');
  protected readonly query = signal('Cardiologist');
  protected readonly symptoms = signal('');
  protected readonly specialties = ['Cardiology', 'Paediatrics', 'Dermatology', 'Dental', 'ENT'];
  protected readonly doctors: Doctor[] = [
    {
      name: 'Dr. Aisha Rasheed',
      person: 'Aisha Rasheed',
      specialty: 'Cardiologist',
      place: 'Malé',
      rating: '4.9',
    },
    {
      name: 'Dr. Ibrahim Naseem',
      person: 'Ibrahim Naseem',
      specialty: 'Cardiologist',
      place: 'Hulhumalé',
      rating: '4.8',
    },
    {
      name: 'Dr. Mariyam Shifa',
      person: 'Mariyam Shifa',
      specialty: 'Cardiologist',
      place: 'Addu City',
      rating: '4.7',
    },
  ];
  protected readonly nav: UiBottomNavItem[] = [
    { label: 'Home', value: 'home', icon: Home01Icon },
    { label: 'Search', value: 'search', icon: Search01Icon },
    { label: 'Visits', value: 'visits', icon: Calendar03Icon },
    { label: 'Profile', value: 'profile', icon: User03Icon },
  ];
}
