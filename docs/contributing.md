# Contributing and Local Checks

This project is a TypeScript-first package that builds ESM, CommonJS, UMD, and
declaration outputs from the same source tree.

## Build

```bash
npm install
npm run build
```

`npm run build` runs `clean -> build:esm -> build:cjs -> build:types ->
build:umd` in order, emitting:

- `dist/esm/index.js` and the rest of the decomposed source tree
- `dist/cjs/index.cjs`
- `dist/types/index.d.ts`
- `dist/umd/image-editor.umd.js`

## Node Tests

```bash
npm test
```

`npm test` runs the Node-based unit and property tests under `tests/`.

## Browser Tests

```bash
npm run test:e2e
npm run test:e2e:all
npm run test:browser
npm run test:browser:release
npm run test:browser:all
```

`npm run test:e2e` is the fast local E2E check and runs Chromium only.
`npm run test:e2e:all` runs the full Playwright E2E suite in Chromium, Firefox,
and WebKit, matching CI browser coverage. Local developers do not need system
Firefox or Safari installed; Playwright downloads and manages its own browser
binaries. Install the full local browser set when needed with:

```bash
npx playwright install chromium firefox webkit
```

`npm run test:browser` keeps the broader browser suite Chromium-only for local
iteration. `npm run test:browser:release` runs cross-browser E2E plus the
Chromium-only visual suite. `npm run test:browser:all` is kept as an alias for
that release browser matrix.

## Visual Regression Tests

```bash
npm run test:visual
npm run test:visual:update
```

Visual tests compare deterministic exported-image screenshots. Run
`npm run test:visual:update` after intentional rendering changes, then review
the updated snapshots before committing them. Visual tests are intentionally
Chromium-only unless browser-specific snapshots are added.

## Release Checks

For the full local release gate, run:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run package:check
npm run release:gate
npm pack --dry-run
npm run release:check
npm run test:e2e:all
npm audit --audit-level=high
```

`npm run release:gate` validates generated artifacts, bundle shape, declaration
output, and package export metadata. Run it only after `npm run build`; the
convenience command `npm run release:check` runs build, package linting, the
release gate, and `npm pack --dry-run` in order.

`npm run ci` combines format, lint, typecheck, tests, and `release:check`.
Playwright visual tests are kept outside the default CI command until they are
stable across supported environments. The test suite also supports a clean
checkout where `dist/` has not been built yet; integration helpers use source
modules until build artifacts exist, while release-gate artifact checks run only
after the build step.
