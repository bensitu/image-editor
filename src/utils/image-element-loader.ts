/**
 * Shared browser image element loading primitive.
 *
 * Callers provide their own error factory and validation so image loading and
 * export pipelines can share listener cleanup without sharing domain errors.
 *
 * @module
 */

export interface ImageElementLoadHandle {
    promise: Promise<HTMLImageElement>;
    cleanup(clearSource?: boolean): void;
}

export interface ImageElementLoadOptions {
    crossOrigin?: string;
    validate?: (imageElement: HTMLImageElement) => Error | null;
    createError: (event: Event | string) => Error;
}

export function startImageElementLoad(
    dataUrl: string,
    options: ImageElementLoadOptions,
): ImageElementLoadHandle {
    const imageElement = new Image();
    if (options.crossOrigin !== undefined) {
        imageElement.crossOrigin = options.crossOrigin;
    }

    const cleanup = (clearSource = false): void => {
        if (typeof imageElement.removeEventListener === 'function') {
            imageElement.removeEventListener('load', handleLoad);
            imageElement.removeEventListener('error', handleError);
        } else {
            imageElement.onload = null;
            imageElement.onerror = null;
        }
        if (clearSource) {
            try {
                imageElement.src = '';
            } catch {
                /* ignore */
            }
        }
    };

    const handleLoad = (): void => {
        const validationError = options.validate?.(imageElement) ?? null;
        if (validationError) {
            cleanup(true);
            rejectImage(validationError);
            return;
        }
        cleanup(false);
        resolveImage(imageElement);
    };
    const handleError = (event: Event | string): void => {
        cleanup(true);
        rejectImage(options.createError(event));
    };
    let resolveImage!: (imageElement: HTMLImageElement) => void;
    let rejectImage!: (error: Error) => void;

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
        resolveImage = resolve;
        rejectImage = reject;
        if (typeof imageElement.addEventListener === 'function') {
            imageElement.addEventListener('load', handleLoad, { once: true });
            imageElement.addEventListener('error', handleError, { once: true });
        } else {
            imageElement.onload = handleLoad;
            imageElement.onerror = handleError;
        }
        imageElement.src = dataUrl;
    });

    return { promise, cleanup };
}
