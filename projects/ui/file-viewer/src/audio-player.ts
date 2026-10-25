import { Component, ElementRef, input, signal, viewChild } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import PauseIcon from '@hugeicons/core-free-icons/PauseIcon';
import PlayIcon from '@hugeicons/core-free-icons/PlayIcon';
import { injectUiStrings } from '@zouriel/ui';

function fmt(s: number): string {
  if (!isFinite(s)) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

/** `ui-audio-player` — themed audio controls (play, scrub, time, volume). */
@Component({
  selector: 'ui-audio-player',
  imports: [HugeiconsIconComponent],
  template: `
    <div class="ap">
      <audio #audio [src]="src()" (timeupdate)="time.set(audio.currentTime)"
             (loadedmetadata)="duration.set(audio.duration)"
             (play)="playing.set(true)" (pause)="playing.set(false)" (ended)="playing.set(false)"></audio>
      <button type="button" class="play" (click)="toggle()" [attr.aria-label]="playing() ? strings.pause : strings.play"><hugeicons-icon [icon]="playing() ? pauseIcon : playIcon" [size]="16" [strokeWidth]="1.8" aria-hidden="true" /></button>
      @if (title()) { <span class="title">{{ title() }}</span> }
      <span class="t">{{ fmt(time()) }}</span>
      <input class="seek" type="range" min="0" [max]="duration() || 0" step="0.1" [value]="time()" [attr.aria-label]="strings.seek" (input)="seek($event)" />
      <span class="t">{{ fmt(duration()) }}</span>
    </div>
  `,
  styles: `
    :host { display: block; container-type: inline-size; }
    .ap { display: flex; align-items: center; gap: var(--ui-space-2); padding: var(--ui-space-1) var(--ui-space-2);
      background: var(--ui-color-surface); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      font-family: var(--ui-font-default); line-height: 1.35; }
    .play { box-sizing: border-box; position: relative; width: var(--ui-size-md); height: var(--ui-size-md); padding: 0; border-radius: var(--ui-radius-pill); border: none;
      background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); cursor: pointer; font: inherit; flex: none;
      display: flex; align-items: center; justify-content: center;
      transition: background var(--ui-motion-base) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard); }
    @media (pointer: coarse) {
      .play::before { content: ''; position: absolute; inset: calc((var(--ui-size-md) - var(--ui-size-touch)) / 2); }
    }
    .play:hover { background: var(--ui-color-primary-hover); }
    .play:active { transform: scale(var(--ui-scale-press)); }
    .play:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .title { flex: 0 1 auto; min-width: 0; max-width: 30%; font-size: var(--ui-font-size-sm); color: var(--ui-color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .t { font-family: var(--ui-font-mono); font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); min-width: 42px; text-align: center;
      font-variant-numeric: tabular-nums; }
    .seek { flex: 1; min-width: var(--ui-space-12); accent-color: var(--ui-color-primary); }
    .seek:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); border-radius: var(--ui-radius-xs); }
    /* Narrow: the title gets its own line above the controls, so neither it nor the seek bar is squeezed. */
    @container (max-width: 420px) {
      .ap { flex-wrap: wrap; row-gap: var(--ui-space-1); padding-block: var(--ui-space-2); }
      .title { order: -1; flex-basis: 100%; max-width: none; padding-inline: var(--ui-space-1); }
    }
  `,
})
export class UiAudioPlayer {
  protected readonly strings = injectUiStrings();
  src = input.required<string>();
  title = input<string>();
  protected readonly audio = viewChild.required<ElementRef<HTMLAudioElement>>('audio');
  protected readonly playing = signal(false);
  protected readonly time = signal(0);
  protected readonly duration = signal(0);
  protected readonly fmt = fmt;
  protected readonly playIcon = PlayIcon;
  protected readonly pauseIcon = PauseIcon;

  protected toggle(): void { const a = this.audio().nativeElement; a.paused ? a.play() : a.pause(); }
  protected seek(e: Event): void { this.audio().nativeElement.currentTime = Number((e.target as HTMLInputElement).value); }
}
