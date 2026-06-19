export async function runBusyOperation(access, operation, body) {
    const context = access.buildCallbackContext(operation, false);
    const token = access.beginBusyOperation(operation);
    access.emitBusyChangeIfChanged(context);
    access.updateUi();
    try {
        return await body(context, token);
    }
    finally {
        access.endBusyOperation(token);
        access.emitBusyChangeIfChanged(context);
        access.updateUi();
    }
}
//# sourceMappingURL=editor-operation-runner.js.map