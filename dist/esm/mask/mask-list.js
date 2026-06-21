import { isMaskObject } from '../core/public-types.js';
function getMaskListDocument(context) {
    var _a, _b, _c, _d, _e;
    const canvasLike = context.canvas;
    return ((_e = (_c = (_b = (_a = canvasLike === null || canvasLike === void 0 ? void 0 : canvasLike.getElement) === null || _a === void 0 ? void 0 : _a.call(canvasLike)) === null || _b === void 0 ? void 0 : _b.ownerDocument) !== null && _c !== void 0 ? _c : (_d = canvasLike === null || canvasLike === void 0 ? void 0 : canvasLike.lowerCanvasEl) === null || _d === void 0 ? void 0 : _d.ownerDocument) !== null && _e !== void 0 ? _e : document);
}
export function renderMaskList(context) {
    const listId = context.getListElementId();
    if (!listId)
        return;
    const ownerDocument = getMaskListDocument(context);
    const listEl = ownerDocument.getElementById(listId);
    if (!listEl || !context.canvas)
        return;
    listEl.innerHTML = '';
    const canvas = context.canvas;
    canvas
        .getObjects()
        .filter(isMaskObject)
        .forEach((mask) => {
        const listItemElement = ownerDocument.createElement('li');
        listItemElement.className = 'list-group-item mask-item';
        listItemElement.textContent = mask.maskName;
        listItemElement.dataset.maskId = String(mask.maskId);
        listItemElement.addEventListener('click', () => {
            const id = Number(listItemElement.dataset.maskId);
            if (!Number.isFinite(id))
                return;
            const target = canvas
                .getObjects()
                .find((o) => isMaskObject(o) && o.maskId === id);
            if (!target)
                return;
            canvas.setActiveObject(target);
            context.onMaskSelected(target);
        });
        listEl.appendChild(listItemElement);
    });
}
export function updateMaskListSelection(context, selectedMask) {
    const listId = context.getListElementId();
    if (!listId)
        return;
    const listEl = getMaskListDocument(context).getElementById(listId);
    if (!listEl)
        return;
    const selectedId = selectedMask ? String(selectedMask.maskId) : null;
    listEl.querySelectorAll('.mask-item').forEach((item) => {
        const isSelected = selectedId !== null && item.dataset.maskId === selectedId;
        item.classList.toggle('active', isSelected);
    });
}
//# sourceMappingURL=mask-list.js.map