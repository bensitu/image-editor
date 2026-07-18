export interface CropRect {
    readonly leftPx: number;
    readonly topPx: number;
    readonly widthPx: number;
    readonly heightPx: number;
}

export type CropAspectRatio =
    'free' | number | string | Readonly<{ width: number; height: number }> | null;

export interface CropImageBounds {
    readonly widthPx: number;
    readonly heightPx: number;
}

export interface CropRectLimits extends CropImageBounds {
    readonly minimumWidthPx: number;
    readonly minimumHeightPx: number;
}

interface Rectangle {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function assertFinitePositive(value: unknown, label: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        throw new TypeError(`[ImageEditor] ${label} must be a finite positive number.`);
    }
    return value;
}

export function normalizeCropAspectRatio(value: unknown): number | null {
    if (value === undefined || value === null || value === 'free') return null;
    let ratio: number;
    if (typeof value === 'number') {
        ratio = value;
    } else if (typeof value === 'string') {
        const match = /^([0-9]+(?:\.[0-9]+)?):([0-9]+(?:\.[0-9]+)?)$/.exec(value);
        if (!match) throw new TypeError('[ImageEditor] Crop aspect ratio string is invalid.');
        ratio = Number(match[1]) / Number(match[2]);
    } else if (isRecord(value)) {
        const keys = Object.keys(value);
        if (keys.some((key) => key !== 'width' && key !== 'height')) {
            throw new TypeError('[ImageEditor] Crop aspect ratio contains unknown keys.');
        }
        ratio =
            assertFinitePositive(value.width, 'Crop aspect ratio width') /
            assertFinitePositive(value.height, 'Crop aspect ratio height');
    } else {
        throw new TypeError('[ImageEditor] Crop aspect ratio is invalid.');
    }
    if (!Number.isFinite(ratio) || ratio <= 0 || ratio < 1e-6 || ratio > 1e6) {
        throw new TypeError('[ImageEditor] Crop aspect ratio must be finite and positive.');
    }
    return ratio;
}

function assertImageBounds(bounds: CropImageBounds): void {
    if (
        !Number.isSafeInteger(bounds.widthPx) ||
        !Number.isSafeInteger(bounds.heightPx) ||
        bounds.widthPx <= 0 ||
        bounds.heightPx <= 0
    ) {
        throw new TypeError('[ImageEditor] Crop image bounds are invalid.');
    }
}

export function normalizeCropRect(value: unknown, limits: CropRectLimits): CropRect {
    assertImageBounds(limits);
    if (
        !Number.isSafeInteger(limits.minimumWidthPx) ||
        !Number.isSafeInteger(limits.minimumHeightPx) ||
        limits.minimumWidthPx <= 0 ||
        limits.minimumHeightPx <= 0
    ) {
        throw new TypeError('[ImageEditor] Crop rect minimum dimensions are invalid.');
    }
    if (!isRecord(value)) throw new TypeError('[ImageEditor] Crop rect must be an object.');
    const allowedKeys = new Set(['leftPx', 'topPx', 'widthPx', 'heightPx']);
    if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
        throw new TypeError('[ImageEditor] Crop rect contains unknown keys.');
    }
    const left = value.leftPx;
    const top = value.topPx;
    const width = value.widthPx;
    const height = value.heightPx;
    if (
        typeof left !== 'number' ||
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
        top + height > limits.heightPx
    ) {
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

export function fitCropRectToAspectRatio(
    rect: CropRect,
    ratio: number,
    bounds: CropImageBounds,
): CropRect {
    assertImageBounds(bounds);
    const normalizedRatio = normalizeCropAspectRatio(ratio);
    if (normalizedRatio === null) return Object.freeze({ ...rect });
    let width = rect.widthPx;
    let height = rect.heightPx;
    if (width / height > normalizedRatio) {
        width = height * normalizedRatio;
    } else {
        height = width / normalizedRatio;
    }
    const centerX = rect.leftPx + rect.widthPx / 2;
    const centerY = rect.topPx + rect.heightPx / 2;
    const left = Math.max(0, Math.min(bounds.widthPx - width, centerX - width / 2));
    const top = Math.max(0, Math.min(bounds.heightPx - height, centerY - height / 2));
    return normalizeCropRect(
        { leftPx: left, topPx: top, widthPx: width, heightPx: height },
        { ...bounds, minimumWidthPx: 1, minimumHeightPx: 1 },
    );
}

export function intersectCropRectangles(left: Rectangle, right: Rectangle): boolean {
    return (
        left.left < right.left + right.width &&
        left.left + left.width > right.left &&
        left.top < right.top + right.height &&
        left.top + left.height > right.top
    );
}
