export type FixtureName = 'test-image.png' | 'test-image-wide.png' | 'test-image-transparent.png';

type FixtureSpec = {
    width: number;
    height: number;
    draw(context: CanvasRenderingContext2D): void;
};

const fixtures: Record<FixtureName, FixtureSpec> = {
    'test-image.png': {
        width: 160,
        height: 160,
        draw(context) {
            context.fillStyle = '#dbeafe';
            context.fillRect(0, 0, 160, 160);
            context.fillStyle = '#1d4ed8';
            context.fillRect(16, 16, 56, 128);
            context.fillStyle = '#f97316';
            context.fillRect(88, 24, 48, 48);
            context.fillStyle = '#16a34a';
            context.beginPath();
            context.arc(112, 112, 28, 0, Math.PI * 2);
            context.fill();
            context.strokeStyle = '#111827';
            context.lineWidth = 6;
            context.beginPath();
            context.moveTo(18, 142);
            context.lineTo(142, 18);
            context.stroke();
        },
    },
    'test-image-wide.png': {
        width: 240,
        height: 160,
        draw(context) {
            context.fillStyle = '#f8fafc';
            context.fillRect(0, 0, 240, 160);
            context.fillStyle = '#2563eb';
            context.fillRect(0, 0, 80, 160);
            context.fillStyle = '#facc15';
            context.fillRect(80, 0, 80, 160);
            context.fillStyle = '#dc2626';
            context.fillRect(160, 0, 80, 160);
            context.fillStyle = '#111827';
            context.fillRect(32, 32, 176, 24);
            context.fillStyle = '#ffffff';
            context.fillRect(56, 88, 128, 40);
        },
    },
    'test-image-transparent.png': {
        width: 120,
        height: 120,
        draw(context) {
            context.clearRect(0, 0, 120, 120);
            context.fillStyle = '#0f766e';
            context.fillRect(12, 12, 48, 96);
            context.fillStyle = 'rgba(220, 38, 38, 0.72)';
            context.beginPath();
            context.arc(78, 60, 36, 0, Math.PI * 2);
            context.fill();
            context.strokeStyle = '#111827';
            context.lineWidth = 4;
            context.strokeRect(8, 8, 104, 104);
        },
    },
};

export function createFixtureDataUrl(name: FixtureName): string {
    const fixture = fixtures[name];
    const canvas = document.createElement('canvas');
    canvas.width = fixture.width;
    canvas.height = fixture.height;
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Unable to create fixture canvas context.');
    }
    fixture.draw(context);
    return canvas.toDataURL('image/png');
}

export function getFixtureSize(name: FixtureName): { width: number; height: number } {
    const fixture = fixtures[name];
    return { width: fixture.width, height: fixture.height };
}
