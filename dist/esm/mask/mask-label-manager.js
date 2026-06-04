import { isMaskObject } from '../core/public-types.js';
import { reportWarning } from '../core/callback-reporter.js';
export function removeLabelForMask(ctx, mask) {
    if (!ctx.canvas || !mask.__label)
        return;
    try {
        if (ctx.canvas.getObjects().includes(mask.__label)) {
            ctx.canvas.remove(mask.__label);
        }
    }
    catch {
    }
    try {
        delete mask.__label;
    }
    catch {
    }
}
export function createLabelForMask(ctx, mask) {
    var _a;
    const { canvas, options, fabric: fb } = ctx;
    if (!canvas || !options.maskLabelOnSelect)
        return;
    removeLabelForMask(ctx, mask);
    let textObj = null;
    if (typeof options.label.create === 'function') {
        try {
            textObj = options.label.create(mask, fb);
        }
        catch (error) {
            reportWarning(options, error, 'label.create callback threw.');
            textObj = null;
        }
    }
    if (!textObj) {
        const indexForGetText = mask.maskId - 1;
        let txt = mask.maskName;
        if (typeof options.label.getText === 'function') {
            try {
                txt = options.label.getText(mask, indexForGetText);
            }
            catch (error) {
                reportWarning(options, error, 'label.getText callback threw.');
                txt = mask.maskName;
            }
        }
        const textOptions = {
            left: 0,
            top: 0,
            ...((_a = options.label.textOptions) !== null && _a !== void 0 ? _a : {}),
            originX: 'left',
            originY: 'top',
        };
        textObj = new fb.FabricText(txt, textOptions);
    }
    textObj.maskLabel = true;
    mask.__label = textObj;
    canvas.add(textObj);
    canvas.bringObjectToFront(textObj);
    syncMaskLabel(ctx, mask);
}
export function syncMaskLabel(ctx, mask) {
    var _a, _b, _c;
    const { canvas, options } = ctx;
    if (!canvas || !options.maskLabelOnSelect || !mask.__label)
        return;
    const coords = (_a = mask.getCoords) === null || _a === void 0 ? void 0 : _a.call(mask);
    if (!(coords === null || coords === void 0 ? void 0 : coords.length))
        return;
    const tl = coords[0];
    if (!tl)
        return;
    const center = mask.getCenterPoint();
    const vx = center.x - tl.x;
    const vy = center.y - tl.y;
    const dist = Math.sqrt(vx * vx + vy * vy) || 1;
    const offset = Math.max(0, (_b = options.maskLabelOffset) !== null && _b !== void 0 ? _b : 3);
    mask.__label.set({
        left: Math.round(tl.x + (vx / dist) * offset),
        top: Math.round(tl.y + (vy / dist) * offset),
        angle: (_c = mask.angle) !== null && _c !== void 0 ? _c : 0,
        originX: 'left',
        originY: 'top',
        visible: true,
    });
    mask.__label.setCoords();
    canvas.renderAll();
}
export function showLabelForMask(ctx, mask) {
    if (!ctx.options.maskLabelOnSelect)
        return;
    if (!mask.__label) {
        createLabelForMask(ctx, mask);
    }
    if (mask.__label) {
        mask.__label.visible = true;
        syncMaskLabel(ctx, mask);
    }
}
export function hideAllMaskLabels(ctx) {
    const { canvas } = ctx;
    if (!canvas)
        return;
    const objs = canvas.getObjects();
    objs.filter((o) => o.maskLabel).forEach((l) => {
        try {
            canvas.remove(l);
        }
        catch {
        }
    });
    objs.filter(isMaskObject).forEach((o) => {
        try {
            delete o.__label;
        }
        catch {
        }
    });
}
//# sourceMappingURL=mask-label-manager.js.map