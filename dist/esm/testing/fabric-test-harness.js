function descriptorMatches(left, right) {
    if (!left || !right)
        return left === right;
    return (left.configurable === right.configurable &&
        left.enumerable === right.enumerable &&
        left.writable === right.writable &&
        left.value === right.value &&
        left.get === right.get &&
        left.set === right.set);
}
export function createPluginTestFabric(module) {
    const keys = Reflect.ownKeys(module);
    const descriptors = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(module, key)]));
    return Object.freeze({
        module,
        assertUnchanged() {
            const currentKeys = Reflect.ownKeys(module);
            const sameKeys = currentKeys.length === keys.length &&
                currentKeys.every((key, index) => key === keys[index]);
            const sameDescriptors = keys.every((key) => descriptorMatches(descriptors.get(key), Object.getOwnPropertyDescriptor(module, key)));
            if (!sameKeys || !sameDescriptors) {
                throw new Error('Fabric namespace changed during the Plugin test.');
            }
        },
    });
}
//# sourceMappingURL=fabric-test-harness.js.map