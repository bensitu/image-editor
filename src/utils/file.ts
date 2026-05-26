/**
 * File-input helpers used by the v2 image-editor file-input flow.
 *
 * These helpers cover three concerns described,
 * 6.3, 6.5, 6.6, and 35.2:
 *
 * - Determining whether a `File` selected through the upload control is a
 *   supported image, including the extension fallback when `file.type` is
 *   empty (some operating systems and browsers report an empty MIME type
 *   for known extensions).
 * - Reading the file as a base64 data URL so the result can be routed
 *   through the existing transactional `loadImage` pipeline (and therefore
 *   inherit its rollback behavior on decode/Fabric/timeout failure).
 * - Resetting the file input value after every attempt so selecting the
 *   same file again triggers a fresh `change` event.
 *
 * The helpers do not call `loadImage` themselves; the orchestrator wires
 * them into the file-input change handler. That keeps the public
 * `loadImage` API unchanged beyond `LoadImageOptions`.
 */

/**
 * Supported image extensions and the MIME type each one resolves to.
 *
 * Supported file extensions: `png`, `jpg`/`jpeg`, `webp`, `gif`, `bmp`.
 *
 * Keys are lowercase extensions without the leading `.`.
 */
export const SUPPORTED_IMAGE_EXTENSIONS: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
};

/**
 * Determine whether a `File` is a supported image and return its resolved
 * MIME type, or `null` when it should be rejected.
 *
 * Resolution order:
 *
 * 1. If `file.type` is non-empty and starts with `image/`, return
 *    `file.type` verbatim. The browser already classified the file as an
 *    image, so the loader trusts that classification.
 * 2. If `file.type` is empty, infer the MIME type from the file
 *    extension via {@link SUPPORTED_IMAGE_EXTENSIONS}. This covers the
 *    case where a browser or OS reports `''` for files with a known
 *    extension.
 * 3. Otherwise, return `null` so the caller can skip the load without
 *    mutating editor state.
 *
 * @param file File selected via the upload control.
 * @returns The resolved MIME type, or `null` when the file is not a
 *          supported image.
 */
export function inferImageMimeType(file: File): string | null {
    if (file.type && file.type.startsWith('image/')) return file.type;
    if (file.type) return null;
    const match = /\.([a-z0-9]+)$/i.exec(file.name);
    const ext = match?.[1]?.toLowerCase();
    if (!ext) return null;
    return SUPPORTED_IMAGE_EXTENSIONS[ext] ?? null;
}

/**
 * Read a `File` as a base64 data URL using `FileReader`.
 *
 * The returned data URL is suitable for the transactional `loadImage`
 * pipeline: on failure the editor's existing
 * rollback bundle restores placeholder visibility, scroll, overflow,
 * `originalImage`, `_lastSnapshot`, and the canvas JSON snapshot.
 *
 * @param file File to read.
 * @returns Promise that resolves to the data URL string, or rejects when
 *          the underlying `FileReader` errors out or returns a non-string
 *          result.
 */
export function readFileAsDataURL(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload =  () => {
            const result = reader.result;
            if (typeof result === 'string') {
                resolve(result);
} else {
                reject(new Error('FileReader returned a non-string result'));
}
};
        reader.onerror =  () => {
            reject(reader.error ?? new Error('FileReader error'));
};
        reader.readAsDataURL(file);
});
}

/**
 * Reset a file input element's value so selecting the same file again
 * triggers a fresh `change` event.
 *
 * Some browsers reject programmatic assignment to `input.value` on
 * security grounds; the assignment is wrapped in a `try`/`catch` so the
 * caller never has to special-case those environments. A `null` input is
 * a no-op so callers can pass the result of `document.getElementById`
 * without an extra null check.
 *
 * @param input File input element, or `null` when the element is not
 *              present in the DOM.
 */
export function resetFileInput(input: HTMLInputElement | null): void {
    if (!input) return;
    try {
        input.value = '';
} catch {
        /* Some browsers reject programmatic resets; ignore. */
}
}
