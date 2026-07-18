# Contributing and Local Checks

This project is a TypeScript-first package that builds ESM, CommonJS, UMD, and
declaration outputs from the same source tree.

## Build

```bash
npm install
npm run build
```

`npm run build` runs `clean -> build:esm -> build:cjs -> build:types ->
build:umd -> build:prune` in order, emitting:

- the ESM graph reachable from formal package entries
- `dist/cjs/index.cjs`
- `dist/types/index.d.ts`
- `dist/umd/image-editor.full.umd.js`
- `dist/umd/image-editor.full.umd.min.js`

The final pruning pass removes build-only and type-only artifacts that cannot
be reached through a formal package contract.

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

For the full local candidate check, run:

```bash
npm run check:release
```

`check:release` requires a clean candidate commit on `develop`, `main`, or a
`release/*` branch. It verifies candidate metadata, deterministic output, all
formal package entries, public API and bundle policies, packed consumers,
cross-browser and visual behavior, UMD, migration, Codemod, performance, and
security. It only validates local readiness and does not change external release
state. `release:gate` and `release:check` remain aliases for this command.

`npm run ci` uses the engineering subset through `check:release-readiness`; the
workflow runs its browser matrix separately. A clean checkout does not need a
pre-existing `dist/` because the checks build generated artifacts before package
validation.
