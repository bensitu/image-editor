import type { CoreDiagnosticsPort, Disposable } from '../../sdk/index.js';
import type { OverlayFoundationApi } from '../../foundations/overlay/index.js';
import type { AnnotationPluginApi, AnnotationStatus } from '../../foundations/annotation/index.js';
import type { CropPluginApi } from '../crop/index.js';
import type { DrawAnnotationPluginApi } from '../annotation-draw/index.js';
import type { ShapeAnnotationPluginApi } from '../annotation-shape/index.js';
import type { TextAnnotationPluginApi } from '../annotation-text/index.js';
import type { FiltersPluginApi, FiltersStatus } from '../filters/index.js';
import type { HistoryPort } from '../history/index.js';
import type { MaskPluginApi } from '../mask/index.js';
import type { MosaicPluginApi } from '../mosaic/index.js';
import type { TransformPluginApi } from '../transform/index.js';
import type {
    DomButtonTarget,
    DomControlsOptions,
    DomControlsStatus,
    DomElementTarget,
    DomInputTarget,
    DomPluginBinding,
    DomRenderAdapter,
} from './dom-controls-types.js';

export class DomControlsConfigurationError extends Error {
    override readonly name = 'DomControlsConfigurationError';
}

interface ResolvedApis {
    readonly transform: TransformPluginApi | null;
    readonly history: HistoryPort | null;
    readonly masks: MaskPluginApi | null;
    readonly filters: FiltersPluginApi | null;
    readonly crop: CropPluginApi | null;
    readonly mosaic: MosaicPluginApi | null;
    readonly annotations: AnnotationPluginApi | null;
    readonly text: TextAnnotationPluginApi | null;
    readonly shape: ShapeAnnotationPluginApi | null;
    readonly draw: DrawAnnotationPluginApi | null;
    readonly overlays: OverlayFoundationApi | null;
}

interface ButtonBinding {
    readonly element: HTMLButtonElement;
    readonly available: () => boolean;
}

function isObject(value: unknown): value is Record<PropertyKey, unknown> {
    return typeof value === 'object' && value !== null;
}

function isEventTarget(value: unknown): value is EventTarget {
    return (
        isObject(value) &&
        typeof value.addEventListener === 'function' &&
        typeof value.removeEventListener === 'function'
    );
}

function isElement(value: unknown): value is Element {
    return (
        isObject(value) &&
        value.nodeType === 1 &&
        isObject(value.ownerDocument) &&
        isEventTarget(value)
    );
}

function resolveElement<TElement extends Element>(
    ownerDocument: Document,
    target: DomElementTarget<TElement>,
    label: string,
): TElement {
    let element: unknown = target;
    if (typeof target === 'string') {
        try {
            element = ownerDocument.querySelector(target);
        } catch (error) {
            throw new DomControlsConfigurationError(
                `${label} uses an invalid selector "${target}": ${String(error)}`,
            );
        }
        if (!element) {
            throw new DomControlsConfigurationError(
                `${label} selector "${target}" did not match an element.`,
            );
        }
    }
    if (!isElement(element)) {
        throw new DomControlsConfigurationError(`${label} must resolve to a DOM element.`);
    }
    if (element.ownerDocument !== ownerDocument) {
        throw new DomControlsConfigurationError(
            `${label} belongs to a different document than ownerDocument.`,
        );
    }
    return element as TElement;
}

function resolveButton(
    ownerDocument: Document,
    target: DomButtonTarget,
    label: string,
): HTMLButtonElement {
    const element = resolveElement(ownerDocument, target, label);
    if (!('disabled' in element) || typeof element.disabled !== 'boolean') {
        throw new DomControlsConfigurationError(`${label} must resolve to a button control.`);
    }
    return element;
}

function resolveInput(
    ownerDocument: Document,
    target: DomInputTarget,
    label: string,
): HTMLInputElement {
    const element = resolveElement(ownerDocument, target, label);
    if (!('value' in element) || !('checked' in element)) {
        throw new DomControlsConfigurationError(`${label} must resolve to an input control.`);
    }
    return element;
}

function resolveApi<TApi>(binding: DomPluginBinding<TApi> | undefined, label: string): TApi | null {
    if (!binding) return null;
    if (typeof binding.resolve !== 'function') {
        throw new DomControlsConfigurationError(`${label}.plugin.resolve must be a function.`);
    }
    const api = binding.resolve();
    if (!isObject(api)) {
        throw new DomControlsConfigurationError(`${label}.plugin did not resolve a Plugin API.`);
    }
    return api as TApi;
}

function disposeRegistration(registration: Disposable | (() => void)): void {
    const result = typeof registration === 'function' ? registration() : registration.dispose();
    if (result instanceof Promise) void result.catch(() => undefined);
}

function readNumericInput(input: HTMLInputElement, label: string): number {
    const value = input.valueAsNumber;
    const parsed = Number.isFinite(value) ? value : Number(input.value);
    if (!Number.isFinite(parsed)) {
        throw new DomControlsConfigurationError(`${label} must contain a finite number.`);
    }
    return parsed;
}

function isEditableNode(value: unknown, ownerDocument: Document): boolean {
    let current: unknown = value;
    while (isElement(current) && current.ownerDocument === ownerDocument) {
        const tagName = String(current.tagName).toLowerCase();
        if (
            tagName === 'input' ||
            tagName === 'textarea' ||
            tagName === 'select' ||
            (current as HTMLElement).isContentEditable === true ||
            current.getAttribute('contenteditable') === 'true' ||
            current.getAttribute('contenteditable') === ''
        ) {
            return true;
        }
        current = current.parentElement;
    }
    return false;
}

export class DomControlsController implements Disposable {
    private options: DomControlsOptions | null;
    private apis: ResolvedApis | null = null;
    private readonly removers: Array<() => void> = [];
    private readonly subscriptions: Array<Disposable | (() => void)> = [];
    private readonly buttons: ButtonBinding[] = [];
    private readonly synchronizers: Array<() => void> = [];
    private readonly occupiedBindings = new Map<EventTarget, Set<string>>();
    private bound = false;
    private disposed = false;
    private pendingActions = 0;

    constructor(
        options: DomControlsOptions,
        private readonly diagnostics: CoreDiagnosticsPort,
    ) {
        this.options = options;
    }

    bind(): void {
        if (this.disposed) {
            throw new DomControlsConfigurationError('DOM Controls cannot bind after disposal.');
        }
        if (this.bound) {
            throw new DomControlsConfigurationError('DOM Controls are already bound.');
        }
        const options = this.requireOptions();
        const configured =
            options.transform ||
            options.history ||
            options.masks ||
            options.filters ||
            options.crop ||
            options.mosaic ||
            options.annotations ||
            options.text ||
            options.shape ||
            options.draw ||
            options.keyboard;
        if (configured && !options.ownerDocument) {
            throw new DomControlsConfigurationError(
                'ownerDocument is required when DOM controls are configured.',
            );
        }

        try {
            this.apis = Object.freeze({
                transform: resolveApi(options.transform?.plugin, 'transform'),
                history: resolveApi(options.history?.plugin, 'history'),
                masks: resolveApi(options.masks?.plugin, 'masks'),
                filters: resolveApi(options.filters?.plugin, 'filters'),
                crop: resolveApi(options.crop?.plugin, 'crop'),
                mosaic: resolveApi(options.mosaic?.plugin, 'mosaic'),
                annotations: resolveApi(options.annotations?.plugin, 'annotations'),
                text: resolveApi(options.text?.plugin, 'text'),
                shape: resolveApi(options.shape?.plugin, 'shape'),
                draw: resolveApi(options.draw?.plugin, 'draw'),
                overlays: resolveApi(options.keyboard?.overlays, 'keyboard.overlays'),
            });
            if (options.ownerDocument) this.bindConfiguredControls(options.ownerDocument, options);
            this.bound = true;
            this.refresh();
        } catch (error) {
            this.releaseBindings();
            this.apis = null;
            throw error;
        }
    }

    refresh(): void {
        if (this.disposed) {
            throw new DomControlsConfigurationError('DOM Controls cannot refresh after disposal.');
        }
        if (!this.bound) {
            throw new DomControlsConfigurationError(
                'DOM Controls cannot refresh before editor initialization.',
            );
        }
        for (const synchronize of this.synchronizers) synchronize();
        for (const button of this.buttons) {
            button.element.disabled = this.pendingActions > 0 || !button.available();
        }
    }

    refreshFromRuntime(): void {
        if (!this.bound || this.disposed) return;
        try {
            this.refresh();
        } catch (error) {
            this.reportActionError('dom-controls:refresh', error);
        }
    }

    getStatus(): DomControlsStatus {
        return Object.freeze({
            isBound: this.bound,
            isBusy: this.pendingActions > 0,
            isDisposed: this.disposed,
            bindingCount: this.removers.length + this.subscriptions.length,
        });
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.releaseBindings();
        this.apis = null;
        this.options = null;
        this.bound = false;
    }

    private bindConfiguredControls(ownerDocument: Document, options: DomControlsOptions): void {
        this.bindTransform(ownerDocument, options);
        this.bindHistory(ownerDocument, options);
        this.bindMasks(ownerDocument, options);
        this.bindFilters(ownerDocument, options);
        this.bindCrop(ownerDocument, options);
        this.bindMosaic(ownerDocument, options);
        this.bindAnnotations(ownerDocument, options);
        this.bindText(ownerDocument, options);
        this.bindShape(ownerDocument, options);
        this.bindDraw(ownerDocument, options);
        this.bindKeyboard(ownerDocument, options);
    }

    private bindTransform(ownerDocument: Document, options: DomControlsOptions): void {
        const controls = options.transform;
        const api = this.requireApis().transform;
        if (!controls || !api) return;
        if (controls.scaleInput) {
            const input = resolveInput(ownerDocument, controls.scaleInput, 'transform.scaleInput');
            this.listen(input, 'change', () => {
                const scale = readNumericInput(input, 'transform.scaleInput');
                this.runAction('transform:scale', () => api.scale(scale));
            });
            this.synchronizers.push(() => {
                input.value = String(api.getState().scale);
            });
        }
        this.button(ownerDocument, controls.zoomInButton, 'transform.zoomInButton', () =>
            api.zoomIn(),
        );
        this.button(ownerDocument, controls.zoomOutButton, 'transform.zoomOutButton', () =>
            api.zoomOut(),
        );
        this.button(ownerDocument, controls.rotateLeftButton, 'transform.rotateLeftButton', () =>
            api.rotate(-90),
        );
        this.button(ownerDocument, controls.rotateRightButton, 'transform.rotateRightButton', () =>
            api.rotate(90),
        );
        this.button(
            ownerDocument,
            controls.flipHorizontalButton,
            'transform.flipHorizontalButton',
            () => api.flipHorizontal(),
        );
        this.button(
            ownerDocument,
            controls.flipVerticalButton,
            'transform.flipVerticalButton',
            () => api.flipVertical(),
        );
        this.button(ownerDocument, controls.resetButton, 'transform.resetButton', () =>
            api.resetImageTransform(),
        );
        this.render(ownerDocument, controls.status, 'transform.status', () => api.getState());
    }

    private bindHistory(ownerDocument: Document, options: DomControlsOptions): void {
        const controls = options.history;
        const api = this.requireApis().history;
        if (!controls || !api) return;
        if (controls.enabledInput) {
            const input = resolveInput(
                ownerDocument,
                controls.enabledInput,
                'history.enabledInput',
            );
            this.listen(input, 'change', () => {
                this.runAction('history:toggle', () =>
                    input.checked
                        ? api.enable({ baseline: 'current' })
                        : api.disable({ clear: false }),
                );
            });
            this.synchronizers.push(() => {
                input.checked = api.getState().isEnabled;
                input.disabled = this.pendingActions > 0;
            });
        }
        this.button(
            ownerDocument,
            controls.undoButton,
            'history.undoButton',
            () => api.undo(),
            () => api.canUndo(),
        );
        this.button(
            ownerDocument,
            controls.redoButton,
            'history.redoButton',
            () => api.redo(),
            () => api.canRedo(),
        );
        this.button(
            ownerDocument,
            controls.clearButton,
            'history.clearButton',
            () => api.clear(),
            () => api.length > 0,
        );
        this.render(ownerDocument, controls.status, 'history.status', () => api.getState());
        this.subscribe(api.onChange(() => this.refreshFromRuntime()));
    }

    private bindMasks(ownerDocument: Document, options: DomControlsOptions): void {
        const controls = options.masks;
        const api = this.requireApis().masks;
        if (!controls || !api) return;
        this.button(
            ownerDocument,
            controls.removeSelectedButton,
            'masks.removeSelectedButton',
            () => api.removeSelected(),
            () => api.getAll().length > 0,
        );
        this.button(
            ownerDocument,
            controls.removeAllButton,
            'masks.removeAllButton',
            () => api.removeAll(),
            () => api.getAll().length > 0,
        );
        this.render(ownerDocument, controls.list, 'masks.list', () => api.getAll());
    }

    private bindFilters(ownerDocument: Document, options: DomControlsOptions): void {
        const controls = options.filters;
        const api = this.requireApis().filters;
        if (!controls || !api) return;
        let status: FiltersStatus = Object.freeze({
            isPreviewing: api.isPreviewing,
            committedFilterCount: api.getState().filters.length,
            previewFilterCount: 0,
            configuration: api.getConfiguration(),
        });
        this.button(
            ownerDocument,
            controls.commitButton,
            'filters.commitButton',
            () => api.commit(),
            () => api.isPreviewing,
        );
        this.button(
            ownerDocument,
            controls.cancelButton,
            'filters.cancelButton',
            () => api.cancelPreview(),
            () => api.isPreviewing,
        );
        this.button(
            ownerDocument,
            controls.clearButton,
            'filters.clearButton',
            () => api.clear(),
            () => api.getState().filters.length > 0,
        );
        this.render(ownerDocument, controls.status, 'filters.status', () => status);
        this.subscribe(
            api.subscribe((nextStatus) => {
                status = nextStatus;
                this.refreshFromRuntime();
            }),
        );
    }

    private bindCrop(ownerDocument: Document, options: DomControlsOptions): void {
        const controls = options.crop;
        const api = this.requireApis().crop;
        if (!controls || !api) return;
        this.button(
            ownerDocument,
            controls.enterButton,
            'crop.enterButton',
            () => api.enter(controls.enterOptions),
            () => !api.isActive,
        );
        this.button(
            ownerDocument,
            controls.applyButton,
            'crop.applyButton',
            () => api.apply(),
            () => api.isActive,
        );
        this.button(
            ownerDocument,
            controls.cancelButton,
            'crop.cancelButton',
            () => api.cancel(),
            () => api.isActive,
        );
        this.render(ownerDocument, controls.status, 'crop.status', () =>
            Object.freeze({ isActive: api.isActive, session: api.getSession() }),
        );
        this.subscribe(api.subscribe(() => this.refreshFromRuntime()));
    }

    private bindMosaic(ownerDocument: Document, options: DomControlsOptions): void {
        const controls = options.mosaic;
        const api = this.requireApis().mosaic;
        if (!controls || !api) return;
        this.button(
            ownerDocument,
            controls.enterButton,
            'mosaic.enterButton',
            () => api.enter(controls.enterOptions),
            () => !api.isActive,
        );
        this.button(
            ownerDocument,
            controls.commitButton,
            'mosaic.commitButton',
            () => api.commit(),
            () => api.isActive,
        );
        this.button(
            ownerDocument,
            controls.cancelButton,
            'mosaic.cancelButton',
            () => api.cancel(),
            () => api.isActive,
        );
        this.render(ownerDocument, controls.status, 'mosaic.status', () =>
            Object.freeze({ isActive: api.isActive, session: api.getSession() }),
        );
        this.subscribe(api.subscribe(() => this.refreshFromRuntime()));
    }

    private bindAnnotations(ownerDocument: Document, options: DomControlsOptions): void {
        const controls = options.annotations;
        const api = this.requireApis().annotations;
        if (!controls || !api) return;
        const status = (): AnnotationStatus => {
            const annotations = api.list({ includeHidden: true, includeLocked: true });
            return Object.freeze({
                annotations,
                selectionIds: Object.freeze(
                    annotations.filter((entry) => entry.selected).map((entry) => entry.id),
                ),
            });
        };
        this.button(
            ownerDocument,
            controls.clearSelectionButton,
            'annotations.clearSelectionButton',
            () => api.clearSelection(),
            () => status().selectionIds.length > 0,
        );
        this.button(
            ownerDocument,
            controls.removeSelectionButton,
            'annotations.removeSelectionButton',
            async () => {
                const selected = status().annotations.filter(
                    (entry) => entry.selected && !entry.locked,
                );
                for (const entry of selected) await api.remove(entry.id);
            },
            () => status().annotations.some((entry) => entry.selected && !entry.locked),
        );
        this.button(
            ownerDocument,
            controls.removeAllButton,
            'annotations.removeAllButton',
            () => api.removeAll(),
            () => status().annotations.length > 0,
        );
        this.render(ownerDocument, controls.list, 'annotations.list', () => status().annotations);
        this.render(ownerDocument, controls.status, 'annotations.status', status);
        this.subscribe(api.subscribe(() => this.refreshFromRuntime()));
    }

    private bindText(ownerDocument: Document, options: DomControlsOptions): void {
        const controls = options.text;
        const api = this.requireApis().text;
        if (!controls || !api) return;
        this.button(ownerDocument, controls.createButton, 'text.createButton', () =>
            api.create(controls.createOptions),
        );
        this.button(
            ownerDocument,
            controls.commitButton,
            'text.commitButton',
            () => api.commitEditing(),
            () => api.getEditingSession() !== null,
        );
        this.button(
            ownerDocument,
            controls.cancelButton,
            'text.cancelButton',
            () => api.cancelEditing(),
            () => api.getEditingSession() !== null,
        );
        this.render(ownerDocument, controls.status, 'text.status', () =>
            Object.freeze({ editing: api.getEditingSession() }),
        );
        this.subscribe(api.subscribe(() => this.refreshFromRuntime()));
    }

    private bindShape(ownerDocument: Document, options: DomControlsOptions): void {
        const controls = options.shape;
        const api = this.requireApis().shape;
        if (!controls || !api) return;
        if (controls.enterButton && !controls.enterOptions) {
            throw new DomControlsConfigurationError(
                'shape.enterOptions is required when shape.enterButton is configured.',
            );
        }
        this.button(
            ownerDocument,
            controls.enterButton,
            'shape.enterButton',
            () => api.enter(controls.enterOptions!),
            () => api.getSession() === null,
        );
        this.button(
            ownerDocument,
            controls.commitButton,
            'shape.commitButton',
            () => api.commit(),
            () => api.getSession()?.geometry !== null && api.getSession() !== null,
        );
        this.button(
            ownerDocument,
            controls.cancelButton,
            'shape.cancelButton',
            () => api.cancel(),
            () => api.getSession() !== null,
        );
        this.render(ownerDocument, controls.status, 'shape.status', () => api.getSession());
    }

    private bindDraw(ownerDocument: Document, options: DomControlsOptions): void {
        const controls = options.draw;
        const api = this.requireApis().draw;
        if (!controls || !api) return;
        this.button(
            ownerDocument,
            controls.enterButton,
            'draw.enterButton',
            () => api.enter(controls.enterOptions),
            () => api.getSession() === null,
        );
        this.button(
            ownerDocument,
            controls.cancelStrokeButton,
            'draw.cancelStrokeButton',
            () => api.cancelStroke(),
            () => api.getSession()?.isStrokeActive === true,
        );
        this.button(
            ownerDocument,
            controls.exitButton,
            'draw.exitButton',
            () => api.exit(),
            () => api.getSession() !== null,
        );
        this.render(ownerDocument, controls.status, 'draw.status', () => api.getSession());
    }

    private bindKeyboard(ownerDocument: Document, options: DomControlsOptions): void {
        const keyboard = options.keyboard;
        if (!keyboard) return;
        const target = this.resolveKeyboardTarget(ownerDocument, keyboard.target);
        this.listen(target, 'keydown', (event) => {
            const keyboardEvent = event as KeyboardEvent;
            if (
                keyboard.allowInEditable !== true &&
                isEditableNode(keyboardEvent.target, ownerDocument)
            ) {
                return;
            }
            const action = this.keyboardAction(keyboardEvent, options);
            if (!action) return;
            keyboardEvent.preventDefault();
            this.runAction(action.name, action.run);
        });
    }

    private keyboardAction(
        event: KeyboardEvent,
        options: DomControlsOptions,
    ): Readonly<{ name: string; run: () => void | Promise<unknown> }> | null {
        const keyboard = options.keyboard!;
        const apis = this.requireApis();
        const modifier = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();

        if (keyboard.historyActions !== false && modifier && !event.altKey) {
            if ((key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey)) {
                if (!apis.history?.canRedo()) return null;
                return Object.freeze({ name: 'history:redo', run: () => apis.history!.redo() });
            }
            if (key === 'z' && !event.shiftKey) {
                if (!apis.history?.canUndo()) return null;
                return Object.freeze({ name: 'history:undo', run: () => apis.history!.undo() });
            }
        }

        if (
            keyboard.cancelActiveSession !== false &&
            event.key === 'Escape' &&
            !modifier &&
            !event.altKey
        ) {
            const cancellers: Array<() => Promise<unknown>> = [];
            if (apis.text?.getEditingSession()) cancellers.push(() => apis.text!.cancelEditing());
            if (apis.shape?.getSession()) cancellers.push(() => apis.shape!.cancel());
            if (apis.draw?.getSession()) cancellers.push(() => apis.draw!.exit());
            if (apis.crop?.isActive) cancellers.push(() => apis.crop!.cancel());
            if (apis.mosaic?.isActive) cancellers.push(() => apis.mosaic!.cancel());
            if (cancellers.length === 0) return null;
            return Object.freeze({
                name: 'dom-controls:cancel-active-session',
                run: () => Promise.all(cancellers.map((cancel) => cancel())),
            });
        }

        if (
            keyboard.removeSelection !== false &&
            (event.key === 'Delete' || event.key === 'Backspace') &&
            !modifier &&
            !event.altKey &&
            !event.shiftKey
        ) {
            const overlays = apis.overlays;
            if (!overlays) return null;
            const ids = overlays.getSelection().ids.filter((id) => {
                const object = overlays.getByPersistentId(id);
                return object ? overlays.classify(object)?.locked === false : false;
            });
            if (ids.length === 0) return null;
            return Object.freeze({
                name: 'overlay:remove-selection',
                run: () => overlays.remove(ids),
            });
        }
        return null;
    }

    private resolveKeyboardTarget(
        ownerDocument: Document,
        target: Document | DomElementTarget | undefined,
    ): EventTarget {
        if (target === undefined || target === ownerDocument) return ownerDocument;
        if (typeof target === 'string' || isElement(target)) {
            return resolveElement(ownerDocument, target, 'keyboard.target');
        }
        if (!isEventTarget(target) || (isObject(target) && target.nodeType !== 9)) {
            throw new DomControlsConfigurationError(
                'keyboard.target must be ownerDocument, an element, or a selector.',
            );
        }
        throw new DomControlsConfigurationError(
            'keyboard.target belongs to a different document than ownerDocument.',
        );
    }

    private button(
        ownerDocument: Document,
        target: DomButtonTarget | undefined,
        label: string,
        action: () => void | Promise<unknown>,
        available: () => boolean = () => true,
    ): void {
        if (!target) return;
        const element = resolveButton(ownerDocument, target, label);
        this.buttons.push({ element, available });
        this.listen(element, 'click', () => this.runAction(label, action));
    }

    private render<TValue>(
        ownerDocument: Document,
        adapter: DomRenderAdapter<TValue> | undefined,
        label: string,
        read: () => TValue,
    ): void {
        if (!adapter) return;
        if (typeof adapter.render !== 'function') {
            throw new DomControlsConfigurationError(`${label}.render must be a function.`);
        }
        const target = resolveElement(ownerDocument, adapter.target, `${label}.target`);
        this.synchronizers.push(() => adapter.render(target, read()));
    }

    private listen(target: EventTarget, eventName: string, listener: (event: Event) => void): void {
        const events = this.occupiedBindings.get(target) ?? new Set<string>();
        if (events.has(eventName)) {
            throw new DomControlsConfigurationError(
                `The same target cannot bind the "${eventName}" event more than once.`,
            );
        }
        events.add(eventName);
        this.occupiedBindings.set(target, events);
        target.addEventListener(eventName, listener);
        this.removers.push(() => target.removeEventListener(eventName, listener));
    }

    private subscribe(registration: Disposable | (() => void)): void {
        this.subscriptions.push(registration);
    }

    private runAction(action: string, run: () => void | Promise<unknown>): void {
        if (this.disposed || !this.bound) return;
        this.pendingActions += 1;
        this.refreshFromRuntime();
        void Promise.resolve()
            .then(run)
            .catch((error: unknown) => this.reportActionError(action, error))
            .finally(() => {
                this.pendingActions = Math.max(0, this.pendingActions - 1);
                this.refreshFromRuntime();
            });
    }

    private reportActionError(action: string, error: unknown): void {
        const event = Object.freeze({ action, error });
        const listener = this.options?.onActionError;
        if (listener) {
            try {
                listener(event);
            } catch (listenerError) {
                this.diagnostics.reportWarning(
                    listenerError,
                    `DOM Controls error listener failed while handling "${action}".`,
                );
            }
        }
        this.diagnostics.reportError(error, `DOM Controls action "${action}" failed.`);
    }

    private releaseBindings(): void {
        for (let index = this.subscriptions.length - 1; index >= 0; index -= 1) {
            try {
                disposeRegistration(this.subscriptions[index]!);
            } catch (error) {
                this.diagnostics.reportWarning(error, 'DOM Controls subscription cleanup failed.');
            }
        }
        for (let index = this.removers.length - 1; index >= 0; index -= 1) {
            try {
                this.removers[index]!();
            } catch (error) {
                this.diagnostics.reportWarning(error, 'DOM Controls listener cleanup failed.');
            }
        }
        this.subscriptions.length = 0;
        this.removers.length = 0;
        this.buttons.length = 0;
        this.synchronizers.length = 0;
        this.occupiedBindings.clear();
    }

    private requireOptions(): DomControlsOptions {
        if (!this.options) {
            throw new DomControlsConfigurationError('DOM Controls options are unavailable.');
        }
        return this.options;
    }

    private requireApis(): ResolvedApis {
        if (!this.apis) {
            throw new DomControlsConfigurationError('DOM Controls Plugin APIs are unavailable.');
        }
        return this.apis;
    }
}
