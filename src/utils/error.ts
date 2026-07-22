/**
 * Provides side-effect-safe predicates for errors received across JavaScript realms.
 *
 * @module
 */

/** Checks an Error-like name without assuming a local-realm Error instance. */
export function hasErrorName(error: unknown, expectedName: string): boolean {
    if ((typeof error !== 'object' && typeof error !== 'function') || error === null) {
        return false;
    }
    try {
        return Reflect.get(error, 'name') === expectedName;
    } catch {
        return false;
    }
}
