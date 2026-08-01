export function normalizeCropRotation(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new TypeError('[ImageEditor] Crop rotation must be a finite number.');
    }
    const normalized = ((value % 360) + 360) % 360;
    return Math.abs(normalized - 360) < 1e-9 || Math.abs(normalized) < 1e-9 ? 0 : normalized;
}
export function constrainCropRectToRotation(value, rotationDegrees, limits) {
    let rect = normalizeCropRect(value, limits);
    const rotation = normalizeCropRotation(rotationDegrees);
    if (rotation === 0)
        return rect;
    const radians = (rotation * Math.PI) / 180;
    const cosine = Math.abs(Math.cos(radians));
    const sine = Math.abs(Math.sin(radians));
    const rotatedWidth = rect.widthPx * cosine + rect.heightPx * sine;
    const rotatedHeight = rect.widthPx * sine + rect.heightPx * cosine;
    const scale = Math.min(1, limits.widthPx / Math.max(rotatedWidth, 1), limits.heightPx / Math.max(rotatedHeight, 1));
    if (scale < 1) {
        const widthPx = Math.max(limits.minimumWidthPx, Math.floor(rect.widthPx * scale));
        const heightPx = Math.max(limits.minimumHeightPx, Math.floor(rect.heightPx * scale));
        if (widthPx * cosine + heightPx * sine > limits.widthPx + 1e-6 ||
            widthPx * sine + heightPx * cosine > limits.heightPx + 1e-6) {
            throw new TypeError('[ImageEditor] Rotated Crop rectangle cannot satisfy the configured minimum.');
        }
        const centerX = rect.leftPx + rect.widthPx / 2;
        const centerY = rect.topPx + rect.heightPx / 2;
        rect = normalizeCropRect({
            leftPx: Math.max(0, Math.min(limits.widthPx - widthPx, centerX - widthPx / 2)),
            topPx: Math.max(0, Math.min(limits.heightPx - heightPx, centerY - heightPx / 2)),
            widthPx,
            heightPx,
        }, limits);
    }
    const extentX = (rect.widthPx * cosine + rect.heightPx * sine) / 2;
    const extentY = (rect.widthPx * sine + rect.heightPx * cosine) / 2;
    const centerX = Math.max(extentX, Math.min(limits.widthPx - extentX, rect.leftPx + rect.widthPx / 2));
    const centerY = Math.max(extentY, Math.min(limits.heightPx - extentY, rect.topPx + rect.heightPx / 2));
    return normalizeCropRect({
        leftPx: Math.max(0, Math.min(limits.widthPx - rect.widthPx, centerX - rect.widthPx / 2)),
        topPx: Math.max(0, Math.min(limits.heightPx - rect.heightPx, centerY - rect.heightPx / 2)),
        widthPx: rect.widthPx,
        heightPx: rect.heightPx,
    }, limits);
}
function isRecord(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function assertFinitePositive(value, label) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        throw new TypeError(`[ImageEditor] ${label} must be a finite positive number.`);
    }
    return value;
}
export function normalizeCropAspectRatio(value) {
    if (value === undefined || value === null || value === 'free')
        return null;
    let ratio;
    if (typeof value === 'number') {
        ratio = value;
    }
    else if (typeof value === 'string') {
        const match = /^([0-9]+(?:\.[0-9]+)?):([0-9]+(?:\.[0-9]+)?)$/.exec(value);
        if (!match)
            throw new TypeError('[ImageEditor] Crop aspect ratio string is invalid.');
        ratio = Number(match[1]) / Number(match[2]);
    }
    else if (isRecord(value)) {
        const keys = Object.keys(value);
        if (keys.some((key) => key !== 'width' && key !== 'height')) {
            throw new TypeError('[ImageEditor] Crop aspect ratio contains unknown keys.');
        }
        ratio =
            assertFinitePositive(value.width, 'Crop aspect ratio width') /
                assertFinitePositive(value.height, 'Crop aspect ratio height');
    }
    else {
        throw new TypeError('[ImageEditor] Crop aspect ratio is invalid.');
    }
    if (!Number.isFinite(ratio) || ratio <= 0 || ratio < 1e-6 || ratio > 1e6) {
        throw new TypeError('[ImageEditor] Crop aspect ratio must be finite and positive.');
    }
    return ratio;
}
function assertImageBounds(bounds) {
    if (!Number.isSafeInteger(bounds.widthPx) ||
        !Number.isSafeInteger(bounds.heightPx) ||
        bounds.widthPx <= 0 ||
        bounds.heightPx <= 0) {
        throw new TypeError('[ImageEditor] Crop image bounds are invalid.');
    }
}
export function normalizeCropRect(value, limits) {
    assertImageBounds(limits);
    if (!Number.isSafeInteger(limits.minimumWidthPx) ||
        !Number.isSafeInteger(limits.minimumHeightPx) ||
        limits.minimumWidthPx <= 0 ||
        limits.minimumHeightPx <= 0) {
        throw new TypeError('[ImageEditor] Crop rect minimum dimensions are invalid.');
    }
    if (!isRecord(value))
        throw new TypeError('[ImageEditor] Crop rect must be an object.');
    const allowedKeys = new Set(['leftPx', 'topPx', 'widthPx', 'heightPx']);
    if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
        throw new TypeError('[ImageEditor] Crop rect contains unknown keys.');
    }
    const left = value.leftPx;
    const top = value.topPx;
    const width = value.widthPx;
    const height = value.heightPx;
    if (typeof left !== 'number' ||
        typeof top !== 'number' ||
        typeof width !== 'number' ||
        typeof height !== 'number' ||
        !Number.isFinite(left) ||
        !Number.isFinite(top) ||
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        left < 0 ||
        top < 0 ||
        width <= 0 ||
        height <= 0 ||
        left + width > limits.widthPx ||
        top + height > limits.heightPx) {
        throw new TypeError('[ImageEditor] Crop rect must be finite and within image bounds.');
    }
    const leftPx = Math.floor(left);
    const topPx = Math.floor(top);
    const rightPx = Math.min(limits.widthPx, Math.ceil(left + width));
    const bottomPx = Math.min(limits.heightPx, Math.ceil(top + height));
    const widthPx = rightPx - leftPx;
    const heightPx = bottomPx - topPx;
    if (widthPx < limits.minimumWidthPx || heightPx < limits.minimumHeightPx) {
        throw new TypeError('[ImageEditor] Crop rect is smaller than the configured minimum.');
    }
    return Object.freeze({ leftPx, topPx, widthPx, heightPx });
}
export function fitCropRectToAspectRatio(rect, ratio, bounds) {
    assertImageBounds(bounds);
    const normalizedRatio = normalizeCropAspectRatio(ratio);
    if (normalizedRatio === null)
        return Object.freeze({ ...rect });
    let width = rect.widthPx;
    let height = rect.heightPx;
    const currentRatio = width / height;
    const ratioMatches = Number.isFinite(currentRatio) &&
        Math.abs(currentRatio - normalizedRatio) <= Math.max(1, normalizedRatio) * 1e-9;
    if (!ratioMatches && currentRatio > normalizedRatio) {
        width = height * normalizedRatio;
    }
    else if (!ratioMatches) {
        height = width / normalizedRatio;
    }
    const centerX = rect.leftPx + rect.widthPx / 2;
    const centerY = rect.topPx + rect.heightPx / 2;
    const left = Math.max(0, Math.min(bounds.widthPx - width, centerX - width / 2));
    const top = Math.max(0, Math.min(bounds.heightPx - height, centerY - height / 2));
    return normalizeCropRect({ leftPx: left, topPx: top, widthPx: width, heightPx: height }, { ...bounds, minimumWidthPx: 1, minimumHeightPx: 1 });
}
//# sourceMappingURL=crop-geometry.js.map