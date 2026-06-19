import { areResolvedDrawConfigsEqual, areResolvedTextAnnotationConfigsEqual, getInvalidDrawConfigFields, getInvalidTextAnnotationConfigFields, mergeDrawConfigPatch, mergeTextAnnotationConfigPatch, } from '../core/default-options.js';
import { isDrawAnnotationObject, isTextAnnotationObject, } from '../core/public-types.js';
import { updateDrawBrush } from './draw-controller.js';
export function applyTextConfigPatchAction(access, config, operation) {
    if (!access.canRunIdleOperation(operation))
        return;
    const invalidFields = getInvalidTextAnnotationConfigFields(config);
    if (invalidFields.length > 0) {
        access.reportWarning(null, `${operation} ignored invalid Text config fields: ${invalidFields.join(', ')}.`);
    }
    const next = mergeTextAnnotationConfigPatch(access.getCurrentTextConfig(), config, access.getDefaultTextConfig());
    if (areResolvedTextAnnotationConfigsEqual(access.getCurrentTextConfig(), next))
        return;
    access.setCurrentTextConfig(next);
    access.updateInputs();
    access.updateUi();
    access.emitImageChanged(access.buildCallbackContext(operation, false));
}
export function applyDrawConfigPatchAction(access, config, operation) {
    if (!access.canRunIdleOperation(operation))
        return;
    const invalidFields = getInvalidDrawConfigFields(config);
    if (invalidFields.length > 0) {
        access.reportWarning(null, `${operation} ignored invalid Draw config fields: ${invalidFields.join(', ')}.`);
    }
    const next = mergeDrawConfigPatch(access.getCurrentDrawConfig(), config, access.getDefaultDrawConfig());
    if (areResolvedDrawConfigsEqual(access.getCurrentDrawConfig(), next))
        return;
    access.setCurrentDrawConfig(next);
    updateDrawBrush(access.buildDrawControllerContext());
    access.updateInputs();
    access.updateUi();
    access.emitImageChanged(access.buildCallbackContext(operation, false));
}
export function applyTextColorInputAction(access, color) {
    var _a;
    if (access.isTextMode()) {
        access.setTextColor(color);
        return;
    }
    const selected = (_a = access.getCanvas()) === null || _a === void 0 ? void 0 : _a.getActiveObject();
    if (selected && isTextAnnotationObject(selected)) {
        access.updateSelectedAnnotation({ fill: color });
        return;
    }
    access.setTextColor(color);
}
export function applyTextFontSizeInputAction(access, size) {
    var _a;
    if (access.isTextMode()) {
        access.setTextFontSize(size);
        return;
    }
    const selected = (_a = access.getCanvas()) === null || _a === void 0 ? void 0 : _a.getActiveObject();
    if (selected && isTextAnnotationObject(selected)) {
        access.updateSelectedAnnotation({ fontSize: size });
        return;
    }
    access.setTextFontSize(size);
}
export function applyDrawColorInputAction(access, color) {
    var _a;
    if (access.isDrawMode()) {
        access.setDrawColor(color);
        return;
    }
    const selected = (_a = access.getCanvas()) === null || _a === void 0 ? void 0 : _a.getActiveObject();
    if (selected && isDrawAnnotationObject(selected)) {
        access.updateSelectedAnnotation({ stroke: color });
        return;
    }
    access.setDrawColor(color);
}
export function applyDrawBrushSizeInputAction(access, size) {
    var _a;
    if (access.isDrawMode()) {
        access.setDrawBrushSize(size);
        return;
    }
    const selected = (_a = access.getCanvas()) === null || _a === void 0 ? void 0 : _a.getActiveObject();
    if (selected && isDrawAnnotationObject(selected)) {
        access.updateSelectedAnnotation({ strokeWidth: size });
        return;
    }
    access.setDrawBrushSize(size);
}
//# sourceMappingURL=annotation-config-actions.js.map