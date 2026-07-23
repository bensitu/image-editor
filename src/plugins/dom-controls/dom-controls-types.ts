/**
 * Declares DOM targets, bindings, control groups, rendering adapters, status, and Plugin API contracts.
 *
 * @module
 */

import type { CoreEventMap, MaskObject } from '../../core/index.js';
import type {
    AnnotationDescriptor,
    AnnotationPluginApi,
    AnnotationStatus,
} from '../../foundations/annotation/index.js';
import type { OverlayFoundationApi } from '../../foundations/overlay/index.js';
import type { CropEnterOptions, CropPluginApi, CropStatus } from '../crop/index.js';
import type {
    DrawAnnotationPluginApi,
    DrawEnterOptions,
    DrawSessionState,
} from '../annotation-draw/index.js';
import type {
    ShapeAnnotationPluginApi,
    ShapeSessionOptions,
    ShapeSessionState,
} from '../annotation-shape/index.js';
import type {
    TextAnnotationCreateOptions,
    TextAnnotationPluginApi,
    TextAnnotationStatus,
} from '../annotation-text/index.js';
import type { FiltersPluginApi, FiltersStatus } from '../filters/index.js';
import type { HistoryPort, HistoryStatus } from '../history/index.js';
import type { MaskPluginApi } from '../mask/index.js';
import type { MosaicEnterOptions, MosaicPluginApi, MosaicStatus } from '../mosaic/index.js';
import type { TransformPluginApi, TransformPluginState } from '../transform/index.js';
import type { PluginRef, SynchronousEditorPlugin } from '../../sdk/index.js';

export type DomElementTarget<TElement extends Element = HTMLElement> = TElement | string;
export type DomButtonTarget = DomElementTarget<HTMLButtonElement>;
export type DomInputTarget = DomElementTarget<HTMLInputElement>;

export interface DomPluginBinding<TApi> {
    readonly ref: PluginRef<TApi>;
    resolve(): TApi;
}

export interface DomRenderAdapter<TValue> {
    readonly target: DomElementTarget;
    render(target: Element, value: TValue): void;
}

export interface TransformControls {
    readonly plugin: DomPluginBinding<TransformPluginApi>;
    readonly scaleInput?: DomInputTarget;
    readonly zoomInButton?: DomButtonTarget;
    readonly zoomOutButton?: DomButtonTarget;
    readonly rotateLeftButton?: DomButtonTarget;
    readonly rotateRightButton?: DomButtonTarget;
    readonly flipHorizontalButton?: DomButtonTarget;
    readonly flipVerticalButton?: DomButtonTarget;
    readonly resetButton?: DomButtonTarget;
    readonly status?: DomRenderAdapter<TransformPluginState>;
}

export interface HistoryControls {
    readonly plugin: DomPluginBinding<HistoryPort>;
    readonly enabledInput?: DomInputTarget;
    readonly undoButton?: DomButtonTarget;
    readonly redoButton?: DomButtonTarget;
    readonly clearButton?: DomButtonTarget;
    readonly status?: DomRenderAdapter<HistoryStatus>;
}

export interface MaskControls {
    readonly plugin: DomPluginBinding<MaskPluginApi>;
    readonly removeSelectedButton?: DomButtonTarget;
    readonly removeAllButton?: DomButtonTarget;
    readonly list?: DomRenderAdapter<readonly MaskObject[]>;
}

export interface FiltersControls {
    readonly plugin: DomPluginBinding<FiltersPluginApi>;
    readonly commitButton?: DomButtonTarget;
    readonly cancelButton?: DomButtonTarget;
    readonly clearButton?: DomButtonTarget;
    readonly status?: DomRenderAdapter<FiltersStatus>;
}

export interface CropControls {
    readonly plugin: DomPluginBinding<CropPluginApi>;
    readonly enterButton?: DomButtonTarget;
    readonly enterOptions?: CropEnterOptions;
    readonly applyButton?: DomButtonTarget;
    readonly cancelButton?: DomButtonTarget;
    readonly status?: DomRenderAdapter<CropStatus>;
}

export interface MosaicControls {
    readonly plugin: DomPluginBinding<MosaicPluginApi>;
    readonly enterButton?: DomButtonTarget;
    readonly enterOptions?: MosaicEnterOptions;
    readonly commitButton?: DomButtonTarget;
    readonly cancelButton?: DomButtonTarget;
    readonly status?: DomRenderAdapter<MosaicStatus>;
}

export interface AnnotationControls {
    readonly plugin: DomPluginBinding<AnnotationPluginApi>;
    readonly clearSelectionButton?: DomButtonTarget;
    readonly removeSelectionButton?: DomButtonTarget;
    readonly removeAllButton?: DomButtonTarget;
    readonly list?: DomRenderAdapter<readonly AnnotationDescriptor[]>;
    readonly status?: DomRenderAdapter<AnnotationStatus>;
}

export interface TextControls {
    readonly plugin: DomPluginBinding<TextAnnotationPluginApi>;
    readonly createButton?: DomButtonTarget;
    readonly createOptions?: TextAnnotationCreateOptions;
    readonly commitButton?: DomButtonTarget;
    readonly cancelButton?: DomButtonTarget;
    readonly status?: DomRenderAdapter<TextAnnotationStatus>;
}

export interface ShapeControls {
    readonly plugin: DomPluginBinding<ShapeAnnotationPluginApi>;
    readonly enterButton?: DomButtonTarget;
    readonly enterOptions?: ShapeSessionOptions;
    readonly commitButton?: DomButtonTarget;
    readonly cancelButton?: DomButtonTarget;
    readonly status?: DomRenderAdapter<ShapeSessionState | null>;
}

export interface DrawControls {
    readonly plugin: DomPluginBinding<DrawAnnotationPluginApi>;
    readonly enterButton?: DomButtonTarget;
    readonly enterOptions?: DrawEnterOptions;
    readonly cancelStrokeButton?: DomButtonTarget;
    readonly exitButton?: DomButtonTarget;
    readonly status?: DomRenderAdapter<DrawSessionState | null>;
}

export interface KeyboardControlsOptions {
    readonly target?: Document | DomElementTarget;
    readonly overlays?: DomPluginBinding<OverlayFoundationApi>;
    readonly allowInEditable?: boolean;
    readonly cancelActiveSession?: boolean;
    readonly removeSelection?: boolean;
    readonly historyActions?: boolean;
}

export interface DomActionErrorEvent {
    readonly action: string;
    readonly error: unknown;
}

export type DomActionErrorListener = (event: DomActionErrorEvent) => void;

export interface DomControlsOptions {
    readonly ownerDocument?: Document;
    readonly transform?: TransformControls;
    readonly history?: HistoryControls;
    readonly masks?: MaskControls;
    readonly filters?: FiltersControls;
    readonly crop?: CropControls;
    readonly mosaic?: MosaicControls;
    readonly annotations?: AnnotationControls;
    readonly text?: TextControls;
    readonly shape?: ShapeControls;
    readonly draw?: DrawControls;
    readonly keyboard?: KeyboardControlsOptions;
    readonly onActionError?: DomActionErrorListener;
}

export interface DomControlsStatus {
    readonly isBound: boolean;
    readonly isBusy: boolean;
    readonly isDisposed: boolean;
    readonly bindingCount: number;
}

export interface DomControlsPluginApi {
    refresh(): void;
    getStatus(): DomControlsStatus;
}

export type DomControlsPlugin = SynchronousEditorPlugin<DomControlsPluginApi, CoreEventMap>;
