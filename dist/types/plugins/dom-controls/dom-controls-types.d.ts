/**
 * Declares DOM targets, bindings, control groups, rendering adapters, status, and Plugin API contracts.
 *
 * @module
 */
import type { CoreEventMap, MaskObject } from '../../core/index.js';
import type { AnnotationDescriptor, AnnotationPluginApi, AnnotationStatus } from '../../foundations/annotation/index.js';
import type { OverlayFoundationApi } from '../../foundations/overlay/index.js';
import type { CropEnterOptions, CropPluginApi, CropStatus } from '../crop/index.js';
import type { DrawAnnotationPluginApi, DrawEnterOptions, DrawSessionState } from '../annotation-draw/index.js';
import type { ShapeAnnotationPluginApi, ShapeSessionOptions, ShapeSessionState } from '../annotation-shape/index.js';
import type { TextAnnotationCreateOptions, TextAnnotationPluginApi, TextAnnotationStatus } from '../annotation-text/index.js';
import type { FiltersPluginApi, FiltersStatus } from '../filters/index.js';
import type { HistoryPort, HistoryStatus } from '../history/index.js';
import type { MaskPluginApi } from '../mask/index.js';
import type { MosaicEnterOptions, MosaicPluginApi, MosaicStatus } from '../mosaic/index.js';
import type { TransformPluginApi, TransformPluginState } from '../transform/index.js';
import type { PluginRef, SynchronousEditorPlugin } from '../../sdk/index.js';
/** DOM element or selector resolved against the configured owner document. */
export type DomElementTarget<TElement extends Element = HTMLElement> = TElement | string;
/** Button element or selector accepted by a DOM control binding. */
export type DomButtonTarget = DomElementTarget<HTMLButtonElement>;
/** Input element or selector accepted by a DOM control binding. */
export type DomInputTarget = DomElementTarget<HTMLInputElement>;
/** Lazily resolves one installed Plugin API for DOM actions. */
export interface DomPluginBinding<TApi> {
    readonly ref: PluginRef<TApi>;
    resolve(): TApi;
}
/** Host-defined rendering adapter for status or list output. */
export interface DomRenderAdapter<TValue> {
    readonly target: DomElementTarget;
    render(target: Element, value: TValue): void;
}
/** DOM bindings for Transform actions and status. */
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
/** DOM bindings for History actions, enablement, and status. */
export interface HistoryControls {
    readonly plugin: DomPluginBinding<HistoryPort>;
    readonly enabledInput?: DomInputTarget;
    readonly undoButton?: DomButtonTarget;
    readonly redoButton?: DomButtonTarget;
    readonly clearButton?: DomButtonTarget;
    readonly status?: DomRenderAdapter<HistoryStatus>;
}
/** DOM bindings for Mask removal and list rendering. */
export interface MaskControls {
    readonly plugin: DomPluginBinding<MaskPluginApi>;
    readonly removeSelectedButton?: DomButtonTarget;
    readonly removeAllButton?: DomButtonTarget;
    readonly list?: DomRenderAdapter<readonly MaskObject[]>;
}
/** DOM bindings for Filter preview lifecycle and status. */
export interface FiltersControls {
    readonly plugin: DomPluginBinding<FiltersPluginApi>;
    readonly commitButton?: DomButtonTarget;
    readonly cancelButton?: DomButtonTarget;
    readonly clearButton?: DomButtonTarget;
    readonly status?: DomRenderAdapter<FiltersStatus>;
}
/** DOM bindings for Crop session lifecycle and status. */
export interface CropControls {
    readonly plugin: DomPluginBinding<CropPluginApi>;
    readonly enterButton?: DomButtonTarget;
    readonly enterOptions?: CropEnterOptions;
    readonly applyButton?: DomButtonTarget;
    readonly cancelButton?: DomButtonTarget;
    readonly status?: DomRenderAdapter<CropStatus>;
}
/** DOM bindings for Mosaic session lifecycle and status. */
export interface MosaicControls {
    readonly plugin: DomPluginBinding<MosaicPluginApi>;
    readonly enterButton?: DomButtonTarget;
    readonly enterOptions?: MosaicEnterOptions;
    readonly commitButton?: DomButtonTarget;
    readonly cancelButton?: DomButtonTarget;
    readonly status?: DomRenderAdapter<MosaicStatus>;
}
/** DOM bindings for Annotation selection, removal, and status. */
export interface AnnotationControls {
    readonly plugin: DomPluginBinding<AnnotationPluginApi>;
    readonly clearSelectionButton?: DomButtonTarget;
    readonly removeSelectionButton?: DomButtonTarget;
    readonly removeAllButton?: DomButtonTarget;
    readonly list?: DomRenderAdapter<readonly AnnotationDescriptor[]>;
    readonly status?: DomRenderAdapter<AnnotationStatus>;
}
/** DOM bindings for Text creation, editing lifecycle, and status. */
export interface TextControls {
    readonly plugin: DomPluginBinding<TextAnnotationPluginApi>;
    readonly createButton?: DomButtonTarget;
    readonly createOptions?: TextAnnotationCreateOptions;
    readonly commitButton?: DomButtonTarget;
    readonly cancelButton?: DomButtonTarget;
    readonly status?: DomRenderAdapter<TextAnnotationStatus>;
}
/** DOM bindings for Shape authoring lifecycle and status. */
export interface ShapeControls {
    readonly plugin: DomPluginBinding<ShapeAnnotationPluginApi>;
    readonly enterButton?: DomButtonTarget;
    readonly enterOptions?: ShapeSessionOptions;
    readonly commitButton?: DomButtonTarget;
    readonly cancelButton?: DomButtonTarget;
    readonly status?: DomRenderAdapter<ShapeSessionState | null>;
}
/** DOM bindings for Draw authoring lifecycle and status. */
export interface DrawControls {
    readonly plugin: DomPluginBinding<DrawAnnotationPluginApi>;
    readonly enterButton?: DomButtonTarget;
    readonly enterOptions?: DrawEnterOptions;
    readonly cancelStrokeButton?: DomButtonTarget;
    readonly exitButton?: DomButtonTarget;
    readonly status?: DomRenderAdapter<DrawSessionState | null>;
}
/** Keyboard action policy and optional Plugin dependencies. */
export interface KeyboardControlsOptions {
    readonly target?: Document | DomElementTarget;
    readonly overlays?: DomPluginBinding<OverlayFoundationApi>;
    readonly allowInEditable?: boolean;
    readonly cancelActiveSession?: boolean;
    readonly removeSelection?: boolean;
    readonly historyActions?: boolean;
}
/** Failed DOM action reported to the host. */
export interface DomActionErrorEvent {
    readonly action: string;
    readonly error: unknown;
}
/** Listener invoked after a DOM action fails. */
export type DomActionErrorListener = (event: DomActionErrorEvent) => void;
/** Configures DOM action groups, keyboard behavior, rendering, and diagnostics. */
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
/** Observable binding and activity state for DOM controls. */
export interface DomControlsStatus {
    readonly isBound: boolean;
    readonly isBusy: boolean;
    readonly isDisposed: boolean;
    readonly bindingCount: number;
}
/** Public DOM binding refresh and status operations. */
export interface DomControlsPluginApi {
    /** Re-resolves configured targets and refreshes rendered values. */
    refresh(): void;
    /** Returns the current immutable DOM controls status. */
    getStatus(): DomControlsStatus;
}
/** Synchronous Plugin definition that binds host DOM controls. */
export type DomControlsPlugin = SynchronousEditorPlugin<DomControlsPluginApi, CoreEventMap>;
