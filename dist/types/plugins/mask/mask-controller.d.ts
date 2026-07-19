/**
 * Owns Mask registration, Overlay persistence, labels, state, mutations, and public API behavior.
 *
 * @module
 */
import { type DefaultMaskConfig, type LabelConfig, type MaskConfig, type MaskObject, type OverlayListOrder } from '../../core/index.js';
import type { CanvasReadPort, CanvasResizePort, CoreDiagnosticsPort, CorePresentationPort, Disposable, FabricRuntimePort, RenderRequestPort, SnapshotRegistrationPort } from '../../sdk/index.js';
import { type OverlayFoundationApi } from '../../foundations/overlay/index.js';
export interface MaskPluginOptions {
    readonly defaultWidth?: number;
    readonly defaultHeight?: number;
    readonly defaultConfig?: DefaultMaskConfig;
    readonly rotatable?: boolean;
    readonly label?: LabelConfig | false;
    readonly labelOffset?: number;
    readonly listOrder?: OverlayListOrder;
    readonly bindToImageTransform?: boolean;
    readonly namePrefix?: string;
    readonly onChange?: (masks: readonly MaskObject[]) => void;
}
export interface ResolvedMaskPluginOptions {
    readonly defaultWidth: number;
    readonly defaultHeight: number;
    readonly defaultConfig: DefaultMaskConfig;
    readonly rotatable: boolean;
    readonly label: LabelConfig | false;
    readonly labelOffset: number;
    readonly listOrder: OverlayListOrder;
    readonly bindToImageTransform: boolean;
    readonly namePrefix: string;
    readonly onChange?: (masks: readonly MaskObject[]) => void;
}
export interface RemoveAllOptions {
    readonly saveHistory?: boolean;
}
export interface MaskPluginApi {
    create(config?: MaskConfig): Promise<MaskObject>;
    getAll(): readonly MaskObject[];
    remove(id: string): Promise<void>;
    removeSelected(): Promise<void>;
    removeAll(options?: RemoveAllOptions): Promise<void>;
    flatten(options?: import('../../foundations/overlay/index.js').FlattenOptions): Promise<void>;
}
type MaskCoreAccess = CoreDiagnosticsPort & CorePresentationPort & FabricRuntimePort & CanvasReadPort & RenderRequestPort & CanvasResizePort;
export declare function resolveMaskPluginOptions(options?: MaskPluginOptions): ResolvedMaskPluginOptions;
export declare class MaskPluginController implements MaskPluginApi, Disposable {
    private readonly host;
    private readonly overlay;
    readonly options: ResolvedMaskPluginOptions;
    private counter;
    private lastMask;
    private attached;
    private disposed;
    private selectedMaskBeforeGeometry;
    private mutationSequence;
    private lastInteractionNotification;
    private readonly registrations;
    private readonly factoryOptions;
    constructor(host: MaskCoreAccess, state: SnapshotRegistrationPort, overlay: OverlayFoundationApi, options: ResolvedMaskPluginOptions);
    attach(): void;
    create(config?: MaskConfig): Promise<MaskObject>;
    getAll(): readonly MaskObject[];
    remove(id: string): Promise<void>;
    removeSelected(): Promise<void>;
    removeAll(options?: RemoveAllOptions): Promise<void>;
    flatten(options?: import('../../foundations/overlay/index.js').FlattenOptions): Promise<void>;
    resetForImage(): void;
    dispose(): void;
    private createContext;
    private labelContext;
    private serializeMask;
    private deserializeMask;
    private synchronizeSelection;
    private syncLabels;
    private captureSelectionBeforeGeometry;
    private synchronizeAfterGeometry;
    private removeLabels;
    private reattachRuntimeState;
    private synchronizeCounterFromCanvas;
    private removeMaskObject;
    private notifyChange;
    private assertActive;
}
export {};
