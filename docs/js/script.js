let editor = null;
document.addEventListener('DOMContentLoaded', () => {
    editor = new ImageEditor({
        backgroundColor: 'transparent',
        expandCanvasToImage: true,
        fitImageToCanvas: false,
        coverImageToCanvas: false,
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
        cropBtn: 'cropBtn',
        applyCropBtn: 'applyCropBtn',
        cancelCropBtn: 'cancelCropBtn',
        canvasContainer: null
    });
});

function setOptions() {
    const fitImageRadio = document.getElementById('fitImage');
    const coverCanvasRadio = document.getElementById('coverCanvas');
    const expandCanvasRadio = document.getElementById('expandCanvas');
    if (fitImageRadio.checked) {
        editor.options.fitImageToCanvas = true;
        editor.options.coverImageToCanvas = false;
        editor.options.expandCanvasToImage = false;
    } else if (coverCanvasRadio.checked) {
        editor.options.fitImageToCanvas = false;
        editor.options.coverImageToCanvas = true;
        editor.options.expandCanvasToImage = false;
    } else {
        editor.options.fitImageToCanvas = false;
        editor.options.coverImageToCanvas = false;
        editor.options.expandCanvasToImage = true;
    }
}

const loadBtnEl = document.getElementById('loadBtn');
if (loadBtnEl) {
    loadBtnEl.addEventListener('click', function () {
        setOptions();
        const base64 = document.getElementById('base64Input')?.value || '';
        editor.loadImage(base64);
    });
}

const imageInputEl = document.getElementById('imageInput');
if (imageInputEl) {
    imageInputEl.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            setOptions();
            const reader = new FileReader();
            reader.onload = function(e) {
                const base64 = e.target.result;
                editor.loadImage(base64);
            };
            reader.readAsDataURL(file);
        }
    });
}

const uploadAreaEl = document.getElementById('uploadArea');
if (uploadAreaEl) {
    uploadAreaEl.addEventListener('drop', function(event) {
        event.preventDefault();
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            setOptions();
            const reader = new FileReader();
            reader.onload = function(e) {
                const base64 = e.target.result;
                editor.loadImage(base64);
            };
            reader.readAsDataURL(file);
        }
    });
    uploadAreaEl.addEventListener('dragover', function(event) {
        event.preventDefault();
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