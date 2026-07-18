import type { Disposable } from '../../sdk/index.js';
import type { AnnotationId, AnnotationMetadata } from '../../foundations/annotation/index.js';
export type TextReflectionBehavior = 'preserve-readable' | 'mirror';
export type TextAlignment = 'left' | 'center' | 'right' | 'justify';
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
export type TextAnnotationPluginOptions = Partial<TextAnnotationConfiguration>;
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
export interface TextEditingSession {
    readonly annotationId: AnnotationId;
    readonly text: string;
}
export interface TextAnnotationStatus {
    readonly configuration: Readonly<TextAnnotationConfiguration>;
    readonly editing: TextEditingSession | null;
}
export type TextAnnotationStatusListener = (status: TextAnnotationStatus) => void;
export interface TextAnnotationPluginApi {
    create(options?: TextAnnotationCreateOptions): Promise<AnnotationId>;
    beginEditing(id: AnnotationId): Promise<void>;
    commitEditing(): Promise<void>;
    cancelEditing(): Promise<void>;
    update(id: AnnotationId, patch: TextAnnotationUpdate): Promise<void>;
    configure(patch: Partial<TextAnnotationConfiguration>): Promise<void>;
    getConfiguration(): Readonly<TextAnnotationConfiguration>;
    getEditingSession(): TextEditingSession | null;
    subscribe(listener: TextAnnotationStatusListener): Disposable;
}
