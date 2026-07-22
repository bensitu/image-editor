/**
 * Clones and bakes filtered Base Images with abort, decode, and resource-limit handling.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import type { FabricModule, ImageMimeType } from '../../core/index.js';
import type { BaseImageInfoPort, ImageResourcePolicyPort } from '../../sdk/index.js';
import { isDangerousStateKey as isUnsafeObjectKey } from '../../plugin-kernel/plugin-identifier.js';
import { settleAbortable } from '../../utils/abortable-promise.js';
import { hasErrorName } from '../../utils/error.js';
import { isPixelAreaWithinBudget } from '../../utils/image-budget.js';
import type { FilterDefinition } from './filter-definitions.js';
import { applyFilterDefinitions } from './fabric-filter-factory.js';
import { FilterBakeValidationError } from './filters-errors.js';

export interface FilterBakeOptions {
    readonly format?: 'png' | 'jpeg' | 'webp';
    readonly quality?: number;
}

export interface BakedImageResult {
    readonly image: FabricNS.FabricImage;
    readonly mimeType: ImageMimeType;
}

function abortError(message: string): DOMException {
    return new DOMException(message, 'AbortError');
}

function throwIfAborted(signal: AbortSignal): void {
    if (signal.aborted) throw signal.reason ?? abortError('Filter rendering was aborted.');
}

export function disposeFabricImage(image: FabricNS.FabricImage | null): void {
    if (!image) return;
    image.dispose();
}

export function copyBaseImagePresentation(
    source: FabricNS.FabricImage,
    target: FabricNS.FabricImage,
    options: Readonly<{ backgroundColor?: string; transient?: boolean }> = {},
): void {
    target.set({
        left: source.left,
        top: source.top,
        scaleX: source.scaleX,
        scaleY: source.scaleY,
        angle: source.angle,
        skewX: source.skewX,
        skewY: source.skewY,
        flipX: source.flipX,
        flipY: source.flipY,
        originX: source.originX,
        originY: source.originY,
        opacity: source.opacity,
        visible: source.visible,
        selectable: options.transient ? false : source.selectable,
        evented: options.transient ? false : source.evented,
        hasControls: options.transient ? false : source.hasControls,
        hoverCursor: source.hoverCursor,
        excludeFromExport: source.excludeFromExport,
        backgroundColor: options.backgroundColor ?? source.backgroundColor,
    });
    target.setCoords();
}

export async function createFilteredImageClone(
    fabric: FabricModule,
    baseImage: FabricNS.FabricImage,
    definitions: readonly FilterDefinition[],
    signal: AbortSignal,
    backgroundColor?: string,
): Promise<FabricNS.FabricImage> {
    throwIfAborted(signal);
    const clone = await baseImage.clone();
    try {
        throwIfAborted(signal);
        applyFilterDefinitions(fabric, clone, definitions);
        copyBaseImagePresentation(baseImage, clone, { backgroundColor, transient: true });
        throwIfAborted(signal);
        return clone;
    } catch (error) {
        disposeFabricImage(clone);
        throw error;
    }
}

export function normalizeFilterBakeOptions(
    options: FilterBakeOptions | undefined,
    sourceMimeType: ImageMimeType | null,
): Readonly<{ format: 'png' | 'jpeg' | 'webp'; quality?: number; mimeType: ImageMimeType }> {
    if (options !== undefined && (typeof options !== 'object' || options === null)) {
        throw new FilterBakeValidationError('Filter bake options must be an object.');
    }
    const record = (options ?? {}) as Record<string, unknown>;
    for (const key of Object.keys(record)) {
        if (isUnsafeObjectKey(key)) {
            throw new FilterBakeValidationError(
                `Filter bake options contain dangerous key "${key}".`,
            );
        }
        if (key !== 'format' && key !== 'quality') {
            throw new FilterBakeValidationError(
                `Filter bake options contain unknown key "${key}".`,
            );
        }
    }
    const sourceFormat =
        sourceMimeType === 'image/jpeg' ? 'jpeg' : sourceMimeType === 'image/webp' ? 'webp' : 'png';
    const format = record.format ?? sourceFormat;
    if (format !== 'png' && format !== 'jpeg' && format !== 'webp') {
        throw new FilterBakeValidationError('Filter bake format must be png, jpeg, or webp.');
    }
    const quality = record.quality;
    if (quality !== undefined && (typeof quality !== 'number' || !Number.isFinite(quality))) {
        throw new FilterBakeValidationError('Filter bake quality must be finite.');
    }
    if (typeof quality === 'number' && (quality < 0 || quality > 1)) {
        throw new FilterBakeValidationError('Filter bake quality must be within [0, 1].');
    }
    return Object.freeze({
        format,
        quality: quality as number | undefined,
        mimeType: format === 'jpeg' ? 'image/jpeg' : `image/${format}`,
    });
}

function encodedBytes(dataUrl: string): number {
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex < 0 || !/;base64$/i.test(dataUrl.slice(0, commaIndex))) {
        throw new FilterBakeValidationError('Filtered Raster output is not a base64 Data URL.');
    }
    const payload = dataUrl.slice(commaIndex + 1);
    const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
    return Math.floor((payload.length * 3) / 4) - padding;
}

async function decodeBakedImage(
    fabric: FabricModule,
    dataUrl: string,
    timeoutMs: number,
    signal: AbortSignal,
): Promise<FabricNS.FabricImage> {
    const controller = new AbortController();
    const abort = (): void => controller.abort(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    const timeout = setTimeout(
        () => controller.abort(new FilterBakeValidationError('Filtered Raster decode timed out.')),
        timeoutMs,
    );
    try {
        return await settleAbortable(
            fabric.FabricImage.fromURL(dataUrl, {
                crossOrigin: 'anonymous',
                signal: controller.signal,
            }),
            controller.signal,
            (lateImage) => lateImage.dispose(),
        );
    } catch (error) {
        if (controller.signal.aborted) throw controller.signal.reason ?? error;
        throw new FilterBakeValidationError('Filtered Raster decode failed.', error);
    } finally {
        clearTimeout(timeout);
        signal.removeEventListener('abort', abort);
    }
}

export async function renderBakedImage(
    fabric: FabricModule,
    baseImage: FabricNS.FabricImage,
    definitions: readonly FilterDefinition[],
    options: FilterBakeOptions | undefined,
    imageInfo: ReturnType<BaseImageInfoPort['getImageInfo']>,
    policy: ReturnType<ImageResourcePolicyPort['getImageResourcePolicy']>,
    signal: AbortSignal,
): Promise<BakedImageResult> {
    const normalizedOptions = normalizeFilterBakeOptions(options, imageInfo?.mimeType ?? null);
    const width = Number(baseImage.width);
    const height = Number(baseImage.height);
    if (
        !Number.isSafeInteger(width) ||
        !Number.isSafeInteger(height) ||
        width <= 0 ||
        height <= 0
    ) {
        throw new FilterBakeValidationError('Base Image dimensions are invalid.');
    }
    const pixelBudget = Math.min(policy.maxInputPixels, policy.maxExportPixels);
    if (
        width > policy.maxExportDimension ||
        height > policy.maxExportDimension ||
        !isPixelAreaWithinBudget(width, height, pixelBudget)
    ) {
        throw new FilterBakeValidationError('Filtered Raster dimensions exceed the Core policy.');
    }
    const clone = await createFilteredImageClone(fabric, baseImage, definitions, signal);
    let replacement: FabricNS.FabricImage | null = null;
    try {
        throwIfAborted(signal);
        let dataUrl: string;
        try {
            dataUrl = clone.toDataURL({
                format: normalizedOptions.format,
                quality: normalizedOptions.quality,
                multiplier: 1,
                withoutTransform: true,
                withoutShadow: true,
                enableRetinaScaling: false,
            });
        } catch (error) {
            if (hasErrorName(error, 'SecurityError')) {
                throw new FilterBakeValidationError(
                    'Filtered Raster pixels cannot be exported because canvas access is blocked.',
                    error,
                );
            }
            throw error;
        }
        if (encodedBytes(dataUrl) > policy.maxInputBytes) {
            throw new FilterBakeValidationError('Filtered Raster exceeds the Core input budget.');
        }
        replacement = await decodeBakedImage(fabric, dataUrl, policy.imageLoadTimeoutMs, signal);
        throwIfAborted(signal);
        if (replacement.width !== width || replacement.height !== height) {
            throw new FilterBakeValidationError(
                'Filtered Raster dimensions changed during decode.',
            );
        }
        copyBaseImagePresentation(baseImage, replacement);
        return Object.freeze({ image: replacement, mimeType: normalizedOptions.mimeType });
    } catch (error) {
        disposeFabricImage(replacement);
        throw error;
    } finally {
        disposeFabricImage(clone);
    }
}
