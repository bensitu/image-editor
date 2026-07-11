export function reportErrorSafely(errorSink, error) {
    if (!errorSink)
        return;
    try {
        errorSink(error);
    }
    catch {
    }
}
export function reportWarningSafely(warningSink, errorSink, warning) {
    if (!warningSink)
        return;
    try {
        warningSink(warning);
    }
    catch (error) {
        reportErrorSafely(errorSink, error);
    }
}
//# sourceMappingURL=reporting.js.map