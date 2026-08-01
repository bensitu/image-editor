/**
 * Defines Mask contracts and editor-owned Fabric object markers shared by Core and the Mask Plugin.
 *
 * Public package entries re-export only the documented Mask contracts. Base-image and session
 * markers remain internal implementation details used to keep transient objects out of persistent
 * state and to maintain Canvas layer order.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import type { FabricModule, LayoutMode } from '../core-runtime/public-types.js';

export type SessionObjectType =
    | 'annotationLabel'
    | 'annotationLockIndicator'
    | 'cropRect'
    | 'maskLabel'
    | 'mosaicPreviewCircle'
    | 'mosaicPreviewImage';

/** Render order for Mask and Annotation lists exposed by their Plugin APIs. */
export type OverlayListOrder = 'front-to-back' | 'back-to-front';

export interface BaseImageObject extends FabricNS.FabricImage {
    editorObjectKind: 'baseImage';
}

export interface SessionObject extends FabricNS.FabricObject {
    editorObjectKind: 'session';
    sessionObjectType: SessionObjectType;
}

/**
 * Fabric object augmented with the persistent identity and interaction metadata owned by the Mask
 * Plugin.
 *
 * Values returned by `MaskPluginApi.getAll()` and passed to `MaskPluginOptions.onChange` are live
 * editor-owned objects. Consumers should treat them as read-only and use the Mask or Overlay APIs
 * for mutations so History, persistence, and selection state remain coordinated.
 */
export interface MaskObject extends FabricNS.FabricObject {
    editorObjectKind: 'mask';
    /** Stable creation sequence used by generated display names and Snapshot records. */
    maskId: number;
    /** Persistent Mask identifier used by Overlay State, Snapshot restore, and API operations. */
    maskUid: string;
    /** Human-readable label derived from the configured name prefix. */
    maskName: string;
    /** Original opacity retained for hover and selection style restoration. */
    originalAlpha: number;
    /** Original stroke retained for hover and selection style restoration. */
    originalStroke?: FabricNS.TFiller | string | null;
    /** Original stroke width retained for hover and selection style restoration. */
    originalStrokeWidth?: number;
    /** Transient label object displayed for the selected Mask. */
    labelObject?: FabricNS.FabricObject;
}

export function isBaseImageObject(object: unknown): object is BaseImageObject {
    return (
        !!object &&
        typeof object === 'object' &&
        (object as { editorObjectKind?: unknown }).editorObjectKind === 'baseImage'
    );
}

export function isMaskObject(object: unknown): object is MaskObject {
    const candidate = object as Partial<MaskObject> | null | undefined;
    return (
        !!candidate &&
        candidate.editorObjectKind === 'mask' &&
        typeof candidate.maskId === 'number' &&
        typeof candidate.maskUid === 'string' &&
        typeof candidate.maskName === 'string'
    );
}

export function isSessionObject(object: unknown): object is SessionObject {
    const candidate = object as Partial<SessionObject> | null | undefined;
    return (
        !!candidate &&
        candidate.editorObjectKind === 'session' &&
        typeof candidate.sessionObjectType === 'string'
    );
}

/** Configuration for the transient label displayed above the selected Mask. */
export interface LabelConfig {
    /**
     * Returns the label text. `maskIndex` is the stable creation index (`mask.maskId - 1`), not the
     * current list position.
     *
     * @defaultValue `(mask) => mask.maskName`
     */
    getText?: (mask: MaskObject, maskIndex: number) => string;
    /** Fabric text properties merged into the default label style. */
    textOptions?: Partial<FabricNS.TextProps>;
    /**
     * Creates a label object directly. Returning `null` uses the default Fabric text builder.
     */
    create?: (mask: MaskObject, fabric: FabricModule) => FabricNS.FabricText | null;
}

/** Resolved Mask Plugin values exposed to numeric factories and custom Fabric generators. */
export type MaskFactoryOptions = Readonly<{
    layoutMode: LayoutMode;
    defaultMaskWidth: number;
    defaultMaskHeight: number;
    defaultMaskConfig: DefaultMaskConfig;
    maskRotatable: boolean;
    maskLabelOnSelect: boolean;
    maskLabelOffset: number;
    maskName: string;
    maskListOrder: OverlayListOrder;
    label: LabelConfig;
    onWarning: ((error: unknown, message: string) => void) | null;
}>;

/**
 * Numeric Mask property accepted as Canvas pixels, a percentage string, or a resolver invoked when
 * the Mask is created.
 */
export type MaskNumericProp =
    | number
    | `${number}%`
    | string
    | ((canvas: FabricNS.Canvas, options: MaskFactoryOptions) => number);

/** Polygon vertex accepted in object or tuple form. */
export type PolygonPoint = { x: number; y: number } | [number, number];

export type MaskShapeKind = 'rect' | 'circle' | 'ellipse' | 'polygon';

/** Configuration passed to `MaskPluginApi.create()`. */
export interface MaskConfig {
    /** Shape type. @defaultValue `'rect'` */
    shape?: MaskShapeKind | (string & {});
    /** Polygon vertices required when `shape` is `polygon`. */
    points?: PolygonPoint[];
    /** Mask width, or a diameter hint for circles. */
    width?: MaskNumericProp;
    /** Mask height for rectangles and ellipses. */
    height?: MaskNumericProp;
    /** Horizontal rectangle corner radius or ellipse x-radius. */
    rx?: MaskNumericProp;
    /** Vertical rectangle corner radius or ellipse y-radius. */
    ry?: MaskNumericProp;
    /** Circle radius. Defaults to half the smaller resolved dimension. */
    radius?: MaskNumericProp;
    /** Horizontal position. Percentages resolve against Canvas width. */
    left?: MaskNumericProp;
    /** Vertical position. Percentages resolve against Canvas height. */
    top?: MaskNumericProp;
    /** Rotation angle in degrees. @defaultValue `0` */
    angle?: number;
    /** CSS fill color. @defaultValue `'rgba(0,0,0,0.5)'` */
    color?: string;
    /** Opacity from zero through one. @defaultValue `0.5` */
    alpha?: number;
    /** Gap used by automatic placement. @defaultValue `5` */
    gap?: number;
    /** Whether the Mask can be selected and moved. @defaultValue `true` */
    selectable?: boolean;
    /** Whether the Mask receives Fabric pointer events. @defaultValue `true` */
    evented?: boolean;
    /** Whether Fabric transform controls are visible. @defaultValue `true` */
    hasControls?: boolean;
    /** Keep stroke width visually uniform while the Mask scales. @defaultValue `true` */
    strokeUniform?: boolean;
    /** Selection border color. @defaultValue `'red'` */
    borderColor?: string;
    /** Transform control color. @defaultValue `'black'` */
    cornerColor?: string;
    /** Transform control size in pixels. @defaultValue `8` */
    cornerSize?: number;
    /** Whether Fabric renders transparent transform-control corners. @defaultValue `false` */
    transparentCorners?: boolean;
    /** Additional supported Fabric object properties. Falsy values are preserved. */
    styles?: Partial<FabricNS.FabricObjectProps>;
    /**
     * Runs synchronously after the Mask is attached, selected when applicable, and rendered, but
     * before the surrounding Overlay mutation commits. Callback failures are reported as warnings
     * and do not replace the successfully created Mask.
     */
    onCreate?: (mask: MaskObject, canvas: FabricNS.Canvas) => void;
    /**
     * Creates a custom Fabric object instead of a built-in shape. Throwing or returning an invalid
     * object rejects the surrounding Mask mutation.
     */
    fabricGenerator?: (
        config: ResolvedMaskConfig,
        canvas: FabricNS.Canvas,
        options: MaskFactoryOptions,
    ) => FabricNS.FabricObject;
}

/** Defaults applied to new Masks; callbacks and custom factories remain per-call values. */
export type DefaultMaskConfig = Omit<Partial<MaskConfig>, 'onCreate' | 'fabricGenerator'>;

/** Fully resolved configuration supplied to a custom `fabricGenerator`. */
export interface ResolvedMaskConfig extends MaskConfig {
    shape: NonNullable<MaskConfig['shape']>;
    width: number;
    height: number;
    color: string;
    alpha: number;
    gap: number;
    angle: number;
    selectable: boolean;
}
