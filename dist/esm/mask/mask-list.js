import { isMaskObject } from '../core/public-types.js';
export function renderMaskList(context) {
    const listEl = context.getListElement();
    if (!listEl || !context.canvas)
        return;
    const ownerDocument = listEl.ownerDocument;
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