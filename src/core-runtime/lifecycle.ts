import {
    CoreRuntimeError,
    EditorAlreadyInitializedError,
    EditorDisposedError,
    EditorDisposingError,
    EditorFaultedError,
    EditorInitializationInProgressError,
} from './errors.js';
import type { EditorLifecycleState } from './public-types.js';

const ALLOWED_TRANSITIONS = {
    configured: ['initializing', 'disposing'],
    initializing: ['configured', 'initialized', 'faulted'],
    initialized: ['disposing', 'faulted'],
    disposing: ['disposed'],
    disposed: [],
    faulted: ['configured', 'disposing'],
} as const satisfies Readonly<Record<EditorLifecycleState, readonly EditorLifecycleState[]>>;

export class EditorLifecycleController {
    private state: EditorLifecycleState = 'configured';

    get current(): EditorLifecycleState {
        return this.state;
    }

    beginInitialization(): void {
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

    completeInitialization(): void {
        this.transition('initialized');
    }

    recoverInitialization(): void {
        this.transition('configured');
    }

    failInitialization(): void {
        this.transition('faulted');
    }

    failRuntime(): void {
        if (this.state === 'faulted') return;
        if (this.state !== 'initialized') {
            throw new CoreRuntimeError(
                `[ImageEditor] Cannot enter faulted from "${this.state}" during runtime.`,
                { code: 'INVALID_LIFECYCLE_TRANSITION', behavior: 'lifecycle' },
            );
        }
        this.transition('faulted');
    }

    recoverFault(): void {
        if (this.state !== 'faulted') {
            throw new CoreRuntimeError(
                `[ImageEditor] Cannot complete emergency reset from "${this.state}".`,
                { code: 'INVALID_LIFECYCLE_TRANSITION', behavior: 'lifecycle' },
            );
        }
        this.transition('configured');
    }

    beginDisposal(): boolean {
        if (this.state === 'disposing' || this.state === 'disposed') return false;
        if (this.state === 'initializing') {
            throw new EditorInitializationInProgressError('dispose');
        }
        this.transition('disposing');
        return true;
    }

    completeDisposal(): void {
        this.transition('disposed');
    }

    assertOperational(operation: string): void {
        switch (this.state) {
            case 'initialized':
                return;
            case 'configured':
                throw new CoreRuntimeError(
                    `[ImageEditor] Cannot ${operation} before initialization.`,
                    { code: 'EDITOR_NOT_INITIALIZED' },
                );
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

    assertAvailable(operation: string): void {
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

    private transition(next: EditorLifecycleState): void {
        const allowed = ALLOWED_TRANSITIONS[this.state] as readonly EditorLifecycleState[];
        if (!allowed.includes(next)) {
            throw new CoreRuntimeError(
                `[ImageEditor] Invalid lifecycle transition from "${this.state}" to "${next}".`,
                { code: 'INVALID_LIFECYCLE_TRANSITION' },
            );
        }
        this.state = next;
    }
}
