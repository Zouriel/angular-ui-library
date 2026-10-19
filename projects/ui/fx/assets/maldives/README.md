# Maldives sea shapes

The source of the sea backdrops' silhouettes (`ui-wave-footer`, `ui-coral-decor`, `ui-palm-decor`),
shared by both libraries:

- Angular: `../../src/sea-shapes.ts` holds the same paths inline (components carry no asset files);
  `sea-shapes.spec.ts` fails if it drifts from these files.
- Flutter: `tool/gen_sea_shapes.mjs` turns these files into `lib/src/fx/sea_shapes.g.dart`.

Each `<path>` names its colour role in `data-tone` (`lagoon`, `coral`, `sand`, `oceanDeep`); the
`fill`/`stroke` colours here are only for previewing the file. Components paint each tone from the
theme tokens (`--ui-color-lagoon`, …). Paths use absolute `M`, `C`, `L` and `Z` commands only, so
the Flutter generator's parser stays small. The waves are 2880 wide and repeat every 1440, so a
layer drifting by half its width loops without a seam.
