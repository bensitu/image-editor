export interface PluginTestFabric<TModule extends object> {
    readonly module: TModule;
    assertUnchanged(): void;
}

function descriptorMatches(
    left: PropertyDescriptor | undefined,
    right: PropertyDescriptor | undefined,
): boolean {
    if (!left || !right) return left === right;
    return (
        left.configurable === right.configurable &&
        left.enumerable === right.enumerable &&
        left.writable === right.writable &&
        left.value === right.value &&
        left.get === right.get &&
        left.set === right.set
    );
}

/** Captures the Fabric namespace surface and detects direct global mutation. */
export function createPluginTestFabric<TModule extends object>(
    module: TModule,
): PluginTestFabric<TModule> {
    const keys = Reflect.ownKeys(module);
    const descriptors = new Map(
        keys.map((key) => [key, Object.getOwnPropertyDescriptor(module, key)] as const),
    );

    return Object.freeze({
        module,
        assertUnchanged(): void {
            const currentKeys = Reflect.ownKeys(module);
            const sameKeys =
                currentKeys.length === keys.length &&
                currentKeys.every((key, index) => key === keys[index]);
            const sameDescriptors = keys.every((key) =>
                descriptorMatches(
                    descriptors.get(key),
                    Object.getOwnPropertyDescriptor(module, key),
                ),
            );
            if (!sameKeys || !sameDescriptors) {
                throw new Error('Fabric namespace changed during the Plugin test.');
            }
        },
    });
}
