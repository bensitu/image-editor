/**
 * Owns Mask registration, Overlay persistence, labels, state, mutations, and public API behavior.
 *
 * @module
 */
import { type DefaultMaskConfig, type LabelConfig, type MaskConfig, type MaskObject, type OverlayListOrder } from '../../core/index.js';
import type { CanvasReadPort, CanvasResizePort, CoreDiagnosticsPort, CorePresentationPort, Disposable, DisposableScope, FabricRuntimePort, RenderRequestPort, SnapshotRegistrationPort } from '../../sdk/index.js';
import { type OverlayFoundationApi } from '../../foundations/overlay/index.js';
/** Configures Mask creation, presentation, ordering, export, and change notifications. */
export interface MaskPluginOptions {
    /** Default width for rectangular Masks. @defaultValue `50` */
    readonly defaultWidth?: number;
    /** Default height for rectangular Masks. @defaultValue `80` */
    readonly defaultHeight?: number;
    /** Style and interaction defaults merged into each created Mask. */
    readonly defaultConfig?: DefaultMaskConfig;
    /** Enables Mask rotation controls. @defaultValue `false` */
    readonly rotatable?: boolean;
    /** Label presentation, or `false` to disable labels. */
    readonly label?: LabelConfig | false;
    /** Gap in Canvas pixels between a Mask and its label. @defaultValue `3` */
    readonly labelOffset?: number;
    /** Whether Masks participate in exports unless the call supplies `includeKinds`. */
    readonly exportByDefault?: boolean;
    /**
     * Ordering used by `MaskPluginApi.getAll()` and `onChange`.
     *
     * `front-to-back` returns the topmost Mask first. `back-to-front` follows Fabric's
     * bottom-to-top Canvas order.
     *
     * @defaultValue `'front-to-back'`
     */
    readonly listOrder?: OverlayListOrder;
    /** Applies committed Base Image geometry mutations to Masks. @defaultValue `false` */
    readonly bindToImageTransform?: boolean;
    /** Prefix used to generate Mask names. @defaultValue `'mask'` */
    readonly namePrefix?: string;
    /** Receives the ordered Mask list after committed Mask changes. */
    readonly onChange?: (masks: readonly MaskObject[]) => void;
}
/** Fully normalized Mask Plugin configuration. */
export interface ResolvedMaskPluginOptions {
    readonly defaultWidth: number;
    readonly defaultHeight: number;
    readonly defaultConfig: DefaultMaskConfig;
    readonly rotatable: boolean;
    readonly label: LabelConfig | false;
    readonly labelOffset: number;
    readonly exportByDefault: boolean;
    readonly listOrder: OverlayListOrder;
    readonly bindToImageTransform: boolean;
    readonly namePrefix: string;
    readonly onChange?: (masks: readonly MaskObject[]) => void;
}
/** Public operations provided by the Mask Plugin. */
export interface MaskPluginApi {
    /** Creates and selects one Mask as a committed mutation. */
    create(config?: MaskConfig): Promise<MaskObject>;
    /** Returns Masks in the configured list order. */
    getAll(): readonly MaskObject[];
    /** Removes one Mask by persistent identifier. */
    remove(id: string): Promise<void>;
    /** Removes every currently selected Mask. */
    removeSelected(): Promise<void>;
    /** Removes all Masks. */
    removeAll(): Promise<void>;
    /** Bakes matching Masks into the Base Image and removes their live objects. */
    flatten(options?: import('../../foundations/overlay/index.js').FlattenOptions): Promise<void>;
}
type MaskCoreAccess = CoreDiagnosticsPort & CorePresentationPort & FabricRuntimePort & CanvasReadPort & RenderRequestPort & CanvasResizePort;
/** Validates and freezes Mask Plugin configuration. */
export declare function resolveMaskPluginOptions(options?: MaskPluginOptions): ResolvedMaskPluginOptions;
export declare class MaskPluginController implements MaskPluginApi, Disposable {
    private readonly host;
    private readonly overlay;
    private readonly disposables;
    readonly options: ResolvedMaskPluginOptions;
    private counter;
    private lastMask;
    private attached;
    private disposed;
    private selectedMaskBeforeGeometry;
    private mutationSequence;
    private lastInteractionNotification;
    private readonly factoryOptions;
    constructor(host: MaskCoreAccess, state: SnapshotRegistrationPort, overlay: OverlayFoundationApi, disposables: DisposableScope, options: ResolvedMaskPluginOptions);
    attach(): void;
    create(config?: MaskConfig): Promise<MaskObject>;
    getAll(): readonly MaskObject[];
    remove(id: string): Promise<void>;
    removeSelected(): Promise<void>;
    removeAll(): Promise<void>;
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
    private findLatestMask;
    private notifyChange;
    private assertActive;
}
export {};
