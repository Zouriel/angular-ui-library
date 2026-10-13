import { Component, ElementRef, input, signal, viewChild } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import FullScreenIcon from '@hugeicons/core-free-icons/FullScreenIcon';
import PauseIcon from '@hugeicons/core-free-icons/PauseIcon';
import PlayIcon from '@hugeicons/core-free-icons/PlayIcon';

function fmt(s: number): string {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** `ui-video-player` — native `<video>` with themed controls (play, scrub, time, volume, speed, fullscreen). */
@Component({
  selector: 'ui-video-player',
  imports: [HugeiconsIconComponent],
  template: `
    <div class="vp" #wrap>
      <video #video [src]="src()" [poster]="poster()" (click)="toggle()"
             (timeupdate)="time.set(video.currentTime)"
             (loadedmetadata)="duration.set(video.duration)"
             (play)="playing.set(true)" (pause)="playing.set(false)"><ng-content select="track" /></video>
      <div class="controls">
        <button type="button" class="ic" (click)="toggle()" [attr.aria-label]="playing() ? 'Pause' : 'Play'"><hugeicons-icon [icon]="playing() ? pauseIcon : playIcon" [size]="16" [strokeWidth]="1.8" aria-hidden="true" /></button>
        <span class="t">{{ fmt(time()) }}</span>
        <input class="seek" type="range" min="0" [max]="duration() || 0" step="0.1" [value]="time()"
               aria-label="Seek" (input)="seek($event)" />
        <span class="t">{{ fmt(duration()) }}</span>
        <input class="vol" type="range" min="0" max="1" step="0.05" [value]="volume()" aria-label="Volume" (input)="setVol($event)" />
        <select class="rate" aria-label="Playback speed" (change)="setRate($event)">
          @for (r of rates; track r) { <option [value]="r" [selected]="r === 1">{{ r }}×</option> }
        </select>
        <button type="button" class="ic" (click)="fullscreen()" aria-label="Fullscreen"><hugeicons-icon [icon]="fullIcon" [size]="16" [strokeWidth]="1.8" aria-hidden="true" /></button>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .vp { position: relative; background: var(--ui-media-bg); border-radius: var(--ui-radius); overflow: hidden;
      font-family: var(--ui-font-default); line-height: 1.35; }
    video { display: block; width: 100%; max-height: 60vh; }
    /* Fullscreen: the clip takes every pixel the bar leaves, not the 60vh it gets inline. */
    .vp:fullscreen { display: flex; flex-direction: column; border-radius: 0; }
    .vp:fullscreen video { flex: 1; min-height: 0; max-height: none; height: 100%; }
    .controls { display: flex; align-items: center; gap: var(--ui-space-1); padding: var(--ui-space-1) var(--ui-space-2);
      background: var(--ui-color-surface-raised); border-top: 1px solid var(--ui-color-border); }
    .ic { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; flex: none; padding: 0;
      width: var(--ui-size-sm); height: var(--ui-size-sm); border: none; background: transparent; color: var(--ui-color-text); cursor: pointer;
      border-radius: var(--ui-radius-xs); font: inherit;
      transition: background var(--ui-motion-base) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .ic:hover { background: var(--ui-color-elevated-hover); }
    .ic:active { transform: scale(var(--ui-scale-press)); }
    .ic:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .t { font-family: var(--ui-font-mono); font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); min-width: 42px; text-align: center;
      font-variant-numeric: tabular-nums; }
    .seek, .vol { accent-color: var(--ui-color-primary); }
    .seek { flex: 1; min-width: 0; }
    .vol { width: 72px; }
    .seek:focus-visible, .vol:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); border-radius: var(--ui-radius-xs); }
    .rate { box-sizing: border-box; height: var(--ui-size-sm); padding: 0 var(--ui-space-1); background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius-xs); font: inherit; font-size: var(--ui-font-size-sm);
      font-variant-numeric: tabular-nums; cursor: pointer; transition: background var(--ui-motion-base) var(--ui-ease-standard); }
    .rate:hover { background: var(--ui-color-elevated-hover); }
    .rate:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    @media (pointer: coarse) {
      .controls { gap: var(--ui-space-2); }
      .ic { width: var(--ui-size-touch); height: var(--ui-size-touch); }
    }
    @media (max-width: 480px) { .vol { display: none; } }
    /* The popup list is the platform's, so it needs the colours spelled out here too. */
    .rate option { background-color: var(--ui-color-surface); color: var(--ui-color-text); }
  `,
})
export class UiVideoPlayer {
  src = input.required<string>();
  poster = input<string>();
  protected readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  protected readonly wrap = viewChild.required<ElementRef<HTMLElement>>('wrap');
  protected readonly playing = signal(false);
  protected readonly time = signal(0);
  protected readonly duration = signal(0);
  protected readonly volume = signal(1);
  protected readonly rates = [0.5, 1, 1.5, 2];
  protected readonly fmt = fmt;
  protected readonly playIcon = PlayIcon;
  protected readonly pauseIcon = PauseIcon;
  protected readonly fullIcon = FullScreenIcon;

  protected toggle(): void {
    const v = this.video().nativeElement;
    v.paused ? v.play() : v.pause();
  }
  protected seek(e: Event): void { this.video().nativeElement.currentTime = Number((e.target as HTMLInputElement).value); }
  protected setVol(e: Event): void { const v = Number((e.target as HTMLInputElement).value); this.video().nativeElement.volume = v; this.volume.set(v); }
  protected setRate(e: Event): void { this.video().nativeElement.playbackRate = Number((e.target as HTMLSelectElement).value); }
  protected fullscreen(): void { this.wrap().nativeElement.requestFullscreen?.(); }
}
