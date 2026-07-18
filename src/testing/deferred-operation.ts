/** A manually controlled Promise used by deterministic Plugin tests. */
export interface DeferredOperation<TValue> {
    readonly promise: Promise<TValue>;
    readonly settled: boolean;
    resolve(value: TValue): void;
    reject(reason: unknown): void;
}

/** Creates a Promise whose first explicit settlement wins. */
export function createDeferredOperation<TValue = void>(): DeferredOperation<TValue> {
    let settled = false;
    let resolvePromise!: (value: TValue) => void;
    let rejectPromise!: (reason: unknown) => void;
    const promise = new Promise<TValue>((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
    });

    return Object.freeze({
        promise,
        get settled(): boolean {
            return settled;
        },
        resolve(value: TValue): void {
            if (settled) return;
            settled = true;
            resolvePromise(value);
        },
        reject(reason: unknown): void {
            if (settled) return;
            settled = true;
            rejectPromise(reason);
        },
    });
}

export interface ControlledImageDecoder<TInput, TImage> {
    readonly pendingInputs: readonly TInput[];
    decode(input: TInput, signal?: AbortSignal): Promise<TImage>;
    resolveNext(image: TImage): void;
    rejectNext(reason: unknown): void;
}

interface PendingDecode<TInput, TImage> {
    readonly input: TInput;
    readonly deferred: DeferredOperation<TImage>;
    readonly signal: AbortSignal | undefined;
    readonly abortListener: () => void;
}

function createAbortError(): Error {
    const error = new Error('Image decoding was aborted.');
    error.name = 'AbortError';
    return error;
}

/** Creates a FIFO decoder whose completion is controlled by the test. */
export function createControlledImageDecoder<
    TInput = unknown,
    TImage = unknown,
>(): ControlledImageDecoder<TInput, TImage> {
    const pending: PendingDecode<TInput, TImage>[] = [];

    const remove = (entry: PendingDecode<TInput, TImage>): void => {
        const index = pending.indexOf(entry);
        if (index >= 0) pending.splice(index, 1);
        entry.signal?.removeEventListener('abort', entry.abortListener);
    };

    const takeNext = (): PendingDecode<TInput, TImage> => {
        const entry = pending[0];
        if (!entry) throw new Error('No controlled image decode is pending.');
        remove(entry);
        return entry;
    };

    return Object.freeze({
        get pendingInputs(): readonly TInput[] {
            return Object.freeze(pending.map((entry) => entry.input));
        },
        decode(input: TInput, signal?: AbortSignal): Promise<TImage> {
            const deferred = createDeferredOperation<TImage>();
            const abortListener = (): void => {
                const index = pending.findIndex((entry) => entry.deferred === deferred);
                if (index >= 0) pending.splice(index, 1);
                deferred.reject(createAbortError());
            };
            const entry = { input, deferred, signal, abortListener };
            if (signal?.aborted) {
                deferred.reject(createAbortError());
            } else {
                pending.push(entry);
                signal?.addEventListener('abort', abortListener, { once: true });
            }
            return deferred.promise;
        },
        resolveNext(image: TImage): void {
            takeNext().deferred.resolve(image);
        },
        rejectNext(reason: unknown): void {
            takeNext().deferred.reject(reason);
        },
    });
}
