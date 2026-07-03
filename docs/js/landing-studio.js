(function () {
    'use strict';

    const demoRuntime = window.__imageEditorDemoRuntime;
    const studioWidth = 1050;
    const studioHeight = 250;

    function createStudioDataUrl() {
        const { canvas, context } = demoRuntime.createCanvas(studioWidth, studioHeight);

        context.fillStyle = '#f8fafc';
        context.fillRect(0, 0, canvas.width, canvas.height);

        const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, 'rgba(36, 104, 255, 0.18)');
        gradient.addColorStop(0.48, 'rgba(0, 166, 166, 0.16)');
        gradient.addColorStop(1, 'rgba(255, 95, 61, 0.16)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);

        demoRuntime.drawPanel(context, 24, 30, 1002, 190, '#ffffff', {
            lineWidth: 1.4,
            radius: 8,
        });
        drawMountain(context);
        drawBars(context);
        drawTextLines(context);
        return canvas.toDataURL('image/png');
    }

    function drawMountain(context) {
        context.save();
        context.beginPath();
        context.moveTo(46, 190);
        context.lineTo(128, 112);
        context.lineTo(194, 158);
        context.lineTo(274, 82);
        context.lineTo(376, 190);
        context.closePath();
        context.fillStyle = 'rgba(36, 104, 255, 0.18)';
        context.fill();

        context.beginPath();
        context.moveTo(180, 190);
        context.lineTo(312, 102);
        context.lineTo(492, 190);
        context.closePath();
        context.fillStyle = 'rgba(0, 166, 166, 0.16)';
        context.fill();
        context.restore();
    }

    function drawBars(context) {
        const bars = [62, 96, 72, 124, 88, 142];
        bars.forEach((height, index) => {
            context.fillStyle = index % 2 === 0 ? '#2468ff' : '#00a6a6';
            context.fillRect(64 + index * 30, 184 - height, 16, height);
        });
    }

    function drawTextLines(context) {
        context.fillStyle = '#94a3b8';
        for (let index = 0; index < 4; index += 1) {
            context.fillRect(760, 82 + index * 28, 150 + index * 12, 8);
        }
        context.fillStyle = '#0f172a';
        context.font = '700 17px Arial';
        context.fillText('ImageEditor Studio', 44, 64);
    }

    async function initLandingStudio() {
        const ImageEditorCtor = demoRuntime?.getImageEditorConstructor();
        const canvas = document.getElementById('landingStudioCanvas');
        const container = document.getElementById('landingStudioContainer');
        if (!ImageEditorCtor || !canvas || !container) return;

        const editor = new ImageEditorCtor({
            backgroundColor: 'transparent',
            canvasWidth: studioWidth,
            canvasHeight: studioHeight,
            defaultLayoutMode: 'fit',
            animationDuration: 0,
            showPlaceholder: false,
            maskRotatable: true,
            maskLabelOnSelect: false,
            textAnnotationName: 'studio-note',
            maskName: 'studio-mask',
            defaultMaskConfig: {
                color: 'rgba(16, 23, 36, 0.76)',
                alpha: 0.76,
                styles: {
                    stroke: '#ffffff',
                    strokeWidth: 1,
                },
            },
        });

        editor.init({
            canvas,
            canvasContainer: container,
        });

        await editor.loadImage(createStudioDataUrl());
        editor.createMask({
            shape: 'rect',
            left: 90,
            top: 78,
            width: 150,
            height: 30,
        });
        editor.createMask({
            shape: 'ellipse',
            left: 850,
            top: 128,
            width: 92,
            height: 58,
            color: 'rgba(36, 104, 255, 0.68)',
            alpha: 0.68,
        });
        editor.createTextAnnotation({
            text: 'Review',
            left: 720,
            top: 72,
            width: 118,
            fontSize: 22,
            fill: '#ff5f3d',
            backgroundColor: 'rgba(255,255,255,0)',
            enterEditing: false,
        });
        editor.createTextAnnotation({
            text: 'OK',
            left: 430,
            top: 164,
            width: 58,
            fontSize: 18,
            fill: '#087f70',
            backgroundColor: 'rgba(255,255,255,0)',
            enterEditing: false,
        });
    }

    initLandingStudio().catch((error) => {
        console.error('[ImageEditor landing demo] Studio initialization failed.', error);
    });
})();
