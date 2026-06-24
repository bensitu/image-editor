import { isMaskObject } from '../core/public-types.js';
function getCurrentMaskListCanvas(context) {
    var _a, _b;
    return (_b = (_a = context.getCanvas) === null || _a === void 0 ? void 0 : _a.call(context)) !== null && _b !== void 0 ? _b : context.canvas;
}
function orderMasksForList(masks, order) {
    const ordered = masks.slice();
    return order === 'back-to-front' ? ordered : ordered.reverse();
}
export function renderMaskList(context) {
    const listEl = context.getListElement();
    const canvas = getCurrentMaskListCanvas(context);
    if (!listEl || !canvas)
        return;
    const ownerDocument = listEl.ownerDocument;
    listEl.innerHTML = '';
    orderMasksForList(canvas.getObjects().filter(isMaskObject), context.listOrder).forEach((mask) => {
        const listItemElement = ownerDocument.createElement('li');
        listItemElement.className = 'list-group-item mask-item';
        listItemElement.textContent = mask.maskName;
        listItemElement.dataset.maskId = String(mask.maskId);
        listItemElement.addEventListener('click', () => {
            const id = Number(listItemElement.dataset.maskId);
            if (!Number.isFinite(id))
                return;
            const liveCanvas = getCurrentMaskListCanvas(context);
            if (!liveCanvas)
                return;
            const target = liveCanvas
                .getObjects()
                .find((o) => isMaskObject(o) && o.maskId === id);
            if (!target)
                return;
            liveCanvas.setActiveObject(target);
            context.onMaskSelected(target);
        });
        listEl.appendChild(listItemElement);
    });
}
export function updateMaskListSelection(context, selectedMask) {
    const listEl = context.getListElement();
    if (!listEl)
        return;
    const selectedId = selectedMask ? String(selectedMask.maskId) : null;
    listEl.querySelectorAll('.mask-item').forEach((item) => {
        const isSelected = selectedId !== null && item.dataset.maskId === selectedId;
        item.classList.toggle('active', isSelected);
    });
}
//# sourceMappingURL=mask-list.js.map