export function normalizeThrownError(cause, message) {
    try {
        if (cause instanceof Error)
            return cause;
    }
    catch {
    }
    const error = new Error(message);
    Object.defineProperty(error, 'cause', {
        configurable: true,
        value: cause,
    });
    return error;
}
//# sourceMappingURL=thrown-error.js.map