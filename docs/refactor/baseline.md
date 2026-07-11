# Phase 0 baseline

## Repository baseline

| Item                               | Value                                      |
| ---------------------------------- | ------------------------------------------ |
| Working branch                     | `develop`                                  |
| Working-tree HEAD before Phase 0–1 | `ae8c34347d6c849f204332038e85e046e917f05e` |
| HEAD subject                       | `docs: update README.md`                   |
| v2.9.0 release commit              | `3f1c7a376f424addaed58b65eef6d550d2128a22` |
| Package version                    | `2.9.0`                                    |
| Node                               | `v24.16.0`                                 |
| npm                                | `11.15.0`                                  |
| Baseline bundler                   | Rollup `4.61.1`                            |

The working tree was clean before the task. Both reference commits existed locally. The release commit was checked out only in an isolated detached worktree, installed with `npm ci --ignore-scripts`, built with `npm run build:esm`, measured, and removed. The active branch was never reset or switched.

`dist` is tracked by Git. Rebuilding on Windows temporarily marked several existing artifacts modified because of `core.autocrlf`/stat handling, but `git diff --exit-code -- dist` confirmed byte-normalized content was unchanged. Those no-content status markers were removed before delivery.

## Commands

```sh
npm install
npm run build
npm test
npm run typecheck
npm run lint
npm run format:check
npm run check:architecture
npm run check:bundle-size
npm run test:plugin-kernel
npm run test:types
npm run check:refactor-baseline
```

Before implementation, `npm run build`, `npm run typecheck`, `npm run lint`, `npm run format:check`, and all 617 existing Node tests passed.

## Bundle fixtures and metrics

The fixtures use the Rollup JavaScript API and resolve the local package as a consumer import. Fabric stays external, matching the peer-dependency and release-build policy. Raw is the unminified generated ESM chunk; minified, gzip, and brotli are calculated from one deterministic minified ESM chunk. Gzip and brotli use Node `zlib`. No bundle output is written to the repository.

| Fixture         | Baseline                     |     Raw | Minified |   Gzip | Brotli | Modules | External |
| --------------- | ---------------------------- | ------: | -------: | -----: | -----: | ------: | -------- |
| `full-root`     | v2.9.0 release               | 691,775 |  329,900 | 78,034 | 63,681 |      86 | `fabric` |
| `public-api`    | v2.9.0 release               | 691,967 |  330,122 | 78,104 | 63,721 |      86 | `fabric` |
| `full-root`     | reviewed HEAD before Phase 1 | 691,775 |  329,900 | 78,034 | 63,681 |      86 | `fabric` |
| `public-api`    | reviewed HEAD before Phase 1 | 691,967 |  330,122 | 78,104 | 63,721 |      86 | `fabric` |
| `full-root`     | after Phase 1                | 691,775 |  329,900 | 78,034 | 63,681 |      86 | `fabric` |
| `public-api`    | after Phase 1                | 691,967 |  330,122 | 78,104 | 63,721 |      86 | `fabric` |
| `plugin-kernel` | after Phase 1                | 145,435 |   60,139 | 15,776 | 13,929 |      63 | none     |

The release and reviewed-HEAD measurements are byte-identical. Phase 1 adds zero bytes and zero modules to both package-root fixtures because the internal Kernel entry is not reachable from `src/index.ts`.

Committed inputs and budgets:

- `tests/bundle/baselines/v2.9.0.json`
- `tests/bundle/baselines/current.json`
- `tests/bundle/baselines/after-phase-1.json`
- `tests/bundle/budgets.json`

Active fixtures allow 5% regression headroom. The check reports fixture, current, baseline delta, and budget failures without updating baselines. Baseline writes require an explicit `--update <name>`.

## Import graph

The TypeScript-resolved graph includes static imports, re-exports, dynamic imports, and import types. Relative `.js` source specifiers and tsconfig aliases use TypeScript's resolver.

| Graph                | Source files | Imports | Root-reachable modules | Cycles |
| -------------------- | -----------: | ------: | ---------------------: | -----: |
| v2.9.0/reviewed HEAD |           89 |     407 |                     88 |      0 |
| After Phase 1        |          105 |     470 |                     88 |      0 |

The package root reaches History, Transform, Mask, Crop, Mosaic, Filters, Annotation, and DOM bindings. Fabric is reachable but external. The after-Phase-1 Kernel entry reaches 16 source modules, all under `src/plugin-kernel`; it reaches no existing Core or feature source. The root still reaches 88 modules and does not reach the Kernel.

Machine-readable reports:

- `tests/bundle/baselines/import-graph-v2.9.0.json`
- `tests/bundle/baselines/import-graph-current.json`
- `tests/bundle/baselines/import-graph-after-phase-1.json`

## Architecture gate

`scripts/check-architecture.mjs` fails with source file, forbidden import, rule, and suggested dependency direction. It enforces:

- `src/plugin-kernel/**` may not import any other `src/**` boundary or Fabric.
- `src/core/**` may not import feature/plugin directories, filter implementation, Transform controller, overlay-state implementation, or DOM controls.
- `src/index.ts` may not import the internal Plugin Kernel entry.
- The `plugin-kernel` bundle fixture may not import the full package root.

The bundle check also rejects the required business-symbol list in the Kernel fixture. The Phase 1 graph has zero architecture violations and zero cycles.

## Existing reusable infrastructure decision

- `src/core/operation-guard.ts` is tied to the current facade's loading/animation semantics, so the Kernel operation registry does not import it.
- `src/tool-mode/tool-mode-policy.ts` uses closed feature unions and hard-coded feature IDs, so the Kernel tool coordinator is independent and open-string based.
- `src/overlay/overlay-custom-registry.ts` is a module-global feature registry, so it is not reused by the instance-local Kernel.
- No reusable committed-observation EventBus existed.
- `semver` existed only transitively; Phase 1 declares it directly because capability negotiation is a runtime contract.

## Public API baseline

The full inventory is in [public-api-v2.9.0.md](./public-api-v2.9.0.md). Package-root exports, constructor forms, 92 public instance methods, options, callbacks, Snapshot entry points, overlay-state entry points, export entry points, DOM `ElementMap`, deprecated API, ESM/CJS entries, and the UMD global are frozen there.

## v2.9.0 behavior coverage

| Contract                                               | Existing regression coverage                                                                                                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Binding defaults off                                   | `overlay-transform-binding.test.mjs`: “default options leave masks and annotations fixed…”; `flip-transform.test.mjs`: “default-off flips…”                         |
| Mask and Annotation binding independently configurable | Mask-only coverage in “all built-in mask shapes…” and Label tests; Annotation-only coverage in mirrored/readable Text tests; option normalization property coverage |
| Text `preserve-readable`                               | `overlay-transform-binding.test.mjs`: “readable text follows full image position without receiving reflection”                                                      |
| Text `mirror`                                          | `overlay-transform-binding.test.mjs`: “mirrored text, shape, line, arrow, and draw annotations…”                                                                    |
| Final-snap, once-only Overlay synchronization          | `reset-transform.property.test.mjs`: “exactly one final overlay delta” and “synchronizes overlay session state only once”                                           |
| Object identity and complete projection                | Built-in Mask and Annotation transform-binding sequence tests plus `overlay-transform-delta.test.mjs` mixed affine/reflection tests                                 |
| ActiveSelection discard                                | `overlay-transform-binding.test.mjs`: both ActiveSelection variants; `active-selection-discard.property.test.mjs` Snapshot coverage                                 |
| Mask Label post-sync                                   | `overlay-transform-binding.test.mjs`: “mask labels are session objects synchronized after…”                                                                         |
| Per-object warning isolation                           | `overlay-transform-binding.test.mjs`: “one malformed overlay does not block later bound overlays”                                                                   |
| Transform failure rollback                             | `reset-transform.property.test.mjs`: scale, rotate, and flip failure rollback tests                                                                                 |
| Reset is one History entry                             | `reset-transform.property.test.mjs`: “resetImageTransform produces exactly one history entry”                                                                       |
| Crop preservation remains independent                  | `post-crop-mask-preservation.property.test.mjs` and the later-transform binding coverage for preserved masks                                                        |
| Overlay-state schema unchanged                         | `overlay-state-validation.test.mjs` schema-v1 acceptance and `overlay-transform-binding.test.mjs` export/import projection test                                     |

No existing assertion was weakened or updated. The coverage audit found no Phase 0 gap requiring a business-implementation change.

## Known baseline debt

- The package root statically reaches every feature; this is the v2.9.0 compatibility baseline.
- Existing `src/core/public-types.ts` and `src/core/state-serializer.ts` contain feature-specific Mask/Annotation/Snapshot knowledge. The Phase 1 boundary is isolated in `src/plugin-kernel` rather than moving that debt.
- Existing tool and operation types are closed feature lists.
- Existing overlay custom registration uses module-global state.
- The current CI runs all browser projects but has no separate visual snapshot step; Phase 0–1 preserves that policy and adds its gates through `npm run ci`.

## Pending budgets

No numeric values are claimed for `core-only`, `core-transform`, `core-mask`, `core-transform-mask`, `minimal-preset`, `redaction-preset`, `annotation-preset`, or `full-preset`. They are explicitly `pending` in `tests/bundle/budgets.json` until the corresponding later-phase static entries exist.
