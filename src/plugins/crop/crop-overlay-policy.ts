/**
 * Selects affected Overlays and applies Crop preview and commit policies.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import type { DocumentMutationContext } from '../../core/index.js';
import type { OverlayRuntimeApi } from '../../foundations/overlay/index.js';
import { intersectCropRectangles } from './crop-geometry.js';
import { CropValidationError } from './crop-errors.js';
import type { CropOverlayPolicy } from './crop-session.js';

const defaultOverlayPolicy: CropOverlayPolicy = Object.freeze({
    preview: 'keep',
    apply: 'keep',
});

export interface CropOverlayCandidates {
    readonly allIds: readonly string[];
    readonly intersectingIds: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

export function normalizeCropOverlayPolicy(value: unknown): CropOverlayPolicy {
    if (value === undefined) return defaultOverlayPolicy;
    if (!isRecord(value)) throw new CropValidationError('Crop overlay policy must be an object.');
    const allowedKeys = new Set(['preview', 'apply', 'kinds']);
    if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
        throw new CropValidationError('Crop overlay policy contains unknown keys.');
    }
    const preview = value.preview;
    const apply = value.apply;
    if (preview !== 'keep' && preview !== 'hide-participating') {
        throw new CropValidationError('Crop overlay preview policy is invalid.');
    }
    if (apply !== 'keep' && apply !== 'discard' && apply !== 'transform-intersecting') {
        throw new CropValidationError('Crop overlay apply policy is invalid.');
    }
    let kinds: readonly string[] | undefined;
    if (value.kinds !== undefined) {
        if (
            !Array.isArray(value.kinds) ||
            value.kinds.length > 64 ||
            value.kinds.some(
                (kind) =>
                    typeof kind !== 'string' ||
                    kind.length === 0 ||
                    kind.trim() !== kind ||
                    kind.length > 128,
            )
        ) {
            throw new CropValidationError('Crop overlay kinds are invalid.');
        }
        kinds = Object.freeze([...new Set(value.kinds as string[])]);
    }
    return Object.freeze({ preview, apply, ...(kinds ? { kinds } : {}) });
}

export function findCropOverlayCandidates(
    overlay: OverlayRuntimeApi | null,
    cropBounds: Readonly<{ left: number; top: number; width: number; height: number }>,
    policy: CropOverlayPolicy,
): CropOverlayCandidates {
    if (!overlay)
        return Object.freeze({ allIds: Object.freeze([]), intersectingIds: Object.freeze([]) });
    const objects = overlay.list({
        ...(policy.kinds ? { kinds: policy.kinds } : {}),
        includeHidden: true,
        includeLocked: true,
    });
    const allIds: string[] = [];
    const intersectingIds: string[] = [];
    for (const object of objects) {
        const classification = overlay.classify(object);
        if (!classification) continue;
        allIds.push(classification.persistentId);
        if (intersectCropRectangles(cropBounds, object.getBoundingRect())) {
            intersectingIds.push(classification.persistentId);
        }
    }
    return Object.freeze({
        allIds: Object.freeze(allIds),
        intersectingIds: Object.freeze(intersectingIds),
    });
}

export async function applyCropOverlayPolicy(
    overlay: OverlayRuntimeApi | null,
    canvas: FabricNS.Canvas,
    parent: DocumentMutationContext,
    policy: CropOverlayPolicy,
    candidates: CropOverlayCandidates,
    mutationId: string,
): Promise<void> {
    if (!overlay || policy.apply === 'keep') return;
    const retained = new Set(candidates.intersectingIds);
    const removeIds =
        policy.apply === 'discard'
            ? candidates.allIds
            : candidates.allIds.filter((id) => !retained.has(id));
    if (removeIds.length === 0) return;
    await overlay.mutate({
        id: `${mutationId}:overlay`,
        operationId: 'crop:apply',
        action: 'delete',
        objectIds: removeIds,
        parent,
        metadata: Object.freeze({ cropPolicy: policy.apply }),
        mutate: () => {
            for (const id of removeIds) {
                const object = overlay.getByPersistentId(id);
                if (object) canvas.remove(object);
            }
        },
    });
}
