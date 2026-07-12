import type { ImageEditorCore } from '../core-runtime/image-editor-core.js';
import type { CoreMemento } from '../core-runtime/state/index.js';
import type { HistoryCommand, LegacyHistoryPort } from '../history/history-port.js';
import type { HistoryAvailability, HistoryPort } from '../plugins/history/index.js';

/** Stable history object owned by EditorRuntime before the plugin host exists. */
export class DeferredHistoryPort implements LegacyHistoryPort {
    private delegate: LegacyHistoryPort | null = null;

    constructor(readonly maxSize: number) {}

    get history(): readonly unknown[] {
        const candidate = this.delegate as (LegacyHistoryPort & { retainedCount?: number }) | null;
        return Object.freeze(new Array(candidate?.retainedCount ?? 0).fill(undefined));
    }

    attach(delegate: LegacyHistoryPort): void {
        if (this.delegate) throw new Error('[ImageEditor] History plugin is already attached.');
        this.delegate = delegate;
    }

    detach(delegate: LegacyHistoryPort): void {
        if (this.delegate === delegate) this.delegate = null;
    }

    execute(command: HistoryCommand): Promise<void> {
        return this.delegate?.execute(command) ?? Promise.resolve();
    }

    push(command: HistoryCommand): void {
        this.delegate?.push(command);
    }

    clear(): void {
        this.delegate?.clear();
    }

    canUndo(): boolean {
        return this.delegate?.canUndo() ?? false;
    }

    canRedo(): boolean {
        return this.delegate?.canRedo() ?? false;
    }

    undo(): Promise<void> {
        return this.delegate?.undo() ?? Promise.resolve();
    }

    redo(): Promise<void> {
        return this.delegate?.redo() ?? Promise.resolve();
    }
}

/**
 * Adapts legacy post-mutation `push(Command)` calls to the single v3
 * Memento-backed History plugin. Command closures are intentionally not
 * retained: the Core mementos are the authoritative undo/redo payload.
 */
export class PluginHistoryAdapter implements LegacyHistoryPort {
    private baseline: CoreMemento | null = null;
    private readonly unsubscribe: () => void;
    private disposed = false;

    constructor(
        private readonly core: ImageEditorCore,
        private readonly history: HistoryPort,
        readonly maxSize: number,
        onChange: (state: HistoryAvailability) => void,
    ) {
        this.unsubscribe = history.onChange((state) => {
            this.refreshBaseline();
            onChange(state);
        });
    }

    get retainedCount(): number {
        return this.history.getState().size;
    }

    async execute(command: HistoryCommand): Promise<void> {
        this.assertActive();
        await command.execute();
        this.push(command);
    }

    push(command: HistoryCommand): void {
        this.assertActive();
        void command;
        const after = this.core.captureCompatibilityMemento();
        const before = this.baseline ?? after;
        this.history.push(
            Object.freeze({
                operationId: 'compatibility:state-change',
                before,
                after,
                timestamp: Date.now(),
                detail: Object.freeze({ source: 'full-facade' }),
            }),
        );
        this.baseline = after;
    }

    clear(): void {
        if (this.disposed) return;
        this.history.clear();
        this.refreshBaseline();
    }

    canUndo(): boolean {
        return !this.disposed && this.history.canUndo();
    }

    canRedo(): boolean {
        return !this.disposed && this.history.canRedo();
    }

    async undo(): Promise<void> {
        if (this.disposed) return;
        await this.history.undo();
        this.refreshBaseline();
    }

    async redo(): Promise<void> {
        if (this.disposed) return;
        await this.history.redo();
        this.refreshBaseline();
    }

    resetBaseline(): void {
        if (this.disposed) return;
        this.refreshBaseline();
    }

    dispose(): void {
        if (this.disposed) return;
        this.unsubscribe();
        this.baseline = null;
        this.disposed = true;
    }

    private refreshBaseline(): void {
        try {
            this.baseline = this.core.captureCompatibilityMemento();
        } catch {
            this.baseline = null;
        }
    }

    private assertActive(): void {
        if (this.disposed) throw new Error('[ImageEditor] History adapter is disposed.');
    }
}
