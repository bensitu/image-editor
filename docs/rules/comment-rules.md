# Comment Rules

Comment conventions for the TypeScript codebase.  
Comments should explain current intent, constraints, invariants, edge cases, and non-obvious decisions.

Do not use comments to narrate repository history, version transitions, or implementation phases.

## 1. Core principles

Write comments only when they add information that the code and names cannot express clearly.

Comments should explain:

- intent;
- ownership;
- invariants;
- lifecycle constraints;
- transaction boundaries;
- ordering requirements;
- rollback behavior;
- concurrency rules;
- security limits;
- platform or library constraints;
- non-obvious algorithmic decisions;
- public usage.

Do not write comments that:

- repeat the code;
- restate a function or variable name;
- duplicate TypeScript types;
- describe obvious control flow;
- preserve stale implementation history;
- compare old and new implementations;
- explain code that should instead be renamed or simplified.

## 2. Documentation comments

Use TSDoc/JSDoc-style comments (`/** ... */`) for:

- exported classes;
- exported functions;
- exported interfaces and types;
- public methods;
- public properties;
- public options;
- public callbacks;
- public events;
- public errors;
- complex extension contracts;
- behavior that is not obvious from the signature.

Example:

```ts
/**
 * Installs the supplied Plugin definitions as one atomic batch.
 *
 * @remarks
 * Dependencies are resolved before setup starts. If setup fails, every
 * registration created by the current batch is disposed in reverse order.
 *
 * @param plugins - Plugin definitions to install.
 * @returns The installed Plugin APIs.
 * @throws {@link PluginDependencyError} When a required dependency is missing.
 * @throws {@link PluginBatchInstallError} When batch setup or rollback fails.
 */
function installPlugins(plugins: readonly EditorPlugin<unknown>[]): readonly unknown[] {}
```

Do not include TypeScript types inside `@param` or `@returns` text.

## 3. Preferred TSDoc tags

Use only tags that add useful contract information.

- `@remarks`
- `@param`
- `@returns`
- `@throws`
- `@example`
- `@typeParam`
- `@see`
- `@internal`
- `@deprecated`

Do not add empty or repetitive tags.

Bad:

```ts
/**
 * Gets the Plugin.
 *
 * @returns The Plugin.
 */
getPlugin() {}
```

Good:

```ts
/**
 * Returns the installed API for the supplied Plugin reference.
 *
 * @returns The Plugin API, or `null` when the Plugin is not installed.
 */
getPlugin<TApi>(
    ref: PluginRef<TApi>,
): TApi | null {}
```

## 4. Implementation comments

Use `//` comments for implementation details.

Good subjects include:

- why a check occurs before mutation;
- why cleanup runs in reverse order;
- why a late async result is ignored;
- why one participant owns History publication;
- why an external library workaround is required;
- why a security budget uses a specific boundary;
- why a branch intentionally does not emit an event.

Examples:

```ts
// Validate every manifest before setup so a rejected batch has no side effects.
validatePluginManifests(plugins);

// Only the top-level transaction owns History and committed-event publication.
if (context.historyOwner === 'self') {
    commitHistoryRecord(record);
}

// Ignore decoded results that no longer own the active request sequence.
if (requestSequence !== activeRequestSequence) {
    return;
}
```

Prefer consecutive `//` comments over `/* ... */` for normal implementation notes.

## 5. Comments must describe the current design

Do not use version or history narration in active code comments.

Avoid:

```ts
// Replaces the old runtime.
// The new implementation uses the Plugin SDK.
// Kept for compatibility with the previous version.
// Temporary v3 path.
```

Use current responsibility and removal condition instead:

```ts
// Adapts the public read port to the internal state record.
// Remove after every caller consumes the read port directly.
```

A temporary comment must identify:

- the exact temporary responsibility;
- the deletion condition;
- the blocking dependency.

Do not describe the temporary code only as “legacy,” “compatibility,” or “old.”

## 6. Platform and library constraints

Comments may explain constraints imposed by:

- browsers;
- Node.js;
- TypeScript;
- package resolution;
- Fabric;
- wire formats;
- external APIs;
- operating systems;
- performance limits.

Example:

```ts
// NodeNext resolves declaration imports using the emitted public subpath.
```

Do not describe repository-history compatibility.

## 7. Ownership and transaction comments

Add comments where ownership is not obvious.

Important ownership subjects include:

- Canvas ownership;
- Base Image ownership;
- Operation ownership;
- transaction ownership;
- History ownership;
- event publication ownership;
- registration disposal ownership;
- cancellation ownership;
- fault recovery ownership.

Example:

```ts
// The batch owns only registrations created after this checkpoint.
const checkpoint = registrationScope.createCheckpoint();
```

Do not add ownership comments when the type or field name already makes the rule obvious.

## 8. Security comments

Security-sensitive checks should explain:

- the protected boundary;
- the failure mode;
- why the limit exists;
- whether the check is complete or best-effort.

Example:

```ts
// Reject the source before decoding so compressed input cannot bypass the pixel budget.
validateImageSource(source);
```

For best-effort checks, state the limitation clearly.

```ts
// Best-effort detection only; dynamic property writes require runtime conformance checks.
```

Do not claim that permissions or lint rules form a security sandbox.

## 9. TODO and FIXME

Use TODO/FIXME only when the follow-up is concrete and actionable.

Recommended formats:

```ts
// TODO: Move this registration to the public port after the Overlay contract is published.
// FIXME: A failed decoder can leave the timeout active; clear it in every exit path.
```

A TODO/FIXME should include:

- the specific follow-up;
- why it is not completed now;
- the condition or dependency that unlocks it.

Avoid:

```ts
// TODO: Clean this up.
// FIXME: Fix later.
```

Do not use TODO/FIXME to record project phases or milestone numbers.

## 10. Deprecated APIs

Use `@deprecated` only for an API that:

- has been publicly released;
- has a clear supported replacement;
- has a documented removal policy.

Example:

```ts
/**
 * @deprecated Use {@link install} with a Plugin Plan.
 */
useAll(
    plugins: readonly EditorPlugin<unknown>[],
): void {}
```

Do not add `@deprecated` merely to describe temporary internal code or an unpublished transition.

Internal temporary code should use a precise implementation comment instead.

## 11. TypeScript suppression comments

Avoid:

- `@ts-ignore`;
- `@ts-nocheck`;
- unexplained `@ts-expect-error`;
- unexplained ESLint suppression.

Production code should not normally require TypeScript suppression.

Type-level negative tests may use `@ts-expect-error` when the comment states the exact contract being verified.

```ts
// @ts-expect-error A reference for another API must not satisfy this lookup.
editor.requirePlugin(unrelatedPluginRef);
```

An ESLint suppression must:

- use the narrowest rule;
- apply to the smallest scope;
- explain why the rule does not apply;
- describe the safe invariant.

Do not disable an entire file unless no narrower option exists.

## 12. Examples in comments

Use examples when they clarify public usage or a non-obvious contract.

Examples should:

- use public APIs;
- compile where practical;
- avoid internal imports;
- avoid type casts used only to force an example to pass;
- follow the repository naming rules;
- avoid version-labelled identifiers.

Keep examples short and focused.

## 13. Error documentation

Document public errors when callers need to distinguish recovery behavior.

Explain:

- when the error is thrown;
- whether state changed;
- whether retry is safe;
- whether cleanup or reset is required.

Example:

```ts
/**
 * Thrown when setup fails after one or more registrations were created.
 *
 * @remarks
 * The current installation batch is rolled back before the error is exposed.
 * Previously installed Plugins remain active.
 */
class PluginBatchInstallError extends Error {}
```

Do not expose private file paths or internal class names in public error documentation.

## 14. Comment maintenance

When changing behavior:

- update or remove affected comments;
- remove comments for deleted constraints;
- verify examples still match the public API;
- ensure `@throws` matches actual errors;
- ensure TODO/FIXME remains valid;
- remove comments that became obvious after renaming or restructuring.

A stale comment is a defect.

## 15. Scope

Apply these rules to:

- production source;
- tests;
- examples;
- public declarations;
- generated declaration comments owned by the repository.

Do not add comments solely to increase documentation coverage.

Public APIs should be documented. Internal code should be commented only where the behavior is not self-explanatory.
