import type { ImageEditorCore } from '../core-runtime/image-editor-core.js';
import type { HistoryCommand, LegacyHistoryPort } from '../history/history-port.js';
import type { HistoryAvailability, HistoryPort } from '../plugins/history/index.js';
/** Stable history object owned by EditorRuntime before the plugin host exists. */
export declare class DeferredHistoryPort implements LegacyHistoryPort {
    readonly maxSize: number;
    private delegate;
    constructor(maxSize: number);
    get history(): readonly unknown[];
    attach(delegate: LegacyHistoryPort): void;
    detach(delegate: LegacyHistoryPort): void;
    execute(command: HistoryCommand): Promise<void>;
    push(command: HistoryCommand): void;
    clear(): void;
    canUndo(): boolean;
    canRedo(): boolean;
    undo(): Promise<void>;
    redo(): Promise<void>;
}
/**
 * Adapts legacy post-mutation `push(Command)` calls to the single v3
 * Memento-backed History plugin. Command closures are intentionally not
 * retained: the Core mementos are the authoritative undo/redo payload.
 */
export declare class PluginHistoryAdapter implements LegacyHistoryPort {
    private readonly core;
    private readonly history;
    readonly maxSize: number;
    private baseline;
    private readonly unsubscribe;
    private disposed;
    constructor(core: ImageEditorCore, history: HistoryPort, maxSize: number, onChange: (state: HistoryAvailability) => void);
    get retainedCount(): number;
    execute(command: HistoryCommand): Promise<void>;
    push(command: HistoryCommand): void;
    clear(): void;
    canUndo(): boolean;
    canRedo(): boolean;
    undo(): Promise<void>;
    redo(): Promise<void>;
    resetBaseline(): void;
    dispose(): void;
    private refreshBaseline;
    private assertActive;
}
