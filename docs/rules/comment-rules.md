# Comment Rules

## General Principles

Comments should explain intent, constraints, edge cases, public usage, and non-obvious implementation decisions. Do not write comments that merely repeat the code.

Use documentation comments for API-level documentation and ordinary line comments for implementation details.

## Documentation Comments

Use TSDoc/JSDoc-style comments (`/** ... */`) for:

- exported classes
- exported functions
- exported interfaces and types
- public methods
- public options and callbacks
- complex configuration objects
- behavior that is not obvious from the name and type signature

Prefer TSDoc-compatible tags:

- `@remarks`
- `@param`
- `@returns`
- `@example`
- `@deprecated`
- `@throws`
- `@see`
- `@typeParam`
- `@internal`

Do not include TypeScript types inside `@param` or `@returns` descriptions in `.ts` files.

## Implementation Comments

Use `//` comments for implementation details, such as:

- non-obvious algorithm steps
- browser or library workarounds
- compatibility constraints
- performance-sensitive decisions
- state synchronization order
- intentional deviations from normal behavior

Avoid block comments (`/* ... */`) for normal implementation notes. Prefer consecutive `//` lines for multi-line implementation comments.

## Bad Comments

Avoid comments that:

- repeat the function or variable name
- describe obvious code
- contain stale information
- explain code that should instead be renamed or refactored
- duplicate TypeScript type information
- leave TODO/FIXME without context
- suppress TypeScript or ESLint errors without explanation

## TODO / FIXME

Use TODO/FIXME only when the follow-up is specific and actionable.

Recommended format:

`// TODO: Explain the concrete follow-up and why it is not done now.`
`// FIXME: Explain the current defect, trigger condition, and expected fix.`

## TypeScript Suppression Comments

Avoid `@ts-ignore`, `@ts-expect-error`, and `@ts-nocheck`.

If a suppression is unavoidable, prefer `@ts-expect-error` with a specific explanation.

Example:

`// @ts-expect-error Intentionally passes invalid input to verify runtime validation.`
