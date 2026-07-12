import { CORE_STATE_CAPABILITY } from '../core-runtime/internal-capabilities.js';
import { definePluginRef, } from '../plugin-kernel/index.js';
const FULL_FACADE_STATE_ID = '@bensitu/full-facade';
const COMPATIBILITY_OBJECT_PROPERTIES = Object.freeze([
    'sessionObjectType',
    'isCropRect',
    'maskLabel',
    'originalAlpha',
    'originalStroke',
    'originalStrokeWidth',
    'hasControls',
    'selectable',
    'strokeUniform',
    'lockRotation',
    'transparentCorners',
    'borderColor',
    'cornerColor',
    'cornerSize',
    'flipX',
    'flipY',
    'isMosaicPreview',
    'annotationId',
    'annotationType',
    'shapeAnnotationKind',
    'annotationName',
    'annotationHidden',
    'annotationLocked',
    'annotationSelectable',
    'annotationEvented',
    'annotationHasControls',
    'annotationEditable',
    'overlayPersistentId',
    'overlayMetadata',
]);
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
function isImageMimeType(value) {
    return (value === null || value === 'image/jpeg' || value === 'image/png' || value === 'image/webp');
}
function validateState(value) {
    if (!isRecord(value))
        return false;
    return (isFiniteNumber(value.currentScale) &&
        value.currentScale > 0 &&
        isFiniteNumber(value.currentRotation) &&
        isFiniteNumber(value.baseImageScale) &&
        value.baseImageScale > 0 &&
        isImageMimeType(value.imageMimeType) &&
        Number.isSafeInteger(value.annotationCounter) &&
        Number(value.annotationCounter) >= 0 &&
        isRecord(value.imageFilterConfig) &&
        isRecord(value.lastCommittedImageFilterConfig) &&
        Array.isArray(value.selectedAnnotationIds) &&
        value.selectedAnnotationIds.every((id) => Number.isSafeInteger(id) && Number(id) > 0));
}
export const fullFacadeStatePluginRef = definePluginRef(FULL_FACADE_STATE_ID, '1.0.0');
export function fullFacadeStatePlugin(access) {
    return Object.freeze({
        ref: fullFacadeStatePluginRef,
        version: '1.0.0',
        setupMode: 'sync',
        requires: [{ token: CORE_STATE_CAPABILITY, range: '^1.0.0' }],
        setup(context) {
            const state = context.capabilities.require(CORE_STATE_CAPABILITY);
            context.addDisposable(state.objectProperties.register({
                owner: FULL_FACADE_STATE_ID,
                keys: COMPATIBILITY_OBJECT_PROPERTIES,
            }));
            context.addDisposable(state.transientObjects.register(FULL_FACADE_STATE_ID, (object) => {
                const candidate = object;
                return (candidate.isCropRect === true ||
                    candidate.maskLabel === true ||
                    candidate.isMosaicPreview === true ||
                    typeof candidate.sessionObjectType === 'string');
            }));
            context.addDisposable(state.slices.register({
                id: FULL_FACADE_STATE_ID,
                version: 1,
                capture: () => access.capture(),
                validate: (value) => validateState(value)
                    ? { valid: true, value }
                    : {
                        valid: false,
                        message: 'Full facade compatibility state is malformed.',
                    },
                restore: (value) => access.restore(value),
                clearState: () => access.clearState(),
            }));
            return Object.freeze({});
        },
    });
}
//# sourceMappingURL=full-facade-state-plugin.js.map