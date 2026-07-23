'use strict';

var pluginManifest = require('../../chunks/plugin-manifest-5BctrtYS.cjs');
var pluginDefinition = require('../../chunks/plugin-definition-DtyrZUJz.cjs');
var coreCapabilities = require('../../chunks/core-capabilities-DryMPZoj.cjs');
require('../../chunks/plugin-identifier-DWQ7SALj.cjs');

class DomControlsConfigurationError extends Error {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'DomControlsConfigurationError'
        });
    }
}
function isObject(value) {
    return typeof value === 'object' && value !== null;
}
function isEventTarget(value) {
    return (isObject(value) &&
        typeof value.addEventListener === 'function' &&
        typeof value.removeEventListener === 'function');
}
function isElement(value) {
    return (isObject(value) &&
        value.nodeType === 1 &&
        isObject(value.ownerDocument) &&
        isEventTarget(value));
}
function resolveElement(ownerDocument, target, label) {
    let element = target;
    if (typeof target === 'string') {
        try {
            element = ownerDocument.querySelector(target);
        }
        catch (error) {
            throw new DomControlsConfigurationError(`${label} uses an invalid selector "${target}": ${String(error)}`);
        }
        if (!element) {
            throw new DomControlsConfigurationError(`${label} selector "${target}" did not match an element.`);
        }
    }
    if (!isElement(element)) {
        throw new DomControlsConfigurationError(`${label} must resolve to a DOM element.`);
    }
    if (element.ownerDocument !== ownerDocument) {
        throw new DomControlsConfigurationError(`${label} belongs to a different document than ownerDocument.`);
    }
    return element;
}
function resolveButton(ownerDocument, target, label) {
    const element = resolveElement(ownerDocument, target, label);
    if (!('disabled' in element) || typeof element.disabled !== 'boolean') {
        throw new DomControlsConfigurationError(`${label} must resolve to a button control.`);
    }
    return element;
}
function resolveInput(ownerDocument, target, label) {
    const element = resolveElement(ownerDocument, target, label);
    if (!('value' in element) || !('checked' in element)) {
        throw new DomControlsConfigurationError(`${label} must resolve to an input control.`);
    }
    return element;
}
function resolveApi(binding, label) {
    if (!binding)
        return null;
    if (typeof binding.resolve !== 'function') {
        throw new DomControlsConfigurationError(`${label}.plugin.resolve must be a function.`);
    }
    const api = binding.resolve();
    if (!isObject(api)) {
        throw new DomControlsConfigurationError(`${label}.plugin did not resolve a Plugin API.`);
    }
    return api;
}
function disposeRegistration(registration) {
    const result = typeof registration === 'function' ? registration() : registration.dispose();
    if (result instanceof Promise)
        void result.catch(() => undefined);
}
function readNumericInput(input, label) {
    const value = input.valueAsNumber;
    const parsed = Number.isFinite(value) ? value : Number(input.value);
    if (!Number.isFinite(parsed)) {
        throw new DomControlsConfigurationError(`${label} must contain a finite number.`);
    }
    return parsed;
}
function isEditableNode(value, ownerDocument) {
    let current = value;
    while (isElement(current) && current.ownerDocument === ownerDocument) {
        const tagName = String(current.tagName).toLowerCase();
        if (tagName === 'input' ||
            tagName === 'textarea' ||
            tagName === 'select' ||
            current.isContentEditable === true ||
            current.getAttribute('contenteditable') === 'true' ||
            current.getAttribute('contenteditable') === '') {
            return true;
        }
        current = current.parentElement;
    }
    return false;
}
class DomControlsController {
    constructor(options, diagnostics) {
        Object.defineProperty(this, "diagnostics", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: diagnostics
        });
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "apis", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "removers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "subscriptions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "buttons", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "synchronizers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "occupiedBindings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "bound", {
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
        Object.defineProperty(this, "pendingActions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        this.options = options;
    }
    bind() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        if (this.disposed) {
            throw new DomControlsConfigurationError('DOM Controls cannot bind after disposal.');
        }
        if (this.bound) {
            throw new DomControlsConfigurationError('DOM Controls are already bound.');
        }
        const options = this.requireOptions();
        const configured = options.transform ||
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
            throw new DomControlsConfigurationError('ownerDocument is required when DOM controls are configured.');
        }
        try {
            this.apis = Object.freeze({
                transform: resolveApi((_a = options.transform) === null || _a === void 0 ? void 0 : _a.plugin, 'transform'),
                history: resolveApi((_b = options.history) === null || _b === void 0 ? void 0 : _b.plugin, 'history'),
                masks: resolveApi((_c = options.masks) === null || _c === void 0 ? void 0 : _c.plugin, 'masks'),
                filters: resolveApi((_d = options.filters) === null || _d === void 0 ? void 0 : _d.plugin, 'filters'),
                crop: resolveApi((_e = options.crop) === null || _e === void 0 ? void 0 : _e.plugin, 'crop'),
                mosaic: resolveApi((_f = options.mosaic) === null || _f === void 0 ? void 0 : _f.plugin, 'mosaic'),
                annotations: resolveApi((_g = options.annotations) === null || _g === void 0 ? void 0 : _g.plugin, 'annotations'),
                text: resolveApi((_h = options.text) === null || _h === void 0 ? void 0 : _h.plugin, 'text'),
                shape: resolveApi((_j = options.shape) === null || _j === void 0 ? void 0 : _j.plugin, 'shape'),
                draw: resolveApi((_k = options.draw) === null || _k === void 0 ? void 0 : _k.plugin, 'draw'),
                overlays: resolveApi((_l = options.keyboard) === null || _l === void 0 ? void 0 : _l.overlays, 'keyboard.overlays'),
            });
            if (options.ownerDocument)
                this.bindConfiguredControls(options.ownerDocument, options);
            this.bound = true;
            this.refresh();
        }
        catch (error) {
            this.releaseBindings();
            this.apis = null;
            throw error;
        }
    }
    refresh() {
        if (this.disposed) {
            throw new DomControlsConfigurationError('DOM Controls cannot refresh after disposal.');
        }
        if (!this.bound) {
            throw new DomControlsConfigurationError('DOM Controls cannot refresh before editor initialization.');
        }
        for (const synchronize of this.synchronizers)
            synchronize();
        for (const button of this.buttons) {
            button.element.disabled = this.pendingActions > 0 || !button.available();
        }
    }
    refreshFromRuntime() {
        if (!this.bound || this.disposed)
            return;
        try {
            this.refresh();
        }
        catch (error) {
            this.reportActionError('dom-controls:refresh', error);
        }
    }
    getStatus() {
        return Object.freeze({
            isBound: this.bound,
            isBusy: this.pendingActions > 0,
            isDisposed: this.disposed,
            bindingCount: this.removers.length + this.subscriptions.length,
        });
    }
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        this.releaseBindings();
        this.apis = null;
        this.options = null;
        this.bound = false;
    }
    bindConfiguredControls(ownerDocument, options) {
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
    bindTransform(ownerDocument, options) {
        const controls = options.transform;
        const api = this.requireApis().transform;
        if (!controls || !api)
            return;
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
        this.button(ownerDocument, controls.zoomInButton, 'transform.zoomInButton', () => api.zoomIn());
        this.button(ownerDocument, controls.zoomOutButton, 'transform.zoomOutButton', () => api.zoomOut());
        this.button(ownerDocument, controls.rotateLeftButton, 'transform.rotateLeftButton', () => api.rotate(-90));
        this.button(ownerDocument, controls.rotateRightButton, 'transform.rotateRightButton', () => api.rotate(90));
        this.button(ownerDocument, controls.flipHorizontalButton, 'transform.flipHorizontalButton', () => api.flipHorizontal());
        this.button(ownerDocument, controls.flipVerticalButton, 'transform.flipVerticalButton', () => api.flipVertical());
        this.button(ownerDocument, controls.resetButton, 'transform.resetButton', () => api.resetImageTransform());
        this.render(ownerDocument, controls.status, 'transform.status', () => api.getState());
    }
    bindHistory(ownerDocument, options) {
        const controls = options.history;
        const api = this.requireApis().history;
        if (!controls || !api)
            return;
        if (controls.enabledInput) {
            const input = resolveInput(ownerDocument, controls.enabledInput, 'history.enabledInput');
            this.listen(input, 'change', () => {
                this.runAction('history:toggle', () => input.checked
                    ? api.enable({ baseline: 'current' })
                    : api.disable({ clear: false }));
            });
            this.synchronizers.push(() => {
                input.checked = api.getState().isEnabled;
                input.disabled = this.pendingActions > 0;
            });
        }
        this.button(ownerDocument, controls.undoButton, 'history.undoButton', () => api.undo(), () => api.canUndo());
        this.button(ownerDocument, controls.redoButton, 'history.redoButton', () => api.redo(), () => api.canRedo());
        this.button(ownerDocument, controls.clearButton, 'history.clearButton', () => api.clear(), () => api.length > 0);
        this.render(ownerDocument, controls.status, 'history.status', () => api.getState());
        this.subscribe(api.onChange(() => this.refreshFromRuntime()));
    }
    bindMasks(ownerDocument, options) {
        const controls = options.masks;
        const api = this.requireApis().masks;
        if (!controls || !api)
            return;
        this.button(ownerDocument, controls.removeSelectedButton, 'masks.removeSelectedButton', () => api.removeSelected(), () => api.getAll().length > 0);
        this.button(ownerDocument, controls.removeAllButton, 'masks.removeAllButton', () => api.removeAll(), () => api.getAll().length > 0);
        this.render(ownerDocument, controls.list, 'masks.list', () => api.getAll());
    }
    bindFilters(ownerDocument, options) {
        const controls = options.filters;
        const api = this.requireApis().filters;
        if (!controls || !api)
            return;
        let status = Object.freeze({
            isPreviewing: api.isPreviewing,
            committedFilterCount: api.getState().filters.length,
            previewFilterCount: 0,
            configuration: api.getConfiguration(),
        });
        this.button(ownerDocument, controls.commitButton, 'filters.commitButton', () => api.commit(), () => api.isPreviewing);
        this.button(ownerDocument, controls.cancelButton, 'filters.cancelButton', () => api.cancelPreview(), () => api.isPreviewing);
        this.button(ownerDocument, controls.clearButton, 'filters.clearButton', () => api.clear(), () => api.getState().filters.length > 0);
        this.render(ownerDocument, controls.status, 'filters.status', () => status);
        this.subscribe(api.subscribe((nextStatus) => {
            status = nextStatus;
            this.refreshFromRuntime();
        }));
    }
    bindCrop(ownerDocument, options) {
        const controls = options.crop;
        const api = this.requireApis().crop;
        if (!controls || !api)
            return;
        this.button(ownerDocument, controls.enterButton, 'crop.enterButton', () => api.enter(controls.enterOptions), () => !api.isActive);
        this.button(ownerDocument, controls.applyButton, 'crop.applyButton', () => api.apply(), () => api.isActive);
        this.button(ownerDocument, controls.cancelButton, 'crop.cancelButton', () => api.cancel(), () => api.isActive);
        this.render(ownerDocument, controls.status, 'crop.status', () => Object.freeze({ isActive: api.isActive, session: api.getSession() }));
        this.subscribe(api.subscribe(() => this.refreshFromRuntime()));
    }
    bindMosaic(ownerDocument, options) {
        const controls = options.mosaic;
        const api = this.requireApis().mosaic;
        if (!controls || !api)
            return;
        this.button(ownerDocument, controls.enterButton, 'mosaic.enterButton', () => api.enter(controls.enterOptions), () => !api.isActive);
        this.button(ownerDocument, controls.commitButton, 'mosaic.commitButton', () => api.commit(), () => api.isActive);
        this.button(ownerDocument, controls.cancelButton, 'mosaic.cancelButton', () => api.cancel(), () => api.isActive);
        this.render(ownerDocument, controls.status, 'mosaic.status', () => Object.freeze({ isActive: api.isActive, session: api.getSession() }));
        this.subscribe(api.subscribe(() => this.refreshFromRuntime()));
    }
    bindAnnotations(ownerDocument, options) {
        const controls = options.annotations;
        const api = this.requireApis().annotations;
        if (!controls || !api)
            return;
        const status = () => {
            const annotations = api.list({ includeHidden: true, includeLocked: true });
            return Object.freeze({
                annotations,
                selectionIds: Object.freeze(annotations.filter((entry) => entry.selected).map((entry) => entry.id)),
            });
        };
        this.button(ownerDocument, controls.clearSelectionButton, 'annotations.clearSelectionButton', () => api.clearSelection(), () => status().selectionIds.length > 0);
        this.button(ownerDocument, controls.removeSelectionButton, 'annotations.removeSelectionButton', async () => {
            const selected = status().annotations.filter((entry) => entry.selected && !entry.locked);
            for (const entry of selected)
                await api.remove(entry.id);
        }, () => status().annotations.some((entry) => entry.selected && !entry.locked));
        this.button(ownerDocument, controls.removeAllButton, 'annotations.removeAllButton', () => api.removeAll(), () => status().annotations.length > 0);
        this.render(ownerDocument, controls.list, 'annotations.list', () => status().annotations);
        this.render(ownerDocument, controls.status, 'annotations.status', status);
        this.subscribe(api.subscribe(() => this.refreshFromRuntime()));
    }
    bindText(ownerDocument, options) {
        const controls = options.text;
        const api = this.requireApis().text;
        if (!controls || !api)
            return;
        this.button(ownerDocument, controls.createButton, 'text.createButton', () => api.create(controls.createOptions));
        this.button(ownerDocument, controls.commitButton, 'text.commitButton', () => api.commitEditing(), () => api.getEditingSession() !== null);
        this.button(ownerDocument, controls.cancelButton, 'text.cancelButton', () => api.cancelEditing(), () => api.getEditingSession() !== null);
        this.render(ownerDocument, controls.status, 'text.status', () => Object.freeze({ editing: api.getEditingSession() }));
        this.subscribe(api.subscribe(() => this.refreshFromRuntime()));
    }
    bindShape(ownerDocument, options) {
        const controls = options.shape;
        const api = this.requireApis().shape;
        if (!controls || !api)
            return;
        if (controls.enterButton && !controls.enterOptions) {
            throw new DomControlsConfigurationError('shape.enterOptions is required when shape.enterButton is configured.');
        }
        this.button(ownerDocument, controls.enterButton, 'shape.enterButton', () => api.enter(controls.enterOptions), () => api.getSession() === null);
        this.button(ownerDocument, controls.commitButton, 'shape.commitButton', () => api.commit(), () => { var _a; return ((_a = api.getSession()) === null || _a === void 0 ? void 0 : _a.geometry) !== null && api.getSession() !== null; });
        this.button(ownerDocument, controls.cancelButton, 'shape.cancelButton', () => api.cancel(), () => api.getSession() !== null);
        this.render(ownerDocument, controls.status, 'shape.status', () => api.getSession());
    }
    bindDraw(ownerDocument, options) {
        const controls = options.draw;
        const api = this.requireApis().draw;
        if (!controls || !api)
            return;
        this.button(ownerDocument, controls.enterButton, 'draw.enterButton', () => api.enter(controls.enterOptions), () => api.getSession() === null);
        this.button(ownerDocument, controls.cancelStrokeButton, 'draw.cancelStrokeButton', () => api.cancelStroke(), () => { var _a; return ((_a = api.getSession()) === null || _a === void 0 ? void 0 : _a.isStrokeActive) === true; });
        this.button(ownerDocument, controls.exitButton, 'draw.exitButton', () => api.exit(), () => api.getSession() !== null);
        this.render(ownerDocument, controls.status, 'draw.status', () => api.getSession());
    }
    bindKeyboard(ownerDocument, options) {
        const keyboard = options.keyboard;
        if (!keyboard)
            return;
        const target = this.resolveKeyboardTarget(ownerDocument, keyboard.target);
        this.listen(target, 'keydown', (event) => {
            const keyboardEvent = event;
            if (keyboard.allowInEditable !== true &&
                isEditableNode(keyboardEvent.target, ownerDocument)) {
                return;
            }
            const action = this.keyboardAction(keyboardEvent, options);
            if (!action)
                return;
            keyboardEvent.preventDefault();
            this.runAction(action.name, action.run);
        });
    }
    keyboardAction(event, options) {
        var _a, _b, _c, _d, _e, _f, _g;
        const keyboard = options.keyboard;
        const apis = this.requireApis();
        const modifier = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();
        if (keyboard.historyActions !== false && modifier && !event.altKey) {
            if ((key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey)) {
                if (!((_a = apis.history) === null || _a === void 0 ? void 0 : _a.canRedo()))
                    return null;
                return Object.freeze({ name: 'history:redo', run: () => apis.history.redo() });
            }
            if (key === 'z' && !event.shiftKey) {
                if (!((_b = apis.history) === null || _b === void 0 ? void 0 : _b.canUndo()))
                    return null;
                return Object.freeze({ name: 'history:undo', run: () => apis.history.undo() });
            }
        }
        if (keyboard.cancelActiveSession !== false &&
            event.key === 'Escape' &&
            !modifier &&
            !event.altKey) {
            const cancellers = [];
            if ((_c = apis.text) === null || _c === void 0 ? void 0 : _c.getEditingSession())
                cancellers.push(() => apis.text.cancelEditing());
            if ((_d = apis.shape) === null || _d === void 0 ? void 0 : _d.getSession())
                cancellers.push(() => apis.shape.cancel());
            if ((_e = apis.draw) === null || _e === void 0 ? void 0 : _e.getSession())
                cancellers.push(() => apis.draw.exit());
            if ((_f = apis.crop) === null || _f === void 0 ? void 0 : _f.isActive)
                cancellers.push(() => apis.crop.cancel());
            if ((_g = apis.mosaic) === null || _g === void 0 ? void 0 : _g.isActive)
                cancellers.push(() => apis.mosaic.cancel());
            if (cancellers.length === 0)
                return null;
            return Object.freeze({
                name: 'dom-controls:cancel-active-session',
                run: () => Promise.all(cancellers.map((cancel) => cancel())),
            });
        }
        if (keyboard.removeSelection !== false &&
            (event.key === 'Delete' || event.key === 'Backspace') &&
            !modifier &&
            !event.altKey &&
            !event.shiftKey) {
            const overlays = apis.overlays;
            if (!overlays)
                return null;
            const ids = overlays.getSelection().ids.filter((id) => {
                var _a;
                const object = overlays.getByPersistentId(id);
                return object ? ((_a = overlays.classify(object)) === null || _a === void 0 ? void 0 : _a.locked) === false : false;
            });
            if (ids.length === 0)
                return null;
            return Object.freeze({
                name: 'overlay:remove-selection',
                run: () => overlays.remove(ids),
            });
        }
        return null;
    }
    resolveKeyboardTarget(ownerDocument, target) {
        if (target === undefined || target === ownerDocument)
            return ownerDocument;
        if (typeof target === 'string' || isElement(target)) {
            return resolveElement(ownerDocument, target, 'keyboard.target');
        }
        if (!isEventTarget(target) || (isObject(target) && target.nodeType !== 9)) {
            throw new DomControlsConfigurationError('keyboard.target must be ownerDocument, an element, or a selector.');
        }
        throw new DomControlsConfigurationError('keyboard.target belongs to a different document than ownerDocument.');
    }
    button(ownerDocument, target, label, action, available = () => true) {
        if (!target)
            return;
        const element = resolveButton(ownerDocument, target, label);
        this.buttons.push({ element, available });
        this.listen(element, 'click', () => this.runAction(label, action));
    }
    render(ownerDocument, adapter, label, read) {
        if (!adapter)
            return;
        if (typeof adapter.render !== 'function') {
            throw new DomControlsConfigurationError(`${label}.render must be a function.`);
        }
        const target = resolveElement(ownerDocument, adapter.target, `${label}.target`);
        this.synchronizers.push(() => adapter.render(target, read()));
    }
    listen(target, eventName, listener) {
        var _a;
        const events = (_a = this.occupiedBindings.get(target)) !== null && _a !== void 0 ? _a : new Set();
        if (events.has(eventName)) {
            throw new DomControlsConfigurationError(`The same target cannot bind the "${eventName}" event more than once.`);
        }
        events.add(eventName);
        this.occupiedBindings.set(target, events);
        target.addEventListener(eventName, listener);
        this.removers.push(() => target.removeEventListener(eventName, listener));
    }
    subscribe(registration) {
        this.subscriptions.push(registration);
    }
    runAction(action, run) {
        if (this.disposed || !this.bound)
            return;
        this.pendingActions += 1;
        this.refreshFromRuntime();
        void Promise.resolve()
            .then(run)
            .catch((error) => this.reportActionError(action, error))
            .finally(() => {
            this.pendingActions = Math.max(0, this.pendingActions - 1);
            this.refreshFromRuntime();
        });
    }
    reportActionError(action, error) {
        var _a;
        const event = Object.freeze({ action, error });
        const listener = (_a = this.options) === null || _a === void 0 ? void 0 : _a.onActionError;
        if (listener) {
            try {
                listener(event);
            }
            catch (listenerError) {
                this.diagnostics.reportWarning(listenerError, `DOM Controls error listener failed while handling "${action}".`);
            }
        }
        this.diagnostics.reportError(error, `DOM Controls action "${action}" failed.`);
    }
    releaseBindings() {
        for (let index = this.subscriptions.length - 1; index >= 0; index -= 1) {
            try {
                disposeRegistration(this.subscriptions[index]);
            }
            catch (error) {
                this.diagnostics.reportWarning(error, 'DOM Controls subscription cleanup failed.');
            }
        }
        for (let index = this.removers.length - 1; index >= 0; index -= 1) {
            try {
                this.removers[index]();
            }
            catch (error) {
                this.diagnostics.reportWarning(error, 'DOM Controls listener cleanup failed.');
            }
        }
        this.subscriptions.length = 0;
        this.removers.length = 0;
        this.buttons.length = 0;
        this.synchronizers.length = 0;
        this.occupiedBindings.clear();
    }
    requireOptions() {
        if (!this.options) {
            throw new DomControlsConfigurationError('DOM Controls options are unavailable.');
        }
        return this.options;
    }
    requireApis() {
        if (!this.apis) {
            throw new DomControlsConfigurationError('DOM Controls Plugin APIs are unavailable.');
        }
        return this.apis;
    }
}

const domControlsPluginRef = pluginManifest.definePluginRef('plugin:dom-controls', '1.0.0');
function collectPluginDependencies(options) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    const bindings = [
        (_a = options.transform) === null || _a === void 0 ? void 0 : _a.plugin,
        (_b = options.history) === null || _b === void 0 ? void 0 : _b.plugin,
        (_c = options.masks) === null || _c === void 0 ? void 0 : _c.plugin,
        (_d = options.filters) === null || _d === void 0 ? void 0 : _d.plugin,
        (_e = options.crop) === null || _e === void 0 ? void 0 : _e.plugin,
        (_f = options.mosaic) === null || _f === void 0 ? void 0 : _f.plugin,
        (_g = options.annotations) === null || _g === void 0 ? void 0 : _g.plugin,
        (_h = options.text) === null || _h === void 0 ? void 0 : _h.plugin,
        (_j = options.shape) === null || _j === void 0 ? void 0 : _j.plugin,
        (_k = options.draw) === null || _k === void 0 ? void 0 : _k.plugin,
        (_l = options.keyboard) === null || _l === void 0 ? void 0 : _l.overlays,
    ];
    const dependencies = new Map();
    for (const binding of bindings) {
        if (!binding)
            continue;
        if (!binding.ref || typeof binding.resolve !== 'function') {
            throw new DomControlsConfigurationError('Each configured DOM section requires a PluginRef and API resolver.');
        }
        const existing = dependencies.get(binding.ref.id);
        if (existing && existing !== binding.ref) {
            throw new DomControlsConfigurationError(`DOM Controls received conflicting PluginRef objects for "${binding.ref.id}".`);
        }
        dependencies.set(binding.ref.id, binding.ref);
    }
    return Object.freeze([...dependencies.values()]);
}
function domControlsPlugin(options = {}) {
    const requiresPlugins = collectPluginDependencies(options);
    let configuredOptions = options;
    let controller = null;
    return pluginDefinition.definePlugin({
        ref: domControlsPluginRef,
        manifest: {
            id: domControlsPluginRef.id,
            version: '1.0.0',
            apiVersion: domControlsPluginRef.apiVersion,
            engine: '^3.0.0',
            requiresPlugins,
            requires: [{ token: coreCapabilities.CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' }],
        },
        setupMode: 'sync',
        setup(context) {
            if (!configuredOptions) {
                throw new DomControlsConfigurationError('DOM Controls options are unavailable.');
            }
            controller = new DomControlsController(configuredOptions, context.capabilities.require(coreCapabilities.CORE_DIAGNOSTICS_CAPABILITY));
            configuredOptions = null;
            context.disposables.add(controller);
            for (const operationId of ['dom-controls:bind', 'dom-controls:refresh']) {
                context.disposables.add(context.operations.register({
                    id: operationId,
                    mode: 'busy',
                    conflictDomains: ['state'],
                    reentrancy: 'queue',
                }));
            }
            for (const eventName of [
                'document:committed',
                'geometry:committed',
                'image:loaded',
                'image:cleared',
                'state:loaded',
            ]) {
                context.disposables.add(context.events.on(eventName, () => controller === null || controller === void 0 ? void 0 : controller.refreshFromRuntime()));
            }
            const requireController = () => {
                if (!controller) {
                    throw new DomControlsConfigurationError('DOM Controls are not installed.');
                }
                return controller;
            };
            return Object.freeze({
                refresh: () => requireController().refresh(),
                getStatus: () => requireController().getStatus(),
            });
        },
        onInit() {
            controller === null || controller === void 0 ? void 0 : controller.bind();
        },
        onDispose() {
            controller === null || controller === void 0 ? void 0 : controller.dispose();
            configuredOptions = null;
        },
    });
}

exports.DomControlsConfigurationError = DomControlsConfigurationError;
exports.domControlsPlugin = domControlsPlugin;
exports.domControlsPluginRef = domControlsPluginRef;
//# sourceMappingURL=index.cjs.map
