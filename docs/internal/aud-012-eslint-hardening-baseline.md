# AUD-012 ESLint Hardening Baseline

The baseline covered every tracked TypeScript-family file matched by
`**/*.{ts,tsx,mts,cts}`. It was run one rule at a time before changing configuration.

| Rule                                  | Baseline violations | Classification                                                                                                     | Post-remediation |
| ------------------------------------- | ------------------: | ------------------------------------------------------------------------------------------------------------------ | ---------------: |
| `@typescript-eslint/only-throw-error` |                   5 | Stored `unknown` values crossing mutation, operation suspension, Tool disposal, and conformance cleanup boundaries |                0 |
| `@typescript-eslint/no-unsafe-return` |                   8 | Three dynamic `Proxy`/`Reflect` boundaries and five Fabric.js array/serialization type boundaries                  |                0 |

## Remediation

- Non-Error thrown values are normalized once at stored/replayed error boundaries while retaining
  the original value as `cause`.
- Existing Error identity is preserved.
- Dynamic `Reflect` results are narrowed to `unknown`; constructor results are checked as
  Proxy-compatible objects.
- Fabric serialization results are validated before return.
- Fabric polygon and dash-array inputs are rebuilt from `unknown` entries through numeric
  validation.
- The browser harness reads custom Fabric metadata through an `unknown` reflection boundary.

Both rules are now normal error-level repository gates in `eslint.config.js`. No `any`,
TypeScript suppression, ESLint suppression, or compatibility cast was added to satisfy them.

## Commands

```text
npx eslint "**/*.{ts,tsx,mts,cts}" --rule "@typescript-eslint/only-throw-error:error"
npx eslint "**/*.{ts,tsx,mts,cts}" --rule "@typescript-eslint/no-unsafe-return:error"
npm run lint
```

The remaining disabled unsafe rules require their own baselines. They were not enabled as part of
AUD-012 because this finding explicitly prioritized only these two rules.
