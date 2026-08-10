const TEXT_TOOL_ID = 'annotation:text';
const TEXT_KIND = 'annotation:text';
function textClassification(overlays, sample) {
    if (!sample.target)
        return null;
    const classification = overlays.classify(sample.target);
    if (!classification ||
        classification.kind !== TEXT_KIND ||
        classification.hidden ||
        classification.locked) {
        return null;
    }
    return classification;
}
export class TextInteractionBinding {
    constructor(options) {
        var _a, _b, _c;
        Object.defineProperty(this, "id", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'text'
        });
        Object.defineProperty(this, "toolId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: TEXT_TOOL_ID
        });
        Object.defineProperty(this, "textBinding", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "overlayBinding", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "annotationBinding", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "textValue", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "overlayValue", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "annotationValue", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "blankClick", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "existingTextClick", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "retargetEditing", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.textBinding = options.plugin;
        this.overlayBinding = options.overlays;
        this.annotationBinding = options.annotations;
        this.blankClick = (_a = options.blankClick) !== null && _a !== void 0 ? _a : 'create';
        this.existingTextClick = (_b = options.existingTextClick) !== null && _b !== void 0 ? _b : 'edit';
        this.retargetEditing = (_c = options.retargetEditing) !== null && _c !== void 0 ? _c : 'commit';
        if (this.blankClick !== 'create' && this.blankClick !== 'ignore') {
            throw new TypeError('[ImageEditor] Text blank-click policy is invalid.');
        }
        if (this.existingTextClick !== 'edit' && this.existingTextClick !== 'select') {
            throw new TypeError('[ImageEditor] Existing Text click policy is invalid.');
        }
        if (this.retargetEditing !== 'commit' && this.retargetEditing !== 'cancel') {
            throw new TypeError('[ImageEditor] Text editing retarget policy is invalid.');
        }
    }
    claim(context) {
        const classification = textClassification(this.overlays(), context.sample);
        let target;
        if (classification) {
            target = Object.freeze({ kind: 'text', id: classification.persistentId });
        }
        else if (!context.sample.target && this.blankClick === 'create') {
            target = Object.freeze({ kind: 'blank' });
        }
        else {
            return null;
        }
        return Object.freeze({
            gesture: Object.freeze({
                context: context.gesture,
                point: context.sample.canvasPoint,
                target,
            }),
        });
    }
    move(_gesture, _sample) { }
    async end(gesture, _sample) {
        if (!gesture.context.isCurrent())
            return;
        if (gesture.target.kind === 'text') {
            await this.activateExisting(gesture, gesture.target.id);
            return;
        }
        if (!(await this.finishCurrentEditing(gesture, null)))
            return;
        const id = await this.text().create({
            left: gesture.point.x,
            top: gesture.point.y,
        });
        if (!gesture.context.isCurrent())
            return;
        await this.text().beginEditing(id);
    }
    cancel(_gesture, _reason) { }
    async activateExisting(gesture, id) {
        const current = this.text().getEditingSession();
        if ((current === null || current === void 0 ? void 0 : current.annotationId) === id)
            return;
        if (!(await this.finishCurrentEditing(gesture, id)))
            return;
        if (this.existingTextClick === 'select') {
            await this.annotations().select([id]);
            return;
        }
        await this.text().beginEditing(id);
    }
    async finishCurrentEditing(gesture, nextId) {
        const text = this.text();
        const current = text.getEditingSession();
        if (!current || current.annotationId === nextId)
            return true;
        if (this.retargetEditing === 'commit')
            await text.commitEditing();
        else
            await text.cancelEditing();
        return gesture.context.canResume(this.toolId);
    }
    text() {
        var _a;
        return ((_a = this.textValue) !== null && _a !== void 0 ? _a : (this.textValue = this.textBinding.resolve()));
    }
    overlays() {
        var _a;
        return ((_a = this.overlayValue) !== null && _a !== void 0 ? _a : (this.overlayValue = this.overlayBinding.resolve()));
    }
    annotations() {
        var _a;
        return ((_a = this.annotationValue) !== null && _a !== void 0 ? _a : (this.annotationValue = this.annotationBinding.resolve()));
    }
}
//# sourceMappingURL=text-interaction-binding.js.map