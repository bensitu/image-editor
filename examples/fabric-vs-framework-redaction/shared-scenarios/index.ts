/**
 * Defines and executes the common redaction behavior used by both adapters.
 *
 * @module
 */

export interface RedactionComparisonAdapter {
    readonly name: string;
    loadImage(source: string): Promise<void>;
    rotate(degrees: number): Promise<void>;
    getRotation(): number;
    addMask(): Promise<void>;
    getMaskCount(): number;
    undo(): Promise<void>;
    snapshot(): Promise<string>;
    verifyFailedLoadRollback(source: string): Promise<boolean>;
    dispose(): Promise<void>;
}

export interface RedactionScenarioResult {
    readonly adapter: string;
    readonly rotation: number;
    readonly maskCountAfterAdd: number;
    readonly maskCountAfterUndo: number;
    readonly rotationChangedSnapshot: boolean;
    readonly maskChangedSnapshot: boolean;
    readonly undoChangedSnapshot: boolean;
    readonly failedLoadRolledBack: boolean;
    readonly disposed: true;
}

function requireCondition(condition: boolean, message: string): void {
    if (!condition) throw new Error(message);
}

export async function runRedactionScenario(
    adapter: RedactionComparisonAdapter,
    validImageSource: string,
    invalidImageSource: string,
): Promise<RedactionScenarioResult> {
    let result: Omit<RedactionScenarioResult, 'disposed'>;
    try {
        await adapter.loadImage(validImageSource);
        const loadedSnapshot = await adapter.snapshot();

        await adapter.rotate(90);
        const rotatedSnapshot = await adapter.snapshot();
        const rotation = adapter.getRotation();
        requireCondition(
            rotation === 90,
            `${adapter.name} did not rotate the image by 90 degrees.`,
        );

        await adapter.addMask();
        const maskedSnapshot = await adapter.snapshot();
        const maskCountAfterAdd = adapter.getMaskCount();
        requireCondition(maskCountAfterAdd === 1, `${adapter.name} did not add one mask.`);

        await adapter.undo();
        const undoneSnapshot = await adapter.snapshot();
        const maskCountAfterUndo = adapter.getMaskCount();
        requireCondition(maskCountAfterUndo === 0, `${adapter.name} did not undo the mask.`);

        const failedLoadRolledBack = await adapter.verifyFailedLoadRollback(invalidImageSource);
        requireCondition(failedLoadRolledBack, `${adapter.name} did not roll back a failed load.`);

        result = Object.freeze({
            adapter: adapter.name,
            rotation,
            maskCountAfterAdd,
            maskCountAfterUndo,
            rotationChangedSnapshot: loadedSnapshot !== rotatedSnapshot,
            maskChangedSnapshot: rotatedSnapshot !== maskedSnapshot,
            undoChangedSnapshot: maskedSnapshot !== undoneSnapshot,
            failedLoadRolledBack,
        });
        requireCondition(result.rotationChangedSnapshot, `${adapter.name} omitted rotation state.`);
        requireCondition(result.maskChangedSnapshot, `${adapter.name} omitted mask state.`);
        requireCondition(result.undoChangedSnapshot, `${adapter.name} undo did not change state.`);
    } finally {
        await adapter.dispose();
    }

    return Object.freeze({ ...result, disposed: true });
}
