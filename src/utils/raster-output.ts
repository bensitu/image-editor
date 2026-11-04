/** Validates browser raster encodings and reports their actual media type and size. */
import { base64PayloadByteLength } from './base64-payload.js';

export function inspectRasterOutput(
    dataUrl: string,
    expectedMimeType?: string,
): Readonly<{
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
    bytes: number;
}> {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,/u.exec(dataUrl);
    if (!match) throw new TypeError('Raster encoding did not produce a supported image Data URL.');
    const mimeType = match[1] as 'image/png' | 'image/jpeg' | 'image/webp';
    if (expectedMimeType && mimeType !== expectedMimeType) {
        throw new TypeError(`Raster encoder returned ${mimeType} instead of ${expectedMimeType}.`);
    }
    const bytes = base64PayloadByteLength(dataUrl.slice(match[0].length));
    if (bytes === 0) throw new TypeError('Raster encoding produced an empty image.');
    return Object.freeze({ mimeType, bytes });
}

/** Uses an opaque white background for JPEG when the configured background is transparent. */
export function rasterBackground(format: string, background: string): string {
    return format === 'jpeg' && (!background || background.trim().toLowerCase() === 'transparent')
        ? '#ffffff'
        : background;
}
