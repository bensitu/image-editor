function result(id, contract, status, message, details) {
    return Object.freeze({ id, contract, required: true, status, message, details });
}
function unavailable(id, contract) {
    return result(id, contract, 'NOT_AVAILABLE', 'No proof adapter was supplied.');
}
function describeError(error) {
    return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
async function resolveProof(source) {
    return typeof source === 'function' ? source() : source;
}
async function evaluate(id, contract, source, inspect) {
    if (!source)
        return unavailable(id, contract);
    try {
        const inspected = inspect(await resolveProof(source));
        return result(id, contract, inspected.passed ? 'PASS' : 'FAIL', inspected.message, inspected.details);
    }
    catch (error) {
        return result(id, contract, 'FAIL', describeError(error));
    }
}
function isBundledCoreModule(moduleId) {
    const normalized = moduleId.replace(/\\/gu, '/');
    return /(?:^|\/)node_modules\/@bensitu\/image-editor(?:\/|$)/u.test(normalized);
}
function isBundledFabricModule(moduleId) {
    const normalized = moduleId.replace(/\\/gu, '/');
    return /(?:^|\/)node_modules\/fabric(?:\/|$)/u.test(normalized);
}
export function assertBundleIsolation(source) {
    return evaluate('bundle-isolation', 'The package uses public imports and has no private or unknown bundled modules.', source, (observation) => {
        var _a, _b;
        const bundledRuntimeModules = observation.moduleIds.filter((moduleId) => isBundledCoreModule(moduleId) || isBundledFabricModule(moduleId));
        const passed = observation.internalImports === 0 &&
            observation.privateAliases === 0 &&
            ((_a = observation.unknownModules) !== null && _a !== void 0 ? _a : 0) === 0 &&
            bundledRuntimeModules.length === 0;
        return {
            passed,
            message: passed
                ? 'Package module isolation is intact.'
                : 'Package module isolation contains forbidden imports or modules.',
            details: Object.freeze({
                internalImports: observation.internalImports,
                privateAliases: observation.privateAliases,
                unknownModules: (_b = observation.unknownModules) !== null && _b !== void 0 ? _b : 0,
                bundledRuntimeModules: Object.freeze([...bundledRuntimeModules].sort()),
            }),
        };
    });
}
function descriptorFingerprint(descriptor) {
    return Object.freeze({
        configurable: descriptor.configurable === true,
        enumerable: descriptor.enumerable === true,
        writable: 'writable' in descriptor ? descriptor.writable === true : undefined,
        value: 'value' in descriptor ? descriptor.value : undefined,
        get: descriptor.get,
        set: descriptor.set,
    });
}
function captureSurface(surfaces, name, value) {
    const properties = new Map();
    for (const key of Reflect.ownKeys(value)) {
        const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
        if (descriptor)
            properties.set(key, descriptorFingerprint(descriptor));
    }
    if (value instanceof Map) {
        for (const [key, entry] of value) {
            properties.set(`[[Map:${String(key)}]]`, descriptorFingerprint({ value: entry }));
        }
    }
    if (value instanceof Set) {
        for (const entry of value) {
            properties.set(`[[Set:${String(entry)}]]`, descriptorFingerprint({ value: entry }));
        }
    }
    surfaces.set(name, properties);
}
export function captureFabricGlobalState(fabric) {
    const surfaces = new Map();
    captureSurface(surfaces, 'fabric', fabric);
    for (const key of Reflect.ownKeys(fabric)) {
        const descriptor = Reflect.getOwnPropertyDescriptor(fabric, key);
        if (!descriptor || !('value' in descriptor))
            continue;
        const value = descriptor.value;
        const name = `fabric.${String(key)}`;
        if (typeof value === 'function' && value.prototype && typeof value.prototype === 'object') {
            captureSurface(surfaces, `${name}.prototype`, value.prototype);
        }
        if (typeof value === 'object' &&
            value !== null &&
            ['classRegistry', 'config', 'filters'].includes(String(key))) {
            captureSurface(surfaces, name, value);
            for (const childKey of Reflect.ownKeys(value)) {
                const childDescriptor = Reflect.getOwnPropertyDescriptor(value, childKey);
                if (childDescriptor &&
                    'value' in childDescriptor &&
                    typeof childDescriptor.value === 'object' &&
                    childDescriptor.value !== null) {
                    captureSurface(surfaces, `${name}.${String(childKey)}`, childDescriptor.value);
                }
            }
        }
    }
    return surfaces;
}
function descriptorsEqual(left, right) {
    return (left.configurable === right.configurable &&
        left.enumerable === right.enumerable &&
        left.writable === right.writable &&
        Object.is(left.value, right.value) &&
        left.get === right.get &&
        left.set === right.set);
}
function globalDifferences(before, after) {
    var _a, _b;
    const differences = new Set();
    const surfaceNames = new Set([...before.keys(), ...after.keys()]);
    for (const surfaceName of surfaceNames) {
        const left = (_a = before.get(surfaceName)) !== null && _a !== void 0 ? _a : new Map();
        const right = (_b = after.get(surfaceName)) !== null && _b !== void 0 ? _b : new Map();
        const keys = new Set([...left.keys(), ...right.keys()]);
        for (const key of keys) {
            const leftValue = left.get(key);
            const rightValue = right.get(key);
            if (!leftValue || !rightValue || !descriptorsEqual(leftValue, rightValue)) {
                differences.add(`${surfaceName}.${String(key)}`);
            }
        }
    }
    return Object.freeze([...differences].sort());
}
export async function assertNoUndeclaredFabricGlobalMutation(lifecycle) {
    var _a, _b, _c;
    const id = 'fabric-global-mutation';
    const contract = 'Known Fabric global surfaces remain unchanged unless global mutation permission is declared.';
    if (!lifecycle)
        return unavailable(id, contract);
    const changes = [];
    let previous = captureFabricGlobalState(lifecycle.fabric);
    let definition;
    let runtime;
    try {
        const module = await lifecycle.importModule();
        let current = captureFabricGlobalState(lifecycle.fabric);
        let surfaces = globalDifferences(previous, current);
        if (surfaces.length > 0)
            changes.push(Object.freeze({ phase: 'import', surfaces }));
        previous = current;
        definition = await lifecycle.createDefinition(module);
        current = captureFabricGlobalState(lifecycle.fabric);
        surfaces = globalDifferences(previous, current);
        if (surfaces.length > 0)
            changes.push(Object.freeze({ phase: 'definition', surfaces }));
        previous = current;
        runtime = await lifecycle.setup(definition);
        current = captureFabricGlobalState(lifecycle.fabric);
        surfaces = globalDifferences(previous, current);
        if (surfaces.length > 0)
            changes.push(Object.freeze({ phase: 'setup', surfaces }));
        previous = current;
        await lifecycle.dispose(runtime, definition);
        current = captureFabricGlobalState(lifecycle.fabric);
        surfaces = globalDifferences(previous, current);
        if (surfaces.length > 0)
            changes.push(Object.freeze({ phase: 'dispose', surfaces }));
    }
    catch (error) {
        return result(id, contract, 'FAIL', describeError(error));
    }
    const permissions = (_c = (_a = lifecycle.declaredPermissions) !== null && _a !== void 0 ? _a : (_b = definition === null || definition === void 0 ? void 0 : definition.manifest) === null || _b === void 0 ? void 0 : _b.permissions) !== null && _c !== void 0 ? _c : Object.freeze([]);
    const declared = permissions.includes('fabric:global-mutation');
    const changedSurfaces = Object.freeze([...new Set(changes.flatMap((entry) => entry.surfaces))].sort());
    const details = Object.freeze({
        changedSurfaces,
        phases: Object.freeze(changes),
        declarationPresent: declared,
        isolation: changedSurfaces.length === 0 ? 'STRONG' : declared ? 'DOWNGRADED' : 'FAILED',
        detectionScope: 'KNOWN_MEASURABLE_SURFACES',
    });
    if (changedSurfaces.length === 0) {
        return result(id, contract, 'PASS', 'Known Fabric global surfaces are unchanged.', details);
    }
    if (declared) {
        return result(id, contract, 'PASS_WITH_DOWNGRADED_ISOLATION', 'Declared Fabric global mutation requires downgraded isolation.', details);
    }
    return result(id, contract, 'FAIL', 'Fabric global mutation was detected without the required declaration.', details);
}
export function assertStrongMultiInstanceIsolation(source) {
    return evaluate('multi-instance-isolation', 'Core, Plugin, operation, tool, Overlay, History, and Fabric state are isolated by instance.', source, (observation) => {
        const failures = Object.entries(observation)
            .filter(([, isolated]) => !isolated)
            .map(([name]) => name)
            .sort();
        return {
            passed: failures.length === 0,
            message: failures.length === 0
                ? 'Strong multi-instance isolation is intact.'
                : `Isolation failed for ${failures.join(', ')}.`,
            details: Object.freeze({ failures: Object.freeze(failures) }),
        };
    });
}
export function assertPeerDependencyContract(source) {
    return evaluate('peer-dependency-contract', 'Core and Fabric are peers and are never vendored by the Plugin package.', source, (manifest) => {
        var _a, _b, _c;
        const peerDependencies = (_a = manifest.peerDependencies) !== null && _a !== void 0 ? _a : {};
        const runtimeDependencies = (_b = manifest.dependencies) !== null && _b !== void 0 ? _b : {};
        const optionalDependencies = (_c = manifest.optionalDependencies) !== null && _c !== void 0 ? _c : {};
        const bundled = Array.isArray(manifest.bundledDependencies)
            ? manifest.bundledDependencies
            : [];
        const requiredPeers = ['@bensitu/image-editor', 'fabric'];
        const missingPeers = requiredPeers.filter((dependency) => typeof peerDependencies[dependency] !== 'string');
        const vendored = requiredPeers.filter((dependency) => dependency in runtimeDependencies ||
            dependency in optionalDependencies ||
            bundled.includes(dependency) ||
            manifest.bundledDependencies === true);
        const passed = missingPeers.length === 0 && vendored.length === 0;
        return {
            passed,
            message: passed
                ? 'Core and Fabric peer dependency declarations are valid.'
                : 'Core or Fabric peer dependency declarations are invalid.',
            details: Object.freeze({
                missingPeers: Object.freeze(missingPeers),
                vendored: Object.freeze(vendored),
            }),
        };
    });
}
export function assertPackageDoesNotBundleCoreOrFabric(source) {
    return evaluate('package-runtime-externalization', 'The Plugin artifact contains no Core or Fabric runtime module.', source, (observation) => {
        var _a, _b;
        const core = (_a = observation.bundledCoreModules) !== null && _a !== void 0 ? _a : observation.moduleIds.filter(isBundledCoreModule).length;
        const fabric = (_b = observation.bundledFabricModules) !== null && _b !== void 0 ? _b : observation.moduleIds.filter(isBundledFabricModule).length;
        return {
            passed: core === 0 && fabric === 0,
            message: core === 0 && fabric === 0
                ? 'Core and Fabric remain external.'
                : 'The Plugin artifact bundles Core or Fabric.',
            details: Object.freeze({ bundledCoreModules: core, bundledFabricModules: fabric }),
        };
    });
}
export function assertBaseImageInvariant(source) {
    return evaluate('base-image-invariant', 'Prohibited Base Image actions are rejected without observable document effects.', source, (observation) => {
        const failed = observation.attempts
            .filter((attempt) => !attempt.rejected ||
            !attempt.documentUnchanged ||
            !attempt.historyUnchanged ||
            !attempt.committedEventAbsent ||
            !attempt.instanceUsable)
            .map((attempt) => attempt.action)
            .sort();
        return {
            passed: observation.attempts.length > 0 && failed.length === 0,
            message: observation.attempts.length > 0 && failed.length === 0
                ? 'Base Image invariants rejected every prohibited action.'
                : 'A prohibited Base Image action produced an observable effect.',
            details: Object.freeze({
                attemptCount: observation.attempts.length,
                failedActions: Object.freeze(failed),
            }),
        };
    });
}
export function assertOverlayMutationHistory(source) {
    return evaluate('overlay-mutation-history', 'A committed Overlay mutation owns one transaction, History record, and event.', source, (observation) => {
        const passed = observation.topLevelTransactions === 1 &&
            observation.historyRecords === 1 &&
            observation.committedEvents === 1 &&
            observation.registrationLeaks === 0;
        return {
            passed,
            message: passed
                ? 'Overlay mutation ownership and cleanup are exact.'
                : 'Overlay mutation ownership or cleanup is not exact.',
            details: Object.freeze({ ...observation }),
        };
    });
}
export function assertCompoundTransaction(source) {
    return evaluate('compound-transaction', 'Compound work commits one Memento pair, History record, and event with atomic restore.', source, (observation) => {
        const passed = observation.topLevelTransactions === 1 &&
            observation.mementoPairs === 1 &&
            observation.historyRecords === 1 &&
            observation.committedEvents === 1 &&
            observation.undoRestoredAll &&
            observation.redoRestoredAll &&
            observation.participantFailureRolledBackAll &&
            observation.nestedWorkPublishedOnce &&
            observation.activeSelectionAtomic;
        return {
            passed,
            message: passed
                ? 'Compound transaction ownership and restoration are atomic.'
                : 'Compound transaction evidence is incomplete or non-atomic.',
            details: Object.freeze({ ...observation }),
        };
    });
}
export function assertSliceMigration(source) {
    return evaluate('slice-migration', 'Plugin-owned Slice migration is deterministic, validated, isolated, and failure-atomic.', source, (observation) => {
        const passed = Number.isSafeInteger(observation.sourceVersion) &&
            Number.isSafeInteger(observation.targetVersion) &&
            observation.sourceVersion < observation.targetVersion &&
            observation.migrated &&
            observation.deterministic &&
            observation.validatedBeforeCommit &&
            observation.failedMigrationMutationCount === 0 &&
            observation.futureVersionTypedFailure &&
            observation.missingPluginPolicyPreserved &&
            observation.privateAccesses === 0;
        return {
            passed,
            message: passed
                ? 'Plugin-owned Slice migration satisfies the public contract.'
                : 'Plugin-owned Slice migration evidence is incomplete.',
            details: Object.freeze({ ...observation }),
        };
    });
}
//# sourceMappingURL=responsibility-assertions.js.map