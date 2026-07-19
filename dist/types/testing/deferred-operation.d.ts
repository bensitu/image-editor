/**
 * A manually controlled Promise used by deterministic Plugin tests.
 *
 * @module
 */
export interface DeferredOperation<TValue> {
    readonly promise: Promise<TValue>;
    readonly settled: boolean;
    resolve(value: TValue): void;
    reject(reason: unknown): void;
}
/** Creates a Promise whose first explicit settlement wins. */
export declare function createDeferredOperation<TValue = void>(): DeferredOperation<TValue>;
export interface ControlledImageDecoder<TInput, TImage> {
    readonly pendingInputs: readonly TInput[];
    decode(input: TInput, signal?: AbortSignal): Promise<TImage>;
    resolveNext(image: TImage): void;
    rejectNext(reason: unknown): void;
}
/** Creates a FIFO decoder whose completion is controlled by the test. */
export declare function createControlledImageDecoder<TInput = unknown, TImage = unknown>(): ControlledImageDecoder<TInput, TImage>;
