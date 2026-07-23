import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { ImageEditorCore as RootImageEditorCore } from '@bensitu/image-editor';
import { ImageEditorCore } from '@bensitu/image-editor/core';
import {
    FABRIC_RUNTIME_CAPABILITY,
    definePlugin,
    definePluginRef,
} from '@bensitu/image-editor/sdk';

import { proveConformance } from './conformance-proof.mjs';
import { installFabricEnvironment, fabric } from './fabric-environment.mjs';
import { proveGridAndBlur } from './grid-blur-proof.mjs';
import { proveTopologyAndInvariant } from './topology-invariant-proof.mjs';
import { proveTransactionsAndIsolation } from './transaction-isolation-proof.mjs';
import { proveWatermarkAndMetadata } from './watermark-metadata-proof.mjs';

installFabricEnvironment();

const proofInputPath = process.env.REFERENCE_PLUGIN_PROOF_INPUT;
if (!proofInputPath) throw new Error('REFERENCE_PLUGIN_PROOF_INPUT is required.');
const proofInput = JSON.parse(await readFile(proofInputPath, 'utf8'));

async function proveRuntimeIdentity() {
    assert.equal(RootImageEditorCore, ImageEditorCore);
    const ref = definePluginRef('testing:runtime-identity', '1.0.0');
    let capabilityFabric;
    const identityPlugin = definePlugin({
        ref,
        manifest: {
            id: ref.id,
            version: '1.0.0',
            apiVersion: ref.apiVersion,
            engine: '^3.0.0',
            requires: [{ token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' }],
            permissions: ['fabric:objects'],
        },
        setupMode: 'sync',
        setup(context) {
            capabilityFabric = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY).fabric;
            return Object.freeze({});
        },
    });
    const editor = new ImageEditorCore(fabric);
    editor.use(identityPlugin);
    assert.ok(capabilityFabric);
    assert.equal(capabilityFabric.Canvas, fabric.Canvas);
    assert.equal(capabilityFabric.FabricObject, fabric.FabricObject);
    assert.equal(capabilityFabric.FabricImage, fabric.FabricImage);
    await editor.disposeAsync();
    return Object.freeze({
        coreConstructorIdentities: 1,
        fabricClassIdentities: 1,
    });
}

function summarizeConformance(reports) {
    return Object.freeze(
        Object.fromEntries(
            Object.entries(reports).map(([name, report]) => [
                name,
                Object.freeze({
                    result: report.result,
                    total: report.assertions.length,
                    passed: report.assertions.filter((entry) => entry.status === 'PASS').length,
                    downgraded: report.assertions.filter(
                        (entry) => entry.status === 'PASS_WITH_DOWNGRADED_ISOLATION',
                    ).length,
                    notApplicable: report.assertions.filter(
                        (entry) => entry.status === 'NOT_APPLICABLE',
                    ).length,
                    failed: report.assertions.filter((entry) => entry.status === 'FAIL').length,
                    notAvailable: report.assertions.filter(
                        (entry) => entry.status === 'NOT_AVAILABLE',
                    ).length,
                }),
            ]),
        ),
    );
}

const runtimeIdentity = await proveRuntimeIdentity();
const watermarkMetadata = await proveWatermarkAndMetadata();
const gridBlur = await proveGridAndBlur();
const topology = await proveTopologyAndInvariant();
const transactions = await proveTransactionsAndIsolation();
const behavior = Object.freeze({ watermarkMetadata, gridBlur, topology, transactions });
const conformanceReports = await proveConformance(proofInput, behavior);

const result = Object.freeze({
    schemaVersion: 1,
    result: 'PASS',
    runtimeIdentity,
    behavior,
    conformance: summarizeConformance(conformanceReports),
});

process.stdout.write(`REFERENCE_PLUGIN_PROOF=${JSON.stringify(result)}\n`);
