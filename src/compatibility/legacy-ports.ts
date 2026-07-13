import type * as FabricNS from 'fabric';

import type { CoreImageInfo } from '../core-runtime/public-types.js';
import type {
    AnnotationObject,
    BaseImageObject,
    EditorToolMode,
    ImageEditorCallbackContext,
    ImageEditorOperation,
    ImageEditorSelection,
    ImageEditorState,
    MaskObject,
} from '../core/public-types.js';
import type { ElementKey } from '../core/editor-elements.js';

export interface LegacyDisposer {
    dispose(): void | Promise<void>;
}

export interface LegacyCanvasReadPort {
    getCanvas(): FabricNS.Canvas | null;
    requireCanvas(operationId: string): FabricNS.Canvas;
}

export interface LegacyBaseImageReadPort {
    getBaseImage(): BaseImageObject | null;
    getImageInfo(): CoreImageInfo | null;
    isImageLoaded(): boolean;
}

export interface LegacyRasterCommitPort {
    commitRaster(operationId: string, mutation: () => void | Promise<void>): Promise<void>;
}

export interface LegacyOperationPort {
    isBusy(): boolean;
    runSync<TResult>(operationId: ImageEditorOperation, body: () => TResult): TResult;
    run<TResult>(
        operationId: ImageEditorOperation,
        body: () => TResult | Promise<TResult>,
    ): Promise<TResult>;
}

export interface LegacyHistoryRecorderPort {
    recordCommitted(operationId: string, detail?: Readonly<Record<string, unknown>>): void;
    clear(): void;
}

export interface LegacyExportContributorPort {
    register(
        id: string,
        render: (workspace: FabricNS.StaticCanvas) => void | Promise<void>,
    ): LegacyDisposer;
}

export interface LegacyStateSliceDefinition<TState> {
    readonly id: string;
    readonly version: number;
    capture(): TState;
    validate(value: unknown): value is TState;
    restore(value: TState): void | Promise<void>;
    clear(): void | Promise<void>;
}

export interface LegacyStateSlicePort {
    register<TState>(definition: LegacyStateSliceDefinition<TState>): LegacyDisposer;
}

export interface LegacyOverlayPort {
    getMasks(): readonly MaskObject[];
    getAnnotations(): readonly AnnotationObject[];
    getSelection(): ImageEditorSelection;
    requestRender(): void;
}

export interface LegacyToolSessionPort {
    getActiveToolMode(): EditorToolMode | null;
    begin(mode: EditorToolMode): void;
    end(mode: EditorToolMode): void;
}

export interface LegacyCallbackPort {
    emitImageChanged(state: ImageEditorState, context: ImageEditorCallbackContext): void;
    emitMasksChanged(masks: readonly MaskObject[], context: ImageEditorCallbackContext): void;
    emitAnnotationsChanged(
        annotations: readonly AnnotationObject[],
        context: ImageEditorCallbackContext,
    ): void;
    reportError(error: unknown, message: string): void;
    reportWarning(error: unknown, message: string): void;
}

export interface LegacyDomReadModelPort {
    getElement<TKey extends ElementKey>(key: TKey): HTMLElement | null;
    setControlEnabled(key: ElementKey, enabled: boolean): void;
    synchronize(): void;
}
