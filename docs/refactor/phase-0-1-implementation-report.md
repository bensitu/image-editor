# Phase 0–1 implementation report

## Scope completed

This change implements only WP-01 (Baseline) and WP-02 (Plugin Kernel) from the v2.9.0 detailed proposal.

No existing Transform, Mask, History, Crop, Mosaic, Filter, Annotation, Overlay-state, DOM control, controller, action, service, manager, Snapshot, or export implementation was moved or converted into a plugin.

## Files and artifacts

### Kernel source

`src/plugin-kernel` contains:

- capability token/registry and SemVer helpers;
- committed EventBus;
- composed-plugin helper;
- disposable and RegistrationScope primitives;
- structured errors and reporting sinks;
- operation registry;
- PluginManager, PluginRef, plugin contracts, and lifecycle contexts;
- plugin-private state store;
- tool coordinator;
- internal barrel used by build/test fixtures only.

The normal TypeScript build emits corresponding internal files under `dist/esm/plugin-kernel` and `dist/types/plugin-kernel`. They are not referenced by `package.json#exports`.

### Phase 0 scripts and fixtures

- `scripts/check-architecture.mjs`
- `scripts/check-bundle-size.mjs`
- focused-root support in `scripts/run-node-tests.mjs`
- `tests/bundle/fixtures/{full-root,public-api,plugin-kernel}`
- `tests/bundle/baselines/*.json`
- `tests/bundle/budgets.json`
- `tests/bundle/README.md`

### Tests

- `tests/plugin-kernel/*.test.mjs`: 39 contract tests.
- `tests/types/plugin-kernel.test.ts`: inference, readonly branding, unsafe lookup rejection, token/ref separation, and composed API tuple inference.
- `tests/types/tsconfig.json`: isolated strict compile fixture.

### Documentation

- `docs/refactor/baseline.md`
- `docs/refactor/public-api-v2.9.0.md`
- `docs/refactor/plugin-kernel.md`
- this report.

## Design decisions

1. **Independent boundary:** `src/plugin-kernel` is used instead of nesting under legacy `src/core`, whose public types and serializer contain feature-specific baseline debt.
2. **No legacy wiring:** Phase 1 uses a standalone `PluginManager` host. This avoids changing synchronous Full Facade lifecycle behavior and is explicitly allowed by the implementation prompt.
3. **Always-async install:** `PluginManager.install()` returns `Promise<TApi>`. This represents async setup honestly and avoids a forced sync facade or unsafe assertion.
4. **Branded, invariant refs/tokens:** Phantom types provide compile-time inference and runtime brands reject structurally fabricated definitions. Plugin lookup additionally checks ref object identity.
5. **Strict composed reuse:** `ensure` requires the same ref object, API version, and implementation version. This is intentionally safer than a guessed compatibility range where the proposal defines none.
6. **Atomic registration scope:** Providers remain provisional until scope commit. All setup registrations, plugin state, and newly installed composed dependencies are rolled back in reverse order.
7. **Observation-only events:** The EventBus is named `emitCommitted` and contains no transaction API.
8. **SemVer policy:** Mature `semver` is a direct runtime dependency. Prerelease matching uses its default explicit-prerelease policy.
9. **No bundle output directory:** Fixture bundles are generated in memory. Baseline JSON stores stable normalized module paths, not random temporary paths.
10. **Measured budgets:** Active fixtures use measured values plus 5% headroom. Future static entries remain `pending` without fabricated numbers.

## Baseline and bundle result

The isolated v2.9.0 release worktree and the reviewed starting HEAD produced identical consumer bundles.

| Fixture         |     Raw | Minified |   Gzip | Brotli | Modules |        Phase 1 delta |
| --------------- | ------: | -------: | -----: | -----: | ------: | -------------------: |
| `full-root`     | 691,775 |  329,900 | 78,034 | 63,681 |      86 |      0 B / 0 modules |
| `public-api`    | 691,967 |  330,122 | 78,104 | 63,721 |      86 |      0 B / 0 modules |
| `plugin-kernel` | 145,435 |   60,139 | 15,776 | 13,929 |      63 | new internal fixture |

Fabric remains external for root fixtures. The Kernel fixture has no external renderer dependency and passes the forbidden-symbol check.

## Architecture result

- Before Phase 1: 89 source files, 407 imports, 88 root-reachable modules, zero cycles.
- After Phase 1: 105 source files, 470 imports, the same 88 root-reachable modules, zero cycles.
- Kernel entry: 16 reachable source modules; zero imports outside `src/plugin-kernel`.
- New architecture violations: zero.
- Root feature reachability is unchanged and still includes all current business features by design.

Existing semantic Core debt is documented rather than migrated. The gate blocks new direct Core-to-feature imports and strictly protects the new Kernel boundary.

## Validation result

| Command                      | Result | Notes                                     |
| ---------------------------- | ------ | ----------------------------------------- |
| `npm run build`              | Pass   | ESM, CJS, declarations, and UMD generated |
| `npm run typecheck`          | Pass   | strict project compile                    |
| `npm run lint`               | Pass   | zero warnings                             |
| `npm run format:check`       | Pass   | repository formatting gate                |
| `npm test`                   | Pass   | 656/656 (617 existing + 39 Kernel)        |
| `npm run test:plugin-kernel` | Pass   | 39/39 focused contracts                   |
| `npm run test:types`         | Pass   | PluginRef/composition inference fixture   |
| `npm run check:architecture` | Pass   | zero violations, zero cycles              |
| `npm run check:bundle-size`  | Pass   | all active budgets and Kernel symbol gate |
| `npm run package:check`      | Pass   | package metadata/artifacts                |
| `npm run release:gate`       | Pass   | existing release artifact gate            |
| `npm run test:e2e:all`       | Pass   | 51/51 across Chromium, Firefox, WebKit    |
| `npm run test:visual`        | Pass   | 4/4 Chromium snapshots                    |

## Dependencies

- Runtime: `semver` for correct SemVer and range negotiation.
- Development: `@types/semver` for strict declarations.
- Development: `@rollup/plugin-commonjs` so the internal consumer fixture bundles `semver` rather than falsely treating it as external.

`npm install` reported zero known vulnerabilities at installation time.

## Compatibility

- Full Facade implementation: unchanged.
- Package root exports: unchanged.
- `package.json#exports`: unchanged and still root-only.
- Public constructor/method/options contracts: unchanged.
- Snapshot format and behavior: unchanged.
- Overlay-state schema/version/coordinates: unchanged.
- Transform Binding and Undo/Redo behavior: unchanged.
- Existing business code migration: none.

## Deviations from the proposal examples

- The Kernel lives at `src/plugin-kernel`, not `src/core/plugin-kernel`, to avoid placing a clean boundary inside legacy Core debt.
- The legacy editor is not wired to the Kernel in Phase 1. The prompt permits this standalone-host option when lifecycle wiring would risk Full Facade behavior.
- Installation is consistently async instead of conditionally `TApi | Promise<TApi>`.
- Composed dependency reuse requires exact implementation/API versions and ref identity because no separate plugin compatibility range exists in Phase 1.
- The current public root and public-api fixtures are retained alongside the internal Kernel fixture; later `core-*` and preset fixtures remain pending.

## Remaining risks and Phase 2 prerequisites

- The Kernel has not yet been exercised by a real feature plugin; that is intentionally outside Phase 1.
- Real Core integration must define host-owned capability ports before feature migration.
- Phase 2 must independently validate Memento and Geometry transaction ordering; EventBus must remain observation-only.
- A future public Kernel/Core entry needs packaging, ESM/CJS declarations, package-entry tests, and explicit export-map review; Phase 1 makes no such compatibility promise.
