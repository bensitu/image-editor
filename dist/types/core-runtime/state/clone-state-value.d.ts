/**
 * Clones and freezes Plugin state while rejecting dangerous keys and unsafe shared references.
 *
 * @module
 */
/** Creates an alias-free state value without using JSON as a fake deep clone. */
export declare function cloneStateValue<T>(value: T): T;
/** Verifies that a value is safe to retain by reference in a trusted Memento. */
export declare function assertSafeImmutableReference(value: unknown, path?: string, seen?: WeakSet<object>): void;
export declare function isDangerousStateKey(key: string): boolean;
