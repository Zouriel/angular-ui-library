# Agent instructions: @zouriel/ui (Angular)

## Every change goes into Angular and Flutter

This library has a Flutter twin at `/home/zouriel/personal/flutterUiLib`
(https://github.com/Zouriel/flutter-ui-library). Any change made here, whether the owner asked for it
or an agent from another project needs it, must be made in the Flutter library in the same task:

- Same API, behaviour and look. Follow the Flutter repo's `AGENTS.md` and `docs/CONVENTIONS.md`.
- Tests in both: `ng test ui` here; `flutter test` in `packages/zouriel_ui` there (plus goldens when
  the look changes).
- Docs in both: the showcase page here, and the matching page in `apps/showcase` there.
- Token or theme changes in `projects/ui/styles`: regenerate the Flutter tokens with
  `tool/gen_tokens.mjs` (see the Flutter README).
- Form-builder engine changes: add or update the shared JSON fixtures, which run in both suites
  (`projects/ui/form-builder/src/fixtures/` and `packages/zouriel_ui/test/form_engine/fixtures/`).

Only skip the Flutter side when the change has no meaning there (e.g. a cursor-only effect), and
say so and why in your report. A change made in only one library is not done.

## Releasing

Both libraries share one version number. For a release: bump `projects/ui/package.json` in Angular and
`packages/zouriel_ui/pubspec.yaml` in Flutter to the same version, commit both, then:

- Angular: `ng build ui`, `npm publish` from `dist/ui` (GitHub Packages, `@zouriel` scope), tag `vX.Y.Z`, push the tag.
- Flutter: tag `vX.Y.Z` and push it; apps pin it with `ref: vX.Y.Z` in their git dependency.

## Rules for this repo

- Spacing tokens are `--ui-space-1/2/3/4/6/8/12/20` only; use only tokens in `projects/ui/styles/tokens.css`.
- Import hugeicons one file per icon (`@hugeicons/core-free-icons/<Name>`), never the package root.
- The showcase dev server runs on port 4310; never touch port 4200.
