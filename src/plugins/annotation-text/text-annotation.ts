/**
 * Declares Text Annotation configuration, editing session, status, update, and Plugin API contracts.
 *
 * @module
 */

import type { Disposable } from '../../sdk/index.js';
import type { AnnotationId, AnnotationMetadata } from '../../foundations/annotation/index.js';

/** Glyph behavior when Base Image geometry contains a reflection. */
export type TextReflectionBehavior = 'preserve-readable' | 'mirror';
/** Horizontal alignment supported by Text Annotations. */
export type TextAlignment = 'left' | 'center' | 'right' | 'justify';

/** Fully normalized defaults for Text creation and editing. */
export interface TextAnnotationConfiguration {
    readonly defaultText: string;
    readonly fontSize: number;
    readonly fontFamily: string;
    readonly fontFallbacks: readonly string[];
    readonly fontWeight: string | number;
    readonly fill: string;
    readonly backgroundColor: string;
    readonly textAlign: TextAlignment;
    readonly width: number;
    readonly opacity: number;
    readonly selectable: boolean;
    readonly evented: boolean;
    readonly editable: boolean;
    readonly bindToImageTransform: boolean;
    readonly reflectionBehavior: TextReflectionBehavior;
    readonly namePrefix: string;
}

/** Construction options for the Text Annotation Plugin. */
export type TextAnnotationPluginOptions = Partial<TextAnnotationConfiguration>;

/** Content, geometry, style, metadata, and selection for one Text Annotation. */
export interface TextAnnotationCreateOptions {
    readonly text?: string;
    readonly left?: number;
    readonly top?: number;
    readonly width?: number;
    readonly fontSize?: number;
    readonly fontFamily?: string;
    readonly fontFallbacks?: readonly string[];
    readonly fontWeight?: string | number;
    readonly fill?: string;
    readonly backgroundColor?: string;
    readonly textAlign?: TextAlignment;
    readonly opacity?: number;
    readonly angle?: number;
    readonly selectable?: boolean;
    readonly evented?: boolean;
    readonly editable?: boolean;
    readonly name?: string;
    readonly metadata?: AnnotationMetadata;
    readonly hidden?: boolean;
    readonly locked?: boolean;
    readonly select?: boolean;
}

/** Feature-specific and shared changes for an existing Text Annotation. */
export interface TextAnnotationUpdate {
    readonly text?: string;
    readonly fontSize?: number;
    readonly fontFamily?: string;
    readonly fontFallbacks?: readonly string[];
    readonly fontWeight?: string | number;
    readonly fill?: string;
    readonly backgroundColor?: string;
    readonly textAlign?: TextAlignment;
    readonly width?: number;
    readonly opacity?: number;
    readonly name?: string;
    readonly metadata?: AnnotationMetadata;
    readonly hidden?: boolean;
    readonly locked?: boolean;
}

/** Immutable view of the active Text editing session. */
export interface TextEditingSession {
    readonly annotationId: AnnotationId;
    readonly text: string;
}

/** Observable Text configuration and editing state. */
export interface TextAnnotationStatus {
    readonly configuration: Readonly<TextAnnotationConfiguration>;
    readonly editing: TextEditingSession | null;
}

/** Listener invoked when Text configuration or editing state changes. */
export type TextAnnotationStatusListener = (status: TextAnnotationStatus) => void;

/** Public Text creation, editing, update, and configuration operations. */
export interface TextAnnotationPluginApi {
    /** Activates Text authoring without creating an Annotation. */
    enter(): Promise<void>;
    /** Exits Text authoring and resolves any active editing session. */
    exit(): Promise<void>;
    /** Creates one Text Annotation as a committed mutation. */
    create(options?: TextAnnotationCreateOptions): Promise<AnnotationId>;
    /** Starts transient editing for an existing editable Text Annotation. */
    beginEditing(id: AnnotationId): Promise<void>;
    /** Commits the active Text editing session as one mutation. */
    commitEditing(): Promise<void>;
    /** Restores the active Text editing session to its preceding state. */
    cancelEditing(): Promise<void>;
    /** Applies Text content, style, or metadata changes transactionally. */
    update(id: AnnotationId, patch: TextAnnotationUpdate): Promise<void>;
    /** Updates validated defaults and refreshes active authoring state. */
    configure(patch: Partial<TextAnnotationConfiguration>): Promise<void>;
    /** Returns immutable normalized Text configuration. */
    getConfiguration(): Readonly<TextAnnotationConfiguration>;
    /** Returns the active editing session, or `null` when inactive. */
    getEditingSession(): TextEditingSession | null;
    /** Subscribes to Text configuration and editing state changes. */
    subscribe(listener: TextAnnotationStatusListener): Disposable;
}
