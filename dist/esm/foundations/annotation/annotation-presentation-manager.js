import { markSessionObject, placeSessionObject } from '../../utils/internal-layer-placement.js';
import { AnnotationValidationError } from './annotation-errors.js';
const DEFAULT_LOCK_INDICATOR = Object.freeze({
    size: 16,
    offset: 3,
    backgroundColor: '#111827',
    iconColor: '#ffffff',
});
function isPlainRecord(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function finiteRange(value, label, minimum, maximum) {
    if (value === undefined)
        return undefined;
    if (typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < minimum ||
        value > maximum) {
        throw new AnnotationValidationError(`${label} must be a finite number from ${minimum} through ${maximum}.`);
    }
    return value;
}
function color(value, label) {
    if (value === undefined)
        return undefined;
    if (typeof value !== 'string' || value.length === 0 || value.length > 256) {
        throw new AnnotationValidationError(`${label} must be a non-empty CSS color string.`);
    }
    return value;
}
function nullableColor(value, label) {
    if (value === null)
        return null;
    return color(value, label);
}
function resolveHoverStyle(value) {
    if (value === undefined || value === false)
        return false;
    if (!isPlainRecord(value)) {
        throw new AnnotationValidationError('Annotation hoverStyle must be an object or false.');
    }
    const allowed = new Set(['fill', 'opacity', 'stroke', 'strokeWidth']);
    if (Object.keys(value).some((key) => !allowed.has(key))) {
        throw new AnnotationValidationError('Annotation hoverStyle contains unknown keys.');
    }
    return Object.freeze({
        ...(value.fill !== undefined
            ? { fill: nullableColor(value.fill, 'Annotation hover fill') }
            : {}),
        ...(value.opacity !== undefined
            ? { opacity: finiteRange(value.opacity, 'Annotation hover opacity', 0, 1) }
            : {}),
        ...(value.stroke !== undefined
            ? { stroke: nullableColor(value.stroke, 'Annotation hover stroke') }
            : {}),
        ...(value.strokeWidth !== undefined
            ? {
                strokeWidth: finiteRange(value.strokeWidth, 'Annotation hover strokeWidth', 0, 256),
            }
            : {}),
    });
}
function resolveControlStyle(value) {
    if (value === undefined)
        return Object.freeze({});
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
        throw new AnnotationValidationError('Annotation controlStyle.transparentCorners must be boolean.');
    }
    return Object.freeze({
        ...(value.borderColor !== undefined
            ? { borderColor: color(value.borderColor, 'Annotation borderColor') }
            : {}),
        ...(value.cornerColor !== undefined
            ? { cornerColor: color(value.cornerColor, 'Annotation cornerColor') }
            : {}),
        ...(value.cornerStrokeColor !== undefined
            ? {
                cornerStrokeColor: color(value.cornerStrokeColor, 'Annotation cornerStrokeColor'),
            }
            : {}),
        ...(value.cornerSize !== undefined
            ? {
                cornerSize: finiteRange(value.cornerSize, 'Annotation cornerSize', 1, 128),
            }
            : {}),
        ...(value.touchCornerSize !== undefined
            ? {
                touchCornerSize: finiteRange(value.touchCornerSize, 'Annotation touchCornerSize', 1, 256),
            }
            : {}),
        ...(value.transparentCorners === undefined
            ? {}
            : { transparentCorners: value.transparentCorners }),
        ...(value.padding !== undefined
            ? {
                padding: finiteRange(value.padding, 'Annotation control padding', 0, 128),
            }
            : {}),
    });
}
function resolveLabel(value) {
    var _a, _b;
    if (value === undefined || value === false)
        return false;
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
        showOn: (_a = value.showOn) !== null && _a !== void 0 ? _a : 'selected',
        offset: (_b = finiteRange(value.offset, 'Annotation label offset', 0, 256)) !== null && _b !== void 0 ? _b : 3,
        ...(value.getText
            ? {
                getText: value.getText,
            }
            : {}),
        ...(value.textOptions
            ? {
                textOptions: Object.freeze({
                    ...value.textOptions,
                }),
            }
            : {}),
    });
}
function resolveLockIndicator(value) {
    var _a, _b, _c, _d;
    if (value === false)
        return false;
    if (value !== undefined && !isPlainRecord(value)) {
        throw new AnnotationValidationError('Annotation lockIndicator must be an object or false.');
    }
    const config = value !== null && value !== void 0 ? value : {};
    const allowed = new Set(['size', 'offset', 'backgroundColor', 'iconColor']);
    if (Object.keys(config).some((key) => !allowed.has(key))) {
        throw new AnnotationValidationError('Annotation lockIndicator contains unknown keys.');
    }
    return Object.freeze({
        size: (_a = finiteRange(config.size, 'Annotation lock indicator size', 8, 64)) !== null && _a !== void 0 ? _a : DEFAULT_LOCK_INDICATOR.size,
        offset: (_b = finiteRange(config.offset, 'Annotation lock indicator offset', 0, 64)) !== null && _b !== void 0 ? _b : DEFAULT_LOCK_INDICATOR.offset,
        backgroundColor: (_c = color(config.backgroundColor, 'Annotation lock indicator backgroundColor')) !== null && _c !== void 0 ? _c : DEFAULT_LOCK_INDICATOR.backgroundColor,
        iconColor: (_d = color(config.iconColor, 'Annotation lock indicator iconColor')) !== null && _d !== void 0 ? _d : DEFAULT_LOCK_INDICATOR.iconColor,
    });
}
export function resolveAnnotationPresentationOptions(options) {
    return Object.freeze({
        exportByDefault: options.exportByDefault !== false,
        hoverStyle: resolveHoverStyle(options.hoverStyle),
        controlStyle: resolveControlStyle(options.controlStyle),
        label: resolveLabel(options.label),
        lockIndicator: resolveLockIndicator(options.lockIndicator),
    });
}
export class AnnotationPresentationManager {
    constructor(host, options, describe, isSelected) {
        Object.defineProperty(this, "host", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: host
        });
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: options
        });
        Object.defineProperty(this, "describe", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: describe
        });
        Object.defineProperty(this, "isSelected", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: isSelected
        });
        Object.defineProperty(this, "labels", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "lockIndicators", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "hoverBindings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    withBaseStyle(object, task) {
        const binding = this.suspendHover(object);
        try {
            return task();
        }
        finally {
            this.resumeHover(object, binding);
        }
    }
    async withBaseStyleAsync(object, task) {
        const binding = this.suspendHover(object);
        try {
            return await task();
        }
        finally {
            this.resumeHover(object, binding);
        }
    }
    synchronize(object) {
        const descriptor = this.describe(object);
        if (!descriptor)
            return;
        this.applyControlStyle(object);
        this.ensureHoverBinding(object);
        if (descriptor.hidden || descriptor.locked)
            this.restoreHover(object);
        this.synchronizeLabel(object, descriptor);
        this.synchronizeLockIndicator(object, descriptor);
        this.host.requestRender();
    }
    synchronizeAll(objects) {
        const live = new Set(objects);
        for (const object of [...this.labels.keys()]) {
            if (!live.has(object))
                this.removeFor(object);
        }
        for (const object of [...this.lockIndicators.keys()]) {
            if (!live.has(object))
                this.removeFor(object);
        }
        for (const object of [...this.hoverBindings.keys()]) {
            if (!live.has(object))
                this.removeFor(object);
        }
        for (const object of objects)
            this.synchronize(object);
    }
    removeFor(object) {
        this.removePresentation(this.labels, object);
        this.removePresentation(this.lockIndicators, object);
        this.detachHoverBinding(object);
    }
    reset() {
        for (const object of new Set([
            ...this.labels.keys(),
            ...this.lockIndicators.keys(),
            ...this.hoverBindings.keys(),
        ])) {
            this.removeFor(object);
        }
        this.host.requestRender();
    }
    applyControlStyle(object) {
        if (Object.keys(this.options.controlStyle).length === 0)
            return;
        object.set(this.options.controlStyle);
        object.setCoords();
    }
    ensureHoverBinding(object) {
        const style = this.options.hoverStyle;
        if (style === false || this.hoverBindings.has(object))
            return;
        const binding = {
            hovered: false,
            original: null,
            over: () => {
                if (object.editorOverlayHidden || object.editorOverlayLocked)
                    return;
                binding.hovered = true;
                if (binding.original)
                    return;
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
    restoreHover(object) {
        const binding = this.hoverBindings.get(object);
        if (!(binding === null || binding === void 0 ? void 0 : binding.original))
            return;
        object.set(binding.original);
        object.setCoords();
        binding.original = null;
    }
    suspendHover(object) {
        const binding = this.hoverBindings.get(object);
        if (!(binding === null || binding === void 0 ? void 0 : binding.original))
            return null;
        object.set(binding.original);
        object.setCoords();
        binding.original = null;
        return binding;
    }
    resumeHover(object, binding) {
        if (!binding || this.hoverBindings.get(object) !== binding || binding.original)
            return;
        if (object.editorOverlayHidden || object.editorOverlayLocked) {
            binding.hovered = false;
            return;
        }
        if (!binding.hovered)
            return;
        const style = this.options.hoverStyle;
        if (style === false)
            return;
        binding.original = this.captureHoverProperties(object, style);
        object.set(style);
        object.setCoords();
        this.host.requestRender();
    }
    captureHoverProperties(object, style) {
        return Object.freeze({
            ...('fill' in style ? { fill: object.fill } : {}),
            ...('opacity' in style ? { opacity: object.opacity } : {}),
            ...('stroke' in style ? { stroke: object.stroke } : {}),
            ...('strokeWidth' in style ? { strokeWidth: object.strokeWidth } : {}),
        });
    }
    detachHoverBinding(object) {
        const binding = this.hoverBindings.get(object);
        if (!binding)
            return;
        binding.hovered = false;
        this.restoreHover(object);
        object.off('mouseover', binding.over);
        object.off('mouseout', binding.out);
        this.hoverBindings.delete(object);
    }
    synchronizeLabel(object, descriptor) {
        var _a, _b;
        const config = this.options.label;
        if (config === false) {
            this.removePresentation(this.labels, object);
            return;
        }
        const shouldShow = !descriptor.hidden && (config.showOn === 'always' || this.isSelected(descriptor.id));
        if (!shouldShow) {
            this.removePresentation(this.labels, object);
            return;
        }
        let label = this.labels.get(object);
        const text = this.labelText(config, descriptor);
        if (!label) {
            label = markSessionObject(new this.host.fabric.FabricText(text, {
                fontFamily: 'monospace',
                fontSize: 12,
                fill: '#ffffff',
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                ...((_a = config.textOptions) !== null && _a !== void 0 ? _a : {}),
                originX: 'left',
                originY: 'top',
                selectable: false,
                evented: false,
                hasControls: false,
                excludeFromExport: true,
            }), 'annotationLabel');
            this.markPresentation(label, descriptor.id);
            this.labels.set(object, label);
            placeSessionObject(this.host.requireCanvas('show an Annotation label'), label);
        }
        else if (label.text !== text) {
            label.set({ text });
        }
        const bounds = object.getBoundingRect();
        label.set({
            left: bounds.left,
            top: Math.max(0, bounds.top - label.getScaledHeight() - ((_b = config.offset) !== null && _b !== void 0 ? _b : 3)),
            visible: true,
        });
        label.setCoords();
    }
    labelText(config, descriptor) {
        if (!config.getText)
            return descriptor.name;
        try {
            const value = config.getText(descriptor);
            return typeof value === 'string' ? value : descriptor.name;
        }
        catch (error) {
            this.host.reportWarning(error, 'Annotation label.getText callback failed.');
            return descriptor.name;
        }
    }
    synchronizeLockIndicator(object, descriptor) {
        const config = this.options.lockIndicator;
        if (config === false || descriptor.hidden || !descriptor.locked) {
            this.removePresentation(this.lockIndicators, object);
            return;
        }
        let indicator = this.lockIndicators.get(object);
        if (!indicator) {
            indicator = this.createLockIndicator(config, descriptor.id);
            this.lockIndicators.set(object, indicator);
            placeSessionObject(this.host.requireCanvas('show an Annotation lock indicator'), indicator);
        }
        const bounds = object.getBoundingRect();
        indicator.set({
            left: Math.max(0, bounds.left + bounds.width - config.size - config.offset),
            top: Math.max(0, bounds.top + config.offset),
            visible: true,
        });
        indicator.setCoords();
    }
    createLockIndicator(config, ownerId) {
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
        const group = markSessionObject(new this.host.fabric.Group([shackle, body, keyhole], {
            originX: 'left',
            originY: 'top',
            selectable: false,
            evented: false,
            hasControls: false,
            excludeFromExport: true,
        }), 'annotationLockIndicator');
        this.markPresentation(group, ownerId);
        return group;
    }
    markPresentation(object, ownerId) {
        const presentation = object;
        presentation.annotationPresentation = true;
        presentation.annotationOwnerId = ownerId;
    }
    removePresentation(collection, owner) {
        const presentation = collection.get(owner);
        if (!presentation)
            return;
        collection.delete(owner);
        const canvas = this.host.getCanvas();
        if (canvas === null || canvas === void 0 ? void 0 : canvas.getObjects().includes(presentation))
            canvas.remove(presentation);
        presentation.dispose();
    }
}
export function isAnnotationPresentationObject(object) {
    return object.annotationPresentation === true;
}
//# sourceMappingURL=annotation-presentation-manager.js.map