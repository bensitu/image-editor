/**
 * Implements Text Annotation creation, editing, validation, codecs, and Foundation integration.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import { isSafeSerializedFabricObject } from '../../fabric/safe-fabric-serialization.js';
import type {
    BaseImageInfoPort,
    CoreDiagnosticsPort,
    Disposable,
    FabricRuntimePort,
} from '../../sdk/index.js';
import { createDisposable } from '../../sdk/index.js';
import type {
    AnnotationAuthoringPort,
    AnnotationFeatureDefinition,
    AnnotationId,
    AnnotationPluginApi,
    AnnotationUpdate,
} from '../../foundations/annotation/index.js';
import { AnnotationValidationError } from '../../foundations/annotation/index.js';
import {
    captureOverlayStateBounds,
    isOverlayStateBoundsGeometry,
    restoreOverlayStateBounds,
} from '../../foundations/overlay/index.js';
import type {
    TextAlignment,
    TextAnnotationConfiguration,
    TextAnnotationCreateOptions,
    TextAnnotationPluginOptions,
    TextAnnotationStatus,
    TextAnnotationStatusListener,
    TextAnnotationUpdate,
    TextEditingSession,
} from './text-annotation.js';

export const TEXT_ANNOTATION_KIND = 'annotation:text' as const;
const TEXT_PLUGIN_ID = 'annotation:text';
const MAX_TEXT_LENGTH = 20_000;
const MAX_FONT_FIELD_LENGTH = 256;
const MAX_TEXT_OBJECT_BYTES = 256 * 1024;
const MAX_TEXT_WIDTH = 100_000;
const MAX_COORDINATE = 10_000_000;

type TextHost = CoreDiagnosticsPort & FabricRuntimePort & BaseImageInfoPort;
type TextObject = FabricNS.Textbox & {
    editorOverlayLocked?: boolean;
    editable?: boolean;
    enterEditing?: () => void;
    exitEditing?: () => void;
    isEditing?: boolean;
};

interface TextFeatureUpdate {
    readonly text?: string;
    readonly fontSize?: number;
    readonly fontFamily?: string;
    readonly fontWeight?: string | number;
    readonly fill?: string;
    readonly backgroundColor?: string;
    readonly textAlign?: TextAlignment;
    readonly width?: number;
    readonly opacity?: number;
}

interface TextRuntimeSession {
    readonly annotationId: AnnotationId;
    readonly previewId: string;
    readonly preview: TextObject;
    readonly visibility: Disposable;
}

interface TextStateData {
    readonly version: 1;
    readonly text: string;
    readonly fontSize: number;
    readonly width: number;
    readonly fontFamily: string;
    readonly fontWeight: string | number;
    readonly fill: string;
    readonly backgroundColor: string;
    readonly textAlign: TextAlignment;
    readonly lineHeight: number;
    readonly opacity: number;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function validateText(value: unknown, label = 'Text'): string {
    if (typeof value !== 'string' || value.length > MAX_TEXT_LENGTH) {
        throw new AnnotationValidationError(
            `${label} must be a string of at most ${MAX_TEXT_LENGTH} characters.`,
        );
    }
    return value;
}

function validateFontField(value: unknown, label: string): string {
    if (
        typeof value !== 'string' ||
        value.length === 0 ||
        value.trim() !== value ||
        value.length > MAX_FONT_FIELD_LENGTH ||
        [...value].some((character) => character.charCodeAt(0) < 32)
    ) {
        throw new AnnotationValidationError(`${label} is invalid.`);
    }
    return value;
}

function validateFontWeight(value: unknown): string | number {
    if (
        (typeof value === 'string' &&
            value.length > 0 &&
            value.length <= 32 &&
            value.trim() === value) ||
        (typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 1_000)
    ) {
        return value;
    }
    throw new AnnotationValidationError('Text font weight is invalid.');
}

function validateFiniteRange(
    value: unknown,
    label: string,
    minimum: number,
    maximum: number,
): number {
    if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < minimum ||
        value > maximum
    ) {
        throw new AnnotationValidationError(`${label} must be from ${minimum} to ${maximum}.`);
    }
    return value;
}

function validateBoolean(value: unknown, label: string): boolean {
    if (typeof value !== 'boolean')
        throw new AnnotationValidationError(`${label} must be boolean.`);
    return value;
}

function validateAlignment(value: unknown): TextAlignment {
    if (value === 'left' || value === 'center' || value === 'right' || value === 'justify') {
        return value;
    }
    throw new AnnotationValidationError('Text alignment is invalid.');
}

function validateFallbacks(value: unknown): readonly string[] {
    if (!Array.isArray(value) || value.length > 8) {
        throw new AnnotationValidationError('Text font fallbacks are invalid.');
    }
    return Object.freeze([
        ...new Set(value.map((entry) => validateFontField(entry, 'Text font fallback'))),
    ]);
}

const defaultConfiguration: TextAnnotationConfiguration = Object.freeze({
    defaultText: 'Text',
    fontSize: 24,
    fontFamily: 'Arial',
    fontFallbacks: Object.freeze(['sans-serif']),
    fontWeight: 'normal',
    fill: '#111111',
    backgroundColor: '',
    textAlign: 'left',
    width: 220,
    opacity: 1,
    selectable: true,
    evented: true,
    editable: true,
    bindToImageTransform: false,
    reflectionBehavior: 'preserve-readable',
    namePrefix: 'Text',
});

export function resolveTextConfiguration(
    value: TextAnnotationPluginOptions | Partial<TextAnnotationConfiguration> = {},
    base: TextAnnotationConfiguration = defaultConfiguration,
): TextAnnotationConfiguration {
    if (!isPlainRecord(value)) {
        throw new AnnotationValidationError('Text configuration must be a plain object.');
    }
    const allowed = new Set(Object.keys(defaultConfiguration));
    if (Object.keys(value).some((key) => !allowed.has(key))) {
        throw new AnnotationValidationError('Text configuration contains unknown keys.');
    }
    const merged = { ...base, ...value };
    if (
        merged.reflectionBehavior !== 'preserve-readable' &&
        merged.reflectionBehavior !== 'mirror'
    ) {
        throw new AnnotationValidationError('Text reflection behavior is invalid.');
    }
    return Object.freeze({
        defaultText: validateText(merged.defaultText, 'Default Text'),
        fontSize: validateFiniteRange(merged.fontSize, 'Text font size', 1, 512),
        fontFamily: validateFontField(merged.fontFamily, 'Text font family'),
        fontFallbacks: validateFallbacks(merged.fontFallbacks),
        fontWeight: validateFontWeight(merged.fontWeight),
        fill: validateFontField(merged.fill, 'Text fill'),
        backgroundColor:
            merged.backgroundColor === ''
                ? ''
                : validateFontField(merged.backgroundColor, 'Text background color'),
        textAlign: validateAlignment(merged.textAlign),
        width: validateFiniteRange(merged.width, 'Text width', 1, MAX_TEXT_WIDTH),
        opacity: validateFiniteRange(merged.opacity, 'Text opacity', 0, 1),
        selectable: validateBoolean(merged.selectable, 'Text selectable'),
        evented: validateBoolean(merged.evented, 'Text evented'),
        editable: validateBoolean(merged.editable, 'Text editable'),
        bindToImageTransform: validateBoolean(
            merged.bindToImageTransform,
            'Text transform binding',
        ),
        reflectionBehavior: merged.reflectionBehavior,
        namePrefix: validateFontField(merged.namePrefix, 'Text name prefix'),
    });
}

function resolvedFontFamily(primary: string, fallbacks: readonly string[]): string {
    return [primary, ...fallbacks].join(', ');
}

function normalizeFeatureUpdate(value: unknown): TextFeatureUpdate {
    if (!isPlainRecord(value)) {
        throw new AnnotationValidationError('Text update must be a plain object.');
    }
    const allowed = new Set([
        'text',
        'fontSize',
        'fontFamily',
        'fontWeight',
        'fill',
        'backgroundColor',
        'textAlign',
        'width',
        'opacity',
    ]);
    if (Object.keys(value).some((key) => !allowed.has(key))) {
        throw new AnnotationValidationError('Text update contains unknown keys.');
    }
    return Object.freeze({
        ...(value.text !== undefined ? { text: validateText(value.text) } : {}),
        ...(value.fontSize !== undefined
            ? { fontSize: validateFiniteRange(value.fontSize, 'Text font size', 1, 512) }
            : {}),
        ...(value.fontFamily !== undefined
            ? { fontFamily: validateFontField(value.fontFamily, 'Text font family') }
            : {}),
        ...(value.fontWeight !== undefined
            ? { fontWeight: validateFontWeight(value.fontWeight) }
            : {}),
        ...(value.fill !== undefined ? { fill: validateFontField(value.fill, 'Text fill') } : {}),
        ...(value.backgroundColor !== undefined
            ? {
                  backgroundColor:
                      value.backgroundColor === ''
                          ? ''
                          : validateFontField(value.backgroundColor, 'Text background color'),
              }
            : {}),
        ...(value.textAlign !== undefined ? { textAlign: validateAlignment(value.textAlign) } : {}),
        ...(value.width !== undefined
            ? { width: validateFiniteRange(value.width, 'Text width', 1, MAX_TEXT_WIDTH) }
            : {}),
        ...(value.opacity !== undefined
            ? { opacity: validateFiniteRange(value.opacity, 'Text opacity', 0, 1) }
            : {}),
    });
}

function sharedUpdate(value: TextAnnotationUpdate): AnnotationUpdate {
    return Object.freeze({
        ...(value.name !== undefined ? { name: value.name } : {}),
        ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
        ...(value.hidden !== undefined ? { hidden: value.hidden } : {}),
        ...(value.locked !== undefined ? { locked: value.locked } : {}),
    });
}

function featureUpdate(value: TextAnnotationUpdate): TextFeatureUpdate {
    const fontFamily =
        value.fontFamily !== undefined || value.fontFallbacks !== undefined
            ? resolvedFontFamily(
                  value.fontFamily ?? 'Arial',
                  value.fontFallbacks ? validateFallbacks(value.fontFallbacks) : [],
              )
            : undefined;
    return normalizeFeatureUpdate({
        ...(value.text !== undefined ? { text: value.text } : {}),
        ...(value.fontSize !== undefined ? { fontSize: value.fontSize } : {}),
        ...(fontFamily !== undefined ? { fontFamily } : {}),
        ...(value.fontWeight !== undefined ? { fontWeight: value.fontWeight } : {}),
        ...(value.fill !== undefined ? { fill: value.fill } : {}),
        ...(value.backgroundColor !== undefined ? { backgroundColor: value.backgroundColor } : {}),
        ...(value.textAlign !== undefined ? { textAlign: value.textAlign } : {}),
        ...(value.width !== undefined ? { width: value.width } : {}),
        ...(value.opacity !== undefined ? { opacity: value.opacity } : {}),
    });
}

function isSerializedText(value: unknown): value is Record<string, unknown> {
    if (!isPlainRecord(value)) return false;
    try {
        if (!isSafeSerializedFabricObject(value, { rootTypes: ['textbox'] })) return false;
        const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
        const type = String(value.type ?? '').toLowerCase();
        return (
            bytes <= MAX_TEXT_OBJECT_BYTES &&
            type === 'textbox' &&
            typeof value.text === 'string' &&
            value.text.length <= MAX_TEXT_LENGTH &&
            Number.isFinite(value.left) &&
            Number.isFinite(value.top) &&
            Number.isFinite(value.width) &&
            Number.isFinite(value.fontSize)
        );
    } catch {
        return false;
    }
}

function isTextStateData(value: unknown): value is TextStateData {
    if (!isPlainRecord(value) || value.version !== 1) return false;
    try {
        validateText(value.text);
        validateFiniteRange(value.fontSize, 'Text font size ratio', 0.000_000_1, 100);
        validateFiniteRange(value.width, 'Text width ratio', 0.000_000_1, 100);
        validateFontField(value.fontFamily, 'Text font family');
        validateFontWeight(value.fontWeight);
        validateFontField(value.fill, 'Text fill');
        if (value.backgroundColor !== '') {
            validateFontField(value.backgroundColor, 'Text background color');
        }
        validateAlignment(value.textAlign);
        validateFiniteRange(value.lineHeight, 'Text line height', 0.1, 10);
        validateFiniteRange(value.opacity, 'Text opacity', 0, 1);
        return Object.keys(value).every((key) =>
            [
                'version',
                'text',
                'fontSize',
                'width',
                'fontFamily',
                'fontWeight',
                'fill',
                'backgroundColor',
                'textAlign',
                'lineHeight',
                'opacity',
            ].includes(key),
        );
    } catch {
        return false;
    }
}

export class TextAnnotationController implements Disposable {
    private configuration: TextAnnotationConfiguration;
    private session: TextRuntimeSession | null = null;
    private readonly listeners = new Set<TextAnnotationStatusListener>();
    private previewSequence = 0;
    private nameSequence = 0;
    private disposed = false;

    constructor(
        private readonly host: TextHost,
        private readonly annotations: AnnotationPluginApi,
        private readonly authoring: AnnotationAuthoringPort,
        options: TextAnnotationPluginOptions,
    ) {
        this.configuration = resolveTextConfiguration(options);
    }

    featureDefinition(): AnnotationFeatureDefinition<TextFeatureUpdate> {
        const definition: AnnotationFeatureDefinition<TextFeatureUpdate> = {
            kind: TEXT_ANNOTATION_KIND,
            ownerPluginId: TEXT_PLUGIN_ID,
            classify: (object) => object instanceof this.host.fabric.Textbox,
            codec: {
                type: 'annotation:textbox',
                version: '1.0.0',
                serialize: (object) => object.toObject(),
                validate: isSerializedText,
                deserialize: async (value, context) => {
                    if (!isSerializedText(value)) {
                        throw new AnnotationValidationError(
                            'Serialized Text Annotation data is malformed.',
                        );
                    }
                    const objects = await context.fabric.util.enlivenObjects<FabricNS.FabricObject>(
                        [value],
                    );
                    const object = objects[0];
                    if (!(object instanceof context.fabric.Textbox)) {
                        throw new AnnotationValidationError(
                            'Serialized Text Annotation did not restore a Textbox.',
                        );
                    }
                    return object;
                },
            },
            stateCodec: {
                type: 'annotation:text',
                version: '1.0.0',
                serialize: (object, context) => {
                    const text = object as TextObject;
                    return Object.freeze({
                        geometry: captureOverlayStateBounds(text, context),
                        data: Object.freeze({
                            version: 1,
                            text: text.text,
                            fontSize: context.toImageNormalizedScalar(text.fontSize),
                            width: context.toImageNormalizedScalar(text.width),
                            fontFamily: text.fontFamily,
                            fontWeight: text.fontWeight,
                            fill: typeof text.fill === 'string' ? text.fill : '#111111',
                            backgroundColor:
                                typeof text.backgroundColor === 'string'
                                    ? text.backgroundColor
                                    : '',
                            textAlign: validateAlignment(text.textAlign),
                            lineHeight: text.lineHeight,
                            opacity: text.opacity,
                        } satisfies TextStateData),
                    });
                },
                validate: (value) =>
                    isOverlayStateBoundsGeometry(value.geometry) && isTextStateData(value.data),
                deserialize: (value, context) => {
                    if (
                        !isOverlayStateBoundsGeometry(value.geometry) ||
                        !isTextStateData(value.data)
                    ) {
                        throw new AnnotationValidationError(
                            'Serialized Text Annotation State data is malformed.',
                        );
                    }
                    const data = value.data;
                    const object = new this.host.fabric.Textbox(data.text, {
                        left: 0,
                        top: 0,
                        width: context.toCanvasScalar(data.width),
                        fontSize: context.toCanvasScalar(data.fontSize),
                        fontFamily: data.fontFamily,
                        fontWeight: data.fontWeight,
                        fill: data.fill,
                        backgroundColor: data.backgroundColor,
                        textAlign: data.textAlign,
                        lineHeight: data.lineHeight,
                        opacity: data.opacity,
                        originX: 'left',
                        originY: 'top',
                    });
                    restoreOverlayStateBounds(object, value.geometry, context, this.host.fabric);
                    return object;
                },
            },
            normalizeUpdate: normalizeFeatureUpdate,
            hasUpdate: (object, patch) =>
                Object.entries(patch).some(
                    ([key, value]) => !Object.is(Reflect.get(object, key), value),
                ),
            applyUpdate: (object, patch) => {
                object.set(patch as Partial<FabricNS.TextboxProps>);
                object.setCoords();
            },
            bindToImageTransform: () => this.configuration.bindToImageTransform,
            preserveReadable: () => this.configuration.reflectionBehavior === 'preserve-readable',
        };
        return Object.freeze(definition);
    }

    async create(options: TextAnnotationCreateOptions = {}): Promise<AnnotationId> {
        this.assertActive('create Text');
        this.assertImageLoaded();
        if (!isPlainRecord(options as unknown)) {
            throw new AnnotationValidationError('Text creation options must be a plain object.');
        }
        const creation = options as TextAnnotationCreateOptions;
        const text = validateText(creation.text ?? this.configuration.defaultText);
        const left = validateFiniteRange(
            creation.left ?? 10,
            'Text left',
            -MAX_COORDINATE,
            MAX_COORDINATE,
        );
        const top = validateFiniteRange(
            creation.top ?? 10,
            'Text top',
            -MAX_COORDINATE,
            MAX_COORDINATE,
        );
        const width = validateFiniteRange(
            creation.width ?? this.configuration.width,
            'Text width',
            1,
            MAX_TEXT_WIDTH,
        );
        const fontSize = validateFiniteRange(
            creation.fontSize ?? this.configuration.fontSize,
            'Text font size',
            1,
            512,
        );
        const primaryFont = validateFontField(
            creation.fontFamily ?? this.configuration.fontFamily,
            'Text font family',
        );
        const fallbacks = creation.fontFallbacks
            ? validateFallbacks(creation.fontFallbacks)
            : this.configuration.fontFallbacks;
        const object = new this.host.fabric.Textbox(text, {
            left,
            top,
            width,
            fontSize,
            fontFamily: resolvedFontFamily(primaryFont, fallbacks),
            fontWeight: validateFontWeight(creation.fontWeight ?? this.configuration.fontWeight),
            fill: creation.fill ?? this.configuration.fill,
            backgroundColor: creation.backgroundColor ?? this.configuration.backgroundColor,
            textAlign: validateAlignment(creation.textAlign ?? this.configuration.textAlign),
            opacity: validateFiniteRange(
                creation.opacity ?? this.configuration.opacity,
                'Text opacity',
                0,
                1,
            ),
            angle: validateFiniteRange(creation.angle ?? 0, 'Text angle', -360_000, 360_000),
            selectable: creation.selectable ?? this.configuration.selectable,
            evented: creation.evented ?? this.configuration.evented,
            editable: creation.editable ?? this.configuration.editable,
            originX: 'left',
            originY: 'top',
        });
        return this.authoring.create({
            kind: TEXT_ANNOTATION_KIND,
            object,
            name: creation.name ?? `${this.configuration.namePrefix} ${++this.nameSequence}`,
            metadata: creation.metadata,
            hidden: creation.hidden,
            locked: creation.locked,
            select: creation.select,
            operationId: 'annotation-text:create',
        });
    }

    async beginEditing(id: AnnotationId): Promise<void> {
        this.assertActive('begin Text editing');
        this.assertImageLoaded();
        if (this.session) {
            throw new AnnotationValidationError('A Text editing session is already active.');
        }
        const descriptor = this.annotations.get(id);
        const source = this.authoring.getObject(id, TEXT_ANNOTATION_KIND) as TextObject | null;
        if (!descriptor || !source) {
            throw new AnnotationValidationError(`Text Annotation "${id}" was not found.`);
        }
        if (descriptor.locked) {
            throw new AnnotationValidationError('Locked Text cannot enter editing.');
        }
        const preview = (await source.clone()) as TextObject;
        const previewId = `annotation-text:edit:${++this.previewSequence}`;
        let visibility: Disposable | null = null;
        let added = false;
        try {
            preview.set({ visible: true, selectable: true, evented: true, editable: true });
            visibility = this.authoring.hideForPreview([id]);
            this.authoring.addPreview({
                id: previewId,
                ownerKind: TEXT_ANNOTATION_KIND,
                object: preview,
                interactive: true,
                select: false,
            });
            added = true;
            preview.enterEditing?.();
        } catch (error) {
            try {
                if (added) this.authoring.removePreview([previewId]);
                else preview.dispose();
            } finally {
                visibility?.dispose();
            }
            throw error;
        }
        this.session = Object.freeze({ annotationId: id, previewId, preview, visibility });
        this.emitStatus();
    }

    async commitEditing(): Promise<void> {
        this.assertActive('commit Text editing');
        const session = this.session;
        if (!session) return;
        const patch = normalizeFeatureUpdate({
            text: String(session.preview.text ?? ''),
            fontSize: session.preview.fontSize,
            fontFamily: session.preview.fontFamily,
            fontWeight: session.preview.fontWeight,
            fill: session.preview.fill,
            backgroundColor: session.preview.backgroundColor,
            textAlign: session.preview.textAlign,
            width: session.preview.width,
            opacity: session.preview.opacity,
        });
        this.closeSession();
        await this.authoring.updateFeature({
            id: session.annotationId,
            kind: TEXT_ANNOTATION_KIND,
            patch,
            operationId: 'annotation-text:commit-edit',
        });
    }

    cancelEditing(): void {
        this.assertActive('cancel Text editing');
        if (!this.session) return;
        this.closeSession();
    }

    update(id: AnnotationId, patch: TextAnnotationUpdate): Promise<void> {
        this.assertActive('update Text');
        if (!isPlainRecord(patch as unknown)) {
            return Promise.reject(new AnnotationValidationError('Text update must be an object.'));
        }
        if (this.session?.annotationId === id) {
            return Promise.reject(
                new AnnotationValidationError('Commit or cancel Text editing before updating it.'),
            );
        }
        return this.authoring.updateFeature({
            id,
            kind: TEXT_ANNOTATION_KIND,
            patch: featureUpdate(patch),
            shared: sharedUpdate(patch),
            operationId: 'annotation-text:update',
        });
    }

    configure(patch: Partial<TextAnnotationConfiguration>): void {
        this.assertActive('configure Text');
        this.configuration = resolveTextConfiguration(patch, this.configuration);
        this.emitStatus();
    }

    getConfiguration(): Readonly<TextAnnotationConfiguration> {
        this.assertActive('read Text configuration');
        return Object.freeze({
            ...this.configuration,
            fontFallbacks: Object.freeze([...this.configuration.fontFallbacks]),
        });
    }

    getEditingSession(): TextEditingSession | null {
        this.assertActive('read Text editing state');
        return this.session
            ? Object.freeze({
                  annotationId: this.session.annotationId,
                  text: String(this.session.preview.text ?? ''),
              })
            : null;
    }

    subscribe(listener: TextAnnotationStatusListener): Disposable {
        this.assertActive('subscribe to Text status');
        if (typeof listener !== 'function') {
            throw new AnnotationValidationError('Text status listener must be a function.');
        }
        this.listeners.add(listener);
        return createDisposable(() => {
            this.listeners.delete(listener);
        });
    }

    closeForImage(): void {
        if (this.session) this.closeSession();
    }

    dispose(): void {
        if (this.disposed) return;
        if (this.session) this.closeSession();
        this.listeners.clear();
        this.disposed = true;
    }

    private closeSession(): void {
        const session = this.session;
        if (!session) return;
        this.session = null;
        session.preview.exitEditing?.();
        this.authoring.removePreview([session.previewId]);
        session.visibility.dispose();
        this.emitStatus();
    }

    private emitStatus(): void {
        if (this.disposed || this.listeners.size === 0) return;
        const status: TextAnnotationStatus = Object.freeze({
            configuration: this.getConfiguration(),
            editing: this.getEditingSession(),
        });
        for (const listener of [...this.listeners]) {
            try {
                listener(status);
            } catch (error) {
                this.host.reportWarning(error, 'A Text Annotation status listener failed.');
            }
        }
    }

    private assertImageLoaded(): void {
        if (!this.host.isImageLoaded()) {
            throw new AnnotationValidationError('Text Annotation requires a loaded image.');
        }
    }

    private assertActive(operation: string): void {
        if (this.disposed) {
            throw new AnnotationValidationError(`Cannot ${operation} after disposal.`);
        }
    }
}
