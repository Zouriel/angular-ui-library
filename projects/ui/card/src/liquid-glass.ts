import { InjectionToken } from '@angular/core';

/**
 * Whether `ui-card glassStrength="liquid"` bends the backdrop at its edges (an SVG displacement map in
 * `backdrop-filter: url(#…)`). Only Chromium renders SVG filters in backdrop-filter; Safari and Firefox
 * get the same glass without the bend (light blur, saturation, rim and sheen). Provide another check to
 * force it on or off (tests, or a browser you know).
 */
export const UI_LIQUID_REFRACTION = new InjectionToken<() => boolean>('UI_LIQUID_REFRACTION', {
  providedIn: 'root',
  factory: () => () => {
    const brands = (
      globalThis.navigator as { userAgentData?: { brands?: { brand: string }[] } } | undefined
    )?.userAgentData?.brands;
    return !!brands?.some((b) =>
      /Chromium|Google Chrome|Microsoft Edge|Opera|Brave/i.test(b.brand),
    );
  },
});

/** Width of the band along the edge that bends, in px, for a card `w` x `h`. */
export function uiLiquidBand(w: number, h: number): number {
  return Math.max(10, Math.min(28, Math.min(w, h) * 0.16));
}

/**
 * The displacement map for a rounded rectangle `w` x `h` with corner `radius`, drawn at `scale` of its
 * size (RGBA bytes, row by row). Red is the x shift and green the y shift, 128 meaning none: zero in the
 * middle, rising toward the edge across `band` px along the edge's inward normal, so the backdrop near
 * the rim is pulled from further in (it bends like the edge of a lens) and the middle stays undistorted.
 */
export function uiLiquidDisplacementMap(
  w: number,
  h: number,
  radius: number,
  band: number,
  scale = 0.5,
): { data: Uint8ClampedArray; width: number; height: number } {
  const mw = Math.max(1, Math.round(w * scale));
  const mh = Math.max(1, Math.round(h * scale));
  const data = new Uint8ClampedArray(mw * mh * 4);
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  const [hx, hy] = [w / 2 - r, h / 2 - r];
  for (let j = 0; j < mh; j++) {
    for (let i = 0; i < mw; i++) {
      // Pixel centre in card px, relative to the centre.
      const x = ((i + 0.5) / mw) * w - w / 2;
      const y = ((j + 0.5) / mh) * h - h / 2;
      const qx = Math.abs(x) - hx;
      const qy = Math.abs(y) - hy;
      let nx = 0;
      let ny = 0;
      let dist: number; // distance in from the edge
      if (qx > 0 && qy > 0) {
        const l = Math.hypot(qx, qy) || 1;
        nx = (qx / l) * Math.sign(x);
        ny = (qy / l) * Math.sign(y);
        dist = r - l;
      } else if (qx > qy) {
        nx = Math.sign(x);
        dist = r - qx;
      } else {
        ny = Math.sign(y);
        dist = r - qy;
      }
      const k = dist < band ? (1 - Math.max(0, dist) / band) ** 2 : 0;
      const o = (j * mw + i) * 4;
      // Sample inward: the shift points against the outward normal.
      data[o] = Math.round(128 - nx * k * 127);
      data[o + 1] = Math.round(128 - ny * k * 127);
      data[o + 2] = 128;
      data[o + 3] = 255;
    }
  }
  return { data, width: mw, height: mh };
}

/** The map as a PNG data URL (null where there is no canvas, e.g. a test DOM). */
export function uiLiquidMapUrl(
  w: number,
  h: number,
  radius: number,
  band: number,
  doc: Document,
): string | null {
  const map = uiLiquidDisplacementMap(w, h, radius, band);
  const canvas = doc.createElement('canvas');
  canvas.width = map.width;
  canvas.height = map.height;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx) return null;
  const img = ctx.createImageData(map.width, map.height);
  img.data.set(map.data);
  ctx.putImageData(img, 0, 0);
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
