/**
 * Serializes asynchronous editor ownership across framework mount lifecycles.
 *
 * @module
 */

function reportSafely(reporter, error, context) {
    try {
        reporter(error);
    } catch (reportingError) {
        console.error(`${context} Error reporting also failed.`, error, reportingError);
    }
}

export function createSerializedEditorMountCoordinator() {
    let previousClosed = Promise.resolve();

    return Object.freeze({
        mount(options) {
            let released = false;
            let resolveRelease;
            let resolveReady;
            const releaseSignal = new Promise((resolve) => {
                resolveRelease = resolve;
            });
            const ready = new Promise((resolve) => {
                resolveReady = resolve;
            });

            const lifecycle = previousClosed.then(async () => {
                if (released) {
                    resolveReady();
                    return;
                }

                let owner;
                try {
                    owner = options.create();
                    await options.initialize(owner);
                    if (!released) options.publish(owner);
                } catch (error) {
                    reportSafely(
                        options.onInitializationError,
                        error,
                        'Editor initialization failed.',
                    );
                    resolveReady();
                    if (owner !== undefined) {
                        try {
                            await options.dispose(owner);
                        } catch (disposeError) {
                            reportSafely(
                                options.onDisposalError,
                                disposeError,
                                'Editor disposal failed.',
                            );
                        }
                    }
                    return;
                }

                resolveReady();
                await releaseSignal;
                try {
                    await options.dispose(owner);
                } catch (error) {
                    reportSafely(options.onDisposalError, error, 'Editor disposal failed.');
                }
            });
            const closed = lifecycle.catch((error) => {
                resolveReady();
                reportSafely(options.onDisposalError, error, 'Editor lifecycle failed.');
            });
            previousClosed = closed;

            return Object.freeze({
                ready,
                closed,
                release() {
                    if (released) return;
                    released = true;
                    resolveRelease();
                    try {
                        options.clear();
                    } catch (error) {
                        reportSafely(
                            options.onDisposalError,
                            error,
                            'Editor ownership cleanup failed.',
                        );
                    }
                },
            });
        },
    });
}
