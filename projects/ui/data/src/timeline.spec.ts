import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import CheckmarkCircle02Icon from '@hugeicons/core-free-icons/CheckmarkCircle02Icon';
import { UiTimeline } from './timeline';

describe('UiTimeline icons', () => {
  it('shows a dot by default, a drawn icon for a HugeIcons icon, and text for a string icon', () => {
    const fixture = TestBed.createComponent(UiTimeline);
    fixture.componentRef.setInput('items', [
      { title: 'Created' },
      { title: 'Shipped', icon: CheckmarkCircle02Icon, tone: 'success' },
      { title: 'Step', icon: '3' },
    ]);
    fixture.detectChanges();
    const marks = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.mark')];
    expect(marks[0].querySelector('.dot')).not.toBeNull();
    expect(marks[1].querySelector('.badge svg')).not.toBeNull();
    expect(marks[1].querySelector('.badge')?.getAttribute('data-tone')).toBe('success');
    expect(marks[2].querySelector('.badge svg')).toBeNull();
    expect(marks[2].querySelector('.badge')?.textContent?.trim()).toBe('3');
  });
});

describe('UiTimeline states', () => {
  it('marks the current step for screen readers and the upcoming ones as such; no state stays as before', () => {
    const fixture = TestBed.createComponent(UiTimeline);
    fixture.componentRef.setInput('items', [
      { title: 'Requested', state: 'done' },
      { title: 'Nurse on the way', state: 'current' },
      { title: 'Visit', state: 'upcoming' },
      { title: 'Plain' },
    ]);
    fixture.detectChanges();
    const events = [...(fixture.nativeElement as HTMLElement).querySelectorAll('li.event')];
    expect(events.map((e) => e.getAttribute('aria-current'))).toEqual([null, 'step', null, null]);
    expect(events.map((e) => e.getAttribute('data-state'))).toEqual(['done', 'current', 'upcoming', null]);
  });
});
