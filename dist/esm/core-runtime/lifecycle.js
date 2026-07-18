import { CoreRuntimeError, EditorAlreadyInitializedError, EditorDisposedError, EditorDisposingError, EditorFaultedError, EditorInitializationInProgressError, } from './errors.js';
const ALLOWED_TRANSITIONS = {
    configured: ['initializing', 'disposing'],
    initializing: ['configured', 'initialized', 'faulted'],
    initialized: ['disposing', 'faulted'],
    disposing: ['disposed'],
    disposed: [],
    faulted: ['configured', 'disposing'],
};
export class EditorLifecycleController {
    constructor() {
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'configured'
        });
    }
    get current() {
        return this.state;
    }
    beginInitialization() {
        switch (this.state) {
            case 'configured':
                this.transition('initializing');
                return;
            case 'initializing':
                throw new EditorInitializationInProgressError();
            case 'initialized':
                throw new EditorAlreadyInitializedError();
            case 'disposing':
                throw new EditorDisposingError('initialize');
            case 'disposed':
                throw new EditorDisposedError('initialize');
            case 'faulted':
                throw new EditorFaultedError('initialize');
        }
    }
    completeInitialization() {
        this.transition('initialized');
    }
    recoverInitialization() {
        this.transition('configured');
    }
    failInitialization() {
        this.transition('faulted');
    }
    failRuntime() {
        if (this.state === 'faulted')
            return;
        if (this.state !== 'initialized') {
            throw new CoreRuntimeError(`[ImageEditor] Cannot enter faulted from "${this.state}" during runtime.`, { code: 'INVALID_LIFECYCLE_TRANSITION', behavior: 'lifecycle' });
        }
        this.transition('faulted');
    }
    recoverFault() {
        if (this.state !== 'faulted') {
            throw new CoreRuntimeError(`[ImageEditor] Cannot complete emergency reset from "${this.state}".`, { code: 'INVALID_LIFECYCLE_TRANSITION', behavior: 'lifecycle' });
        }
        this.transition('configured');
    }
    beginDisposal() {
        if (this.state === 'disposing' || this.state === 'disposed')
            return false;
        if (this.state === 'initializing') {
            throw new EditorInitializationInProgressError('dispose');
        }
        this.transition('disposing');
        return true;
    }
    completeDisposal() {
        this.transition('disposed');
    }
    assertOperational(operation) {
        switch (this.state) {
            case 'initialized':
                return;
            case 'configured':
                throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} before initialization.`, { code: 'EDITOR_NOT_INITIALIZED' });
            case 'initializing':
                throw new EditorInitializationInProgressError(operation);
            case 'disposing':
                throw new EditorDisposingError(operation);
            case 'disposed':
                throw new EditorDisposedError(operation);
            case 'faulted':
                throw new EditorFaultedError(operation);
        }
    }
    assertAvailable(operation) {
        switch (this.state) {
            case 'disposing':
                throw new EditorDisposingError(operation);
            case 'disposed':
                throw new EditorDisposedError(operation);
            case 'faulted':
                throw new EditorFaultedError(operation);
            default:
                return;
        }
    }
    transition(next) {
        const allowed = ALLOWED_TRANSITIONS[this.state];
        if (!allowed.includes(next)) {
            throw new CoreRuntimeError(`[ImageEditor] Invalid lifecycle transition from "${this.state}" to "${next}".`, { code: 'INVALID_LIFECYCLE_TRANSITION' });
        }
        this.state = next;
    }
}
//# sourceMappingURL=lifecycle.js.map