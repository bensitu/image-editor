/**
 * Own-property copying helpers for user-provided config objects.
 *
 * @module
 */
export declare function canCopySafeObjectKey(key: string): boolean;
export declare function copySafeOwnProperties<T extends object>(value: unknown): Partial<T>;
