/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies history/editor-state action behavior that sits above the raw
 *   state serializer.
 *
 * Scope:
 *   - Snapshot capture records active mask identity only when Fabric reports
 *     the mask as the current active object.
 *
 * Environment:
 *   - Node.js ESM
 *   - Source TypeScript loaded through the test resolver hook
 *
 * Run:
 *   node --import ./tests/helpers/register-ts-loader.mjs --test tests/editor-state-actions.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { captureSnapshotAction } = await import('../src/history/editor-state-actions.ts');

function makeMask() {
    return {
        editorObjectKind: 'mask',
        type: 'rect',
        maskId: 7,
        maskUid: 'mask-7',
        maskName: 'mask7',
        labelObject: { maskLabel: true },
    };
}

function makeCanvas({ activeObject = null } = {}) {
    const mask = makeMask();
    return {
        width: 100,
        height: 80,
        objects: [mask],
        getObjects() {
            return this.objects.slice();
        },
        getActiveObject() {
            return activeObject;
        },
        toJSON() {
            return {
                version: '7.0.0',
                width: this.width,
                height: this.height,
                objects: this.objects.map((object) => ({ type: object.type })),
            };
        },
        mask,
    };
}

function makeAccess(canvas) {
    return {
        getCanvas: () => canvas,
        getCurrentScale: () => 1,
        getCurrentRotation: () => 0,
        getBaseImageScale: () => 1,
        getCurrentImageMimeType: () => 'image/png',
        hideAllMaskLabels: () => {},
    };
}

test('captureSnapshotAction does not infer active mask from a lone visible label', () => {
    const canvas = makeCanvas();

    const snapshot = captureSnapshotAction(makeAccess(canvas));
    const json = JSON.parse(snapshot);

    assert.equal(json._editorState.activeObjectKind, null);
    assert.equal('activeMaskId' in json._editorState, false);
});

test('captureSnapshotAction preserves explicit active mask identity', () => {
    const baseCanvas = makeCanvas();
    const canvas = makeCanvas({ activeObject: baseCanvas.mask });
    canvas.objects = [baseCanvas.mask];

    const snapshot = captureSnapshotAction(makeAccess(canvas));
    const json = JSON.parse(snapshot);

    assert.equal(json._editorState.activeObjectKind, 'mask');
    assert.equal(json._editorState.activeMaskId, 7);
});
