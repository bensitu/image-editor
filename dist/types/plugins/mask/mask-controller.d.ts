import type { CoreHostPort, CoreStatePort } from '../../core-runtime/internal-capabilities.js';
import type { OverlayFoundationApi } from '../../foundations/overlay/index.js';
import type { DefaultMaskConfig, LabelConfig, MaskConfig, MaskObject, OverlayListOrder } from '../../core/public-types.js';
import type { Disposable } from '../../plugin-kernel/index.js';
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
    create(config?: MaskConfig): MaskObject;
    getAll(): readonly MaskObject[];
    remove(id: string): void;
    removeSelected(): void;
    removeAll(options?: RemoveAllOptions): void;
    flatten(options?: import('../../foundations/overlay/index.js').FlattenOptions): Promise<void>;
}
interface MaskOperationAccess {
    run<TResult>(operationId: string, body: () => TResult): TResult;
}
export declare function resolveMaskPluginOptions(options?: MaskPluginOptions): ResolvedMaskPluginOptions;
export declare class MaskPluginController implements MaskPluginApi, Disposable {
    private readonly host;
    private readonly state;
    private readonly overlay;
    private readonly operations;
    readonly options: ResolvedMaskPluginOptions;
    private counter;
    private lastMask;
    private attached;
    private disposed;
    private selectedMaskBeforeGeometry;
    private readonly registrations;
    private readonly legacyOptions;
    private readonly onObjectTransform;
    constructor(host: CoreHostPort, state: CoreStatePort, overlay: OverlayFoundationApi, operations: MaskOperationAccess, options: ResolvedMaskPluginOptions);
    attach(): void;
    create(config?: MaskConfig): MaskObject;
    getAll(): readonly MaskObject[];
    remove(id: string): void;
    removeSelected(): void;
    removeAll(options?: RemoveAllOptions): void;
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
    private commitHistory;
    private notifyChange;
    private assertActive;
}
export {};
