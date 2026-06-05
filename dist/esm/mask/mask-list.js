import { isMaskObject } from '../core/public-types.js';
export function renderMaskList(context) {
    const listId = context.getListElementId();
    if (!listId)
        return;
    const listEl = document.getElementById(listId);
    if (!listEl || !context.canvas)
        return;
    listEl.innerHTML = '';
    const canvas = context.canvas;
    canvas
        .getObjects()
        .filter(isMaskObject)
        .forEach((mask) => {
        const listItemElement = document.createElement('li');
        listItemElement.className = 'list-group-item mask-item';
        listItemElement.textContent = mask.maskName;
        listItemElement.dataset.maskId = String(mask.maskId);
        listItemElement.onclick = () => {
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
        };
        listEl.appendChild(listItemElement);
    });
}
export function updateMaskListSelection(context, selectedMask) {
    const listId = context.getListElementId();
    if (!listId)
        return;
    const listEl = document.getElementById(listId);
    if (!listEl)
        return;
    const selectedId = selectedMask ? String(selectedMask.maskId) : null;
    listEl.querySelectorAll('.mask-item').forEach((item) => {
        const isSelected = selectedId !== null && item.dataset.maskId === selectedId;
        item.classList.toggle('active', isSelected);
    });
}
//# sourceMappingURL=mask-list.js.map