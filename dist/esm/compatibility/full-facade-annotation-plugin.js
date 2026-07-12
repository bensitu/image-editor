import { syncAnnotationRuntimeState } from '../annotation/annotation-style.js';
import { SNAPSHOT_CUSTOM_KEYS } from '../core/state-serializer.js';
import { isAnnotationObject } from '../core/public-types.js';
import { CORE_HOST_CAPABILITY } from '../core-runtime/internal-capabilities.js';
import { OVERLAY_CAPABILITY } from '../foundations/overlay/index.js';
import { applyDeltaToObject } from '../foundations/overlay/overlay-transform-delta.js';
import { definePluginRef, } from '../plugin-kernel/index.js';
const ANNOTATION_BRIDGE_ID = '@bensitu/full-facade-annotation';
function isSerializedAnnotationData(value) {
    if (!value || typeof value !== 'object')
        return false;
    const candidate = value;
    return (!!candidate.object &&
        typeof candidate.object === 'object' &&
        Number.isSafeInteger(candidate.annotationId) &&
        Number(candidate.annotationId) > 0 &&
        typeof candidate.annotationType === 'string' &&
        candidate.annotationType.length > 0 &&
        typeof candidate.annotationName === 'string');
}
function readPersistentId(object) {
    if (!isAnnotationObject(object))
        return null;
    const persistent = object
        .overlayPersistentId;
    return typeof persistent === 'string' && persistent.length > 0
        ? persistent
        : `annotation-${object.annotationId}`;
}
function serializeAnnotation(object) {
    if (!isAnnotationObject(object))
        throw new Error('Expected an Annotation object.');
    const annotation = object;
    const serializedObject = annotation.toObject(SNAPSHOT_CUSTOM_KEYS);
    for (const key of SNAPSHOT_CUSTOM_KEYS) {
        const value = Reflect.get(annotation, key);
        if (value !== undefined)
            serializedObject[key] = value;
    }
    return Object.freeze({
        object: serializedObject,
        annotationId: annotation.annotationId,
        annotationType: annotation.annotationType,
        annotationName: annotation.annotationName,
        shapeAnnotationKind: annotation.shapeAnnotationKind,
        annotationSelectable: annotation.annotationSelectable,
        annotationEvented: annotation.annotationEvented,
        annotationHasControls: annotation.annotationHasControls,
        annotationEditable: annotation.annotationEditable,
        overlayPersistentId: annotation.overlayPersistentId,
        overlayMetadata: annotation.overlayMetadata,
    });
}
async function deserializeAnnotation(value, fabric) {
    if (!isSerializedAnnotationData(value)) {
        throw new Error('Serialized Annotation data is malformed.');
    }
    const objects = await fabric.util.enlivenObjects([value.object]);
    const object = objects[0];
    if (!object)
        throw new Error('Fabric did not restore an Annotation object.');
    const annotation = object;
    annotation.editorObjectKind = 'annotation';
    annotation.annotationId = value.annotationId;
    annotation.annotationType = value.annotationType;
    annotation.annotationName = value.annotationName;
    annotation.shapeAnnotationKind = value.shapeAnnotationKind;
    annotation.annotationSelectable = value.annotationSelectable;
    annotation.annotationEvented = value.annotationEvented;
    annotation.annotationHasControls = value.annotationHasControls;
    annotation.annotationEditable = value.annotationEditable;
    annotation.overlayPersistentId = value.overlayPersistentId;
    annotation.overlayMetadata = value.overlayMetadata;
    syncAnnotationRuntimeState(annotation);
    return annotation;
}
export const fullFacadeAnnotationPluginRef = definePluginRef(ANNOTATION_BRIDGE_ID, '1.0.0');
export function fullFacadeAnnotationPlugin(options) {
    return Object.freeze({
        ref: fullFacadeAnnotationPluginRef,
        version: '1.0.0',
        setupMode: 'sync',
        requires: [
            { token: CORE_HOST_CAPABILITY, range: '^1.0.0' },
            { token: OVERLAY_CAPABILITY, range: '^1.0.0' },
        ],
        setup(context) {
            const host = context.capabilities.require(CORE_HOST_CAPABILITY);
            const overlay = context.capabilities.require(OVERLAY_CAPABILITY);
            context.addDisposable(overlay.registerKind({
                id: 'annotation',
                ownerPluginId: ANNOTATION_BRIDGE_ID,
                classify: isAnnotationObject,
                getPersistentId: readPersistentId,
                setPersistentId: (object, id) => {
                    if (isAnnotationObject(object)) {
                        object.overlayPersistentId = id;
                    }
                },
                isHidden: (object) => isAnnotationObject(object) && object.annotationHidden === true,
                setHidden: (object, hidden) => {
                    if (!isAnnotationObject(object))
                        return;
                    object.annotationHidden = hidden;
                    syncAnnotationRuntimeState(object);
                },
                isLocked: (object) => isAnnotationObject(object) && object.annotationLocked === true,
                setLocked: (object, locked) => {
                    if (!isAnnotationObject(object))
                        return;
                    object.annotationLocked = locked;
                    syncAnnotationRuntimeState(object);
                },
            }));
            context.addDisposable(overlay.registerGeometryPolicy({
                id: `${ANNOTATION_BRIDGE_ID}:geometry`,
                kind: 'annotation',
                ownerPluginId: ANNOTATION_BRIDGE_ID,
                supports: (mutation) => options.bindToImageTransform && mutation.kind === 'transform',
                apply: (object, mutation) => {
                    if (!mutation.affineDelta)
                        return;
                    applyDeltaToObject(object, [...mutation.affineDelta], {
                        fabricUtil: {
                            multiplyTransformMatrices: (left, right) => host.fabric.util.multiplyTransformMatrices(left, right),
                            invertTransform: (matrix) => host.fabric.util.invertTransform(matrix),
                            qrDecompose: (matrix) => host.fabric.util.qrDecompose(matrix),
                            Point: host.fabric.Point,
                        },
                        preserveReadableText: options.textFlipBehavior === 'preserve-readable' &&
                            isAnnotationObject(object) &&
                            object.annotationType === 'text',
                    });
                },
            }));
            context.addDisposable(overlay.registerSerializer({
                id: `${ANNOTATION_BRIDGE_ID}:serializer`,
                kind: 'annotation',
                ownerPluginId: ANNOTATION_BRIDGE_ID,
                serialize: serializeAnnotation,
                validate: isSerializedAnnotationData,
                deserialize: (value, serializerContext) => deserializeAnnotation(value, serializerContext.fabric),
            }));
            return Object.freeze({});
        },
    });
}
//# sourceMappingURL=full-facade-annotation-plugin.js.map