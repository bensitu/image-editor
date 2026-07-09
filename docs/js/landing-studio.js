(function () {
    'use strict';

    const demoRuntime = window.__imageEditorDemoRuntime;
    const studioWidth = 1120;
    const studioHeight = 320;

    function createStudioDataUrl() {
        const { canvas, context } = demoRuntime.createCanvas(studioWidth, studioHeight);

        const baseGradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
        baseGradient.addColorStop(0, '#f8fafc');
        baseGradient.addColorStop(0.5, '#eef6fb');
        baseGradient.addColorStop(1, '#fff6f0');
        context.fillStyle = baseGradient;
        context.fillRect(0, 0, canvas.width, canvas.height);

        drawBackdropGrid(context);
        drawStudioPanel(context);
        drawDocumentCard(context);
        drawPhotoCard(context);
        drawInspectorCard(context);

        return canvas.toDataURL('image/png');
    }

    function drawBackdropGrid(context) {
        context.save();
        context.globalAlpha = 0.52;
        context.strokeStyle = 'rgba(36, 104, 255, 0.1)';
        context.lineWidth = 1;
        for (let x = 0; x <= studioWidth; x += 36) {
            context.beginPath();
            context.moveTo(x, 0);
            context.lineTo(x, studioHeight);
            context.stroke();
        }
        context.strokeStyle = 'rgba(0, 166, 166, 0.09)';
        for (let y = 0; y <= studioHeight; y += 36) {
            context.beginPath();
            context.moveTo(0, y);
            context.lineTo(studioWidth, y);
            context.stroke();
        }
        context.restore();
    }

    function drawStudioPanel(context) {
        drawPanel(context, 28, 24, 1064, 272, '#ffffff', 'rgba(133, 150, 174, 0.35)');
        context.fillStyle = '#0f172a';
        context.font = '700 18px Arial';
        context.fillText('Claim review packet', 54, 58);
        drawPill(context, 'FILTERED', 302, 40, 88, 24, '#e7f7f4', '#087f70');
        drawPill(context, 'MASKS 4', 400, 40, 88, 24, '#eef4ff', '#1647c8');
        drawPill(context, 'ANNOTATIONS 5', 498, 40, 130, 24, '#fff3ed', '#9d341f');
    }

    function drawDocumentCard(context) {
        const x = 54;
        const y = 76;
        drawPanel(context, x, y, 302, 196, '#ffffff', 'rgba(133, 150, 174, 0.3)');

        context.fillStyle = '#1647c8';
        fillRoundedRect(context, x + 16, y + 16, 112, 10, 5);
        context.fillStyle = '#64748b';
        context.font = '700 11px Arial';
        context.fillText('DOCUMENT INTAKE', x + 16, y + 42);

        const photoGradient = context.createLinearGradient(x + 22, y + 62, x + 106, y + 154);
        photoGradient.addColorStop(0, '#dbeafe');
        photoGradient.addColorStop(1, '#c7f2ec');
        fillRoundedRect(context, x + 22, y + 58, 84, 92, 7, photoGradient);
        context.fillStyle = 'rgba(15, 23, 42, 0.2)';
        context.beginPath();
        context.arc(x + 64, y + 88, 18, 0, Math.PI * 2);
        context.fill();
        fillRoundedRect(context, x + 38, y + 112, 52, 31, 14, 'rgba(15, 23, 42, 0.16)');

        drawMosaicPatch(context, x + 23, y + 113, 82, 36, 9, [
            '#9cc7e8',
            '#b4dacf',
            '#e7d8bd',
            '#a7b4c7',
        ]);

        drawFieldRow(context, x + 126, y + 63, 142, 'Name');
        drawFieldRow(context, x + 126, y + 94, 118, 'Policy ID');
        drawFieldRow(context, x + 126, y + 125, 152, 'Address');
        drawTinyTable(context, x + 18, y + 166, 260, 3);
    }

    function drawPhotoCard(context) {
        const x = 382;
        const y = 76;
        drawPanel(context, x, y, 390, 196, '#ffffff', 'rgba(133, 150, 174, 0.3)');
        context.fillStyle = '#64748b';
        context.font = '700 11px Arial';
        context.fillText('SOURCE PHOTO', x + 18, y + 27);

        const imageX = x + 16;
        const imageY = y + 40;
        const imageGradient = context.createLinearGradient(
            imageX,
            imageY,
            imageX + 360,
            imageY + 118,
        );
        imageGradient.addColorStop(0, '#dbeafe');
        imageGradient.addColorStop(0.58, '#c8f2ef');
        imageGradient.addColorStop(1, '#ffe6d9');
        fillRoundedRect(context, imageX, imageY, 358, 114, 7, imageGradient);

        context.fillStyle = 'rgba(255, 255, 255, 0.54)';
        context.beginPath();
        context.arc(imageX + 270, imageY + 27, 17, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = 'rgba(15, 23, 42, 0.14)';
        context.beginPath();
        context.moveTo(imageX + 20, imageY + 100);
        context.lineTo(imageX + 108, imageY + 45);
        context.lineTo(imageX + 176, imageY + 96);
        context.lineTo(imageX + 242, imageY + 54);
        context.lineTo(imageX + 340, imageY + 100);
        context.closePath();
        context.fill();

        context.strokeStyle = 'rgba(36, 104, 255, 0.6)';
        context.lineWidth = 4;
        context.lineCap = 'round';
        context.beginPath();
        context.moveTo(imageX + 34, imageY + 86);
        context.bezierCurveTo(
            imageX + 110,
            imageY + 58,
            imageX + 188,
            imageY + 94,
            imageX + 310,
            imageY + 62,
        );
        context.stroke();

        fillRoundedRect(context, imageX + 218, imageY + 82, 96, 20, 3, '#f8fafc');
        drawMosaicPatch(context, imageX + 224, imageY + 85, 84, 14, 7, [
            '#526174',
            '#8ea2ba',
            '#e4edf7',
            '#304055',
        ]);

        drawMiniChart(context, x + 28, y + 166);
        drawPill(context, 'contrast +8', x + 170, y + 162, 88, 22, '#eef4ff', '#1647c8');
        drawPill(context, 'mosaic block 12', x + 266, y + 162, 106, 22, '#f1fbf9', '#087f70');
    }

    function drawInspectorCard(context) {
        const x = 798;
        const y = 76;
        drawPanel(context, x, y, 268, 196, '#ffffff', 'rgba(133, 150, 174, 0.3)');
        context.fillStyle = '#64748b';
        context.font = '700 11px Arial';
        context.fillText('EXPORT CHECK', x + 18, y + 27);

        drawScoreRing(context, x + 56, y + 82, 34, 0.78);
        context.fillStyle = '#0f172a';
        context.font = '700 22px Arial';
        context.fillText('78', x + 44, y + 90);
        context.fillStyle = '#526174';
        context.font = '12px Arial';
        context.fillText('review score', x + 101, y + 70);
        drawTextLine(context, x + 102, y + 84, 112, '#d7e0eb');
        drawTextLine(context, x + 102, y + 104, 94, '#d7e0eb');

        drawChecklistRow(context, x + 18, y + 130, 172, '#087f70');
        drawChecklistRow(context, x + 18, y + 156, 132, '#ff5f3d');
        drawChecklistRow(context, x + 18, y + 182, 190, '#2468ff');

        fillRoundedRect(context, x + 188, y + 128, 50, 54, 6, '#edf3fb');
        context.strokeStyle = 'rgba(36, 104, 255, 0.42)';
        context.lineWidth = 2;
        context.strokeRect(x + 198, y + 140, 30, 30);
    }

    function drawFieldRow(context, x, y, width, label) {
        context.fillStyle = '#94a3b8';
        context.font = '10px Arial';
        context.fillText(label, x, y);
        drawTextLine(context, x, y + 8, width, '#d7e0eb');
        drawTextLine(context, x, y + 22, width * 0.76, '#eef3f8');
    }

    function drawTinyTable(context, x, y, width, rows) {
        for (let index = 0; index < rows; index += 1) {
            const top = y + index * 16;
            fillRoundedRect(context, x, top, width, 10, 4, index % 2 === 0 ? '#f4f8fc' : '#eef4ff');
            drawTextLine(context, x + 10, top + 3, width * 0.34, '#c7d3e2');
            drawTextLine(context, x + width * 0.54, top + 3, width * 0.32, '#c7d3e2');
        }
    }

    function drawMiniChart(context, x, y) {
        const bars = [20, 32, 18, 38, 27, 45];
        bars.forEach((height, index) => {
            context.fillStyle = index % 2 === 0 ? '#2468ff' : '#00a6a6';
            fillRoundedRect(context, x + index * 15, y + 45 - height, 8, height, 4);
        });
    }

    function drawChecklistRow(context, x, y, width, color) {
        fillRoundedRect(context, x, y, 14, 14, 4, color);
        drawTextLine(context, x + 22, y + 3, width, '#d7e0eb');
    }

    function drawScoreRing(context, x, y, radius, progress) {
        context.save();
        context.lineWidth = 7;
        context.strokeStyle = '#edf3fb';
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.stroke();
        context.strokeStyle = '#00a6a6';
        context.beginPath();
        context.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        context.stroke();
        context.restore();
    }

    function drawPill(context, text, x, y, width, height, fill, color) {
        fillRoundedRect(context, x, y, width, height, height / 2, fill);
        context.fillStyle = color;
        context.font = '700 10px Arial';
        context.textBaseline = 'middle';
        context.fillText(text, x + 10, y + height / 2 + 0.5);
        context.textBaseline = 'alphabetic';
    }

    function drawTextLine(context, x, y, width, color) {
        fillRoundedRect(context, x, y, width, 8, 4, color);
    }

    function drawMosaicPatch(context, x, y, width, height, blockSize, colors) {
        for (let blockY = 0; blockY < height; blockY += blockSize) {
            for (let blockX = 0; blockX < width; blockX += blockSize) {
                const index = (blockX / blockSize + (blockY / blockSize) * 3) % colors.length;
                context.fillStyle = colors[index];
                context.fillRect(
                    x + blockX,
                    y + blockY,
                    Math.min(blockSize, width - blockX),
                    Math.min(blockSize, height - blockY),
                );
            }
        }
    }

    function drawPanel(context, x, y, width, height, fill, stroke) {
        context.save();
        context.shadowColor = 'rgba(26, 39, 63, 0.08)';
        context.shadowBlur = 18;
        context.shadowOffsetY = 8;
        fillRoundedRect(context, x, y, width, height, 10, fill);
        context.restore();
        context.strokeStyle = stroke;
        context.lineWidth = 1;
        strokeRoundedRect(context, x, y, width, height, 10);
    }

    function fillRoundedRect(context, x, y, width, height, radius, fill) {
        context.save();
        buildRoundedRectPath(context, x, y, width, height, radius);
        if (fill !== undefined) context.fillStyle = fill;
        context.fill();
        context.restore();
    }

    function strokeRoundedRect(context, x, y, width, height, radius) {
        buildRoundedRectPath(context, x, y, width, height, radius);
        context.stroke();
    }

    function buildRoundedRectPath(context, x, y, width, height, radius) {
        const nextRadius = Math.min(radius, width / 2, height / 2);
        context.beginPath();
        context.moveTo(x + nextRadius, y);
        context.lineTo(x + width - nextRadius, y);
        context.quadraticCurveTo(x + width, y, x + width, y + nextRadius);
        context.lineTo(x + width, y + height - nextRadius);
        context.quadraticCurveTo(x + width, y + height, x + width - nextRadius, y + height);
        context.lineTo(x + nextRadius, y + height);
        context.quadraticCurveTo(x, y + height, x, y + height - nextRadius);
        context.lineTo(x, y + nextRadius);
        context.quadraticCurveTo(x, y, x + nextRadius, y);
        context.closePath();
    }

    function createOverlayScale(editor) {
        const imageInfo = editor.getImageInfo?.();
        const xScale = imageInfo?.displayWidth ? imageInfo.displayWidth / studioWidth : 1;
        const yScale = imageInfo?.displayHeight ? imageInfo.displayHeight / studioHeight : xScale;
        const baseScale = Math.min(xScale || 1, yScale || 1);
        return {
            x: (value) => Math.round(value * xScale),
            y: (value) => Math.round(value * yScale),
            width: (value) => Math.max(1, Math.round(value * xScale)),
            height: (value) => Math.max(1, Math.round(value * yScale)),
            font: (value) => Math.max(8, Math.round(value * baseScale)),
            stroke: (value) => Math.max(1.5, value * baseScale),
            dash: (values) => values.map((value) => Math.max(2, Math.round(value * baseScale))),
            arrow: (value) => Math.max(8, Math.round(value * baseScale)),
            points: (points) =>
                points.map(([x, y]) => [Math.round(x * xScale), Math.round(y * yScale)]),
        };
    }

    function createMask(editor, scale, config) {
        const scaledConfig = { ...config };
        if (typeof config.left === 'number') scaledConfig.left = scale.x(config.left);
        if (typeof config.top === 'number') scaledConfig.top = scale.y(config.top);
        if (typeof config.width === 'number') scaledConfig.width = scale.width(config.width);
        if (typeof config.height === 'number') scaledConfig.height = scale.height(config.height);
        if (typeof config.rx === 'number') scaledConfig.rx = scale.width(config.rx);
        if (typeof config.ry === 'number') scaledConfig.ry = scale.height(config.ry);
        if (Array.isArray(config.points)) scaledConfig.points = scale.points(config.points);
        return editor.createMask(scaledConfig);
    }

    function createTextAnnotation(editor, scale, config) {
        const scaledConfig = {
            ...config,
            left: typeof config.left === 'number' ? scale.x(config.left) : config.left,
            top: typeof config.top === 'number' ? scale.y(config.top) : config.top,
            width: scale.width(config.width ?? 160),
            fontSize: scale.font(config.fontSize ?? 18),
        };
        return editor.createTextAnnotation({
            fontWeight: 700,
            fill: '#0f172a',
            backgroundColor: 'rgba(255,255,255,0)',
            enterEditing: false,
            ...scaledConfig,
        });
    }

    function createShapeAnnotation(editor, scale, config) {
        const scaledConfig = { ...config };
        if (typeof config.left === 'number') scaledConfig.left = scale.x(config.left);
        if (typeof config.top === 'number') scaledConfig.top = scale.y(config.top);
        if (typeof config.width === 'number') scaledConfig.width = scale.width(config.width);
        if (typeof config.height === 'number') scaledConfig.height = scale.height(config.height);
        if (typeof config.x1 === 'number') scaledConfig.x1 = scale.x(config.x1);
        if (typeof config.y1 === 'number') scaledConfig.y1 = scale.y(config.y1);
        if (typeof config.x2 === 'number') scaledConfig.x2 = scale.x(config.x2);
        if (typeof config.y2 === 'number') scaledConfig.y2 = scale.y(config.y2);
        if (typeof config.strokeWidth === 'number')
            scaledConfig.strokeWidth = scale.stroke(config.strokeWidth);
        if (typeof config.arrowHeadLength === 'number') {
            scaledConfig.arrowHeadLength = scale.arrow(config.arrowHeadLength);
        }
        if (Array.isArray(config.strokeDashArray)) {
            scaledConfig.strokeDashArray = scale.dash(config.strokeDashArray);
        }
        return editor.createShapeAnnotation({
            stroke: '#2468ff',
            strokeWidth: scale.stroke(4),
            fill: 'rgba(36,104,255,0.08)',
            opacity: 1,
            ...scaledConfig,
        });
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
                color: 'rgba(16, 23, 36, 0.78)',
                alpha: 0.78,
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
        editor.setImageFilterConfig({
            brightness: 0.03,
            contrast: 0.08,
            saturation: 0.14,
            sharpen: 0.28,
        });
        editor.commitImageFilters();

        const overlayScale = createOverlayScale(editor);

        createMask(editor, overlayScale, {
            shape: 'ellipse',
            left: 76,
            top: 132,
            width: 88,
            height: 74,
            color: 'rgba(15, 23, 42, 0.66)',
            alpha: 0.66,
        });
        createMask(editor, overlayScale, {
            shape: 'rect',
            left: 180,
            top: 128,
            width: 142,
            height: 22,
            rx: 5,
            ry: 5,
        });
        createMask(editor, overlayScale, {
            shape: 'rect',
            left: 180,
            top: 158,
            width: 122,
            height: 22,
            rx: 5,
            ry: 5,
        });
        createMask(editor, overlayScale, {
            shape: 'polygon',
            points: [
                [622, 197],
                [718, 198],
                [708, 222],
                [618, 220],
            ],
            color: 'rgba(16, 23, 36, 0.72)',
            alpha: 0.72,
        });

        createShapeAnnotation(editor, overlayScale, {
            shape: 'rect',
            left: 398,
            top: 116,
            width: 358,
            height: 114,
            stroke: '#2468ff',
            strokeDashArray: [12, 8],
        });
        createShapeAnnotation(editor, overlayScale, {
            shape: 'arrow',
            x1: 356,
            y1: 124,
            x2: 300,
            y2: 140,
            stroke: '#ff5f3d',
            fill: 'rgba(0,0,0,0)',
            arrowHeadLength: 22,
        });
        createShapeAnnotation(editor, overlayScale, {
            shape: 'arrow',
            x1: 744,
            y1: 252,
            x2: 686,
            y2: 214,
            stroke: '#087f70',
            fill: 'rgba(0,0,0,0)',
            arrowHeadLength: 22,
        });
        createShapeAnnotation(editor, overlayScale, {
            shape: 'line',
            x1: 842,
            y1: 212,
            x2: 990,
            y2: 212,
            stroke: '#ff5f3d',
            strokeWidth: 5,
            fill: 'rgba(0,0,0,0)',
        });

        createTextAnnotation(editor, overlayScale, {
            text: 'PII masked',
            left: 186,
            top: 98,
            width: 130,
            fontSize: 18,
            fill: '#c42f3a',
        });
        createTextAnnotation(editor, overlayScale, {
            text: 'OCR mismatch',
            left: 796,
            top: 236,
            width: 158,
            fontSize: 18,
            fill: '#9d341f',
        });
        createTextAnnotation(editor, overlayScale, {
            text: 'Filter + mosaic',
            left: 520,
            top: 244,
            width: 190,
            fontSize: 19,
            fill: '#087f70',
        });
        createTextAnnotation(editor, overlayScale, {
            text: 'Export-ready',
            left: 820,
            top: 112,
            width: 160,
            fontSize: 20,
            fill: '#1647c8',
        });
    }

    initLandingStudio().catch((error) => {
        console.error('[ImageEditor landing demo] Studio initialization failed.', error);
    });
})();
