export function isFinitePoint(value) {
    const point = value;
    return (!!point &&
        typeof point.x === 'number' &&
        Number.isFinite(point.x) &&
        typeof point.y === 'number' &&
        Number.isFinite(point.y));
}
export function getPointerFromFabricEvent(canvas, event) {
    const fabricEvent = event && typeof event === 'object'
        ? event
        : null;
    if (!fabricEvent)
        return null;
    if (isFinitePoint(fabricEvent.scenePoint))
        return { ...fabricEvent.scenePoint };
    if (isFinitePoint(fabricEvent.pointer))
        return { ...fabricEvent.pointer };
    if (isFinitePoint(fabricEvent.absolutePointer))
        return { ...fabricEvent.absolutePointer };
    if (fabricEvent.e && typeof canvas.getPointer === 'function') {
        const pointer = canvas.getPointer(fabricEvent.e);
        if (isFinitePoint(pointer))
            return { ...pointer };
    }
    return null;
}
//# sourceMappingURL=pointer.js.map