import { reportError, reportWarning } from '../core/callback-reporter.js';
import { inferImageMimeType, readFileAsDataUrl, resetFileInput } from '../utils/file.js';
export async function loadImageFile(context, file) {
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
        await context.loadImage(dataUrl);
    }
    finally {
        resetFileInput(inputElement);
    }
}
//# sourceMappingURL=image-file-loader.js.map