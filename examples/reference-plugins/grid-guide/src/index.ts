import type * as FabricNS from 'fabric';

import type { CoreEventMap } from '@bensitu/image-editor/core';
import {
    BASE_IMAGE_INFO_CAPABILITY,
    FABRIC_RUNTIME_CAPABILITY,
    definePlugin,
    definePluginRef,
    type ConfigurablePluginApi,
    type PluginSetupContext,
    type SynchronousEditorPlugin,
} from '@bensitu/image-editor/sdk';
import {
    OVERLAY_CAPABILITY,
    OVERLAY_REGISTRATION_CAPABILITY,
} from '@bensitu/image-editor/plugins/overlay';

export interface GridGuideConfiguration {
    readonly spacing: number;
    readonly gridColor: string;
    readonly guideColor: string;
    readonly strokeWidth: number;
}

export interface GridGuidePluginApi extends ConfigurablePluginApi<GridGuideConfiguration> {
    enable(): Promise<void>;
    disable(): Promise<void>;
    isEnabled(): boolean;
    addGuide(axis: 'horizontal' | 'vertical', position: number): Promise<string>;
    clearGuides(): Promise<void>;
    enterGuideTool(): Promise<void>;
    exitGuideTool(): Promise<void>;
    listGuideIds(): readonly string[];
}

export interface GridGuidePluginOptions {
    readonly configuration?: Partial<GridGuideConfiguration>;
}

type MarkedLine = FabricNS.Line & {
    referenceGridGuideKind?: 'grid' | 'guide';
    referenceGridGuideId?: string;
};

const gridKind = 'reference-grid-guide:grid';
const guideKind = 'reference-grid-guide:guide';
const guideToolId = 'reference-grid-guide:guide-tool';
const defaultConfiguration: GridGuideConfiguration = Object.freeze({
    spacing: 32,
    gridColor: 'rgba(64, 160, 255, 0.35)',
    guideColor: '#ff4d6d',
    strokeWidth: 1,
});

export const gridGuidePluginRef = definePluginRef<GridGuidePluginApi>(
    'reference:grid-guide',
    '1.0.0',
);

function validateConfiguration(value: GridGuideConfiguration): GridGuideConfiguration {
    if (
        !Number.isFinite(value.spacing) ||
        value.spacing <= 0 ||
        !Number.isFinite(value.strokeWidth) ||
        value.strokeWidth <= 0 ||
        typeof value.gridColor !== 'string' ||
        value.gridColor.length === 0 ||
        typeof value.guideColor !== 'string' ||
        value.guideColor.length === 0
    ) {
        throw new TypeError('Grid and guide configuration is invalid.');
    }
    return Object.freeze({ ...value });
}

function mark(line: FabricNS.Line, kind: 'grid' | 'guide', id: string): MarkedLine {
    const marked = line as MarkedLine;
    marked.referenceGridGuideKind = kind;
    marked.referenceGridGuideId = id;
    return marked;
}

function kindDefinition(kind: 'grid' | 'guide') {
    return Object.freeze({
        id: kind === 'grid' ? gridKind : guideKind,
        ownerPluginId: gridGuidePluginRef.id,
        classify: (object: FabricNS.FabricObject) =>
            (object as MarkedLine).referenceGridGuideKind === kind,
        getPersistentId: (object: FabricNS.FabricObject) =>
            (object as MarkedLine).referenceGridGuideId ?? null,
        persistence: Object.freeze({ mode: 'transient' as const }),
    });
}

export function createGridGuidePlugin(
    options: GridGuidePluginOptions = {},
): SynchronousEditorPlugin<GridGuidePluginApi, CoreEventMap> {
    let configuration = validateConfiguration({
        ...defaultConfiguration,
        ...options.configuration,
    });
    let gridIds: readonly string[] = Object.freeze([]);
    let guideIds: readonly string[] = Object.freeze([]);
    let objectCounter = 0;

    return definePlugin({
        ref: gridGuidePluginRef,
        manifest: {
            id: gridGuidePluginRef.id,
            version: '1.0.0',
            apiVersion: gridGuidePluginRef.apiVersion,
            engine: '^3.0.0',
            requires: [
                { token: BASE_IMAGE_INFO_CAPABILITY, range: '^1.0.0' },
                { token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                { token: OVERLAY_CAPABILITY, range: '^1.0.0' },
                { token: OVERLAY_REGISTRATION_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: ['fabric:objects', 'fabric:custom-class'],
        },
        setupMode: 'sync',
        setup(context: PluginSetupContext<CoreEventMap>) {
            const baseImage = context.capabilities.require(BASE_IMAGE_INFO_CAPABILITY);
            const fabric = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY).fabric;
            const overlay = context.capabilities.require(OVERLAY_CAPABILITY);
            const registration = context.capabilities.require(OVERLAY_REGISTRATION_CAPABILITY);
            context.disposables.add(registration.registerKind(kindDefinition('grid')));
            context.disposables.add(registration.registerKind(kindDefinition('guide')));
            context.tools.register({
                id: guideToolId,
                enter: () => undefined,
                exit: () => undefined,
                canRunOperation: (requestedOperationId) =>
                    requestedOperationId === 'overlay:transient',
            });

            const createLine = (
                points: [number, number, number, number],
                kind: 'grid' | 'guide',
                color: string,
            ): MarkedLine => {
                const id = `${kind}-${++objectCounter}`;
                return mark(
                    new fabric.Line(points, {
                        stroke: color,
                        strokeWidth: configuration.strokeWidth,
                        selectable: kind === 'guide',
                        evented: kind === 'guide',
                        excludeFromExport: true,
                    }),
                    kind,
                    id,
                );
            };

            const createGrid = (): readonly MarkedLine[] => {
                const size = baseImage.getCanvasSize();
                const lines: MarkedLine[] = [];
                for (let x = configuration.spacing; x < size.width; x += configuration.spacing) {
                    lines.push(createLine([x, 0, x, size.height], 'grid', configuration.gridColor));
                }
                for (let y = configuration.spacing; y < size.height; y += configuration.spacing) {
                    lines.push(createLine([0, y, size.width, y], 'grid', configuration.gridColor));
                }
                return Object.freeze(lines);
            };

            const replaceGrid = async (next: readonly MarkedLine[]): Promise<void> => {
                await overlay.replaceTransient(gridIds, next);
                gridIds = Object.freeze(next.map((line) => line.referenceGridGuideId!));
            };

            const api: GridGuidePluginApi = {
                enable: () => replaceGrid(createGrid()),
                disable: () => replaceGrid([]),
                isEnabled: () => gridIds.length > 0,
                async addGuide(axis, position) {
                    if (!Number.isFinite(position) || position < 0) {
                        throw new RangeError(
                            'Guide position must be a non-negative finite number.',
                        );
                    }
                    const size = baseImage.getCanvasSize();
                    const points: [number, number, number, number] =
                        axis === 'horizontal'
                            ? [0, position, size.width, position]
                            : [position, 0, position, size.height];
                    const guide = createLine(points, 'guide', configuration.guideColor);
                    await overlay.addTransient([guide]);
                    guideIds = Object.freeze([...guideIds, guide.referenceGridGuideId!]);
                    return guide.referenceGridGuideId!;
                },
                async clearGuides() {
                    await overlay.removeTransient(guideIds);
                    guideIds = Object.freeze([]);
                },
                enterGuideTool: () => context.tools.enter(guideToolId),
                exitGuideTool: () => context.tools.exit('requested'),
                listGuideIds: () => Object.freeze([...guideIds]),
                async configure(patch) {
                    const previous = configuration;
                    const next = validateConfiguration({ ...configuration, ...patch });
                    const enabled = gridIds.length > 0;
                    configuration = next;
                    try {
                        if (enabled) await replaceGrid(createGrid());
                    } catch (error) {
                        configuration = previous;
                        throw error;
                    }
                },
                getConfiguration: () => Object.freeze({ ...configuration }),
            };
            return Object.freeze(api);
        },
    });
}
