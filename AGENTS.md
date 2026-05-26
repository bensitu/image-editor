# AGENTS.md

Universal instructions for AI coding agents. Merge with project-specific commands and conventions as needed.

## Core principles

- Think first. State assumptions, clarify ambiguity, and surface tradeoffs before editing.
- Keep it simple. Implement the smallest solution that solves the requested problem.
- Change surgically. Touch only files and lines directly related to the task.
- Verify by goals. Define success criteria, run relevant checks, and fix failures before finishing.

## Project commands

Replace these examples with the commands used by this repository.

- Install dependencies: `npm install`
- Run local development/watch mode: `npm run dev`
- Run tests: `npm test`
- Run type checks: `npm run build:types`
- Build: `npm run build`

## Before coding

- Read the relevant files first; do not guess from filenames alone.
- If requirements conflict, stop and explain the conflict.
- If the task is large, write a short plan with steps and verification.
- Prefer fixing the root cause over adding workarounds.

## Change rules

- Do not add features, abstractions, dependencies, or configuration unless required.
- Do not refactor unrelated code, reformat whole files, or rename things opportunistically.
- Match the existing style, patterns, naming, and architecture.
- Remove only unused code introduced by your own change.
- Mention unrelated problems separately instead of fixing them silently.

## Testing and verification

- Add or update tests when changing behavior.
- For bugs, reproduce the issue with a failing test or clear verification step before fixing when practical.
- Run the smallest relevant check first, then broader checks if needed.
- If a check cannot be run, explain why and describe what was verified instead.

## Safety

- Never expose secrets, tokens, credentials, or private data.
- Do not weaken authentication, authorization, encryption, validation, or logging.
- Do not run destructive commands or rewrite history unless explicitly requested.
- Preserve public APIs and backward compatibility unless the task says otherwise.

## Final response

- Summarize what changed and why.
- List tests/checks run and their results.
- Call out remaining risks, follow-ups, or skipped checks.
