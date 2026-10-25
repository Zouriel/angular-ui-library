import { uiNavBearing, uiNavDistance, type UiNavStep } from '@zouriel/ui/map';
import type { UiLatLng } from '@zouriel/ui/map';

/**
 * The showcase's simulated drive (0.47.0): a real road route across Male (OSRM, 1.3 km, the
 * Routes demo's) with steps made from its turns, as an app would get them from OSRM, in English or
 * Dhivehi. The same route and steps are in the Flutter showcase.
 */
export const NAV_DEMO_ROUTE: [number, number][] = [
  [4.17682, 73.5121], [4.17678, 73.51237], [4.17708, 73.51244], [4.17709, 73.51223], [4.17716, 73.51216], [4.17773, 73.51224], [4.17785, 73.51146],
  [4.1769, 73.51136], [4.1771, 73.50974], [4.17284, 73.50825], [4.17311, 73.50751], [4.1732, 73.50755], [4.17344, 73.50696], [4.17388, 73.50715], [4.17387, 73.50721],
];

const STREETS = ['Majeedhee Magu', 'Orchid Magu', 'Chaandhanee Magu', 'Fareedhee Magu', 'Boduthakurufaanu Magu', 'Ameenee Magu', 'Sosun Magu'];
const STREETS_DV = ['މަޖީދީ މަގު', 'އޯކިޑް މަގު', 'ޗާނދަނީ މަގު', 'ފަރީދީ މަގު', 'ބޮޑުތަކުރުފާނު މަގު', 'އަމީނީ މަގު', 'ސޮސަން މަގު'];
const WORDS: Record<string, [string, string]> = {
  'slight right': ['Keep slightly right onto {s}', 'ކުޑަކޮށް ކަނާތަށް، {s}'],
  'slight left': ['Keep slightly left onto {s}', 'ކުޑަކޮށް ވާތަށް، {s}'],
  right: ['Turn right onto {s}', 'ކަނާތަށް އެނބުރި {s}'],
  left: ['Turn left onto {s}', 'ވާތަށް އެނބުރި {s}'],
  'sharp right': ['Turn sharp right onto {s}', 'ވަރަށް ކަނާތަށް އެނބުރި {s}'],
  'sharp left': ['Turn sharp left onto {s}', 'ވަރަށް ވާތަށް އެނބުރި {s}'],
};

/** The turn at a vertex as OSRM words it, from the change of bearing (clockwise, -180..180). */
function modifier(turn: number): string | null {
  const a = Math.abs(turn);
  if (a < 30) return null;
  const side = turn > 0 ? 'right' : 'left';
  return a < 60 ? `slight ${side}` : a < 135 ? side : `sharp ${side}`;
}

/** Steps for `points`: depart, one per turn of 30 degrees or more (vertices under 12 m apart merged), arrive. */
export function navDemoSteps(points: readonly [number, number][], dv: boolean): UiNavStep[] {
  const ll: UiLatLng[] = points.map(([lat, lng]) => ({ lat, lng }));
  const cum = [0];
  for (let i = 1; i < ll.length; i++) cum.push(cum[i - 1] + uiNavDistance(ll[i - 1], ll[i]));
  const turns: { i: number; mod: string; bearing: number }[] = [];
  for (let i = 1; i < ll.length - 1; i++) {
    const before = uiNavBearing(ll[i - 1], ll[i]);
    const after = uiNavBearing(ll[i], ll[i + 1]);
    const turn = ((after - before + 540) % 360) - 180;
    const mod = modifier(turn);
    if (!mod) continue;
    const last = turns[turns.length - 1];
    if (last && cum[i] - cum[last.i] < 12) continue;
    turns.push({ i, mod, bearing: after });
  }
  const street = (k: number) => (dv ? STREETS_DV : STREETS)[k % STREETS.length];
  const marks = [0, ...turns.map((x) => x.i), ll.length - 1];
  const steps: UiNavStep[] = [];
  for (let k = 0; k < marks.length; k++) {
    const i = marks[k];
    const dist = k < marks.length - 1 ? cum[marks[k + 1]] - cum[i] : 0;
    const secs = dist / 6; // about 22 km/h through town
    if (k === 0) {
      steps.push({ maneuver: { type: 'depart', location: ll[0], bearingAfter: uiNavBearing(ll[0], ll[1]) }, distanceMeters: dist, durationSeconds: secs, instruction: dv ? `${street(0)} ގައި ފަށާ` : `Head out on ${street(0)}`, streetName: street(0) });
    } else if (k === marks.length - 1) {
      steps.push({ maneuver: { type: 'arrive', location: ll[i] }, distanceMeters: 0, durationSeconds: 0, instruction: dv ? 'މަންޒިލަށް ވާސިލުވެއްޖެ' : 'You have arrived', streetName: undefined });
    } else {
      const turn = turns[k - 1];
      const w = WORDS[turn.mod][dv ? 1 : 0].replace('{s}', street(k));
      steps.push({ maneuver: { type: 'turn', modifier: turn.mod, location: ll[i], bearingAfter: turn.bearing }, distanceMeters: dist, durationSeconds: secs, instruction: w, streetName: street(k) });
    }
  }
  return steps;
}
