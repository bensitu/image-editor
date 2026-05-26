export const SUPPORTED_IMAGE_EXTENSIONS = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
};
export function inferImageMimeType(file) {
    var _a, _b;
    if (file.type && file.type.startsWith('image/'))
        return file.type;
    if (file.type)
        return null;
    const match = /\.([a-z0-9]+)$/i.exec(file.name);
    const ext = (_a = match === null || match === void 0 ? void 0 : match[1]) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    if (!ext)
        return null;
    return (_b = SUPPORTED_IMAGE_EXTENSIONS[ext]) !== null && _b !== void 0 ? _b : null;
}
export function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (typeof result === 'string') {
                resolve(result);
            }
            else {
                reject(new Error('FileReader returned a non-string result'));
            }
        };
        reader.onerror = () => {
            var _a;
            reject((_a = reader.error) !== null && _a !== void 0 ? _a : new Error('FileReader error'));
        };
        reader.readAsDataURL(file);
    });
}
export function resetFileInput(input) {
    if (!input)
        return;
    try {
        input.value = '';
    }
    catch {
    }
}
//# sourceMappingURL=file.js.map