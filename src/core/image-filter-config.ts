/**
 * Normalizes editor-managed image filter config for preview, history, and restore.
 *
 * @module
 */

import type { ImageFilterConfig, ResolvedImageFilterConfig } from './public-types.js';

export const DEFAULT_IMAGE_FILTER_CONFIG: Readonly<ResolvedImageFilterConfig> = Object.freeze({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    blur: 0,
    sharpen: 0,
    grayscale: false,
    sepia: false,
    vintage: false,
});

export interface ImageFilterConfigNormalizationResult {
    config: ResolvedImageFilterConfig;
    warnings: string[];
}

function isConfigObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(object: Record<string, unknown>, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(object, key);
}

function normalizeNumberField(
    raw: Record<string, unknown>,
    key: keyof Pick<
        ResolvedImageFilterConfig,
        'brightness' | 'contrast' | 'saturation' | 'blur' | 'sharpen'
    >,
    fallback: number,
    min: number,
    max: number,
    warnings: string[],
): number {
    if (!hasOwn(raw, key)) return fallback;

    const value = raw[key];
    if (value === undefined || value === null) return 0;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        warnings.push(key);
        return fallback;
    }
    if (value < min || value > max) {
        warnings.push(key);
        return Math.max(min, Math.min(max, value));
    }
    return value;
}

function normalizeBooleanField(
    raw: Record<string, unknown>,
    key: keyof Pick<ResolvedImageFilterConfig, 'grayscale' | 'sepia' | 'vintage'>,
    fallback: boolean,
    warnings: string[],
): boolean {
    if (!hasOwn(raw, key)) return fallback;

    const value = raw[key];
    if (value === undefined || value === null) return false;
    if (typeof value !== 'boolean') {
        warnings.push(key);
        return fallback;
    }
    return value;
}

export function cloneResolvedImageFilterConfig(
    config: ResolvedImageFilterConfig,
): ResolvedImageFilterConfig {
    return { ...config };
}

export function mergeImageFilterConfigPatch(
    current: ResolvedImageFilterConfig,
    patch: Partial<ImageFilterConfig>,
): ImageFilterConfigNormalizationResult {
    const raw = isConfigObject(patch) ? patch : {};
    const warnings: string[] = [];
    const config: ResolvedImageFilterConfig = {
        brightness: normalizeNumberField(raw, 'brightness', current.brightness, -1, 1, warnings),
        contrast: normalizeNumberField(raw, 'contrast', current.contrast, -1, 1, warnings),
        saturation: normalizeNumberField(raw, 'saturation', current.saturation, -1, 1, warnings),
        blur: normalizeNumberField(raw, 'blur', current.blur, 0, 1, warnings),
        sharpen: normalizeNumberField(raw, 'sharpen', current.sharpen, 0, 1, warnings),
        grayscale: normalizeBooleanField(raw, 'grayscale', current.grayscale, warnings),
        sepia: normalizeBooleanField(raw, 'sepia', current.sepia, warnings),
        vintage: normalizeBooleanField(raw, 'vintage', current.vintage, warnings),
    };
    return { config, warnings };
}

export function normalizeImageFilterConfigSnapshot(value: unknown): ResolvedImageFilterConfig {
    if (!isConfigObject(value)) return cloneResolvedImageFilterConfig(DEFAULT_IMAGE_FILTER_CONFIG);
    return mergeImageFilterConfigPatch(
        cloneResolvedImageFilterConfig(DEFAULT_IMAGE_FILTER_CONFIG),
        value as Partial<ImageFilterConfig>,
    ).config;
}

export function areResolvedImageFilterConfigsEqual(
    left: ResolvedImageFilterConfig,
    right: ResolvedImageFilterConfig,
): boolean {
    return (
        left.brightness === right.brightness &&
        left.contrast === right.contrast &&
        left.saturation === right.saturation &&
        left.blur === right.blur &&
        left.sharpen === right.sharpen &&
        left.grayscale === right.grayscale &&
        left.sepia === right.sepia &&
        left.vintage === right.vintage
    );
}

export function hasActiveImageFilters(config: ResolvedImageFilterConfig): boolean {
    return (
        config.brightness !== 0 ||
        config.contrast !== 0 ||
        config.saturation !== 0 ||
        config.blur !== 0 ||
        config.sharpen !== 0 ||
        config.grayscale ||
        config.sepia ||
        config.vintage
    );
}
