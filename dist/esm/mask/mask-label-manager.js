import { isMaskObject } from '../core/public-types.js';
import { reportWarning } from '../core/callback-reporter.js';
import { markSessionObject } from '../core/editor-object-kind.js';
export function removeLabelForMask(context, mask) {
    if (!context.canvas || !mask.labelObject)
        return;
    try {
        if (context.canvas.getObjects().includes(mask.labelObject)) {
            context.canvas.remove(mask.labelObject);
        }
    }
    catch {
    }
    try {
        delete mask.labelObject;
    }
    catch {
    }
}
export function createLabelForMask(context, mask) {
    var _a;
    const { canvas, options, fabric: fabricModule } = context;
    if (!canvas || !options.maskLabelOnSelect)
        return;
    removeLabelForMask(context, mask);
    let labelTextObject = null;
    if (typeof options.label.create === 'function') {
        try {
            labelTextObject = options.label.create(mask, fabricModule);
        }
        catch (error) {
            reportWarning(options, error, 'label.create callback threw.');
            labelTextObject = null;
        }
    }
    if (!labelTextObject) {
        const indexForGetText = Math.max(0, mask.maskId - 1);
        let labelText = mask.maskName;
        if (typeof options.label.getText === 'function') {
            try {
                labelText = options.label.getText(mask, indexForGetText);
            }
            catch (error) {
                reportWarning(options, error, 'label.getText callback threw.');
                labelText = mask.maskName;
            }
        }
        const textOptions = {
            left: 0,
            top: 0,
            ...((_a = options.label.textOptions) !== null && _a !== void 0 ? _a : {}),
            originX: 'left',
            originY: 'top',
        };
        labelTextObject = new fabricModule.FabricText(labelText, textOptions);
    }
    markSessionObject(labelTextObject, 'maskLabel');
    labelTextObject.maskLabel = true;
    mask.labelObject = labelTextObject;
    canvas.add(labelTextObject);
    canvas.bringObjectToFront(labelTextObject);
    syncMaskLabel(context, mask);
}
export function syncMaskLabel(context, mask) {
    var _a, _b, _c;
    const { canvas, options } = context;
    if (!canvas || !options.maskLabelOnSelect || !mask.labelObject)
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
    mask.labelObject.set({
        left: Math.round(tl.x + (vx / dist) * offset),
        top: Math.round(tl.y + (vy / dist) * offset),
        angle: (_c = mask.angle) !== null && _c !== void 0 ? _c : 0,
        originX: 'left',
        originY: 'top',
        visible: true,
    });
    mask.labelObject.setCoords();
    canvas.renderAll();
}
export function showLabelForMask(context, mask) {
    if (!context.options.maskLabelOnSelect)
        return;
    if (!mask.labelObject) {
        createLabelForMask(context, mask);
    }
    if (mask.labelObject) {
        mask.labelObject.visible = true;
        syncMaskLabel(context, mask);
    }
}
export function hideAllMaskLabels(context) {
    const { canvas } = context;
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
            delete o.labelObject;
        }
        catch {
        }
    });
}
//# sourceMappingURL=mask-label-manager.js.map