import { isMaskObject } from '../core/public-types.js';
export function renderMaskList(ctx) {
    const listId = ctx.getListElementId();
    if (!listId)
        return;
    const listEl = document.getElementById(listId);
    if (!listEl || !ctx.canvas)
        return;
    listEl.innerHTML = '';
    const canvas = ctx.canvas;
    canvas
        .getObjects()
        .filter(isMaskObject)
        .forEach((mask) => {
        const li = document.createElement('li');
        li.className = 'list-group-item mask-item';
        li.textContent = mask.maskName;
        li.dataset.maskId = String(mask.maskId);
        li.onclick = () => {
            const id = Number(li.dataset.maskId);
            if (!Number.isFinite(id))
                return;
            const target = canvas
                .getObjects()
                .find((o) => isMaskObject(o) && o.maskId === id);
            if (!target)
                return;
            canvas.setActiveObject(target);
            ctx.onMaskSelected(target);
        };
        listEl.appendChild(li);
    });
}
export function updateMaskListSelection(ctx, selectedMask) {
    const listId = ctx.getListElementId();
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