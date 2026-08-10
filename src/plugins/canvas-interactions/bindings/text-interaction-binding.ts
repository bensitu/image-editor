/**
 * Adapts Canvas clicks to public Text Annotation placement, selection, and editing APIs.
 *
 * @module
 */

import type { AnnotationPluginApi } from '../../../foundations/annotation/index.js';
import type {
    OverlayClassification,
    OverlayFoundationApi,
} from '../../../foundations/overlay/index.js';
import type { TextAnnotationPluginApi } from '../../annotation-text/index.js';
import type { CanvasInteractionBinding, PointerDownContext } from '../interaction-binding.js';
import type {
    InteractionCancelReason,
    TextCanvasInteractionOptions,
} from '../canvas-interactions-types.js';
import type { PointerSample } from '../interaction-types.js';

const TEXT_TOOL_ID = 'annotation:text';
const TEXT_KIND = 'annotation:text';

type TextClickTarget =
    Readonly<{ readonly kind: 'blank' }> | Readonly<{ readonly kind: 'text'; readonly id: string }>;

interface TextGesture {
    readonly context: PointerDownContext['gesture'];
    readonly point: PointerSample['canvasPoint'];
    readonly target: TextClickTarget;
}

function textClassification(
    overlays: OverlayFoundationApi,
    sample: PointerSample,
): OverlayClassification | null {
    if (!sample.target) return null;
    const classification = overlays.classify(sample.target);
    if (
        !classification ||
        classification.kind !== TEXT_KIND ||
        classification.hidden ||
        classification.locked
    ) {
        return null;
    }
    return classification;
}

export class TextInteractionBinding implements CanvasInteractionBinding<TextGesture> {
    readonly id = 'text';
    readonly toolId = TEXT_TOOL_ID;
    private readonly textBinding: TextCanvasInteractionOptions['plugin'];
    private readonly overlayBinding: TextCanvasInteractionOptions['overlays'];
    private readonly annotationBinding: TextCanvasInteractionOptions['annotations'];
    private textValue: TextAnnotationPluginApi | null = null;
    private overlayValue: OverlayFoundationApi | null = null;
    private annotationValue: AnnotationPluginApi | null = null;
    private readonly blankClick: 'create' | 'ignore';
    private readonly existingTextClick: 'edit' | 'select';
    private readonly retargetEditing: 'commit' | 'cancel';

    constructor(options: TextCanvasInteractionOptions) {
        this.textBinding = options.plugin;
        this.overlayBinding = options.overlays;
        this.annotationBinding = options.annotations;
        this.blankClick = options.blankClick ?? 'create';
        this.existingTextClick = options.existingTextClick ?? 'edit';
        this.retargetEditing = options.retargetEditing ?? 'commit';
        if (this.blankClick !== 'create' && this.blankClick !== 'ignore') {
            throw new TypeError('[ImageEditor] Text blank-click policy is invalid.');
        }
        if (this.existingTextClick !== 'edit' && this.existingTextClick !== 'select') {
            throw new TypeError('[ImageEditor] Existing Text click policy is invalid.');
        }
        if (this.retargetEditing !== 'commit' && this.retargetEditing !== 'cancel') {
            throw new TypeError('[ImageEditor] Text editing retarget policy is invalid.');
        }
    }

    claim(context: PointerDownContext): { readonly gesture: TextGesture } | null {
        const classification = textClassification(this.overlays(), context.sample);
        let target: TextClickTarget;
        if (classification) {
            target = Object.freeze({ kind: 'text', id: classification.persistentId });
        } else if (!context.sample.target && this.blankClick === 'create') {
            target = Object.freeze({ kind: 'blank' });
        } else {
            return null;
        }
        return Object.freeze({
            gesture: Object.freeze({
                context: context.gesture,
                point: context.sample.canvasPoint,
                target,
            }),
        });
    }

    move(_gesture: TextGesture, _sample: PointerSample): void {}

    async end(gesture: TextGesture, _sample: PointerSample): Promise<void> {
        if (!gesture.context.isCurrent()) return;
        if (gesture.target.kind === 'text') {
            await this.activateExisting(gesture, gesture.target.id);
            return;
        }
        if (!(await this.finishCurrentEditing(gesture, null))) return;
        const id = await this.text().create({
            left: gesture.point.x,
            top: gesture.point.y,
        });
        if (!gesture.context.isCurrent()) return;
        await this.text().beginEditing(id);
    }

    cancel(_gesture: TextGesture, _reason: InteractionCancelReason): void {}

    private async activateExisting(gesture: TextGesture, id: string): Promise<void> {
        const current = this.text().getEditingSession();
        if (current?.annotationId === id) return;
        if (!(await this.finishCurrentEditing(gesture, id))) return;
        if (this.existingTextClick === 'select') {
            await this.annotations().select([id]);
            return;
        }
        await this.text().beginEditing(id);
    }

    private async finishCurrentEditing(
        gesture: TextGesture,
        nextId: string | null,
    ): Promise<boolean> {
        const text = this.text();
        const current = text.getEditingSession();
        if (!current || current.annotationId === nextId) return true;
        if (this.retargetEditing === 'commit') await text.commitEditing();
        else await text.cancelEditing();
        return gesture.context.canResume(this.toolId);
    }

    private text(): TextAnnotationPluginApi {
        return (this.textValue ??= this.textBinding.resolve());
    }

    private overlays(): OverlayFoundationApi {
        return (this.overlayValue ??= this.overlayBinding.resolve());
    }

    private annotations(): AnnotationPluginApi {
        return (this.annotationValue ??= this.annotationBinding.resolve());
    }
}
