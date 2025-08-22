let editor = null;
document.addEventListener('DOMContentLoaded', () => {
    editor = new ImageEditor({
        expandCanvasToImage: true,
        fitImageToCanvas: false,
        downsampleOnLoad: true,
        initialImageBase64: null,
        maskRotatable: true,
        maskLabelOnSelect: true,
        animationDuration: 100,
        maskLabelOffset: 5,
        showPlaceholder: true,
        exportImageAreaByDefault: true
    });
    editor.init({
        canvas: 'fabricCanvas',
        imgPlaceholder: 'imgPlaceholder',
        imageInput: 'imageInput',
        uploadArea: 'uploadArea',
        scaleRate: 'scaleRate',
        rotateLeftBtn: 'rotateLeftBtn',
        rotateRightBtn: 'rotateRightBtn',
        rotationLeftInput: 'leftValue',
        rotationRightInput: 'rightValue',
        addMaskBtn: 'addMaskBtn',
        removeMaskBtn: 'removeMaskBtn',
        removeAllMasksBtn: 'removeAllMasksBtn',
        mergeBtn: 'mergeBtn',
        downloadBtn: 'downloadBtn',
        maskList: 'maskList',
        canvasContainer: null
    });
});

const loadBtnEl = document.getElementById('loadBtn');
if (loadBtnEl) {
    loadBtnEl.addEventListener('click', function () {
        const base64 = document.getElementById('base64Input')?.value || '';
        editor.loadImage(base64);
    });
}

async function getBase64Action() {
    try {
        const img64 = await editor.getImageBase64();
        console.log(img64);
    } catch (e) {
        console.error(e);
    }
}