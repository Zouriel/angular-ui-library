import { Directive, computed, inject, input } from '@angular/core';
import { UiReadAloudService } from './read-aloud.service';

/**
 * `[uiReadAloud]` — turns any button into a read-aloud toggle for a target element or selector.
 *
 *   <button type="button" uiReadAloud [for]="questionEl">Read this question aloud</button>
 */
@Directive({
  selector: '[uiReadAloud]',
  host: {
    '[attr.aria-pressed]': 'speaking()',
    '(click)': 'toggle()',
  },
})
export class UiReadAloud {
  private readonly readAloud = inject(UiReadAloudService);

  for = input<HTMLElement | string | null>(null);
  lang = input<string | undefined>(undefined);

  readonly speaking = this.readAloud.speaking;
  readonly canSpeak = computed(() => this.readAloud.canSpeak(this.lang()));

  toggle(): void {
    if (this.readAloud.speaking()) {
      this.readAloud.stop();
      return;
    }
    const target = this.for();
    if (target) this.readAloud.speak(target, this.lang());
  }
}
