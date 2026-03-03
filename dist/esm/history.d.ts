export declare class Command {
    readonly execute: () => void;
    readonly undo: () => void;
    constructor(execute: () => void, undo: () => void);
}
export declare class HistoryManager {
    readonly maxSize: number;
    history: Command[];
    currentIndex: number;
    constructor(maxSize?: number);
    execute(command: Command): void;
    canUndo(): boolean;
    canRedo(): boolean;
    undo(): void;
    redo(): void;
}
//# sourceMappingURL=history.d.ts.map