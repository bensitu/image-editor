import { CropValidationError } from './crop-errors.js';
const DEFAULT_OVERLAY_POLICY = Object.freeze({
    preview: 'keep',
    apply: 'keep',
});
function intersectConvexPolygons(left, right) {
    if (left.length < 3 || right.length < 3)
        return false;
    for (const polygon of [left, right]) {
        for (let index = 0; index < polygon.length; index += 1) {
            const start = polygon[index];
            const end = polygon[(index + 1) % polygon.length];
            if (!start || !end)
                return false;
            const axisX = -(end.y - start.y);
            const axisY = end.x - start.x;
            if (!Number.isFinite(axisX) || !Number.isFinite(axisY))
                return false;
            let leftMinimum = Number.POSITIVE_INFINITY;
            let leftMaximum = Number.NEGATIVE_INFINITY;
            let rightMinimum = Number.POSITIVE_INFINITY;
            let rightMaximum = Number.NEGATIVE_INFINITY;
            for (const point of left) {
                const projection = point.x * axisX + point.y * axisY;
                leftMinimum = Math.min(leftMinimum, projection);
                leftMaximum = Math.max(leftMaximum, projection);
            }
            for (const point of right) {
                const projection = point.x * axisX + point.y * axisY;
                rightMinimum = Math.min(rightMinimum, projection);
                rightMaximum = Math.max(rightMaximum, projection);
            }
            if (leftMaximum <= rightMinimum || rightMaximum <= leftMinimum)
                return false;
        }
    }
    return true;
}
function isRecord(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
export function normalizeCropOverlayPolicy(value) {
    if (value === undefined)
        return DEFAULT_OVERLAY_POLICY;
    if (!isRecord(value))
        throw new CropValidationError('Crop overlay policy must be an object.');
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
    let kinds;
    if (value.kinds !== undefined) {
        if (!Array.isArray(value.kinds) ||
            value.kinds.length > 64 ||
            value.kinds.some((kind) => typeof kind !== 'string' ||
                kind.length === 0 ||
                kind.trim() !== kind ||
                kind.length > 128)) {
            throw new CropValidationError('Crop overlay kinds are invalid.');
        }
        kinds = Object.freeze([...new Set(value.kinds)]);
    }
    return Object.freeze({ preview, apply, ...(kinds ? { kinds } : {}) });
}
export function findCropOverlayCandidates(overlay, cropPreview, policy) {
    if (!overlay)
        return Object.freeze({ allIds: Object.freeze([]), intersectingIds: Object.freeze([]) });
    const objects = overlay.list({
        ...(policy.kinds ? { kinds: policy.kinds } : {}),
        includeHidden: true,
        includeLocked: true,
    });
    const allIds = [];
    const intersectingIds = [];
    for (const object of objects) {
        const classification = overlay.classify(object);
        if (!classification)
            continue;
        allIds.push(classification.persistentId);
        if (intersectConvexPolygons(cropPreview.getCoords(), object.getCoords())) {
            intersectingIds.push(classification.persistentId);
        }
    }
    return Object.freeze({
        allIds: Object.freeze(allIds),
        intersectingIds: Object.freeze(intersectingIds),
    });
}
export async function applyCropOverlayPolicy(overlay, canvas, parent, policy, candidates, mutationId) {
    if (!overlay || policy.apply === 'keep')
        return;
    const retained = new Set(candidates.intersectingIds);
    const removeIds = policy.apply === 'discard'
        ? candidates.allIds
        : candidates.allIds.filter((id) => !retained.has(id));
    if (removeIds.length === 0)
        return;
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
                if (object)
                    canvas.remove(object);
            }
        },
    });
}
//# sourceMappingURL=crop-overlay-policy.js.map