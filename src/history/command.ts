/**
 * Re-export shim for the {@link Command} class.
 *
 * The class itself is defined alongside {@link HistoryManager} in
 * `./history-manager.ts` so the history module can be loaded directly
 * from source by property tests running under Node's type-stripping
 * mode without needing to resolve a sibling `.js` specifier at runtime.
 *
 * Module-layout consumers — and the canonical Module Responsibilities
 * table — continue to see `command.ts` as the named home of the
 * `Command` primitive.
 *
 * @module
 */

export { Command } from './history-port.js';
