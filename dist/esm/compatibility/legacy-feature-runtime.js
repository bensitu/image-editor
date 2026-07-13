export function createLegacyFeatureCompatibilityPort() {
    let attached = false;
    return Object.freeze({
        get attached() {
            return attached;
        },
        attach() {
            attached = true;
        },
        dispose() {
            attached = false;
        },
    });
}
//# sourceMappingURL=legacy-feature-runtime.js.map