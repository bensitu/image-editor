import type { CoreDiagnosticsPort, Disposable } from '../../sdk/index.js';
import type { DomControlsOptions, DomControlsStatus } from './dom-controls-types.js';
export declare class DomControlsConfigurationError extends Error {
    readonly name = "DomControlsConfigurationError";
}
export declare class DomControlsController implements Disposable {
    private readonly diagnostics;
    private options;
    private apis;
    private readonly removers;
    private readonly subscriptions;
    private readonly buttons;
    private readonly synchronizers;
    private readonly occupiedBindings;
    private bound;
    private disposed;
    private pendingActions;
    constructor(options: DomControlsOptions, diagnostics: CoreDiagnosticsPort);
    bind(): void;
    refresh(): void;
    refreshFromRuntime(): void;
    getStatus(): DomControlsStatus;
    dispose(): void;
    private bindConfiguredControls;
    private bindTransform;
    private bindHistory;
    private bindMasks;
    private bindFilters;
    private bindCrop;
    private bindMosaic;
    private bindAnnotations;
    private bindText;
    private bindShape;
    private bindDraw;
    private bindKeyboard;
    private keyboardAction;
    private resolveKeyboardTarget;
    private button;
    private render;
    private listen;
    private subscribe;
    private runAction;
    private reportActionError;
    private releaseBindings;
    private requireOptions;
    private requireApis;
}
