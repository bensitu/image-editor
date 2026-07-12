/** Creates an alias-free state value without using JSON as a fake deep clone. */
export declare function cloneStateValue<T>(value: T): T;
export declare function isDangerousStateKey(key: string): boolean;
