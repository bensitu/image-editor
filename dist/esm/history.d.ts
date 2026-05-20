export declare class Command {
    readonly execute: () => Promise<void>;
    readonly undo: () => Promise<void>;
    constructor(execute: () => Promise<void>, undo: () => Promise<void>);
}
export declare class HistoryManager {
    readonly maxSize: number;
    history: Command[];
    currentIndex: number;
    private _processing;
    constructor(maxSize?: number);
    execute(command: Command): void;
    push(command: Command): void;
    canUndo(): boolean;
    canRedo(): boolean;
    undo(): Promise<void>;
    redo(): Promise<void>;
}
//# sourceMappingURL=history.d.ts.map