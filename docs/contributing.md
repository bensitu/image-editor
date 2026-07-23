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

`npm test` builds the Codemod package and runs every Node-based product, unit,
property, migration, and Codemod test under `tests/`.

## Browser Tests

```bash
npm run test:e2e
npm run test:e2e:all
npm run test:browser
npm run test:browser:release
```

`npm run test:e2e` is the fast local E2E check and runs Chromium only.
`npm run test:e2e:all` runs the full Playwright E2E suite in Chromium, Firefox,
and WebKit for the Release profile. Local developers do not need system
Firefox or Safari installed; Playwright downloads and manages its own browser
binaries. Install the full local browser set when needed with:

```bash
npx playwright install chromium firefox webkit
```

`npm run test:browser` keeps the broader browser suite Chromium-only for local
iteration. `npm run test:browser:release` runs cross-browser E2E plus the
Chromium-only visual suite.

## Visual Regression Tests

```bash
npm run test:visual
npm run test:visual:update
```

Visual tests compare deterministic exported-image screenshots. Run
`npm run test:visual:update` after intentional rendering changes, then review
the updated snapshots before committing them. Visual tests are intentionally
Chromium-only unless browser-specific snapshots are added.

## Validation Profiles

For pull-request responsibilities, run:

```bash
npm run check:pr
```

This profile runs source formatting, linting, type checking, every Node product
test, architecture and repository policies, official Plugin checks, the built
package surface, security checks, public type fixtures, and Chromium E2E. CI
checks the minimum supported Node.js 22.12 runtime and runs the full gate on
Node.js 24.

For distribution and release responsibilities, run from a clean commit:

```bash
npm run check:release
```

`check:release` verifies generic semantic-version and peer-range alignment,
builds the distribution once, validates package/API/bundle/UMD consumers, audits
dependencies, runs Chromium/Firefox/WebKit E2E and Chromium visual tests, and
checks deterministic output. It does not create tags, publish packages, or alter
external release state. `npm run ci` is the single alias for `check:pr`.
