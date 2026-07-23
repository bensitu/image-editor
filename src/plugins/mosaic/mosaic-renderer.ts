/**
 * Renders Mosaic commits and preserves Base Image presentation during replacement.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import type { CoreImageInfo, FabricModule } from '../../core/index.js';
import type { ImageResourcePolicyPort } from '../../sdk/index.js';
import { settleAbortable } from '../../utils/abortable-promise.js';
import { hasErrorName } from '../../utils/error.js';
import { isPixelAreaWithinBudget } from '../../utils/image-budget.js';
import { MosaicValidationError } from './mosaic-errors.js';
import { copyMosaicImagePresentation, type MosaicRasterCache } from './mosaic-raster-cache.js';
import type {
    MosaicCommitOptions,
    MosaicConfiguration,
    MosaicOutputFormat,
} from './mosaic-session.js';

type SupportedImageMimeType = NonNullable<CoreImageInfo['mimeType']>;

export interface NormalizedMosaicCommitOptions {
    readonly format: Exclude<MosaicOutputFormat, 'source'>;
    readonly quality?: number;
    readonly mimeType: SupportedImageMimeType;
    readonly bakeVisibleFilters: boolean;
}

export interface MosaicRenderResult {
    readonly image: FabricNS.FabricImage;
    readonly mimeType: SupportedImageMimeType;
}

interface MosaicRenderHost {
    readonly fabric: FabricModule;
    getImageResourcePolicy(): ReturnType<ImageResourcePolicyPort['getImageResourcePolicy']>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

export function normalizeMosaicCommitOptions(
    value: MosaicCommitOptions | undefined,
    configuration: MosaicConfiguration,
    sourceMimeType: CoreImageInfo['mimeType'],
): NormalizedMosaicCommitOptions {
    if (value !== undefined && !isRecord(value)) {
        throw new MosaicValidationError('Mosaic commit options must be an object.');
    }
    const record = (value ?? {}) as Record<string, unknown>;
    const allowedKeys = new Set(['format', 'quality', 'bakeVisibleFilters']);
    if (Object.keys(record).some((key) => !allowedKeys.has(key))) {
        throw new MosaicValidationError('Mosaic commit options contain unknown keys.');
    }
    const requestedFormat = record.format ?? configuration.format;
    if (
        requestedFormat !== 'source' &&
        requestedFormat !== 'png' &&
        requestedFormat !== 'jpeg' &&
        requestedFormat !== 'webp'
    ) {
        throw new MosaicValidationError('Mosaic output format is invalid.');
    }
    const sourceFormat =
        sourceMimeType === 'image/jpeg' ? 'jpeg' : sourceMimeType === 'image/webp' ? 'webp' : 'png';
    const format = requestedFormat === 'source' ? sourceFormat : requestedFormat;
    const quality = record.quality ?? configuration.quality;
    if (typeof quality !== 'number' || !Number.isFinite(quality) || quality < 0 || quality > 1) {
        throw new MosaicValidationError('Mosaic output quality must be within [0, 1].');
    }
    if (record.bakeVisibleFilters !== undefined && typeof record.bakeVisibleFilters !== 'boolean') {
        throw new MosaicValidationError('bakeVisibleFilters must be a boolean.');
    }
    return Object.freeze({
        format,
        ...(format === 'png' ? {} : { quality }),
        mimeType: format === 'jpeg' ? 'image/jpeg' : `image/${format}`,
        bakeVisibleFilters: record.bakeVisibleFilters !== false,
    });
}

function encodedBytes(dataUrl: string, expectedMimeType: SupportedImageMimeType): number {
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex < 0 || !/;base64$/i.test(dataUrl.slice(0, commaIndex))) {
        throw new MosaicValidationError('Mosaic output is not a base64 Data URL.');
    }
    const mimeType = dataUrl.slice(5, dataUrl.indexOf(';'));
    if (mimeType !== expectedMimeType) {
        throw new MosaicValidationError(
            `Mosaic encoder returned ${mimeType || 'an unknown MIME'} instead of ${expectedMimeType}.`,
        );
    }
    const payload = dataUrl.slice(commaIndex + 1);
    const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
    return Math.floor((payload.length * 3) / 4) - padding;
}

async function decodeMosaicImage(
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
        () => controller.abort(new MosaicValidationError('Mosaic decode timed out.')),
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
        throw new MosaicValidationError('Mosaic decode failed.');
    } finally {
        clearTimeout(timeout);
        signal.removeEventListener('abort', abort);
    }
}

export async function renderMosaicImage(
    host: MosaicRenderHost,
    source: FabricNS.FabricImage,
    cache: MosaicRasterCache,
    options: NormalizedMosaicCommitOptions,
    signal: AbortSignal,
): Promise<MosaicRenderResult> {
    const policy = host.getImageResourcePolicy();
    const pixelBudget = Math.min(policy.maxInputPixels, policy.maxExportPixels);
    if (
        cache.widthPx > policy.maxExportDimension ||
        cache.heightPx > policy.maxExportDimension ||
        !isPixelAreaWithinBudget(cache.widthPx, cache.heightPx, pixelBudget)
    ) {
        throw new MosaicValidationError('Mosaic dimensions exceed the Core resource policy.');
    }
    let dataUrl: string;
    try {
        cache.context.putImageData(cache.imageData, 0, 0);
        if (signal.aborted) throw signal.reason;
        dataUrl = cache.surface.toDataURL(options.mimeType, options.quality);
    } catch (error) {
        if (signal.aborted) throw signal.reason ?? error;
        if (hasErrorName(error, 'SecurityError')) {
            throw new MosaicValidationError(
                'Mosaic pixels cannot be exported because canvas access is blocked.',
            );
        }
        throw error;
    }
    if (encodedBytes(dataUrl, options.mimeType) > policy.maxInputBytes) {
        throw new MosaicValidationError('Mosaic output exceeds the Core input budget.');
    }
    const image = await decodeMosaicImage(host.fabric, dataUrl, policy.imageLoadTimeoutMs, signal);
    try {
        if (image.width !== cache.widthPx || image.height !== cache.heightPx) {
            throw new MosaicValidationError('Mosaic dimensions changed during decode.');
        }
        copyMosaicImagePresentation(source, image, false);
        image.set({ selectable: false, evented: false, hasControls: false });
        image.setCoords();
        return Object.freeze({ image, mimeType: options.mimeType });
    } catch (error) {
        image.dispose();
        throw error;
    }
}
