const registry = new Map();
export function registerOverlaySerializer(customType, entry) {
    registry.set(customType, entry);
}
export function getOverlaySerializer(customType) {
    return registry.get(customType);
}
//# sourceMappingURL=overlay-custom-registry.js.map