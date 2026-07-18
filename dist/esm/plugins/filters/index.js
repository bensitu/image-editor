import { BASE_IMAGE_READ_CAPABILITY, CANVAS_READ_CAPABILITY, CORE_DIAGNOSTICS_CAPABILITY, CORE_PRESENTATION_CAPABILITY, CORE_STATUS_CAPABILITY, DOCUMENT_MUTATION_CAPABILITY, EXPORT_CONTRIBUTION_CAPABILITY, FABRIC_RUNTIME_CAPABILITY, IMAGE_RESOURCE_POLICY_CAPABILITY, RASTER_MUTATION_CAPABILITY, RENDER_REQUEST_CAPABILITY, SNAPSHOT_REGISTRATION_CAPABILITY, VISIBLE_RASTER_BAKE_CAPABILITY, definePlugin, definePluginRef, } from '../../sdk/index.js';
import { FiltersController, } from './filters-controller.js';
export const filtersPluginRef = definePluginRef('@bensitu/filters', '1.0.0');
export function filtersPlugin(options = {}) {
    let controller = null;
    return definePlugin({
        ref: filtersPluginRef,
        manifest: {
            id: filtersPluginRef.id,
            version: '1.0.0',
            apiVersion: filtersPluginRef.apiVersion,
            engine: '^3.0.0',
            requires: [
                { token: CORE_STATUS_CAPABILITY, range: '^1.0.0' },
                { token: CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
                { token: CORE_PRESENTATION_CAPABILITY, range: '^1.0.0' },
                { token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                { token: CANVAS_READ_CAPABILITY, range: '^1.0.0' },
                { token: BASE_IMAGE_READ_CAPABILITY, range: '^1.0.0' },
                { token: IMAGE_RESOURCE_POLICY_CAPABILITY, range: '^1.0.0' },
                { token: RENDER_REQUEST_CAPABILITY, range: '^1.0.0' },
                { token: RASTER_MUTATION_CAPABILITY, range: '^1.0.0' },
                { token: SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' },
                { token: DOCUMENT_MUTATION_CAPABILITY, range: '^1.0.0' },
                { token: EXPORT_CONTRIBUTION_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: [
                'fabric:objects',
                'fabric:canvas-read',
                'core:raster-mutation',
                'core:export-contributor',
            ],
        },
        setupMode: 'sync',
        setup(context) {
            const status = context.capabilities.require(CORE_STATUS_CAPABILITY);
            const diagnostics = context.capabilities.require(CORE_DIAGNOSTICS_CAPABILITY);
            const presentation = context.capabilities.require(CORE_PRESENTATION_CAPABILITY);
            const fabricRuntime = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY);
            const canvas = context.capabilities.require(CANVAS_READ_CAPABILITY);
            const baseImage = context.capabilities.require(BASE_IMAGE_READ_CAPABILITY);
            const resourcePolicy = context.capabilities.require(IMAGE_RESOURCE_POLICY_CAPABILITY);
            const render = context.capabilities.require(RENDER_REQUEST_CAPABILITY);
            const raster = context.capabilities.require(RASTER_MUTATION_CAPABILITY);
            const snapshots = context.capabilities.require(SNAPSHOT_REGISTRATION_CAPABILITY);
            const mutations = context.capabilities.require(DOCUMENT_MUTATION_CAPABILITY);
            const exports = context.capabilities.require(EXPORT_CONTRIBUTION_CAPABILITY);
            for (const definition of [
                {
                    id: 'filters:preview',
                    mode: 'busy',
                    conflictDomains: ['base-image', 'export', 'state'],
                    reentrancy: 'replace',
                },
                {
                    id: 'filters:cancel-preview',
                    mode: 'busy',
                    conflictDomains: ['state'],
                    reentrancy: 'replace',
                },
                {
                    id: 'filters:commit',
                    mode: 'mutation',
                    conflictDomains: [
                        'document',
                        'base-image',
                        'geometry',
                        'raster',
                        'overlay',
                        'state',
                    ],
                    reentrancy: 'queue',
                },
                {
                    id: 'filters:clear',
                    mode: 'mutation',
                    conflictDomains: [
                        'document',
                        'base-image',
                        'geometry',
                        'raster',
                        'overlay',
                        'state',
                    ],
                    reentrancy: 'queue',
                },
                {
                    id: 'filters:bake',
                    mode: 'mutation',
                    conflictDomains: [
                        'document',
                        'base-image',
                        'geometry',
                        'raster',
                        'overlay',
                        'state',
                    ],
                    reentrancy: 'queue',
                },
                {
                    id: 'filters:configure',
                    mode: 'mutation',
                    conflictDomains: ['state'],
                    reentrancy: 'queue',
                },
            ]) {
                context.disposables.add(context.operations.register(definition));
            }
            controller = new FiltersController(Object.freeze({
                ...status,
                ...diagnostics,
                ...presentation,
                ...fabricRuntime,
                ...canvas,
                ...baseImage,
                ...resourcePolicy,
                ...render,
            }), Object.freeze({
                run: (operationId, task) => context.operations.run(operationId, undefined, (args, operationContext) => {
                    void args;
                    return task(operationContext.signal);
                }),
            }), mutations, raster, options);
            const requireController = () => {
                if (!controller)
                    throw new Error('Filters Plugin is not installed.');
                return controller;
            };
            const visibleRasterBake = Object.freeze({
                hasVisibleState: () => requireController().hasVisibleState(),
                bakeIntoBase: (parent, bakeOptions) => requireController().bakeIntoBase(parent, bakeOptions),
            });
            context.capabilities.provide(VISIBLE_RASTER_BAKE_CAPABILITY, visibleRasterBake, {
                version: VISIBLE_RASTER_BAKE_CAPABILITY.version,
            });
            context.disposables.add(snapshots.registerTransientObject(filtersPluginRef.id, (object) => { var _a; return (_a = controller === null || controller === void 0 ? void 0 : controller.ownsTransient(object)) !== null && _a !== void 0 ? _a : false; }));
            context.disposables.add(snapshots.registerSlice({
                id: filtersPluginRef.id,
                version: 1,
                capturePolicy: 'always',
                capture: () => requireController().captureState(),
                validate: (value) => requireController().validateState(value),
                restore: (state, restoreContext) => requireController().restoreState(state, restoreContext),
                clearState: () => requireController().clearState(),
            }));
            context.disposables.add(exports.register(filtersPluginRef.id, {
                id: 'filters:committed',
                order: -100,
                isEnabled: () => requireController().getState().filters.length > 0,
                render: ({ canvas: targetCanvas, options: exportOptions }) => requireController().renderExport(targetCanvas, exportOptions),
            }));
            context.disposables.add(context.events.on('geometry:committed', () => controller === null || controller === void 0 ? void 0 : controller.synchronizeAfterCommittedMutation()));
            context.disposables.add(context.events.on('document:committed', (descriptor) => {
                if (descriptor.operationId.startsWith('filters:'))
                    return;
                return controller === null || controller === void 0 ? void 0 : controller.synchronizeAfterCommittedMutation();
            }));
            return Object.freeze({
                get isPreviewing() {
                    return requireController().isPreviewing;
                },
                getState: () => requireController().getState(),
                preview: (definitions) => requireController().preview(definitions),
                commit: (definitions) => requireController().commit(definitions),
                cancelPreview: () => requireController().cancelPreview(),
                clear: () => requireController().clear(),
                bake: (bakeOptions) => requireController().bake(bakeOptions),
                configure: (patch) => requireController().configure(patch),
                getConfiguration: () => requireController().getConfiguration(),
                subscribe: (listener) => requireController().subscribe(listener),
            });
        },
        onImageCleared() {
            controller === null || controller === void 0 ? void 0 : controller.clearForImage();
        },
        onDispose() {
            controller === null || controller === void 0 ? void 0 : controller.dispose();
            controller = null;
        },
    });
}
export { MAX_SUPPORTED_FILTER_COUNT, SUPPORTED_FILTER_TYPES, areFilterDefinitionsEqual, normalizeFilterDefinitions, } from './filter-definitions.js';
export { FilterBakeValidationError, FilterDefinitionError, FilterImplementationError, FiltersPluginDisposedError, FiltersPreviewMissingError, } from './filters-errors.js';
//# sourceMappingURL=index.js.map