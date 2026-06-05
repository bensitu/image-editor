import { isMaskObject } from '../core/public-types.js';
const SELECTED_STROKE = '#ff0000';
const SELECTED_STROKE_WIDTH = 1;
const HOVER_STROKE = '#ff5500';
const HOVER_STROKE_WIDTH = 2;
const HOVER_OPACITY_BUMP = 0.2;
const DEFAULT_STROKE_FALLBACK = '#ccc';
const DEFAULT_STROKE_WIDTH_FALLBACK = 1;
const DEFAULT_ALPHA_FALLBACK = 0.5;
export function getMaskNormalStyle(mask) {
    var _a;
    const strokeWidth = Number(mask.originalStrokeWidth);
    const opacity = Number(mask.originalAlpha);
    return {
        stroke: (_a = mask.originalStroke) !== null && _a !== void 0 ? _a : DEFAULT_STROKE_FALLBACK,
        strokeWidth: Number.isFinite(strokeWidth) ? strokeWidth : DEFAULT_STROKE_WIDTH_FALLBACK,
        opacity: Number.isFinite(opacity) ? opacity : DEFAULT_ALPHA_FALLBACK,
    };
}
export function getMaskHoverStyle(mask) {
    const opacity = Number(mask.originalAlpha);
    const baseAlpha = Number.isFinite(opacity) ? opacity : DEFAULT_ALPHA_FALLBACK;
    return {
        stroke: HOVER_STROKE,
        strokeWidth: HOVER_STROKE_WIDTH,
        opacity: Math.min(baseAlpha + HOVER_OPACITY_BUMP, 1),
    };
}
export function applyMaskSelectedStyle(mask) {
    mask.set({ stroke: SELECTED_STROKE, strokeWidth: SELECTED_STROKE_WIDTH });
}
export function applyMaskUnselectedStyle(mask) {
    var _a;
    const strokeWidth = Number(mask.originalStrokeWidth);
    mask.set({
        stroke: (_a = mask.originalStroke) !== null && _a !== void 0 ? _a : DEFAULT_STROKE_FALLBACK,
        strokeWidth: Number.isFinite(strokeWidth) ? strokeWidth : DEFAULT_STROKE_WIDTH_FALLBACK,
    });
}
export function attachMaskHoverHandlers(mask) {
    const tagged = mask;
    const mouseover = () => {
        var _a;
        tagged.set(getMaskHoverStyle(tagged));
        (_a = tagged.canvas) === null || _a === void 0 ? void 0 : _a.requestRenderAll();
    };
    const mouseout = () => {
        var _a;
        tagged.set(getMaskNormalStyle(tagged));
        (_a = tagged.canvas) === null || _a === void 0 ? void 0 : _a.requestRenderAll();
    };
    tagged.on('mouseover', mouseover);
    tagged.on('mouseout', mouseout);
    tagged.imageEditorMaskHandlers = { mouseover, mouseout };
}
export function reattachMaskHoverHandlers(mask) {
    var _a;
    const tagged = mask;
    if (tagged.imageEditorMaskHandlers) {
        try {
            tagged.off('mouseover', tagged.imageEditorMaskHandlers.mouseover);
            tagged.off('mouseout', tagged.imageEditorMaskHandlers.mouseout);
        }
        catch {
        }
        delete tagged.imageEditorMaskHandlers;
    }
    const patch = {};
    if (!Number.isFinite(Number(tagged.originalAlpha))) {
        const opacity = Number(tagged.opacity);
        patch.originalAlpha = Number.isFinite(opacity) ? opacity : DEFAULT_ALPHA_FALLBACK;
    }
    if (tagged.originalStroke == null) {
        patch.originalStroke = (_a = tagged.stroke) !== null && _a !== void 0 ? _a : DEFAULT_STROKE_FALLBACK;
    }
    if (!Number.isFinite(Number(tagged.originalStrokeWidth))) {
        const sw = Number(tagged.strokeWidth);
        patch.originalStrokeWidth = Number.isFinite(sw) ? sw : DEFAULT_STROKE_WIDTH_FALLBACK;
    }
    if (Object.keys(patch).length > 0)
        tagged.set(patch);
    attachMaskHoverHandlers(tagged);
}
export function detachMaskHoverHandlers(mask) {
    const tagged = mask;
    if (!tagged.imageEditorMaskHandlers)
        return;
    try {
        tagged.off('mouseover', tagged.imageEditorMaskHandlers.mouseover);
        tagged.off('mouseout', tagged.imageEditorMaskHandlers.mouseout);
    }
    catch {
    }
    delete tagged.imageEditorMaskHandlers;
}
export function captureMaskStyleBackup(mask) {
    var _a, _b, _c, _d, _e, _f, _g;
    return {
        object: mask,
        opacity: (_a = mask.opacity) !== null && _a !== void 0 ? _a : 1,
        fill: ((_b = mask.fill) !== null && _b !== void 0 ? _b : null),
        strokeWidth: (_c = mask.strokeWidth) !== null && _c !== void 0 ? _c : 0,
        stroke: ((_d = mask.stroke) !== null && _d !== void 0 ? _d : null),
        selectable: (_e = mask.selectable) !== null && _e !== void 0 ? _e : true,
        evented: (_f = mask.evented) !== null && _f !== void 0 ? _f : true,
        lockRotation: (_g = mask.lockRotation) !== null && _g !== void 0 ? _g : false,
    };
}
export function restoreMaskStyleBackup(backup) {
    try {
        backup.object.set({
            opacity: backup.opacity,
            fill: backup.fill,
            strokeWidth: backup.strokeWidth,
            stroke: backup.stroke,
            selectable: backup.selectable,
            evented: backup.evented,
            lockRotation: backup.lockRotation,
        });
        if (typeof backup.object.setCoords === 'function') {
            backup.object.setCoords();
        }
    }
    catch {
    }
}
export function withNormalizedMaskStyles(context, callback) {
    if (!context.canvas)
        return callback();
    const masks = context.canvas.getObjects().filter(isMaskObject);
    const patches = [];
    try {
        for (const mask of masks) {
            const normal = getMaskNormalStyle(mask);
            const snapshot = {};
            const stylePatch = {};
            Object.keys(normal).forEach((key) => {
                const live = mask[key];
                if (live !== normal[key]) {
                    snapshot[key] = live;
                    stylePatch[key] = normal[key];
                }
            });
            if (Object.keys(stylePatch).length === 0)
                continue;
            patches.push({ object: mask, snapshot });
            mask.set(stylePatch);
        }
        return callback();
    }
    finally {
        for (const patch of patches) {
            try {
                patch.object.set(patch.snapshot);
            }
            catch {
            }
        }
    }
}
export async function withMaskStyleBackup(context, mutator, callback) {
    if (!context.canvas)
        return await callback();
    const masks = context.canvas.getObjects().filter(isMaskObject);
    const backups = masks.map(captureMaskStyleBackup);
    try {
        masks.forEach((mask, index) => mutator(mask, index));
        return await callback();
    }
    finally {
        for (const backup of backups)
            restoreMaskStyleBackup(backup);
    }
}
export function applyCropHideMaskStyle(mask) {
    try {
        mask.set({ opacity: 0, evented: false, selectable: false });
    }
    catch {
    }
}
//# sourceMappingURL=mask-style.js.map