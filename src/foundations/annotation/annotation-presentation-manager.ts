/**
 * Owns transient Annotation labels, lock indicators, hover styling, and control appearance.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import type {
    CanvasReadPort,
    CoreDiagnosticsPort,
    FabricRuntimePort,
    RenderRequestPort,
} from '../../sdk/index.js';
import { markSessionObject, placeSessionObject } from '../../utils/internal-layer-placement.js';
import type {
    AnnotationControlStyle,
    AnnotationDescriptor,
    AnnotationFoundationOptions,
    AnnotationHoverStyle,
    AnnotationLabelConfig,
    AnnotationLockIndicatorConfig,
} from './annotation-definition.js';
import { AnnotationValidationError } from './annotation-errors.js';
import type { AnnotationFabricObject } from './annotation-runtime-state.js';

type AnnotationPresentationHost = CoreDiagnosticsPort &
    FabricRuntimePort &
    CanvasReadPort &
    RenderRequestPort;

type PresentationObject = FabricNS.FabricObject & {
    annotationPresentation: true;
    annotationOwnerId: string;
};

interface HoverBinding {
    readonly over: () => void;
    readonly out: () => void;
    hovered: boolean;
    original: Partial<
        Pick<FabricNS.FabricObject, 'fill' | 'opacity' | 'stroke' | 'strokeWidth'>
    > | null;
}

export interface ResolvedAnnotationPresentationOptions {
    readonly exportByDefault: boolean;
    readonly hoverStyle: Readonly<AnnotationHoverStyle> | false;
    readonly controlStyle: Readonly<AnnotationControlStyle>;
    readonly label: Readonly<AnnotationLabelConfig> | false;
    readonly lockIndicator: Readonly<Required<AnnotationLockIndicatorConfig>> | false;
}

const DEFAULT_LOCK_INDICATOR: Readonly<Required<AnnotationLockIndicatorConfig>> = Object.freeze({
    size: 16,
    offset: 3,
    backgroundColor: '#111827',
    iconColor: '#ffffff',
});

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function finiteRange(
    value: unknown,
    label: string,
    minimum: number,
    maximum: number,
): number | undefined {
    if (value === undefined) return undefined;
    if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < minimum ||
        value > maximum
    ) {
        throw new AnnotationValidationError(
            `${label} must be a finite number from ${minimum} through ${maximum}.`,
        );
    }
    return value;
}

function color(value: unknown, label: string): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || value.length === 0 || value.length > 256) {
        throw new AnnotationValidationError(`${label} must be a non-empty CSS color string.`);
    }
    return value;
}

function nullableColor(value: unknown, label: string): string | null | undefined {
    if (value === null) return null;
    return color(value, label);
}

function resolveHoverStyle(
    value: AnnotationHoverStyle | false | undefined,
): Readonly<AnnotationHoverStyle> | false {
    if (value === undefined || value === false) return false;
    if (!isPlainRecord(value)) {
        throw new AnnotationValidationError('Annotation hoverStyle must be an object or false.');
    }
    const allowed = new Set(['fill', 'opacity', 'stroke', 'strokeWidth']);
    if (Object.keys(value).some((key) => !allowed.has(key))) {
        throw new AnnotationValidationError('Annotation hoverStyle contains unknown keys.');
    }
    return Object.freeze({
        ...(value.fill !== undefined
            ? { fill: nullableColor(value.fill, 'Annotation hover fill') as string | null }
            : {}),
        ...(value.opacity !== undefined
            ? { opacity: finiteRange(value.opacity, 'Annotation hover opacity', 0, 1) as number }
            : {}),
        ...(value.stroke !== undefined
            ? { stroke: nullableColor(value.stroke, 'Annotation hover stroke') as string | null }
            : {}),
        ...(value.strokeWidth !== undefined
            ? {
                  strokeWidth: finiteRange(
                      value.strokeWidth,
                      'Annotation hover strokeWidth',
                      0,
                      256,
                  ) as number,
              }
            : {}),
    });
}

function resolveControlStyle(
    value: AnnotationControlStyle | undefined,
): Readonly<AnnotationControlStyle> {
    if (value === undefined) return Object.freeze({});
    if (!isPlainRecord(value)) {
        throw new AnnotationValidationError('Annotation controlStyle must be an object.');
    }
    const allowed = new Set([
        'borderColor',
        'cornerColor',
        'cornerStrokeColor',
        'cornerSize',
        'touchCornerSize',
        'transparentCorners',
        'padding',
    ]);
    if (Object.keys(value).some((key) => !allowed.has(key))) {
        throw new AnnotationValidationError('Annotation controlStyle contains unknown keys.');
    }
    if (value.transparentCorners !== undefined && typeof value.transparentCorners !== 'boolean') {
        throw new AnnotationValidationError(
            'Annotation controlStyle.transparentCorners must be boolean.',
        );
    }
    return Object.freeze({
        ...(value.borderColor !== undefined
            ? { borderColor: color(value.borderColor, 'Annotation borderColor') as string }
            : {}),
        ...(value.cornerColor !== undefined
            ? { cornerColor: color(value.cornerColor, 'Annotation cornerColor') as string }
            : {}),
        ...(value.cornerStrokeColor !== undefined
            ? {
                  cornerStrokeColor: color(
                      value.cornerStrokeColor,
                      'Annotation cornerStrokeColor',
                  ) as string,
              }
            : {}),
        ...(value.cornerSize !== undefined
            ? {
                  cornerSize: finiteRange(
                      value.cornerSize,
                      'Annotation cornerSize',
                      1,
                      128,
                  ) as number,
              }
            : {}),
        ...(value.touchCornerSize !== undefined
            ? {
                  touchCornerSize: finiteRange(
                      value.touchCornerSize,
                      'Annotation touchCornerSize',
                      1,
                      256,
                  ) as number,
              }
            : {}),
        ...(value.transparentCorners === undefined
            ? {}
            : { transparentCorners: value.transparentCorners }),
        ...(value.padding !== undefined
            ? {
                  padding: finiteRange(
                      value.padding,
                      'Annotation control padding',
                      0,
                      128,
                  ) as number,
              }
            : {}),
    });
}

function resolveLabel(
    value: AnnotationLabelConfig | false | undefined,
): Readonly<AnnotationLabelConfig> | false {
    if (value === undefined || value === false) return false;
    if (!isPlainRecord(value)) {
        throw new AnnotationValidationError('Annotation label must be an object or false.');
    }
    const allowed = new Set(['showOn', 'offset', 'getText', 'textOptions']);
    if (Object.keys(value).some((key) => !allowed.has(key))) {
        throw new AnnotationValidationError('Annotation label contains unknown keys.');
    }
    if (value.showOn !== undefined && value.showOn !== 'selected' && value.showOn !== 'always') {
        throw new AnnotationValidationError('Annotation label.showOn must be selected or always.');
    }
    if (value.getText !== undefined && typeof value.getText !== 'function') {
        throw new AnnotationValidationError('Annotation label.getText must be a function.');
    }
    if (value.textOptions !== undefined && !isPlainRecord(value.textOptions)) {
        throw new AnnotationValidationError('Annotation label.textOptions must be an object.');
    }
    return Object.freeze({
        showOn: value.showOn ?? 'selected',
        offset: finiteRange(value.offset, 'Annotation label offset', 0, 256) ?? 3,
        ...(value.getText
            ? {
                  getText: value.getText as (annotation: AnnotationDescriptor) => string,
              }
            : {}),
        ...(value.textOptions
            ? {
                  textOptions: Object.freeze({
                      ...(value.textOptions as Partial<FabricNS.TextProps>),
                  }),
              }
            : {}),
    });
}

function resolveLockIndicator(
    value: AnnotationLockIndicatorConfig | false | undefined,
): Readonly<Required<AnnotationLockIndicatorConfig>> | false {
    if (value === false) return false;
    if (value !== undefined && !isPlainRecord(value)) {
        throw new AnnotationValidationError('Annotation lockIndicator must be an object or false.');
    }
    const config = value ?? {};
    const allowed = new Set(['size', 'offset', 'backgroundColor', 'iconColor']);
    if (Object.keys(config).some((key) => !allowed.has(key))) {
        throw new AnnotationValidationError('Annotation lockIndicator contains unknown keys.');
    }
    return Object.freeze({
        size:
            finiteRange(config.size, 'Annotation lock indicator size', 8, 64) ??
            DEFAULT_LOCK_INDICATOR.size,
        offset:
            finiteRange(config.offset, 'Annotation lock indicator offset', 0, 64) ??
            DEFAULT_LOCK_INDICATOR.offset,
        backgroundColor:
            color(config.backgroundColor, 'Annotation lock indicator backgroundColor') ??
            DEFAULT_LOCK_INDICATOR.backgroundColor,
        iconColor:
            color(config.iconColor, 'Annotation lock indicator iconColor') ??
            DEFAULT_LOCK_INDICATOR.iconColor,
    });
}

export function resolveAnnotationPresentationOptions(
    options: AnnotationFoundationOptions,
): ResolvedAnnotationPresentationOptions {
    return Object.freeze({
        exportByDefault: options.exportByDefault !== false,
        hoverStyle: resolveHoverStyle(options.hoverStyle),
        controlStyle: resolveControlStyle(options.controlStyle),
        label: resolveLabel(options.label),
        lockIndicator: resolveLockIndicator(options.lockIndicator),
    });
}

export class AnnotationPresentationManager {
    private readonly labels = new Map<AnnotationFabricObject, FabricNS.FabricText>();
    private readonly lockIndicators = new Map<AnnotationFabricObject, FabricNS.Group>();
    private readonly hoverBindings = new Map<AnnotationFabricObject, HoverBinding>();

    constructor(
        private readonly host: AnnotationPresentationHost,
        private readonly options: ResolvedAnnotationPresentationOptions,
        private readonly describe: (object: AnnotationFabricObject) => AnnotationDescriptor | null,
        private readonly isSelected: (id: string) => boolean,
    ) {}

    withBaseStyle<T>(object: AnnotationFabricObject, task: () => T): T {
        const binding = this.suspendHover(object);
        try {
            return task();
        } finally {
            this.resumeHover(object, binding);
        }
    }

    async withBaseStyleAsync<T>(
        object: AnnotationFabricObject,
        task: () => Promise<T>,
    ): Promise<T> {
        const binding = this.suspendHover(object);
        try {
            return await task();
        } finally {
            this.resumeHover(object, binding);
        }
    }

    synchronize(object: AnnotationFabricObject): void {
        const descriptor = this.describe(object);
        if (!descriptor) return;
        this.applyControlStyle(object);
        this.ensureHoverBinding(object);
        if (descriptor.hidden || descriptor.locked) this.restoreHover(object);
        this.synchronizeLabel(object, descriptor);
        this.synchronizeLockIndicator(object, descriptor);
        this.host.requestRender();
    }

    synchronizeAll(objects: readonly AnnotationFabricObject[]): void {
        const live = new Set(objects);
        for (const object of [...this.labels.keys()]) {
            if (!live.has(object)) this.removeFor(object);
        }
        for (const object of [...this.lockIndicators.keys()]) {
            if (!live.has(object)) this.removeFor(object);
        }
        for (const object of [...this.hoverBindings.keys()]) {
            if (!live.has(object)) this.removeFor(object);
        }
        for (const object of objects) this.synchronize(object);
    }

    removeFor(object: AnnotationFabricObject): void {
        this.removePresentation(this.labels, object);
        this.removePresentation(this.lockIndicators, object);
        this.detachHoverBinding(object);
    }

    reset(): void {
        for (const object of new Set([
            ...this.labels.keys(),
            ...this.lockIndicators.keys(),
            ...this.hoverBindings.keys(),
        ])) {
            this.removeFor(object);
        }
        this.host.requestRender();
    }

    private applyControlStyle(object: AnnotationFabricObject): void {
        if (Object.keys(this.options.controlStyle).length === 0) return;
        object.set(this.options.controlStyle);
        object.setCoords();
    }

    private ensureHoverBinding(object: AnnotationFabricObject): void {
        const style = this.options.hoverStyle;
        if (style === false || this.hoverBindings.has(object)) return;
        const binding: HoverBinding = {
            hovered: false,
            original: null,
            over: () => {
                if (object.editorOverlayHidden || object.editorOverlayLocked) return;
                binding.hovered = true;
                if (binding.original) return;
                binding.original = this.captureHoverProperties(object, style);
                object.set(style);
                object.setCoords();
                this.host.requestRender();
            },
            out: () => {
                binding.hovered = false;
                this.restoreHover(object);
                this.host.requestRender();
            },
        };
        object.on('mouseover', binding.over);
        object.on('mouseout', binding.out);
        this.hoverBindings.set(object, binding);
    }

    private restoreHover(object: AnnotationFabricObject): void {
        const binding = this.hoverBindings.get(object);
        if (!binding?.original) return;
        object.set(binding.original);
        object.setCoords();
        binding.original = null;
    }

    private suspendHover(object: AnnotationFabricObject): HoverBinding | null {
        const binding = this.hoverBindings.get(object);
        if (!binding?.original) return null;
        object.set(binding.original);
        object.setCoords();
        binding.original = null;
        return binding;
    }

    private resumeHover(object: AnnotationFabricObject, binding: HoverBinding | null): void {
        if (!binding || this.hoverBindings.get(object) !== binding || binding.original) return;
        if (object.editorOverlayHidden || object.editorOverlayLocked) {
            binding.hovered = false;
            return;
        }
        if (!binding.hovered) return;
        const style = this.options.hoverStyle;
        if (style === false) return;
        binding.original = this.captureHoverProperties(object, style);
        object.set(style);
        object.setCoords();
        this.host.requestRender();
    }

    private captureHoverProperties(
        object: AnnotationFabricObject,
        style: Readonly<AnnotationHoverStyle>,
    ): HoverBinding['original'] {
        return Object.freeze({
            ...('fill' in style ? { fill: object.fill } : {}),
            ...('opacity' in style ? { opacity: object.opacity } : {}),
            ...('stroke' in style ? { stroke: object.stroke } : {}),
            ...('strokeWidth' in style ? { strokeWidth: object.strokeWidth } : {}),
        });
    }

    private detachHoverBinding(object: AnnotationFabricObject): void {
        const binding = this.hoverBindings.get(object);
        if (!binding) return;
        binding.hovered = false;
        this.restoreHover(object);
        object.off('mouseover', binding.over);
        object.off('mouseout', binding.out);
        this.hoverBindings.delete(object);
    }

    private synchronizeLabel(
        object: AnnotationFabricObject,
        descriptor: AnnotationDescriptor,
    ): void {
        const config = this.options.label;
        if (config === false) {
            this.removePresentation(this.labels, object);
            return;
        }
        const shouldShow =
            !descriptor.hidden && (config.showOn === 'always' || this.isSelected(descriptor.id));
        if (!shouldShow) {
            this.removePresentation(this.labels, object);
            return;
        }
        let label = this.labels.get(object);
        const text = this.labelText(config, descriptor);
        if (!label) {
            label = markSessionObject(
                new this.host.fabric.FabricText(text, {
                    fontFamily: 'monospace',
                    fontSize: 12,
                    fill: '#ffffff',
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    ...(config.textOptions ?? {}),
                    originX: 'left',
                    originY: 'top',
                    selectable: false,
                    evented: false,
                    hasControls: false,
                    excludeFromExport: true,
                }),
                'annotationLabel',
            ) as FabricNS.FabricText;
            this.markPresentation(label, descriptor.id);
            this.labels.set(object, label);
            placeSessionObject(this.host.requireCanvas('show an Annotation label'), label);
        } else if (label.text !== text) {
            label.set({ text });
        }
        const bounds = object.getBoundingRect();
        label.set({
            left: bounds.left,
            top: Math.max(0, bounds.top - label.getScaledHeight() - (config.offset ?? 3)),
            visible: true,
        });
        label.setCoords();
    }

    private labelText(
        config: Readonly<AnnotationLabelConfig>,
        descriptor: AnnotationDescriptor,
    ): string {
        if (!config.getText) return descriptor.name;
        try {
            const value = config.getText(descriptor);
            return typeof value === 'string' ? value : descriptor.name;
        } catch (error) {
            this.host.reportWarning(error, 'Annotation label.getText callback failed.');
            return descriptor.name;
        }
    }

    private synchronizeLockIndicator(
        object: AnnotationFabricObject,
        descriptor: AnnotationDescriptor,
    ): void {
        const config = this.options.lockIndicator;
        if (config === false || descriptor.hidden || !descriptor.locked) {
            this.removePresentation(this.lockIndicators, object);
            return;
        }
        let indicator = this.lockIndicators.get(object);
        if (!indicator) {
            indicator = this.createLockIndicator(config, descriptor.id);
            this.lockIndicators.set(object, indicator);
            placeSessionObject(
                this.host.requireCanvas('show an Annotation lock indicator'),
                indicator,
            );
        }
        const bounds = object.getBoundingRect();
        indicator.set({
            left: Math.max(0, bounds.left + bounds.width - config.size - config.offset),
            top: Math.max(0, bounds.top + config.offset),
            visible: true,
        });
        indicator.setCoords();
    }

    private createLockIndicator(
        config: Readonly<Required<AnnotationLockIndicatorConfig>>,
        ownerId: string,
    ): FabricNS.Group {
        const strokeWidth = Math.max(1, config.size / 10);
        const shackle = new this.host.fabric.Rect({
            left: config.size * 0.27,
            top: strokeWidth / 2,
            width: config.size * 0.46,
            height: config.size * 0.52,
            rx: config.size * 0.2,
            ry: config.size * 0.2,
            fill: 'transparent',
            stroke: config.iconColor,
            strokeWidth,
            selectable: false,
            evented: false,
        });
        const body = new this.host.fabric.Rect({
            left: strokeWidth / 2,
            top: config.size * 0.42,
            width: config.size - strokeWidth,
            height: config.size * 0.55,
            rx: config.size * 0.1,
            ry: config.size * 0.1,
            fill: config.backgroundColor,
            stroke: config.iconColor,
            strokeWidth,
            selectable: false,
            evented: false,
        });
        const keyhole = new this.host.fabric.Circle({
            left: config.size * 0.44,
            top: config.size * 0.6,
            radius: config.size * 0.07,
            fill: config.iconColor,
            selectable: false,
            evented: false,
        });
        const group = markSessionObject(
            new this.host.fabric.Group([shackle, body, keyhole], {
                originX: 'left',
                originY: 'top',
                selectable: false,
                evented: false,
                hasControls: false,
                excludeFromExport: true,
            }),
            'annotationLockIndicator',
        ) as FabricNS.Group;
        this.markPresentation(group, ownerId);
        return group;
    }

    private markPresentation(object: FabricNS.FabricObject, ownerId: string): void {
        const presentation = object as PresentationObject;
        presentation.annotationPresentation = true;
        presentation.annotationOwnerId = ownerId;
    }

    private removePresentation<T extends FabricNS.FabricObject>(
        collection: Map<AnnotationFabricObject, T>,
        owner: AnnotationFabricObject,
    ): void {
        const presentation = collection.get(owner);
        if (!presentation) return;
        collection.delete(owner);
        const canvas = this.host.getCanvas();
        if (canvas?.getObjects().includes(presentation)) canvas.remove(presentation);
        presentation.dispose();
    }
}

export function isAnnotationPresentationObject(object: FabricNS.FabricObject): boolean {
    return (object as unknown as Partial<PresentationObject>).annotationPresentation === true;
}
