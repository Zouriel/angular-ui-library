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

## Using the library in an app

Always install a released version, never a path or `file:` link to the local checkout. To pick up a
library change in an app, release it first (see "Releasing" in either repo's `AGENTS.md`), then bump
the app's version.

**Angular apps** (`@zouriel/ui` on GitHub Packages):

- `.npmrc` in the app, committed, with the token taken from the environment (never write the token
  value into a file):
  ```
  @zouriel:registry=https://npm.pkg.github.com
  //npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
  ```
- Install with `NODE_AUTH_TOKEN=$(gh auth token) npm i @zouriel/ui@^X.Y.Z @angular/cdk @hugeicons/angular @hugeicons/core-free-icons`
  (plus `pdfjs-dist` only for the PDF viewer, and `leaflet@~1.9.4` only for `@zouriel/ui/map`). The token needs the `read:packages` scope.
- Docker builds: pass the token as a build secret (`RUN --mount=type=secret,id=npm_token NODE_AUTH_TOKEN=$(cat /run/secrets/npm_token) npm ci`),
  not as an `ARG`/`ENV`, which stays in the image.
- Load `@zouriel/ui/styles/tokens.css` and `animations.css` globally (without tokens.css nothing has
  colour or spacing), import components from their entry points (`import { UiButton } from '@zouriel/ui/button'`),
  and optionally `provideUiConfig({...})` in the app providers. Full guide: the Angular `README.md` "Quick start".
- `^0.21.0` only accepts 0.21.x: moving to a new minor version is a deliberate bump in the app's `package.json`.

**Flutter apps** (`zouriel_ui`, from GitHub, pinned to a release tag):

- In `pubspec.yaml`:
  ```yaml
  dependencies:
    zouriel_ui:
      git:
        url: https://github.com/Zouriel/flutter-ui-library.git
        path: packages/zouriel_ui
        ref: vX.Y.Z
  ```
  Always pin `ref` to a tag, never a branch; update by changing the tag and running `flutter pub get`.
- Use `UiApp` instead of `MaterialApp` (`UiApp(theme: UiThemeName.dark, home: ...)`), read tokens with
  `context.ui` and text styles with `context.uiText`, switch themes with `UiThemeController`. Don't
  mix in Material widgets for things the library has. Full guide: the Flutter `README.md` "Use".
- Every component, with demos and its API, is in the showcase app (`apps/showcase`) and on
  https://zouriel.com/uilib/ for the Angular side.

## Rules for this repo

- Spacing tokens are `--ui-space-1/2/3/4/6/8/12/20` only; use only tokens in `projects/ui/styles/tokens.css`.
- Import hugeicons one file per icon (`@hugeicons/core-free-icons/<Name>`), never the package root.
- The showcase dev server runs on port 4310; never touch port 4200.
