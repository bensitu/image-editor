import assert from 'node:assert/strict';
import test from 'node:test';

import { JSDOM } from 'jsdom';

import { measureScrollbarSize } from '../../src/image/layout-manager.js';

type InstrumentedDimensions = Readonly<
    Partial<Record<'offsetWidth' | 'clientWidth' | 'offsetHeight' | 'clientHeight', number>>
>;

function createInstrumentedDocument(dimensions: InstrumentedDimensions) {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const { document } = dom.window;
    const createElement = document.createElement.bind(document);
    let probeCount = 0;
    document.createElement = ((tagName: string, options?: ElementCreationOptions) => {
        const element = createElement(tagName, options);
        if (String(tagName).toLowerCase() !== 'div') return element;
        probeCount += 1;
        for (const [property, value] of Object.entries(dimensions)) {
            Object.defineProperty(element, property, {
                configurable: true,
                value,
            });
        }
        return element;
    }) as typeof document.createElement;
    return { document, dom, probeCount: () => probeCount };
}

test('scrollbar measurement probes each document once and keeps documents isolated', () => {
    const first = createInstrumentedDocument({
        offsetWidth: 100,
        clientWidth: 83,
        offsetHeight: 100,
        clientHeight: 89,
    });
    const second = createInstrumentedDocument({
        offsetWidth: 100,
        clientWidth: 91,
        offsetHeight: 100,
        clientHeight: 87,
    });

    const firstResult = measureScrollbarSize(first.document);
    assert.deepEqual(firstResult, { width: 17, height: 11 });
    assert.strictEqual(measureScrollbarSize(first.document), firstResult);
    assert.equal(first.probeCount(), 1);

    assert.deepEqual(measureScrollbarSize(second.document), { width: 9, height: 13 });
    assert.equal(second.probeCount(), 1);
    assert.equal(first.probeCount(), 1);
    first.dom.window.close();
    second.dom.window.close();
});

test('a missing body returns zero without caching the temporary result', () => {
    const context = createInstrumentedDocument({
        offsetWidth: 100,
        clientWidth: 84,
        offsetHeight: 100,
        clientHeight: 88,
    });
    context.document.body.remove();

    assert.deepEqual(measureScrollbarSize(context.document), { width: 0, height: 0 });
    assert.equal(context.probeCount(), 0);

    context.document.documentElement.append(context.document.createElement('body'));
    assert.deepEqual(measureScrollbarSize(context.document), { width: 16, height: 12 });
    assert.equal(context.probeCount(), 1);
    context.dom.window.close();
});

test('zero-gutter measurements are cached and cannot be externally mutated', () => {
    const context = createInstrumentedDocument({
        offsetWidth: 100,
        clientWidth: 100,
        offsetHeight: 100,
        clientHeight: 100,
    });

    const measured = measureScrollbarSize(context.document);
    assert.deepEqual(measured, { width: 0, height: 0 });
    assert.equal(Object.isFrozen(measured), true);
    assert.throws(() => {
        measured.width = 99;
    }, TypeError);
    assert.strictEqual(measureScrollbarSize(context.document), measured);
    assert.deepEqual(measured, { width: 0, height: 0 });
    assert.equal(context.probeCount(), 1);
    context.dom.window.close();
});
