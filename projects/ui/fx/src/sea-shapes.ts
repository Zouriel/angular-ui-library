/*
 * The sea backdrops' silhouettes, inline so the components need no asset files. The source is
 * projects/ui/fx/assets/maldives/*.svg (shared with the Flutter library); sea-shapes.spec.ts fails
 * if these drift from it. Each part is painted in its tone's theme colour (see UI_SEA_TONES).
 */

export type UiSeaTone = 'lagoon' | 'coral' | 'sand' | 'oceanDeep';

export interface UiSeaShapePart {
  tone: UiSeaTone;
  d: string;
  /** Stroke width in viewBox units; a part without one is filled. */
  stroke?: number;
  opacity?: number;
}

export interface UiSeaShape {
  viewBox: string;
  parts: UiSeaShapePart[];
}

/** Each tone's colour: the maldives brand token, or a theme role elsewhere. */
export const UI_SEA_TONES: Record<UiSeaTone, string> = {
  lagoon: 'var(--ui-color-lagoon, var(--ui-color-secondary))',
  coral: 'var(--ui-color-coral, var(--ui-color-accent))',
  sand: 'var(--ui-color-sand, var(--ui-color-surface-raised))',
  oceanDeep: 'var(--ui-color-ocean-deep, var(--ui-color-primary))',
};

export const UI_SEA_SHAPES = {
  wave1: {
    viewBox: '0 0 2880 120',
    parts: [
      {
        tone: 'lagoon',
        d: 'M0 46C240 24 480 24 720 46C960 68 1200 68 1440 46C1680 24 1920 24 2160 46C2400 68 2640 68 2880 46L2880 120L0 120Z',
      },
    ],
  },
  wave2: {
    viewBox: '0 0 2880 120',
    parts: [
      {
        tone: 'lagoon',
        d: 'M0 66C120 52 240 52 360 66C480 80 600 80 720 66C840 52 960 52 1080 66C1200 80 1320 80 1440 66C1560 52 1680 52 1800 66C1920 80 2040 80 2160 66C2280 52 2400 52 2520 66C2640 80 2760 80 2880 66L2880 120L0 120Z',
      },
    ],
  },
  wave3: {
    viewBox: '0 0 2880 120',
    parts: [
      {
        tone: 'lagoon',
        d: 'M0 86C80 77 160 77 240 86C320 95 400 95 480 86C560 77 640 77 720 86C800 95 880 95 960 86C1040 77 1120 77 1200 86C1280 95 1360 95 1440 86C1520 77 1600 77 1680 86C1760 95 1840 95 1920 86C2000 77 2080 77 2160 86C2240 95 2320 95 2400 86C2480 77 2560 77 2640 86C2720 95 2800 95 2880 86L2880 120L0 120Z',
      },
    ],
  },
  coral: {
    viewBox: '0 0 200 160',
    parts: [
      { tone: 'sand', d: 'M0 160L0 126C40 110 92 108 142 122C172 130 190 142 200 160Z' },
      {
        tone: 'coral',
        stroke: 10,
        d: 'M58 128C57 106 51 90 40 72M55 104C65 92 71 80 73 62M47 86C37 80 30 70 28 56M71 82C81 76 87 67 89 54M40 72C36 62 37 52 42 44M73 62C71 52 74 44 80 38',
      },
      {
        tone: 'coral',
        stroke: 8,
        opacity: 0.7,
        d: 'M122 124C124 110 129 100 138 90M127 108C118 101 112 93 110 83M134 96C142 92 148 84 150 74',
      },
    ],
  },
  palm: {
    viewBox: '0 0 200 220',
    parts: [
      { tone: 'lagoon', stroke: 7, d: 'M100 220C101 192 109 164 124 136' },
      {
        tone: 'lagoon',
        d: 'M124 136C111 117.3 90.9 115.8 76.5 127.4C93.8 121.6 111 125.9 124 136ZM124 136C138.4 118.7 160 117.3 174.4 127.4C157.1 123 139.8 125.9 124 136ZM124 136C116.8 115.8 102.4 104.3 86.6 102.9C102.4 108.6 113.9 120.2 124 136ZM124 136C134.1 114.4 149.9 105.8 165.8 105.8C149.9 111.5 137 121.6 124 136ZM124 136C109.6 136 96.6 144.6 90.9 159C101 147.5 112.5 140.3 124 136ZM124 136C139.8 137.4 151.4 147.5 155.7 161.9C147 150.4 135.5 141.8 124 136Z',
      },
      { tone: 'oceanDeep', stroke: 9, d: 'M40 220C44 180 54 140 76 104' },
      {
        tone: 'oceanDeep',
        d: 'M76 104C58 78 30 76 10 92C34 84 58 90 76 104ZM76 104C96 80 126 78 146 92C122 86 98 90 76 104ZM76 104C66 76 46 60 24 58C46 66 62 82 76 104ZM76 104C90 74 112 62 134 62C112 70 94 84 76 104ZM76 104C56 104 38 116 30 136C44 120 60 110 76 104ZM76 104C98 106 114 120 120 140C108 124 92 112 76 104Z',
      },
    ],
  },
} satisfies Record<string, UiSeaShape>;
