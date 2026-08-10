export const OFFICIAL_PLUGIN_PACKAGE_HINTS = Object.freeze([
    Object.freeze({
        pluginId: 'foundation:overlay',
        packageName: '@bensitu/image-editor/plugins/overlay',
    }),
    Object.freeze({
        pluginId: 'foundation:annotation',
        packageName: '@bensitu/image-editor/plugins/annotation',
    }),
    Object.freeze({
        pluginId: 'plugin:transform',
        packageName: '@bensitu/image-editor/plugins/transform',
    }),
    Object.freeze({
        pluginId: 'plugin:mask',
        packageName: '@bensitu/image-editor/plugins/mask',
    }),
    Object.freeze({
        pluginId: 'plugin:history',
        packageName: '@bensitu/image-editor/plugins/history',
    }),
    Object.freeze({
        pluginId: 'plugin:filters',
        packageName: '@bensitu/image-editor/plugins/filters',
    }),
    Object.freeze({
        pluginId: 'plugin:crop',
        packageName: '@bensitu/image-editor/plugins/crop',
    }),
    Object.freeze({
        pluginId: 'plugin:mosaic',
        packageName: '@bensitu/image-editor/plugins/mosaic',
    }),
    Object.freeze({
        pluginId: 'annotation:text',
        packageName: '@bensitu/image-editor/plugins/annotation-text',
    }),
    Object.freeze({
        pluginId: 'annotation:shape',
        packageName: '@bensitu/image-editor/plugins/annotation-shape',
    }),
    Object.freeze({
        pluginId: 'annotation:draw',
        packageName: '@bensitu/image-editor/plugins/annotation-draw',
    }),
    Object.freeze({
        pluginId: 'plugin:overlay-state',
        packageName: '@bensitu/image-editor/plugins/overlay-state',
    }),
    Object.freeze({
        pluginId: 'plugin:dom-controls',
        packageName: '@bensitu/image-editor/plugins/dom-controls',
    }),
    Object.freeze({
        pluginId: 'plugin:canvas-interactions',
        packageName: '@bensitu/image-editor/plugins/canvas-interactions',
    }),
]);
const packageHintsByPluginId = new Map(OFFICIAL_PLUGIN_PACKAGE_HINTS.map(({ pluginId, packageName }) => [pluginId, packageName]));
export function getOfficialPluginPackageHint(pluginId) {
    return packageHintsByPluginId.get(pluginId);
}
//# sourceMappingURL=official-plugin-package-hints.js.map