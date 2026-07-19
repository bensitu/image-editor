import { createDisposable, isPromiseLike, } from './disposable.js';
import { PluginKernelDisposedError, ToolRegistrationError, ToolTransitionError } from './errors.js';
import { reportErrorSafely } from './reporting.js';
import { isRuntimeIdentifier } from './runtime-identifier.js';
export class ToolCoordinator {
    constructor(options = {}) {
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: options
        });
        Object.defineProperty(this, "tools", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "active", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "transitioning", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    register(definition, ownerPluginId) {
        this.assertActive('register a tool');
        if (!isRuntimeIdentifier(ownerPluginId)) {
            throw new ToolRegistrationError('Tool owner Plugin id must match "namespace:kebab-case".', ownerPluginId);
        }
        if (!isRuntimeIdentifier(definition.id)) {
            throw new ToolRegistrationError('Tool id must match "namespace:kebab-case".', ownerPluginId);
        }
        const existing = this.tools.get(definition.id);
        if (existing) {
            throw new ToolRegistrationError(`Tool "${definition.id}" is already registered by "${existing.ownerPluginId}".`, ownerPluginId);
        }
        const record = {
            definition,
            ownerPluginId,
            context: Object.freeze({ toolId: definition.id, ownerPluginId }),
        };
        this.tools.set(definition.id, record);
        return createDisposable(() => {
            if (this.active === record) {
                return this.exitCurrent('plugin-dispose').finally(() => {
                    if (this.tools.get(definition.id) === record)
                        this.tools.delete(definition.id);
                });
            }
            if (this.tools.get(definition.id) === record)
                this.tools.delete(definition.id);
            return undefined;
        });
    }
    disposeSync() {
        if (this.disposed)
            return;
        let exitError;
        try {
            const current = this.active;
            this.active = null;
            if (current) {
                const result = current.definition.exit('host-dispose', current.context);
                if (isPromiseLike(result)) {
                    void Promise.resolve(result).catch((error) => {
                        reportErrorSafely(this.options.errorSink, error);
                    });
                    throw new ToolTransitionError(current.definition.id, 'returned a Promise during synchronous host disposal', current.ownerPluginId);
                }
            }
        }
        catch (error) {
            exitError = error;
        }
        finally {
            this.active = null;
            this.tools.clear();
            this.disposed = true;
        }
        if (exitError)
            throw exitError;
    }
    async enter(toolId, requesterPluginId) {
        this.assertActive('enter a tool');
        const next = this.tools.get(toolId);
        if (!next)
            throw new ToolTransitionError(toolId, 'is not registered', requesterPluginId);
        if (requesterPluginId && requesterPluginId !== next.ownerPluginId) {
            throw new ToolTransitionError(toolId, `belongs to "${next.ownerPluginId}", not "${requesterPluginId}"`, requesterPluginId);
        }
        if (this.active === next)
            return;
        await this.runTransition(toolId, async () => {
            if (this.active)
                await this.exitCurrent('switch');
            try {
                await next.definition.enter(next.context);
                this.active = next;
            }
            catch (error) {
                this.active = null;
                const transitionError = new ToolTransitionError(toolId, 'failed to enter', next.ownerPluginId, error);
                reportErrorSafely(this.options.errorSink, transitionError);
                throw transitionError;
            }
        });
    }
    async exit(reason = 'requested') {
        this.assertActive('exit a tool');
        if (!this.active)
            return;
        await this.runTransition(this.active.definition.id, () => this.exitCurrent(reason));
    }
    getActiveToolId() {
        var _a, _b;
        this.assertActive('inspect active tool state');
        return (_b = (_a = this.active) === null || _a === void 0 ? void 0 : _a.definition.id) !== null && _b !== void 0 ? _b : null;
    }
    canRunOperation(operationId) {
        var _a;
        this.assertActive('check tool operation policy');
        if (!((_a = this.active) === null || _a === void 0 ? void 0 : _a.definition.canRunOperation))
            return true;
        try {
            return this.active.definition.canRunOperation(operationId);
        }
        catch (error) {
            const transitionError = new ToolTransitionError(this.active.definition.id, `operation policy failed for "${operationId}"`, this.active.ownerPluginId, error);
            reportErrorSafely(this.options.errorSink, transitionError);
            return false;
        }
    }
    async dispose() {
        if (this.disposed)
            return;
        let exitError;
        try {
            if (this.active)
                await this.exitCurrent('host-dispose');
        }
        catch (error) {
            exitError = error;
        }
        finally {
            this.active = null;
            this.tools.clear();
            this.disposed = true;
        }
        if (exitError)
            throw exitError;
    }
    async exitCurrent(reason) {
        const current = this.active;
        if (!current)
            return;
        this.active = null;
        try {
            await current.definition.exit(reason, current.context);
        }
        catch (error) {
            const transitionError = new ToolTransitionError(current.definition.id, `failed to exit for reason "${reason}"`, current.ownerPluginId, error);
            reportErrorSafely(this.options.errorSink, transitionError);
            throw transitionError;
        }
    }
    async runTransition(toolId, task) {
        if (this.transitioning) {
            throw new ToolTransitionError(toolId, 'cannot transition while another transition is active');
        }
        this.transitioning = true;
        try {
            await task();
        }
        finally {
            this.transitioning = false;
        }
    }
    assertActive(operation) {
        if (this.disposed)
            throw new PluginKernelDisposedError(operation);
    }
}
//# sourceMappingURL=tool-coordinator.js.map