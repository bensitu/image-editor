/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies extracted keyboard-event policy without constructing
 *   ImageEditor or Fabric.
 *
 * Scope:
 *   - Delete/Backspace deletion guards.
 *   - Escape finalization and mode-exit priority.
 *
 * Out of scope:
 *   - Browser event registration.
 *   - Text controller commit behavior.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { handleEditorKeyboardEvent } = await import('../src/ui/editor-keyboard-events.ts');

function createEvent(key) {
    return {
        key,
        defaultPrevented: false,
        preventDefault() {
            this.defaultPrevented = true;
        },
    };
}

function createAccess(overrides = {}) {
    const calls = [];
    const access = {
        calls,
        isDisposed: () => false,
        getCanvas: () => null,
        getKeyboardDocument: () => null,
        hasTextSession: () => false,
        hasDrawSession: () => false,
        hasMosaicSession: () => false,
        hasCropSession: () => false,
        deleteSelectedObject: () => {
            calls.push('deleteSelectedObject');
        },
        finalizeActiveTextEditing: (commit) => {
            calls.push(['finalizeActiveTextEditing', commit]);
        },
        exitTextMode: () => {
            calls.push('exitTextMode');
        },
        exitDrawMode: () => {
            calls.push('exitDrawMode');
        },
        exitMosaicMode: () => {
            calls.push('exitMosaicMode');
        },
        cancelCrop: () => {
            calls.push('cancelCrop');
        },
        ...overrides,
    };
    return access;
}

test('Delete removes the selected object when no text input is active', () => {
    const access = createAccess();

    handleEditorKeyboardEvent(access, createEvent('Delete'));

    assert.deepEqual(access.calls, ['deleteSelectedObject']);
});

test('Backspace is ignored while a native input owns focus', () => {
    const activeElement = {
        tagName: 'INPUT',
        isContentEditable: false,
    };
    const access = createAccess({
        getKeyboardDocument: () => ({ activeElement }),
    });

    handleEditorKeyboardEvent(access, createEvent('Backspace'));

    assert.deepEqual(access.calls, []);
});

test('Escape finalizes active Fabric text editing without committing', () => {
    const textObject = {
        editorObjectKind: 'annotation',
        annotationId: 1,
        annotationType: 'text',
        annotationName: 'Text',
        isEditing: true,
    };
    const access = createAccess({
        getCanvas: () => ({
            getActiveObject: () => textObject,
        }),
    });
    const event = createEvent('Escape');

    handleEditorKeyboardEvent(access, event);

    assert.deepEqual(access.calls, [['finalizeActiveTextEditing', false]]);
    assert.equal(event.defaultPrevented, true);
});

test('Escape exits active modes in existing facade priority', () => {
    const access = createAccess({
        hasTextSession: () => true,
        hasDrawSession: () => true,
        hasMosaicSession: () => true,
        hasCropSession: () => true,
    });

    handleEditorKeyboardEvent(access, createEvent('Escape'));

    assert.deepEqual(access.calls, ['exitTextMode']);
});

test('Escape falls through to crop cancellation when only crop is active', () => {
    const access = createAccess({
        hasCropSession: () => true,
    });

    handleEditorKeyboardEvent(access, createEvent('Escape'));

    assert.deepEqual(access.calls, ['cancelCrop']);
});
