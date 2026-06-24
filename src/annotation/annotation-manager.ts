/**
 * Annotation CRUD, selection, list rendering, and update helpers.
 *
 * The editor runtime owns canvas state and passes a small context bundle
 * into these helpers so Text and Draw annotations share one removal/update
 * implementation.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import {
    isAnnotationObject,
    isDrawAnnotationObject,
    isTextAnnotationObject,
    type AnnotationObject,
    type AnnotationUpdateConfig,
    type DrawAnnotationObject,
    type OverlayListOrder,
    type RemoveAllAnnotationsOptions,
    type TextAnnotationObject,
} from '../core/public-types.js';
import { syncAnnotationRuntimeState } from './annotation-style.js';
import { isAnnotationLocked, isAnnotationUnlocked } from './annotation-lock.js';

export interface AnnotationManagerContext {
    canvas: FabricNS.Canvas;
    saveCanvasState(): void;
    updateUi(): void;
}

export interface AnnotationListContext {
    canvas: FabricNS.Canvas | null;
    /**
     * Returns the current canvas reference at click time. When omitted, the
     * list falls back to `canvas` for legacy unit contexts.
     */
    getCanvas?(): FabricNS.Canvas | null;
    getListElement(): HTMLElement | null | undefined;
    /**
     * DOM render order for the annotation list. 'front-to-back' mirrors
     * layer-panel behavior by showing the topmost overlay first.
     */
    listOrder?: OverlayListOrder;
    onAnnotationSelected(annotation: AnnotationObject): void;
}

function isActiveSelectionObject(object: FabricNS.FabricObject | null | undefined): boolean {
    if (!object) return false;
    const type = typeof object.type === 'string' ? object.type.toLowerCase() : '';
    if (type === 'activeselection') return true;
    const isType = (object as { isType?: (...types: string[]) => boolean }).isType;
    return (
        typeof isType === 'function' &&
        (isType.call(object, 'ActiveSelection') || isType.call(object, 'activeSelection'))
    );
}

export function getActiveSelectionObjects(canvas: FabricNS.Canvas): FabricNS.FabricObject[] {
    const active = canvas.getActiveObject();
    if (!active) return [];
    if (!isActiveSelectionObject(active)) return [active];
    const getObjects = (active as { getObjects?: () => FabricNS.FabricObject[] }).getObjects;
    return typeof getObjects === 'function' ? getObjects.call(active) : [];
}

export function getAnnotations(canvas: FabricNS.Canvas): AnnotationObject[] {
    return canvas.getObjects().filter(isAnnotationObject).slice();
}

function orderAnnotationsForList(
    annotations: readonly AnnotationObject[],
    order: OverlayListOrder | undefined,
): AnnotationObject[] {
    const ordered = annotations.slice();
    return order === 'back-to-front' ? ordered : ordered.reverse();
}

export function getSelectedAnnotations(canvas: FabricNS.Canvas): AnnotationObject[] {
    return getActiveSelectionObjects(canvas).filter(isAnnotationObject);
}

function snapshotAnnotation(annotation: AnnotationObject): string {
    return JSON.stringify({
        text: (annotation as { text?: unknown }).text,
        fontSize: (annotation as { fontSize?: unknown }).fontSize,
        fontFamily: (annotation as { fontFamily?: unknown }).fontFamily,
        fontWeight: (annotation as { fontWeight?: unknown }).fontWeight,
        fill: (annotation as { fill?: unknown }).fill,
        backgroundColor: (annotation as { backgroundColor?: unknown }).backgroundColor,
        textAlign: (annotation as { textAlign?: unknown }).textAlign,
        width: annotation.width,
        stroke: annotation.stroke,
        strokeWidth: annotation.strokeWidth,
        opacity: annotation.opacity,
        visible: annotation.visible,
        selectable: annotation.selectable,
        evented: annotation.evented,
        hasControls: annotation.hasControls,
        editable: isTextAnnotationObject(annotation)
            ? (annotation as TextAnnotationObject & { editable?: unknown }).editable
            : undefined,
        annotationHidden: annotation.annotationHidden,
        annotationLocked: annotation.annotationLocked,
        annotationSelectable: annotation.annotationSelectable,
        annotationEvented: annotation.annotationEvented,
        annotationHasControls: annotation.annotationHasControls,
        annotationEditable: annotation.annotationEditable,
    });
}

function setAnnotationProps(
    annotation: AnnotationObject,
    props: Partial<FabricNS.FabricObjectProps> & Record<string, unknown>,
): void {
    annotation.set(props);
}

function getCurrentAnnotationListCanvas(context: AnnotationListContext): FabricNS.Canvas | null {
    return context.getCanvas?.() ?? context.canvas;
}

function updateTextAnnotation(
    annotation: TextAnnotationObject,
    config: AnnotationUpdateConfig,
): void {
    const props: Record<string, unknown> = {};
    const raw = config as Record<string, unknown>;
    if (typeof raw.text === 'string') props.text = raw.text;
    if (typeof raw.fontSize === 'number' && Number.isFinite(raw.fontSize) && raw.fontSize > 0) {
        props.fontSize = raw.fontSize;
    }
    if (typeof raw.fontFamily === 'string') props.fontFamily = raw.fontFamily;
    if (typeof raw.fontWeight === 'string' || typeof raw.fontWeight === 'number') {
        props.fontWeight = raw.fontWeight;
    }
    if (typeof raw.fill === 'string') props.fill = raw.fill;
    if (typeof raw.backgroundColor === 'string') props.backgroundColor = raw.backgroundColor;
    if (
        raw.textAlign === 'left' ||
        raw.textAlign === 'center' ||
        raw.textAlign === 'right' ||
        raw.textAlign === 'justify'
    ) {
        props.textAlign = raw.textAlign;
    }
    if (typeof raw.width === 'number' && Number.isFinite(raw.width) && raw.width > 0) {
        props.width = raw.width;
    }
    if (Object.keys(props).length > 0) setAnnotationProps(annotation, props);
}

function updateDrawAnnotation(
    annotation: DrawAnnotationObject,
    config: AnnotationUpdateConfig,
): void {
    const props: Record<string, unknown> = {};
    const raw = config as Record<string, unknown>;
    if (typeof raw.stroke === 'string') props.stroke = raw.stroke;
    if (
        typeof raw.strokeWidth === 'number' &&
        Number.isFinite(raw.strokeWidth) &&
        raw.strokeWidth > 0
    ) {
        props.strokeWidth = raw.strokeWidth;
    }
    if (typeof raw.opacity === 'number' && Number.isFinite(raw.opacity)) {
        props.opacity = Math.max(0, Math.min(1, raw.opacity));
    }
    if (Object.keys(props).length > 0) setAnnotationProps(annotation, props);
}

export function updateAnnotationObject(
    annotation: AnnotationObject,
    config: AnnotationUpdateConfig,
): boolean {
    const before = snapshotAnnotation(annotation);
    const raw = config as Record<string, unknown>;

    if (typeof raw.annotationHidden === 'boolean') {
        annotation.annotationHidden = raw.annotationHidden;
    }
    if (typeof raw.annotationLocked === 'boolean') {
        annotation.annotationLocked = raw.annotationLocked;
    }

    const lockedAfter = isAnnotationLocked(annotation);
    if (!lockedAfter) {
        if (typeof raw.selectable === 'boolean') {
            annotation.annotationSelectable = raw.selectable;
        }
        if (typeof raw.evented === 'boolean') {
            annotation.annotationEvented = raw.evented;
        }
        if (typeof raw.hasControls === 'boolean') {
            annotation.annotationHasControls = raw.hasControls;
        }
        if (isTextAnnotationObject(annotation)) {
            if (typeof raw.editable === 'boolean') {
                annotation.annotationEditable = raw.editable;
            }
            updateTextAnnotation(annotation, config);
        }
        if (isDrawAnnotationObject(annotation)) updateDrawAnnotation(annotation, config);
    }

    syncAnnotationRuntimeState(annotation);
    return snapshotAnnotation(annotation) !== before;
}

export function updateAnnotation(
    context: AnnotationManagerContext,
    annotationId: number,
    config: AnnotationUpdateConfig,
): boolean {
    const target = getAnnotations(context.canvas).find(
        (annotation) => annotation.annotationId === annotationId,
    );
    if (!target) return false;
    const changed = updateAnnotationObject(target, config);
    if (!changed) return false;
    context.canvas.requestRenderAll();
    context.saveCanvasState();
    context.updateUi();
    return true;
}

export function updateSelectedAnnotation(
    context: AnnotationManagerContext,
    config: AnnotationUpdateConfig,
): boolean {
    const selectedAnnotations = getSelectedAnnotations(context.canvas);
    if (selectedAnnotations.length === 0) return false;
    const changed = selectedAnnotations
        .map((annotation) => updateAnnotationObject(annotation, config))
        .some(Boolean);
    if (!changed) return false;
    context.canvas.requestRenderAll();
    context.saveCanvasState();
    context.updateUi();
    return true;
}

export function removeAnnotationObjects(
    context: AnnotationManagerContext,
    objects: AnnotationObject[],
    options: RemoveAllAnnotationsOptions = {},
): number {
    const force = options.force === true;
    const removable = objects.filter((annotation) => force || isAnnotationUnlocked(annotation));
    if (removable.length === 0) return 0;

    for (const annotation of removable) {
        context.canvas.remove(annotation);
    }
    context.canvas.discardActiveObject();
    context.canvas.renderAll();
    if (options.saveHistory !== false) context.saveCanvasState();
    context.updateUi();
    return removable.length;
}

export function removeSelectedAnnotation(context: AnnotationManagerContext): number {
    return removeAnnotationObjects(context, getSelectedAnnotations(context.canvas));
}

export function removeAllAnnotations(
    context: AnnotationManagerContext,
    options: RemoveAllAnnotationsOptions = {},
): number {
    return removeAnnotationObjects(context, getAnnotations(context.canvas), options);
}

export function renderAnnotationList(context: AnnotationListContext): void {
    const listEl = context.getListElement();
    const canvas = getCurrentAnnotationListCanvas(context);
    if (!listEl || !canvas) return;
    const ownerDocument = listEl.ownerDocument;

    listEl.innerHTML = '';
    orderAnnotationsForList(getAnnotations(canvas), context.listOrder).forEach((annotation) => {
        const item = ownerDocument.createElement('li');
        item.className = 'list-group-item annotation-item';
        item.textContent = annotation.annotationName;
        item.dataset.annotationId = String(annotation.annotationId);
        item.addEventListener('click', () => {
            const id = Number(item.dataset.annotationId);
            if (!Number.isFinite(id)) return;
            const liveCanvas = getCurrentAnnotationListCanvas(context);
            if (!liveCanvas) return;
            const target = getAnnotations(liveCanvas).find(
                (candidate) => candidate.annotationId === id,
            );
            if (!target) return;
            liveCanvas.setActiveObject(target);
            context.onAnnotationSelected(target);
        });
        listEl.appendChild(item);
    });
}

export function updateAnnotationListSelection(
    context: AnnotationListContext,
    selectedAnnotation: AnnotationObject | null,
): void {
    const listEl = context.getListElement();
    if (!listEl) return;

    const selectedId = selectedAnnotation ? String(selectedAnnotation.annotationId) : null;
    listEl.querySelectorAll<HTMLElement>('.annotation-item').forEach((item) => {
        item.classList.toggle(
            'active',
            selectedId !== null && item.dataset.annotationId === selectedId,
        );
    });
}
