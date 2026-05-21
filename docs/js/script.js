let editor = null;

function initEditor() {
    if (editor || typeof window.ImageEditor !== 'function') return;

    editor = new window.ImageEditor({
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
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEditor);
} else {
    initEditor();
}

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

const loadButtonElement = document.getElementById('loadBtn');
if (loadButtonElement) {
    loadButtonElement.addEventListener('click', function () {
        setOptions();
        const imageBase64 = document.getElementById('base64Input')?.value || '';
        editor.loadImage(imageBase64);
    });
}

const imageInputElement = document.getElementById('imageInput');
if (imageInputElement) {
    imageInputElement.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            setOptions();
            const reader = new FileReader();
            reader.onload = function(loadEvent) {
                const imageBase64 = loadEvent.target.result;
                editor.loadImage(imageBase64);
            };
            reader.readAsDataURL(file);
        }
    });
}

const uploadAreaElement = document.getElementById('uploadArea');
if (uploadAreaElement) {
    uploadAreaElement.addEventListener('drop', function(event) {
        event.preventDefault();
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            setOptions();
            const reader = new FileReader();
            reader.onload = function(loadEvent) {
                const imageBase64 = loadEvent.target.result;
                editor.loadImage(imageBase64);
            };
            reader.readAsDataURL(file);
        }
    });
    uploadAreaElement.addEventListener('dragover', function(event) {
        event.preventDefault();
    });
}

async function getBase64Action() {
    try {
        const imageBase64 = await editor.exportImageBase64();
        console.log(imageBase64);
    } catch (error) {
        console.error(error);
    }
}
