import { reportError, reportWarning } from '../core/callback-reporter.js';
import { normalizeJpegOrientationIfNeeded } from './exif-orientation.js';
import { inferImageMimeType, readFileAsDataUrl, resetFileInput } from '../utils/file.js';
export async function loadImageFile(context, file) {
    var _a;
    const inputElement = context.getInputElement();
    const mime = inferImageMimeType(file);
    if (!mime) {
        reportWarning(context.options, null, `Unsupported image file type: ${file.type || file.name || 'unknown'}.`);
        resetFileInput(inputElement);
        return;
    }
    let dataUrl;
    try {
        dataUrl = await readFileAsDataUrl(file);
    }
    catch (error) {
        reportError(context.options, error, 'Failed to read selected image file.');
        resetFileInput(inputElement);
        return;
    }
    try {
        try {
            dataUrl =
                (_a = (await normalizeJpegOrientationIfNeeded(file, dataUrl, context.options, inputElement === null || inputElement === void 0 ? void 0 : inputElement.ownerDocument))) !== null && _a !== void 0 ? _a : dataUrl;
        }
        catch (error) {
            reportWarning(context.options, error, 'JPEG EXIF orientation normalization failed; loading the original file data.');
        }
        await context.loadImage(dataUrl);
    }
    finally {
        resetFileInput(inputElement);
    }
}
//# sourceMappingURL=image-file-loader.js.map