import { base64PayloadByteLength } from './base64-payload.js';
export function inspectRasterOutput(dataUrl, expectedMimeType) {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,/u.exec(dataUrl);
    if (!match)
        throw new TypeError('Raster encoding did not produce a supported image Data URL.');
    const mimeType = match[1];
    if (expectedMimeType && mimeType !== expectedMimeType) {
        throw new TypeError(`Raster encoder returned ${mimeType} instead of ${expectedMimeType}.`);
    }
    const bytes = base64PayloadByteLength(dataUrl.slice(match[0].length));
    if (bytes === 0)
        throw new TypeError('Raster encoding produced an empty image.');
    return Object.freeze({ mimeType, bytes });
}
export function rasterBackground(format, background) {
    return format === 'jpeg' && (!background || background.trim().toLowerCase() === 'transparent')
        ? '#ffffff'
        : background;
}
//# sourceMappingURL=raster-output.js.map