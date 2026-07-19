(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.ImageEditorFull = {}));
})(this, (function (exports) { 'use strict';

    function derivePluginErrorName(code) {
        const stem = code
            .replace('PLUGIN_DEPENDENCY_MISSING', 'PLUGIN_DEPENDENCY')
            .replace('PLUGIN_BATCH_INSTALL_FAILED', 'PLUGIN_BATCH_INSTALL')
            .replace('PLUGIN_PERMISSION_REQUIRED', 'PLUGIN_PERMISSION')
            .replace(/_ERROR$/u, '');
        return `${stem.toLowerCase().replace(/(?:^|_)[a-z]/gu, (match) => match.slice(-1).toUpperCase())}Error`;
    }
    class PluginError extends Error {
        constructor(code, message, options = {}) {
            super(message);
            this.name = new.target === PluginError ? 'PluginError' : derivePluginErrorName(code);
            this.code = code;
            this.pluginId = options.pluginId;
            this.cause = options.cause;
        }
    }
    class PluginManifestError extends PluginError {
        constructor(message, options = {}) {
            super('PLUGIN_MANIFEST_ERROR', `[ImageEditor] ${message}`, options);
        }
    }
    class PluginIdentityConflictError extends PluginManifestError {
        constructor(referenceId, manifestId) {
            super(`Plugin reference "${referenceId}" does not match manifest identity "${manifestId}".`, { pluginId: referenceId });
            Object.defineProperty(this, "name", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'PluginIdentityConflictError'
            });
            this.referenceId = referenceId;
            this.manifestId = manifestId;
        }
    }
    class PluginEngineVersionError extends PluginManifestError {
        constructor(pluginId, engineRange, coreApiVersion) {
            super(`Plugin "${pluginId}" requires engine range "${engineRange}", which does not include Core API "${coreApiVersion}".`, { pluginId });
            Object.defineProperty(this, "name", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'PluginEngineVersionError'
            });
            this.engineRange = engineRange;
            this.coreApiVersion = coreApiVersion;
        }
    }
    class PluginApiVersionError extends PluginManifestError {
        constructor(pluginId, referenceApiVersion, manifestApiVersion) {
            super(`Plugin "${pluginId}" reference API version "${referenceApiVersion}" does not match manifest API version "${manifestApiVersion}".`, { pluginId });
            Object.defineProperty(this, "name", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'PluginApiVersionError'
            });
            this.referenceApiVersion = referenceApiVersion;
            this.manifestApiVersion = manifestApiVersion;
        }
    }
    class PluginAggregateError extends PluginError {
        constructor(message, errors, options = {}) {
            var _a;
            super('PLUGIN_AGGREGATE_ERROR', message, {
                ...options,
                cause: (_a = options.cause) !== null && _a !== void 0 ? _a : errors[0],
            });
            this.errors = Object.freeze([...errors]);
        }
    }
    class PluginAlreadyInstalledError extends PluginError {
        constructor(pluginId) {
            super('PLUGIN_ALREADY_INSTALLED', `[ImageEditor] Plugin "${pluginId}" is already installed. Direct duplicate installation is not allowed.`, { pluginId });
        }
    }
    class PluginNotInstalledError extends PluginError {
        constructor(pluginId) {
            super('PLUGIN_NOT_INSTALLED', `[ImageEditor] Plugin "${pluginId}" is not installed.`, {
                pluginId,
            });
        }
    }
    class PluginDependencyError extends PluginError {
        constructor(details) {
            const packageHint = details.packageHint ? ` Package hint: ${details.packageHint}.` : '';
            const available = details.availablePluginIds.length > 0 ? details.availablePluginIds.join(', ') : 'none';
            super('PLUGIN_DEPENDENCY_MISSING', `[ImageEditor] Plugin "${details.consumerPluginId}" requires Plugin "${details.dependencyId}" API "${details.requiredApiVersion}", but it is not available. Available Plugins: ${available}.${packageHint} ${details.planHint}`, { pluginId: details.consumerPluginId });
            this.consumerPluginId = details.consumerPluginId;
            this.dependencyId = details.dependencyId;
            this.requiredApiVersion = details.requiredApiVersion;
            this.availablePluginIds = Object.freeze([...details.availablePluginIds]);
            this.packageHint = details.packageHint;
            this.planHint = details.planHint;
        }
    }
    class PluginDependencyCycleError extends PluginError {
        constructor(cycle) {
            super('PLUGIN_DEPENDENCY_CYCLE', `[ImageEditor] Plugin dependency cycle detected: ${cycle.join(' -> ')}.`, { pluginId: cycle[0] });
            this.cycle = Object.freeze([...cycle]);
        }
    }
    class PluginDefinitionConflictError extends PluginError {
        constructor(pluginId) {
            super('PLUGIN_DEFINITION_CONFLICT', `[ImageEditor] Plugin "${pluginId}" has conflicting immutable installation definitions.`, { pluginId });
        }
    }
    class PluginBatchInstallError extends PluginError {
        constructor(cause, cleanupErrors = []) {
            super('PLUGIN_BATCH_INSTALL_FAILED', '[ImageEditor] Plugin batch installation failed and was rolled back.', { cause });
            this.cleanupErrors = Object.freeze([...cleanupErrors]);
        }
    }
    class PluginPermissionError extends PluginError {
        constructor(pluginId, permission, capabilityId, operation = 'access a privileged Capability') {
            super('PLUGIN_PERMISSION_REQUIRED', `[ImageEditor] Plugin "${pluginId}" must declare permission "${permission}" to ${operation} "${capabilityId}".`, { pluginId });
            this.permission = permission;
            this.capabilityId = capabilityId;
            this.operation = operation;
        }
    }
    class CapabilityMissingError extends PluginError {
        constructor(details) {
            const available = details.availableProviders.length > 0 ? details.availableProviders.join(', ') : 'none';
            super('CAPABILITY_MISSING', `[ImageEditor] Plugin "${details.consumerPluginId}" requires Capability "${details.capabilityId}" range "${details.requestedRange}", but no provider is available. Available providers: ${available}. Include a declared provider in the Plugin Plan.`, { pluginId: details.consumerPluginId });
            this.consumerPluginId = details.consumerPluginId;
            this.capabilityId = details.capabilityId;
            this.requestedRange = details.requestedRange;
            this.availableProviders = Object.freeze([...details.availableProviders]);
        }
    }
    class CapabilityVersionError extends PluginError {
        constructor(details, code = 'CAPABILITY_VERSION_ERROR', message) {
            var _a, _b;
            const provider = details.providerPluginId
                ? ` from provider "${details.providerPluginId}"`
                : '';
            const consumer = details.consumerPluginId
                ? ` for Plugin "${details.consumerPluginId}"`
                : '';
            super(code, message !== null && message !== void 0 ? message : `[ImageEditor] Capability "${details.capabilityId}" version "${(_a = details.actualVersion) !== null && _a !== void 0 ? _a : 'unavailable'}"${provider} does not satisfy "${details.expectedRange}"${consumer}.`, {
                pluginId: (_b = details.consumerPluginId) !== null && _b !== void 0 ? _b : details.providerPluginId,
                cause: details.cause,
            });
            this.capabilityId = details.capabilityId;
            this.expectedRange = details.expectedRange;
            this.actualVersion = details.actualVersion;
            this.providerPluginId = details.providerPluginId;
            this.consumerPluginId = details.consumerPluginId;
        }
    }
    class PluginCapabilityError extends PluginError {
        constructor(details) {
            var _a, _b;
            const installed = (_a = details.installedVersion) !== null && _a !== void 0 ? _a : 'not installed';
            const provider = (_b = details.providerPluginId) !== null && _b !== void 0 ? _b : 'none';
            super('PLUGIN_CAPABILITY_ERROR', `[ImageEditor] Plugin "${details.consumerPluginId}" requires capability "${details.capabilityId}" range "${details.requestedRange}", but installed version is "${installed}" from provider "${provider}" (${details.reason}).`, { pluginId: details.consumerPluginId, cause: details.cause });
            this.consumerPluginId = details.consumerPluginId;
            this.capabilityId = details.capabilityId;
            this.requestedRange = details.requestedRange;
            this.installedVersion = details.installedVersion;
            this.providerPluginId = details.providerPluginId;
            this.reason = details.reason;
        }
    }
    class CapabilityConflictError extends PluginError {
        constructor(capabilityId, installedProviderPluginId, conflictingProviderPluginId) {
            super('CAPABILITY_CONFLICT', `[ImageEditor] Capability "${capabilityId}" is already provided by "${installedProviderPluginId}" and cannot also be provided by "${conflictingProviderPluginId}".`, { pluginId: conflictingProviderPluginId });
            this.capabilityId = capabilityId;
            this.installedProviderPluginId = installedProviderPluginId;
            this.conflictingProviderPluginId = conflictingProviderPluginId;
        }
    }
    class PluginLifecycleError extends PluginError {
        constructor(pluginId, phase, cause, cleanupErrors = []) {
            super('PLUGIN_LIFECYCLE_ERROR', `[ImageEditor] Plugin "${pluginId}" failed during lifecycle phase "${phase}".`, { pluginId, cause });
            this.phase = phase;
            this.cleanupErrors = Object.freeze([...cleanupErrors]);
        }
    }
    class PluginSetupError extends PluginError {
        constructor(pluginId, cause, cleanupErrors = []) {
            super('PLUGIN_SETUP_ERROR', `[ImageEditor] Plugin "${pluginId}" setup failed and its installation was rolled back.`, { pluginId, cause });
            this.cleanupErrors = Object.freeze([...cleanupErrors]);
        }
    }
    class InvalidPluginDefinitionError extends PluginManifestError {
        constructor(message, pluginId, cause) {
            super(message, { pluginId, cause });
            Object.defineProperty(this, "name", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'InvalidPluginDefinitionError'
            });
        }
    }
    class InvalidCapabilityVersionError extends CapabilityVersionError {
        constructor(capabilityId, value, valueKind) {
            super({
                capabilityId,
                expectedRange: `valid SemVer ${valueKind}`,
                actualVersion: value,
            }, 'INVALID_CAPABILITY_VERSION', `[ImageEditor] Capability "${capabilityId}" has invalid SemVer ${valueKind} "${value}".`);
            this.value = value;
            this.valueKind = valueKind;
        }
    }
    class PluginVersionMismatchError extends PluginError {
        constructor(pluginId, installedVersion, requestedVersion, installedApiVersion, requestedApiVersion) {
            super('PLUGIN_VERSION_MISMATCH', `[ImageEditor] Plugin "${pluginId}" cannot be reused: installed implementation/API versions are "${installedVersion}"/"${installedApiVersion}", requested versions are "${requestedVersion}"/"${requestedApiVersion}".`, { pluginId });
        }
    }
    class OperationRegistrationError extends PluginError {
        constructor(message, pluginId) {
            super('OPERATION_REGISTRATION_ERROR', `[ImageEditor] ${message}`, { pluginId });
        }
    }
    class OperationConflictError extends PluginError {
        constructor(message, pluginId) {
            super('OPERATION_CONFLICT', `[ImageEditor] ${message}`, { pluginId });
        }
    }
    class ToolRegistrationError extends PluginError {
        constructor(message, pluginId) {
            super('TOOL_REGISTRATION_ERROR', `[ImageEditor] ${message}`, { pluginId });
        }
    }
    class ToolTransitionError extends PluginError {
        constructor(toolId, message, pluginId, cause) {
            super('TOOL_TRANSITION_ERROR', `[ImageEditor] Tool "${toolId}" ${message}.`, {
                pluginId,
                cause,
            });
            this.toolId = toolId;
        }
    }
    class PluginKernelDisposedError extends PluginError {
        constructor(operation) {
            super('PLUGIN_KERNEL_DISPOSED', `[ImageEditor] Cannot ${operation} after the Plugin Kernel has been disposed.`);
        }
    }
    class PluginKernelStateError extends PluginError {
        constructor(operation, state) {
            super('PLUGIN_KERNEL_STATE_ERROR', `[ImageEditor] Cannot ${operation} while the Plugin Kernel is in state "${state}".`);
        }
    }

    const MAX_RUNTIME_IDENTIFIER_LENGTH = 128;
    const RUNTIME_IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/u;
    const prohibitedRuntimeIdentifierSegments = new Set(['__proto__', 'constructor', 'prototype']);
    function isRuntimeIdentifier(value) {
        return (typeof value === 'string' &&
            value.length <= MAX_RUNTIME_IDENTIFIER_LENGTH &&
            RUNTIME_IDENTIFIER_PATTERN.test(value) &&
            !value.split(':').some((segment) => prohibitedRuntimeIdentifierSegments.has(segment)));
    }

    const numericIdentifier = '(?:0|[1-9]\\d*)';
    const prereleaseIdentifier = `(?:${numericIdentifier}|\\d*[A-Za-z-][0-9A-Za-z-]*)`;
    const semVerPattern = new RegExp(`^(${numericIdentifier})\\.(${numericIdentifier})\\.(${numericIdentifier})(?:-(${prereleaseIdentifier}(?:\\.${prereleaseIdentifier})*))?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`, 'u');
    const partialVersionPattern = new RegExp(`^(${numericIdentifier})(?:\\.(${numericIdentifier}|[xX*]))?(?:\\.(${numericIdentifier}|[xX*]))?$`, 'u');
    const comparatorPattern = /^(<=|>=|<|>|=|~|\^)?(.+)$/u;
    function parseRangeVersion(value) {
        const exact = semVerPattern.exec(value);
        if (exact) {
            return {
                major: Number(exact[1]),
                minor: Number(exact[2]),
                patch: Number(exact[3]),
                exact: value,
            };
        }
        const partial = partialVersionPattern.exec(value);
        if (!partial)
            return null;
        const minor = partial[2];
        const patch = partial[3];
        return {
            major: Number(partial[1]),
            minor: minor === undefined || /[xX*]/u.test(minor) ? null : Number(minor),
            patch: patch === undefined || /[xX*]/u.test(patch) ? null : Number(patch),
            exact: null,
        };
    }
    function lowerBound(version) {
        var _a, _b;
        return `${version.major}.${(_a = version.minor) !== null && _a !== void 0 ? _a : 0}.${(_b = version.patch) !== null && _b !== void 0 ? _b : 0}`;
    }
    function exclusiveUpperBound(version) {
        return version.minor === null
            ? `${version.major + 1}.0.0`
            : `${version.major}.${version.minor + 1}.0`;
    }
    function caretUpperBound(version) {
        if (version.major > 0 || version.minor === null)
            return `${version.major + 1}.0.0`;
        if (version.minor > 0 || version.patch === null)
            return `0.${version.minor + 1}.0`;
        return `0.0.${version.patch + 1}`;
    }
    function normalizeComparator(token) {
        var _a, _b;
        if (/^[xX*]$/u.test(token))
            return ['>=0.0.0'];
        const match = comparatorPattern.exec(token);
        if (!match)
            return null;
        const operator = (_a = match[1]) !== null && _a !== void 0 ? _a : '';
        const version = parseRangeVersion(match[2]);
        if (!version)
            return null;
        const lower = (_b = version.exact) !== null && _b !== void 0 ? _b : lowerBound(version);
        if (operator === '^')
            return [`>=${lower}`, `<${caretUpperBound(version)}`];
        if (operator === '~')
            return [`>=${lower}`, `<${exclusiveUpperBound(version)}`];
        if (version.exact !== null)
            return [`${operator}${version.exact}`];
        const upper = exclusiveUpperBound(version);
        if (operator === '>')
            return [`>=${upper}`];
        if (operator === '<=')
            return [`<${upper}`];
        if (operator === '<')
            return [`<${lower}`];
        if (operator === '>=')
            return [`>=${lower}`];
        return [`>=${lower}`, `<${upper}`];
    }
    function normalizeComparatorSet(value) {
        const hyphen = /^(\S+)\s+-\s+(\S+)$/u.exec(value);
        if (hyphen) {
            const lower = parseRangeVersion(hyphen[1]);
            const upper = parseRangeVersion(hyphen[2]);
            if (!lower || !upper)
                return null;
            return `>=${lowerBound(lower)} ${upper.exact === null ? `<${exclusiveUpperBound(upper)}` : `<=${upper.exact}`}`;
        }
        const normalized = [];
        for (const token of value.split(/\s+/u).filter(Boolean)) {
            const comparators = normalizeComparator(token);
            if (!comparators)
                return null;
            normalized.push(...comparators);
        }
        return normalized.length === 0 ? null : normalized.join(' ');
    }
    function normalizeRange(range) {
        if (range.length === 0 || range.trim() !== range)
            return null;
        const sets = range
            .replace(/([><=~^]+)\s+/gu, '$1')
            .split('||')
            .map((entry) => entry.trim());
        if (sets.some((entry) => entry.length === 0))
            return null;
        const normalized = sets.map(normalizeComparatorSet);
        return normalized.some((entry) => entry === null) ? null : normalized.join(' || ');
    }
    function compareNumeric(left, right) {
        const leftNumber = Number(left);
        const rightNumber = Number(right);
        return leftNumber === rightNumber ? 0 : leftNumber < rightNumber ? -1 : 1;
    }
    function compareSemVer(left, right) {
        var _a, _b, _c, _d;
        for (let index = 1; index <= 3; index += 1) {
            const comparison = compareNumeric(left[index], right[index]);
            if (comparison !== 0)
                return comparison;
        }
        const leftPrerelease = (_b = (_a = left[4]) === null || _a === void 0 ? void 0 : _a.split('.')) !== null && _b !== void 0 ? _b : [];
        const rightPrerelease = (_d = (_c = right[4]) === null || _c === void 0 ? void 0 : _c.split('.')) !== null && _d !== void 0 ? _d : [];
        if (leftPrerelease.length === 0 || rightPrerelease.length === 0) {
            return leftPrerelease.length === rightPrerelease.length
                ? 0
                : leftPrerelease.length === 0
                    ? 1
                    : -1;
        }
        for (let index = 0; index < Math.max(leftPrerelease.length, rightPrerelease.length); index += 1) {
            const leftIdentifier = leftPrerelease[index];
            const rightIdentifier = rightPrerelease[index];
            if (leftIdentifier === undefined || rightIdentifier === undefined) {
                return leftIdentifier === rightIdentifier ? 0 : leftIdentifier === undefined ? -1 : 1;
            }
            if (leftIdentifier === rightIdentifier)
                continue;
            const leftIsNumeric = /^\d+$/u.test(leftIdentifier);
            const rightIsNumeric = /^\d+$/u.test(rightIdentifier);
            if (leftIsNumeric && rightIsNumeric) {
                return compareNumeric(leftIdentifier, rightIdentifier);
            }
            if (leftIsNumeric !== rightIsNumeric)
                return leftIsNumeric ? -1 : 1;
            return leftIdentifier < rightIdentifier ? -1 : 1;
        }
        return 0;
    }
    function satisfiesComparator(version, comparator) {
        var _a;
        const match = /^(<=|>=|<|>|=)?(.+)$/u.exec(comparator);
        const target = match && semVerPattern.exec(match[2]);
        if (!match || !target)
            return false;
        const comparison = compareSemVer(version, target);
        switch ((_a = match[1]) !== null && _a !== void 0 ? _a : '=') {
            case '<':
                return comparison < 0;
            case '<=':
                return comparison <= 0;
            case '>':
                return comparison > 0;
            case '>=':
                return comparison >= 0;
            default:
                return comparison === 0;
        }
    }
    function isValidSemVer(version) {
        return version.trim() === version && semVerPattern.test(version);
    }
    function isValidSemVerRange(range) {
        return normalizeRange(range) !== null;
    }
    function satisfiesSemVer(version, range) {
        if (version.trim() !== version)
            return false;
        const parsedVersion = semVerPattern.exec(version);
        const normalized = normalizeRange(range);
        if (!parsedVersion || !normalized)
            return false;
        const prereleaseTuple = parsedVersion[4]
            ? `${parsedVersion[1]}.${parsedVersion[2]}.${parsedVersion[3]}`
            : null;
        return normalized.split(' || ').some((comparatorSet) => {
            if (!comparatorSet
                .split(' ')
                .every((comparator) => satisfiesComparator(parsedVersion, comparator))) {
                return false;
            }
            if (prereleaseTuple === null)
                return true;
            return new RegExp(`(?:^|[<>=])${prereleaseTuple.replace(/\./gu, '\\.')}-[0-9A-Za-z-]`, 'u').test(comparatorSet);
        });
    }

    const capabilityTokenBrand = Symbol('ImageEditorCapabilityToken');
    function createCapabilityToken(id, version) {
        if (!isRuntimeIdentifier(id)) {
            throw new InvalidPluginDefinitionError('CapabilityToken id must match "namespace:kebab-case" and be no longer than 128 characters.');
        }
        if (!isValidSemVer(version)) {
            throw new InvalidCapabilityVersionError(id, version, 'version');
        }
        const token = {
            id,
            version,
            [capabilityTokenBrand]: true,
        };
        return Object.freeze(token);
    }
    function isCapabilityToken(value) {
        if (typeof value !== 'object' || value === null)
            return false;
        const candidate = value;
        return candidate[capabilityTokenBrand] === true;
    }
    function assertCapabilityRequirement(requirement) {
        var _a;
        const token = requirement === null || requirement === void 0 ? void 0 : requirement.token;
        if (!isCapabilityToken(token)) {
            throw new InvalidCapabilityVersionError('unknown', (_a = requirement === null || requirement === void 0 ? void 0 : requirement.range) !== null && _a !== void 0 ? _a : '', 'range');
        }
        if (!isValidSemVerRange(requirement.range)) {
            throw new InvalidCapabilityVersionError(token.id, requirement.range, 'range');
        }
    }

    function reportErrorSafely(errorSink, error) {
        if (!errorSink)
            return;
        try {
            errorSink(error);
        }
        catch {
        }
    }
    function reportWarningSafely(warningSink, errorSink, warning) {
        if (!warningSink)
            return;
        try {
            warningSink(warning);
        }
        catch (error) {
            reportErrorSafely(errorSink, error);
        }
    }

    function isPromiseLike(value) {
        return ((typeof value === 'object' || typeof value === 'function') &&
            value !== null &&
            typeof value.then === 'function');
    }
    function disposeInReverseSync(disposables, options = {}) {
        var _a;
        const errors = [];
        for (let index = disposables.length - 1; index >= 0; index -= 1) {
            try {
                const result = (_a = disposables[index]) === null || _a === void 0 ? void 0 : _a.dispose();
                if (isPromiseLike(result)) {
                    const error = new Error(`Synchronous cleanup item ${index} returned a Promise. Use the asynchronous disposal path.`);
                    errors.push(error);
                    void Promise.resolve(result).catch((cleanupError) => {
                        reportWarningSafely(options.warningSink, options.errorSink, {
                            code: 'PLUGIN_CLEANUP_FAILED',
                            message: `Asynchronous cleanup item ${index} failed after synchronous disposal returned.`,
                            pluginId: options.pluginId,
                            cause: cleanupError,
                            details: { cleanupIndex: index },
                        });
                    });
                }
            }
            catch (error) {
                errors.push(error);
                reportWarningSafely(options.warningSink, options.errorSink, {
                    code: 'PLUGIN_CLEANUP_FAILED',
                    message: `Plugin cleanup item ${index} failed; remaining cleanup continued.`,
                    pluginId: options.pluginId,
                    cause: error,
                    details: { cleanupIndex: index },
                });
            }
        }
        return Object.freeze(errors);
    }
    function createDisposable(cleanup) {
        let state = 'active';
        let pending = null;
        return {
            dispose() {
                if (state === 'disposed')
                    return undefined;
                if (state === 'disposing')
                    return pending !== null && pending !== void 0 ? pending : undefined;
                state = 'disposing';
                try {
                    const result = cleanup();
                    if (isPromiseLike(result)) {
                        pending = Promise.resolve(result).finally(() => {
                            state = 'disposed';
                        });
                        return pending;
                    }
                    state = 'disposed';
                    return undefined;
                }
                catch (error) {
                    state = 'disposed';
                    throw error;
                }
            },
        };
    }
    function createNoopDisposable() {
        return createDisposable(() => undefined);
    }
    async function disposeInReverse(disposables, options = {}) {
        var _a;
        const errors = [];
        for (let index = disposables.length - 1; index >= 0; index -= 1) {
            try {
                await ((_a = disposables[index]) === null || _a === void 0 ? void 0 : _a.dispose());
            }
            catch (error) {
                errors.push(error);
                reportWarningSafely(options.warningSink, options.errorSink, {
                    code: 'PLUGIN_CLEANUP_FAILED',
                    message: `Plugin cleanup item ${index} failed; remaining cleanup continued.`,
                    pluginId: options.pluginId,
                    cause: error,
                    details: { cleanupIndex: index },
                });
            }
        }
        return errors;
    }

    function assertPluginIdentifier(pluginId, fieldName = 'Plugin id') {
        if (!isRuntimeIdentifier(pluginId)) {
            throw new InvalidPluginDefinitionError(`${fieldName} must match "namespace:kebab-case" and be no longer than 128 characters.`, typeof pluginId === 'string' ? pluginId : undefined);
        }
        return pluginId;
    }

    const pluginRefBrand = Symbol('ImageEditorPluginRef');
    function definePluginRef(id, apiVersion) {
        assertPluginIdentifier(id, 'PluginRef id');
        if (apiVersion.length > 64 || !isValidSemVer(apiVersion)) {
            throw new InvalidPluginDefinitionError(`PluginRef "${id}" has invalid API SemVer "${apiVersion}".`, id);
        }
        const ref = {
            id,
            apiVersion,
            [pluginRefBrand]: true,
        };
        return Object.freeze(ref);
    }
    function isPluginRef(value) {
        if (typeof value !== 'object' || value === null)
            return false;
        const candidate = value;
        return candidate[pluginRefBrand] === true;
    }

    const CORE_API_VERSION = '3.0.0';
    const MAX_VERSION_LENGTH = 64;
    const MAX_PLUGIN_DEPENDENCIES = 64;
    const MAX_CAPABILITY_REQUIREMENTS = 64;
    const MAX_PLUGIN_PERMISSIONS = 16;
    const supportedPermissions = new Set([
        'fabric:objects',
        'fabric:canvas-read',
        'fabric:custom-class',
        'fabric:global-mutation',
        'core:raster-mutation',
        'core:geometry-participant',
        'core:export-contributor',
    ]);
    function isPluginPermission(value) {
        return typeof value === 'string' && supportedPermissions.has(value);
    }
    function assertArrayLimit(value, fieldName, maximum) {
        if (value === undefined)
            return [];
        if (!Array.isArray(value) || value.length > maximum) {
            throw new PluginManifestError(`${fieldName} must be an array containing at most ${maximum} entries.`);
        }
        return value;
    }
    function freezeRequirements(pluginId, value, fieldName) {
        if (value === undefined)
            return undefined;
        const requirements = assertArrayLimit(value, fieldName, MAX_CAPABILITY_REQUIREMENTS);
        return Object.freeze(requirements.map((requirement) => {
            try {
                assertCapabilityRequirement(requirement);
            }
            catch (cause) {
                throw new PluginManifestError(`Plugin "${pluginId}" has an invalid capability requirement in ${fieldName}.`, { pluginId, cause });
            }
            return Object.freeze({ token: requirement.token, range: requirement.range });
        }));
    }
    function freezePluginDependencies(pluginId, value) {
        if (value === undefined)
            return undefined;
        const dependencies = assertArrayLimit(value, 'Plugin manifest requiresPlugins', MAX_PLUGIN_DEPENDENCIES);
        const dependencyIds = new Set();
        const validated = dependencies.map((dependency) => {
            if (!isPluginRef(dependency)) {
                throw new PluginManifestError(`Plugin "${pluginId}" requiresPlugins entries must use definePluginRef().`, { pluginId });
            }
            if (dependency.id === pluginId) {
                throw new PluginManifestError(`Plugin "${pluginId}" cannot depend on itself.`, {
                    pluginId,
                });
            }
            if (dependencyIds.has(dependency.id)) {
                throw new PluginManifestError(`Plugin "${pluginId}" declares dependency "${dependency.id}" more than once.`, { pluginId });
            }
            dependencyIds.add(dependency.id);
            return dependency;
        });
        return Object.freeze(validated);
    }
    function freezePermissions(pluginId, value) {
        if (value === undefined)
            return undefined;
        const permissions = assertArrayLimit(value, 'Plugin manifest permissions', MAX_PLUGIN_PERMISSIONS);
        const permissionSet = new Set();
        const validated = permissions.map((permission) => {
            if (typeof permission !== 'string' || !isPluginPermission(permission)) {
                throw new PluginManifestError(`Plugin "${pluginId}" declares unsupported permission "${String(permission)}".`, { pluginId });
            }
            const typedPermission = permission;
            if (permissionSet.has(typedPermission)) {
                throw new PluginManifestError(`Plugin "${pluginId}" declares permission "${typedPermission}" more than once.`, { pluginId });
            }
            permissionSet.add(typedPermission);
            return typedPermission;
        });
        return Object.freeze(validated);
    }
    function validatePluginManifest(ref, manifest) {
        if (typeof manifest !== 'object' || manifest === null) {
            throw new PluginManifestError(`Plugin "${ref.id}" must define a manifest.`, {
                pluginId: ref.id,
            });
        }
        const manifestId = assertPluginIdentifier(manifest.id, 'Plugin manifest id');
        if (manifestId !== ref.id)
            throw new PluginIdentityConflictError(ref.id, manifestId);
        if (typeof manifest.version !== 'string' ||
            manifest.version.length > MAX_VERSION_LENGTH ||
            !isValidSemVer(manifest.version)) {
            throw new PluginManifestError(`Plugin "${ref.id}" has invalid implementation SemVer "${String(manifest.version)}".`, { pluginId: ref.id });
        }
        if (typeof manifest.apiVersion !== 'string' ||
            manifest.apiVersion.length > MAX_VERSION_LENGTH ||
            !isValidSemVer(manifest.apiVersion)) {
            throw new PluginManifestError(`Plugin "${ref.id}" has invalid API SemVer "${String(manifest.apiVersion)}".`, { pluginId: ref.id });
        }
        if (manifest.apiVersion !== ref.apiVersion) {
            throw new PluginApiVersionError(ref.id, ref.apiVersion, manifest.apiVersion);
        }
        if (typeof manifest.engine !== 'string' ||
            manifest.engine.length > MAX_VERSION_LENGTH ||
            !isValidSemVerRange(manifest.engine)) {
            throw new InvalidPluginDefinitionError(`Plugin "${ref.id}" has invalid engine SemVer range "${String(manifest.engine)}".`, ref.id);
        }
        if (!satisfiesSemVer(CORE_API_VERSION, manifest.engine)) {
            throw new PluginEngineVersionError(ref.id, manifest.engine, CORE_API_VERSION);
        }
        const requiresPlugins = freezePluginDependencies(ref.id, manifest.requiresPlugins);
        const requires = freezeRequirements(ref.id, manifest.requires, 'Plugin manifest requires');
        const optional = freezeRequirements(ref.id, manifest.optional, 'Plugin manifest optional');
        const capabilityIds = new Set();
        for (const requirement of [...(requires !== null && requires !== void 0 ? requires : []), ...(optional !== null && optional !== void 0 ? optional : [])]) {
            if (capabilityIds.has(requirement.token.id)) {
                throw new PluginManifestError(`Plugin "${ref.id}" declares capability "${requirement.token.id}" more than once.`, { pluginId: ref.id });
            }
            capabilityIds.add(requirement.token.id);
        }
        const permissions = freezePermissions(ref.id, manifest.permissions);
        return Object.freeze({
            id: manifestId,
            version: manifest.version,
            apiVersion: manifest.apiVersion,
            engine: manifest.engine,
            requiresPlugins,
            requires,
            optional,
            permissions,
        });
    }

    function validateProvider(token, implementation, providerPluginId, providerVersion, requiredPermission) {
        var _a, _b;
        if (!isCapabilityToken(token) || !isValidSemVer(token.version)) {
            throw new InvalidCapabilityVersionError((_a = token === null || token === void 0 ? void 0 : token.id) !== null && _a !== void 0 ? _a : 'unknown', (_b = token === null || token === void 0 ? void 0 : token.version) !== null && _b !== void 0 ? _b : '', 'version');
        }
        if (!isRuntimeIdentifier(providerPluginId)) {
            throw new InvalidPluginDefinitionError(`Capability provider id for "${token.id}" must match "namespace:kebab-case".`, providerPluginId);
        }
        if (!isValidSemVer(providerVersion)) {
            throw new InvalidCapabilityVersionError(token.id, providerVersion, 'version');
        }
        if (providerVersion !== token.version) {
            throw new CapabilityVersionError({
                capabilityId: token.id,
                expectedRange: token.version,
                actualVersion: providerVersion,
                providerPluginId,
            });
        }
        if (requiredPermission !== undefined && !isPluginPermission(requiredPermission)) {
            throw new InvalidPluginDefinitionError(`Capability "${token.id}" requires an unsupported Plugin permission.`, providerPluginId);
        }
        if (implementation === null || implementation === undefined) {
            throw new PluginCapabilityError({
                consumerPluginId: providerPluginId,
                capabilityId: token.id,
                requestedRange: token.version,
                installedVersion: token.version,
                providerPluginId,
                reason: 'incomplete',
            });
        }
    }
    class CapabilityRegistry {
        constructor(options = {}) {
            Object.defineProperty(this, "options", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: options
            });
            Object.defineProperty(this, "providers", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Map()
            });
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
        }
        provide(token, implementation, providerPluginId, requiredPermission) {
            const registration = this.providePending(token, implementation, providerPluginId, Symbol(`capability:${token.id}`), token.version, requiredPermission);
            registration.commit();
            return registration;
        }
        provideHost(token, implementation, providerPluginId = 'core:host', requiredPermission) {
            if (!isCapabilityToken(token)) {
                throw new InvalidPluginDefinitionError('Host capability must use createCapabilityToken().');
            }
            return this.provide(token, implementation, providerPluginId, requiredPermission);
        }
        providePending(token, implementation, providerPluginId, transactionId, providerVersion = token.version, requiredPermission) {
            this.assertActive('provide a capability');
            validateProvider(token, implementation, providerPluginId, providerVersion, requiredPermission);
            const existing = this.providers.get(token.id);
            if (existing) {
                const isSameTransaction = existing.providerPluginId === providerPluginId &&
                    existing.transactionId === transactionId &&
                    existing.version === providerVersion &&
                    existing.requiredPermission === requiredPermission &&
                    Object.is(existing.implementation, implementation);
                if (isSameTransaction) {
                    const noop = createNoopDisposable();
                    return {
                        commit: () => {
                            existing.complete = true;
                        },
                        dispose: () => noop.dispose(),
                    };
                }
                throw new CapabilityConflictError(token.id, existing.providerPluginId, providerPluginId);
            }
            const record = {
                token,
                version: providerVersion,
                requiredPermission,
                implementation,
                providerPluginId,
                transactionId,
                complete: false,
            };
            this.providers.set(token.id, record);
            const disposable = createDisposable(() => {
                if (this.providers.get(token.id) === record)
                    this.providers.delete(token.id);
            });
            return {
                commit: () => {
                    if (this.providers.get(token.id) === record)
                        record.complete = true;
                },
                dispose: () => disposable.dispose(),
            };
        }
        require(requirement, consumerPluginId) {
            const value = this.resolve(requirement, consumerPluginId, false);
            return value;
        }
        optional(requirement, consumerPluginId) {
            const value = this.resolve(requirement, consumerPluginId, true);
            return value;
        }
        requireDefinition(requirement, consumerPluginId, visibleTransactions) {
            return this.resolve(requirement, consumerPluginId, false, visibleTransactions);
        }
        optionalDefinition(requirement, consumerPluginId, visibleTransactions) {
            return this.resolve(requirement, consumerPluginId, true, visibleTransactions);
        }
        getProviderInfo(tokenOrId) {
            this.assertActive('inspect a capability provider');
            const id = typeof tokenOrId === 'string' ? tokenOrId : tokenOrId.id;
            if (!isRuntimeIdentifier(id)) {
                throw new InvalidPluginDefinitionError('Capability id must match "namespace:kebab-case".');
            }
            const record = this.providers.get(id);
            if (!record)
                return null;
            return Object.freeze({
                capabilityId: record.token.id,
                version: record.version,
                providerPluginId: record.providerPluginId,
                requiredPermission: record.requiredPermission,
                complete: record.complete,
            });
        }
        has(tokenOrId) {
            return this.getProviderInfo(tokenOrId) !== null;
        }
        getRequiredPermission(capabilityId, visibleTransactions) {
            this.assertActive('inspect a Capability permission');
            if (!isRuntimeIdentifier(capabilityId)) {
                throw new InvalidPluginDefinitionError('Capability id must match "namespace:kebab-case".');
            }
            const record = this.providers.get(capabilityId);
            if (!record)
                return undefined;
            if (!record.complete && !(visibleTransactions === null || visibleTransactions === void 0 ? void 0 : visibleTransactions.has(record.transactionId)))
                return undefined;
            return record.requiredPermission;
        }
        dispose() {
            if (this.disposed)
                return;
            this.providers.clear();
            this.disposed = true;
        }
        resolve(requirement, consumerPluginId, optional, visibleTransactions) {
            var _a, _b, _c;
            this.assertActive('resolve a capability');
            if (!isRuntimeIdentifier(consumerPluginId)) {
                throw new InvalidPluginDefinitionError('Capability consumer Plugin id must match "namespace:kebab-case".', consumerPluginId);
            }
            try {
                assertCapabilityRequirement(requirement);
            }
            catch (error) {
                throw new PluginCapabilityError({
                    consumerPluginId,
                    capabilityId: (_b = (_a = requirement === null || requirement === void 0 ? void 0 : requirement.token) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : 'unknown',
                    requestedRange: (_c = requirement === null || requirement === void 0 ? void 0 : requirement.range) !== null && _c !== void 0 ? _c : '',
                    reason: 'invalid-range',
                    cause: error,
                });
            }
            const record = this.providers.get(requirement.token.id);
            if (!record) {
                if (optional)
                    return null;
                throw new CapabilityMissingError({
                    consumerPluginId,
                    capabilityId: requirement.token.id,
                    requestedRange: requirement.range,
                    availableProviders: this.describeProviders(),
                });
            }
            if (!record.complete && !(visibleTransactions === null || visibleTransactions === void 0 ? void 0 : visibleTransactions.has(record.transactionId))) {
                if (optional)
                    return null;
                throw new PluginCapabilityError({
                    consumerPluginId,
                    capabilityId: requirement.token.id,
                    requestedRange: requirement.range,
                    installedVersion: record.version,
                    providerPluginId: record.providerPluginId,
                    reason: 'incomplete',
                });
            }
            if (!satisfiesSemVer(record.version, requirement.range)) {
                if (!optional) {
                    throw new CapabilityVersionError({
                        capabilityId: requirement.token.id,
                        expectedRange: requirement.range,
                        actualVersion: record.version,
                        providerPluginId: record.providerPluginId,
                        consumerPluginId,
                    });
                }
                reportWarningSafely(this.options.warningSink, this.options.errorSink, {
                    code: 'OPTIONAL_CAPABILITY_INCOMPATIBLE',
                    message: `Optional integration "${requirement.token.id}" was disabled for plugin "${consumerPluginId}" because installed version "${record.version}" does not satisfy "${requirement.range}".`,
                    pluginId: consumerPluginId,
                    details: {
                        capabilityId: requirement.token.id,
                        requestedRange: requirement.range,
                        installedVersion: record.version,
                        providerPluginId: record.providerPluginId,
                        optionalIntegrationDisabled: true,
                    },
                });
                return null;
            }
            return record.implementation;
        }
        describeProviders() {
            return Object.freeze([...this.providers.values()]
                .filter((record) => record.complete)
                .map((record) => `${record.token.id}@${record.version} (${record.providerPluginId})`)
                .sort());
        }
        assertActive(operation) {
            if (this.disposed)
                throw new PluginKernelDisposedError(operation);
        }
    }

    class CommittedEventBus {
        constructor(options = {}) {
            Object.defineProperty(this, "options", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: options
            });
            Object.defineProperty(this, "listeners", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Map()
            });
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
        }
        on(eventName, listener) {
            this.assertActive('register a committed event listener');
            this.assertEventName(eventName);
            let eventListeners = this.listeners.get(eventName);
            if (!eventListeners) {
                eventListeners = [];
                this.listeners.set(eventName, eventListeners);
            }
            const erasedListener = listener;
            eventListeners.push(erasedListener);
            return createDisposable(() => {
                const current = this.listeners.get(eventName);
                if (!current)
                    return;
                const index = current.indexOf(erasedListener);
                if (index >= 0)
                    current.splice(index, 1);
                if (current.length === 0)
                    this.listeners.delete(eventName);
            });
        }
        async emitCommitted(eventName, payload) {
            var _a, _b;
            this.assertActive('emit a committed event');
            this.assertEventName(eventName);
            const snapshot = [...((_a = this.listeners.get(eventName)) !== null && _a !== void 0 ? _a : [])];
            for (let index = 0; index < snapshot.length; index += 1) {
                try {
                    await ((_b = snapshot[index]) === null || _b === void 0 ? void 0 : _b.call(snapshot, payload));
                }
                catch (error) {
                    reportWarningSafely(this.options.warningSink, this.options.errorSink, {
                        code: 'COMMITTED_EVENT_LISTENER_FAILED',
                        message: `Committed event listener ${index} for "${eventName}" failed; remaining listeners continued.`,
                        cause: error,
                        details: { eventName, listenerIndex: index },
                    });
                }
            }
        }
        listenerCount(eventName) {
            var _a, _b;
            this.assertActive('inspect committed event listeners');
            if (eventName) {
                this.assertEventName(eventName);
                return (_b = (_a = this.listeners.get(eventName)) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
            }
            let count = 0;
            for (const listeners of this.listeners.values())
                count += listeners.length;
            return count;
        }
        dispose() {
            if (this.disposed)
                return;
            this.listeners.clear();
            this.disposed = true;
        }
        assertActive(operation) {
            if (this.disposed)
                throw new PluginKernelDisposedError(operation);
        }
        assertEventName(eventName) {
            if (!isRuntimeIdentifier(eventName)) {
                throw new InvalidPluginDefinitionError('Committed event name must match "namespace:kebab-case".');
            }
        }
    }

    const OPERATION_MODES = ['read', 'busy', 'animation', 'mutation'];
    const REENTRANCY_POLICIES = [
        'reject',
        'queue',
        'replace',
        'coalesce',
    ];
    const CONFLICT_DOMAINS = [
        'document',
        'base-image',
        'geometry',
        'raster',
        'overlay',
        'selection',
        'tool',
        'export',
        'state',
        'image-decode',
    ];
    function abortError$3(message) {
        return new DOMException(message, 'AbortError');
    }
    function abortReason(signal, fallback) {
        var _a;
        return (_a = signal.reason) !== null && _a !== void 0 ? _a : abortError$3(fallback);
    }
    function domainsOverlap(first, second) {
        return first.some((domain) => second.includes(domain));
    }
    function definitionsConflict(first, second) {
        if (first.mode === 'read' && second.mode === 'read')
            return false;
        return domainsOverlap(first.conflictDomains, second.conflictDomains);
    }
    class OperationRegistry {
        constructor() {
            Object.defineProperty(this, "operations", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Map()
            });
            Object.defineProperty(this, "activeOperations", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Set()
            });
            Object.defineProperty(this, "executingRequests", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Set()
            });
            Object.defineProperty(this, "idleWaiters", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Set()
            });
            Object.defineProperty(this, "pendingRequests", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: []
            });
            Object.defineProperty(this, "suspendedReason", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: null
            });
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
        }
        register(definition, ownerPluginId) {
            this.assertActive('register an operation');
            this.validateDefinition(definition, ownerPluginId);
            const existing = this.operations.get(definition.id);
            if (existing) {
                throw new OperationRegistrationError(`Operation "${definition.id}" is already registered by "${existing.ownerPluginId}".`, ownerPluginId);
            }
            const frozenDefinition = Object.freeze({
                ...definition,
                conflictDomains: Object.freeze([...definition.conflictDomains]),
                allowedDuringTool: definition.allowedDuringTool
                    ? Object.freeze([...definition.allowedDuringTool])
                    : undefined,
            });
            const record = { definition: frozenDefinition, ownerPluginId };
            this.operations.set(definition.id, record);
            return createDisposable(() => {
                if (this.operations.get(definition.id) !== record)
                    return;
                const reason = abortError$3(`Operation "${definition.id}" was unregistered.`);
                for (const active of [...this.activeOperations]) {
                    if (active.record === record)
                        this.retireActive(active, reason);
                }
                this.rejectPending((request) => request.record === record, reason);
                this.operations.delete(definition.id);
                this.drainPending();
            });
        }
        begin(operationId, ownerPluginId) {
            this.assertActive('begin an operation');
            if (this.suspendedReason !== null)
                throw this.suspendedReason;
            const record = this.requireOwned(operationId, ownerPluginId);
            const conflicts = this.findConflicts(record, undefined);
            if (conflicts.length > 0) {
                throw this.conflictError(record, conflicts[0].record, ownerPluginId);
            }
            const active = this.createActive(record, undefined, null);
            this.activeOperations.add(active);
            return active.token;
        }
        run(operationId, ownerPluginId, args, task, options = {}) {
            var _a;
            this.assertActive('run an operation');
            if (this.suspendedReason !== null)
                return Promise.reject(this.suspendedReason);
            const record = this.requireOwned(operationId, ownerPluginId);
            this.validateParent(options.parent);
            if ((_a = options.signal) === null || _a === void 0 ? void 0 : _a.aborted) {
                return Promise.reject(abortReason(options.signal, `Operation "${operationId}" was aborted.`));
            }
            const existingPending = this.findCoalesciblePending(record, options.parent);
            if (record.definition.reentrancy === 'coalesce' && existingPending) {
                const coalesce = record.definition.coalesce;
                if (!coalesce) {
                    return Promise.reject(new OperationRegistrationError(`Operation "${operationId}" has no coalesce function.`, ownerPluginId));
                }
                existingPending.args = coalesce(existingPending.args, args);
                return new Promise((resolve, reject) => {
                    existingPending.waiters.push({ resolve, reject });
                });
            }
            const request = {
                record,
                args,
                task,
                options,
                waiters: [],
                active: null,
                state: 'pending',
                removeExternalAbortListener: null,
            };
            const result = new Promise((resolve, reject) => {
                request.waiters.push({ resolve, reject });
            });
            this.attachExternalAbort(request);
            this.schedule(request);
            return result;
        }
        beginForHost(operationId) {
            this.assertActive('begin an operation');
            const registered = this.requireRegistered(operationId, 'core:host');
            return this.begin(operationId, registered.ownerPluginId);
        }
        runForHost(operationId, args, task, options = {}) {
            const registered = this.requireRegistered(operationId, 'core:host');
            return this.run(operationId, registered.ownerPluginId, args, task, options);
        }
        has(operationId) {
            this.assertActive('inspect an operation');
            return this.operations.has(operationId);
        }
        get(operationId) {
            var _a, _b;
            this.assertActive('inspect an operation');
            return (_b = (_a = this.operations.get(operationId)) === null || _a === void 0 ? void 0 : _a.definition) !== null && _b !== void 0 ? _b : null;
        }
        isActive(operationId) {
            this.assertActive('inspect operation state');
            if (!operationId)
                return this.activeOperations.size > 0;
            return [...this.activeOperations].some((active) => active.record.definition.id === operationId);
        }
        waitForIdle() {
            if (this.isIdle())
                return Promise.resolve();
            return new Promise((resolve) => this.idleWaiters.add(resolve));
        }
        async abortAll(reason = abortError$3('All Plugin Kernel operations were aborted.')) {
            this.assertActive('abort operations');
            this.rejectPending(() => true, reason);
            for (const active of [...this.activeOperations]) {
                if (active.request)
                    this.abortActive(active, reason);
                else
                    this.retireActive(active, reason);
            }
            await Promise.allSettled([...this.executingRequests]);
            this.resolveIdleWaiters();
        }
        suspend(reason) {
            this.assertActive('suspend operations');
            this.suspendedReason = reason;
            return this.abortAll(reason);
        }
        dispose() {
            if (this.disposed)
                return;
            const reason = abortError$3('Operation Registry was disposed.');
            this.rejectPending(() => true, reason);
            for (const active of [...this.activeOperations])
                this.retireActive(active, reason);
            this.operations.clear();
            this.suspendedReason = null;
            this.disposed = true;
            this.resolveIdleWaiters();
        }
        schedule(request) {
            var _a, _b;
            if (request.state !== 'pending')
                return;
            const conflicts = this.findConflicts(request.record, request.options.parent);
            const sameOperationActive = conflicts.filter((active) => active.record.definition.id === request.record.definition.id);
            const policy = request.record.definition.reentrancy;
            if (policy === 'replace' && sameOperationActive.length > 0) {
                const reason = abortError$3(`Operation "${request.record.definition.id}" was replaced by a newer request.`);
                for (const active of sameOperationActive)
                    this.retireActive(active, reason);
                this.rejectPending((pending) => pending.record === request.record, reason);
            }
            else if (conflicts.length > 0 && policy === 'reject') {
                this.rejectRequest(request, this.conflictError(request.record, conflicts[0].record, request.record.ownerPluginId));
                (_a = request.removeExternalAbortListener) === null || _a === void 0 ? void 0 : _a.call(request);
                request.removeExternalAbortListener = null;
                request.state = 'settled';
                this.resolveIdleWaiters();
                return;
            }
            else if (conflicts.length > 0 && policy === 'replace') {
                this.rejectRequest(request, this.conflictError(request.record, conflicts[0].record, request.record.ownerPluginId));
                (_b = request.removeExternalAbortListener) === null || _b === void 0 ? void 0 : _b.call(request);
                request.removeExternalAbortListener = null;
                request.state = 'settled';
                this.resolveIdleWaiters();
                return;
            }
            if (this.findConflicts(request.record, request.options.parent).length === 0) {
                this.startRequest(request);
            }
            else {
                this.pendingRequests.push(request);
            }
        }
        startRequest(request) {
            if (request.state !== 'pending')
                return;
            const active = this.createActive(request.record, request.options.parent, request);
            request.active = active;
            request.state = 'active';
            this.activeOperations.add(active);
            const context = Object.freeze({
                signal: active.controller.signal,
                token: active.token,
                topLevel: active.token.topLevel,
                ownsHistory: active.token.ownsHistory,
            });
            let output;
            try {
                output = request.task(request.args, context);
            }
            catch (error) {
                output = Promise.reject(error);
            }
            const execution = Promise.resolve(output).then((value) => ({ status: 'fulfilled', value }), (error) => ({ status: 'rejected', error }));
            const tracked = execution
                .then((outcome) => {
                this.finishRequest(request);
                if (outcome.status === 'rejected') {
                    this.rejectRequest(request, outcome.error);
                }
                else if (active.controller.signal.aborted) {
                    this.rejectRequest(request, abortReason(active.controller.signal, `Operation "${active.token.id}" was aborted.`));
                }
                else {
                    this.resolveRequest(request, outcome.value);
                }
            })
                .finally(() => {
                this.executingRequests.delete(tracked);
                this.resolveIdleWaiters();
            });
            this.executingRequests.add(tracked);
            void tracked.catch(() => undefined);
        }
        finishRequest(request) {
            var _a;
            const active = request.active;
            if (active) {
                this.activeOperations.delete(active);
                active.deactivate();
            }
            (_a = request.removeExternalAbortListener) === null || _a === void 0 ? void 0 : _a.call(request);
            request.removeExternalAbortListener = null;
            request.state = 'settled';
            this.drainPending();
            this.resolveIdleWaiters();
        }
        drainPending() {
            if (this.disposed)
                return;
            let started = true;
            while (started) {
                started = false;
                for (let index = 0; index < this.pendingRequests.length; index += 1) {
                    const request = this.pendingRequests[index];
                    if (this.findConflicts(request.record, request.options.parent).length > 0)
                        continue;
                    this.pendingRequests.splice(index, 1);
                    this.startRequest(request);
                    started = true;
                    break;
                }
            }
        }
        createActive(record, parent, request) {
            var _a;
            const controller = new AbortController();
            let active = true;
            const activeReference = { current: null };
            const token = Object.freeze({
                id: record.definition.id,
                ownerPluginId: record.ownerPluginId,
                parentId: (_a = parent === null || parent === void 0 ? void 0 : parent.id) !== null && _a !== void 0 ? _a : null,
                topLevel: parent === undefined,
                ownsHistory: parent === undefined,
                signal: controller.signal,
                get active() {
                    return active;
                },
                dispose: () => {
                    const entry = activeReference.current;
                    if (!active || !entry)
                        return;
                    this.retireActive(entry, abortError$3(`Operation "${record.definition.id}" was cancelled.`));
                    this.drainPending();
                    this.resolveIdleWaiters();
                },
            });
            const entry = {
                record,
                controller,
                token,
                deactivate: () => {
                    active = false;
                },
                request,
            };
            activeReference.current = entry;
            return entry;
        }
        retireActive(active, reason) {
            if (!active.token.active)
                return;
            this.activeOperations.delete(active);
            active.deactivate();
            active.controller.abort(reason);
            if (active.request && active.request.state === 'active') {
                active.request.state = 'retired';
            }
        }
        abortActive(active, reason) {
            if (!active.token.active || active.controller.signal.aborted)
                return;
            active.controller.abort(reason);
        }
        findConflicts(record, parent) {
            return [...this.activeOperations].filter((active) => {
                if (parent && active.token === parent)
                    return false;
                return definitionsConflict(record.definition, active.record.definition);
            });
        }
        findCoalesciblePending(record, parent) {
            return this.pendingRequests.find((request) => request.record === record && request.options.parent === parent);
        }
        attachExternalAbort(request) {
            var _a;
            const signals = [
                ...new Set([request.options.signal, (_a = request.options.parent) === null || _a === void 0 ? void 0 : _a.signal]),
            ].filter((signal) => signal !== undefined);
            if (signals.length === 0)
                return;
            const abort = () => {
                const signal = signals.find((candidate) => candidate.aborted);
                const reason = signal
                    ? abortReason(signal, `Operation "${request.record.definition.id}" was aborted.`)
                    : abortError$3(`Operation "${request.record.definition.id}" was aborted.`);
                if (request.state === 'pending') {
                    this.pendingRequests = this.pendingRequests.filter((entry) => entry !== request);
                    this.rejectRequest(request, reason);
                    request.state = 'settled';
                }
                else if (request.active) {
                    this.abortActive(request.active, reason);
                }
                this.drainPending();
                this.resolveIdleWaiters();
            };
            for (const signal of signals)
                signal.addEventListener('abort', abort, { once: true });
            request.removeExternalAbortListener = () => {
                for (const signal of signals)
                    signal.removeEventListener('abort', abort);
            };
            if (signals.some((signal) => signal.aborted))
                abort();
        }
        rejectPending(predicate, reason) {
            var _a;
            const retained = [];
            for (const request of this.pendingRequests) {
                if (!predicate(request)) {
                    retained.push(request);
                    continue;
                }
                this.rejectRequest(request, reason);
                (_a = request.removeExternalAbortListener) === null || _a === void 0 ? void 0 : _a.call(request);
                request.state = 'settled';
            }
            this.pendingRequests = retained;
            this.resolveIdleWaiters();
        }
        resolveRequest(request, value) {
            for (const waiter of request.waiters)
                waiter.resolve(value);
            request.waiters.length = 0;
        }
        rejectRequest(request, error) {
            for (const waiter of request.waiters)
                waiter.reject(error);
            request.waiters.length = 0;
        }
        requireRegistered(operationId, ownerPluginId) {
            this.assertActive('access an operation');
            const registered = this.operations.get(operationId);
            if (!registered) {
                throw new OperationConflictError(`Operation "${operationId}" is not registered.`, ownerPluginId);
            }
            return registered;
        }
        requireOwned(operationId, ownerPluginId) {
            const registered = this.requireRegistered(operationId, ownerPluginId);
            if (registered.ownerPluginId !== ownerPluginId) {
                throw new OperationConflictError(`Operation "${operationId}" belongs to "${registered.ownerPluginId}", not "${ownerPluginId}".`, ownerPluginId);
            }
            return registered;
        }
        validateParent(parent) {
            if (!parent)
                return;
            if (!parent.active ||
                parent.signal.aborted ||
                ![...this.activeOperations].some((active) => active.token === parent)) {
                throw new OperationConflictError(`Parent operation "${parent.id}" is not active.`, parent.ownerPluginId);
            }
        }
        validateDefinition(definition, ownerPluginId) {
            if (!isRuntimeIdentifier(ownerPluginId)) {
                throw new OperationRegistrationError('Operation owner Plugin id must match "namespace:kebab-case".', ownerPluginId);
            }
            if (!isRuntimeIdentifier(definition.id)) {
                throw new OperationRegistrationError('Operation id must match "namespace:kebab-case".', ownerPluginId);
            }
            if (!OPERATION_MODES.includes(definition.mode)) {
                throw new OperationRegistrationError(`Operation "${definition.id}" has invalid mode "${definition.mode}".`, ownerPluginId);
            }
            if (!REENTRANCY_POLICIES.includes(definition.reentrancy)) {
                throw new OperationRegistrationError(`Operation "${definition.id}" has invalid reentrancy policy.`, ownerPluginId);
            }
            if (!Array.isArray(definition.conflictDomains) ||
                definition.conflictDomains.length === 0 ||
                definition.conflictDomains.some((domain) => !CONFLICT_DOMAINS.includes(domain)) ||
                new Set(definition.conflictDomains).size !== definition.conflictDomains.length) {
                throw new OperationRegistrationError(`Operation "${definition.id}" has invalid conflict domains.`, ownerPluginId);
            }
            if (definition.reentrancy === 'coalesce' && typeof definition.coalesce !== 'function') {
                throw new OperationRegistrationError(`Operation "${definition.id}" must define coalesce().`, ownerPluginId);
            }
            if (definition.allowedDuringTool !== undefined &&
                (!Array.isArray(definition.allowedDuringTool) ||
                    definition.allowedDuringTool.some((toolId) => !isRuntimeIdentifier(toolId)) ||
                    new Set(definition.allowedDuringTool).size !== definition.allowedDuringTool.length)) {
                throw new OperationRegistrationError(`Operation "${definition.id}" has invalid allowed Tool ids.`, ownerPluginId);
            }
        }
        conflictError(requested, active, ownerPluginId) {
            return new OperationConflictError(`Operation "${requested.definition.id}" conflicts with active operation "${active.definition.id}" in domain(s) ${requested.definition.conflictDomains
            .filter((domain) => active.definition.conflictDomains.includes(domain))
            .join(', ')}.`, ownerPluginId);
        }
        isIdle() {
            return (this.activeOperations.size === 0 &&
                this.pendingRequests.length === 0 &&
                this.executingRequests.size === 0);
        }
        resolveIdleWaiters() {
            if (!this.isIdle())
                return;
            for (const resolve of this.idleWaiters)
                resolve();
            this.idleWaiters.clear();
        }
        assertActive(operation) {
            if (this.disposed)
                throw new PluginKernelDisposedError(operation);
        }
    }

    function assertStateKey(key) {
        if (key.trim().length === 0 || key.trim() !== key) {
            throw new InvalidPluginDefinitionError('Plugin state keys must be non-empty trimmed strings.');
        }
    }
    class PluginStateStore {
        constructor() {
            Object.defineProperty(this, "stateByPlugin", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Map()
            });
            Object.defineProperty(this, "activePluginIds", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Set()
            });
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
        }
        createScoped(pluginId, registerCleanup, registerFinalizer, isScopeActive) {
            this.assertActive('create plugin state');
            assertPluginIdentifier(pluginId, 'Plugin state owner id');
            if (this.activePluginIds.has(pluginId)) {
                throw new InvalidPluginDefinitionError(`Plugin state scope "${pluginId}" is already active.`, pluginId);
            }
            this.activePluginIds.add(pluginId);
            let active = true;
            let cleanupRegistered = false;
            const cleanup = createDisposable(() => {
                this.stateByPlugin.delete(pluginId);
            });
            try {
                registerFinalizer(createDisposable(() => {
                    this.stateByPlugin.delete(pluginId);
                    this.activePluginIds.delete(pluginId);
                    active = false;
                }));
            }
            catch (error) {
                this.activePluginIds.delete(pluginId);
                throw error;
            }
            const assertScopedActive = () => {
                this.assertActive('access plugin state');
                if (!active || !isScopeActive()) {
                    throw new PluginKernelDisposedError(`access state for plugin "${pluginId}"`);
                }
            };
            const activate = () => {
                assertScopedActive();
                if (!cleanupRegistered) {
                    registerCleanup(cleanup);
                    cleanupRegistered = true;
                }
                let namespace = this.stateByPlugin.get(pluginId);
                if (!namespace) {
                    namespace = new Map();
                    this.stateByPlugin.set(pluginId, namespace);
                }
                return namespace;
            };
            return Object.freeze({
                has: (key) => {
                    var _a, _b;
                    assertStateKey(key);
                    assertScopedActive();
                    return (_b = (_a = this.stateByPlugin.get(pluginId)) === null || _a === void 0 ? void 0 : _a.has(key)) !== null && _b !== void 0 ? _b : false;
                },
                get: (key) => {
                    var _a;
                    assertStateKey(key);
                    assertScopedActive();
                    return (_a = this.stateByPlugin.get(pluginId)) === null || _a === void 0 ? void 0 : _a.get(key);
                },
                set: (key, value) => {
                    assertStateKey(key);
                    activate().set(key, value);
                },
                delete: (key) => {
                    var _a, _b;
                    assertStateKey(key);
                    assertScopedActive();
                    return (_b = (_a = this.stateByPlugin.get(pluginId)) === null || _a === void 0 ? void 0 : _a.delete(key)) !== null && _b !== void 0 ? _b : false;
                },
                clear: () => {
                    var _a;
                    assertScopedActive();
                    (_a = this.stateByPlugin.get(pluginId)) === null || _a === void 0 ? void 0 : _a.clear();
                },
            });
        }
        hasPluginState(pluginId) {
            this.assertActive('inspect plugin state');
            return this.stateByPlugin.has(pluginId);
        }
        dispose() {
            if (this.disposed)
                return;
            this.stateByPlugin.clear();
            this.activePluginIds.clear();
            this.disposed = true;
        }
        assertActive(operation) {
            if (this.disposed)
                throw new PluginKernelDisposedError(operation);
        }
    }

    class RegistrationScope {
        constructor(pluginId, options = {}) {
            Object.defineProperty(this, "pluginId", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: pluginId
            });
            Object.defineProperty(this, "options", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: options
            });
            Object.defineProperty(this, "transactionId", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: void 0
            });
            Object.defineProperty(this, "entries", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: []
            });
            Object.defineProperty(this, "finalizers", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: []
            });
            Object.defineProperty(this, "state", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'open'
            });
            assertPluginIdentifier(pluginId, 'RegistrationScope Plugin id');
            this.transactionId = Symbol(`plugin-install:${pluginId}`);
        }
        get active() {
            return this.state !== 'disposed';
        }
        assertOpen(operation = 'register installation resources') {
            if (this.state !== 'open') {
                throw new PluginKernelStateError(operation, `registration-scope:${this.state}`);
            }
        }
        add(disposable) {
            this.assertOpen();
            this.entries.push({ disposable, rollbackOnly: false });
            return disposable;
        }
        addRollback(disposable) {
            this.assertOpen();
            this.entries.push({ disposable, rollbackOnly: true });
            return disposable;
        }
        addFinalizer(disposable) {
            this.assertOpen();
            this.finalizers.push(disposable);
            return disposable;
        }
        addCleanup(cleanup) {
            return this.add(createDisposable(cleanup));
        }
        commit() {
            var _a;
            this.assertOpen('commit plugin installation');
            for (const entry of this.entries) {
                if (!entry.rollbackOnly && 'commit' in entry.disposable) {
                    entry.disposable.commit();
                }
            }
            for (let index = this.entries.length - 1; index >= 0; index -= 1) {
                if ((_a = this.entries[index]) === null || _a === void 0 ? void 0 : _a.rollbackOnly)
                    this.entries.splice(index, 1);
            }
            this.state = 'committed';
        }
        async rollback() {
            if (this.state === 'disposed')
                return [];
            const errors = [
                ...(await disposeInReverse(this.entries.map((entry) => entry.disposable), { pluginId: this.pluginId, ...this.options })),
                ...(await disposeInReverse(this.finalizers, {
                    pluginId: this.pluginId,
                    ...this.options,
                })),
            ];
            this.entries.length = 0;
            this.finalizers.length = 0;
            this.state = 'disposed';
            return errors;
        }
        rollbackSync() {
            if (this.state === 'disposed')
                return Object.freeze([]);
            const errors = [
                ...disposeInReverseSync(this.entries.map((entry) => entry.disposable), { pluginId: this.pluginId, ...this.options }),
                ...disposeInReverseSync(this.finalizers, {
                    pluginId: this.pluginId,
                    ...this.options,
                }),
            ];
            this.entries.length = 0;
            this.finalizers.length = 0;
            this.state = 'disposed';
            return Object.freeze(errors);
        }
        async dispose() {
            if (this.state === 'disposed')
                return;
            const errors = [
                ...(await disposeInReverse(this.entries.map((entry) => entry.disposable), { pluginId: this.pluginId, ...this.options })),
                ...(await disposeInReverse(this.finalizers, {
                    pluginId: this.pluginId,
                    ...this.options,
                })),
            ];
            this.entries.length = 0;
            this.finalizers.length = 0;
            this.state = 'disposed';
            if (errors.length > 0) {
                throw new PluginAggregateError(`[ImageEditor] Plugin "${this.pluginId}" cleanup failed.`, errors, { pluginId: this.pluginId });
            }
        }
        disposeSync() {
            if (this.state === 'disposed')
                return;
            const errors = this.rollbackSync();
            if (errors.length > 0) {
                throw new PluginAggregateError(`[ImageEditor] Plugin "${this.pluginId}" synchronous cleanup failed.`, errors, { pluginId: this.pluginId });
            }
        }
    }

    class ToolCoordinator {
        constructor(options = {}) {
            Object.defineProperty(this, "options", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: options
            });
            Object.defineProperty(this, "tools", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Map()
            });
            Object.defineProperty(this, "active", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: null
            });
            Object.defineProperty(this, "transitioning", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
        }
        register(definition, ownerPluginId) {
            this.assertActive('register a tool');
            if (!isRuntimeIdentifier(ownerPluginId)) {
                throw new ToolRegistrationError('Tool owner Plugin id must match "namespace:kebab-case".', ownerPluginId);
            }
            if (!isRuntimeIdentifier(definition.id)) {
                throw new ToolRegistrationError('Tool id must match "namespace:kebab-case".', ownerPluginId);
            }
            const existing = this.tools.get(definition.id);
            if (existing) {
                throw new ToolRegistrationError(`Tool "${definition.id}" is already registered by "${existing.ownerPluginId}".`, ownerPluginId);
            }
            const record = {
                definition,
                ownerPluginId,
                context: Object.freeze({ toolId: definition.id, ownerPluginId }),
            };
            this.tools.set(definition.id, record);
            return createDisposable(() => {
                if (this.active === record) {
                    return this.exitCurrent('plugin-dispose').finally(() => {
                        if (this.tools.get(definition.id) === record)
                            this.tools.delete(definition.id);
                    });
                }
                if (this.tools.get(definition.id) === record)
                    this.tools.delete(definition.id);
                return undefined;
            });
        }
        disposeSync() {
            if (this.disposed)
                return;
            let exitError;
            try {
                const current = this.active;
                this.active = null;
                if (current) {
                    const result = current.definition.exit('host-dispose', current.context);
                    if (isPromiseLike(result)) {
                        void Promise.resolve(result).catch((error) => {
                            reportErrorSafely(this.options.errorSink, error);
                        });
                        throw new ToolTransitionError(current.definition.id, 'returned a Promise during synchronous host disposal', current.ownerPluginId);
                    }
                }
            }
            catch (error) {
                exitError = error;
            }
            finally {
                this.active = null;
                this.tools.clear();
                this.disposed = true;
            }
            if (exitError)
                throw exitError;
        }
        async enter(toolId, requesterPluginId) {
            this.assertActive('enter a tool');
            const next = this.tools.get(toolId);
            if (!next)
                throw new ToolTransitionError(toolId, 'is not registered', requesterPluginId);
            if (requesterPluginId && requesterPluginId !== next.ownerPluginId) {
                throw new ToolTransitionError(toolId, `belongs to "${next.ownerPluginId}", not "${requesterPluginId}"`, requesterPluginId);
            }
            if (this.active === next)
                return;
            await this.runTransition(toolId, async () => {
                if (this.active)
                    await this.exitCurrent('switch');
                try {
                    await next.definition.enter(next.context);
                    this.active = next;
                }
                catch (error) {
                    this.active = null;
                    const transitionError = new ToolTransitionError(toolId, 'failed to enter', next.ownerPluginId, error);
                    reportErrorSafely(this.options.errorSink, transitionError);
                    throw transitionError;
                }
            });
        }
        async exit(reason = 'requested') {
            this.assertActive('exit a tool');
            if (!this.active)
                return;
            await this.runTransition(this.active.definition.id, () => this.exitCurrent(reason));
        }
        getActiveToolId() {
            var _a, _b;
            this.assertActive('inspect active tool state');
            return (_b = (_a = this.active) === null || _a === void 0 ? void 0 : _a.definition.id) !== null && _b !== void 0 ? _b : null;
        }
        canRunOperation(operationId) {
            var _a;
            this.assertActive('check tool operation policy');
            if (!((_a = this.active) === null || _a === void 0 ? void 0 : _a.definition.canRunOperation))
                return true;
            try {
                return this.active.definition.canRunOperation(operationId);
            }
            catch (error) {
                const transitionError = new ToolTransitionError(this.active.definition.id, `operation policy failed for "${operationId}"`, this.active.ownerPluginId, error);
                reportErrorSafely(this.options.errorSink, transitionError);
                return false;
            }
        }
        async dispose() {
            if (this.disposed)
                return;
            let exitError;
            try {
                if (this.active)
                    await this.exitCurrent('host-dispose');
            }
            catch (error) {
                exitError = error;
            }
            finally {
                this.active = null;
                this.tools.clear();
                this.disposed = true;
            }
            if (exitError)
                throw exitError;
        }
        async exitCurrent(reason) {
            const current = this.active;
            if (!current)
                return;
            this.active = null;
            try {
                await current.definition.exit(reason, current.context);
            }
            catch (error) {
                const transitionError = new ToolTransitionError(current.definition.id, `failed to exit for reason "${reason}"`, current.ownerPluginId, error);
                reportErrorSafely(this.options.errorSink, transitionError);
                throw transitionError;
            }
        }
        async runTransition(toolId, task) {
            if (this.transitioning) {
                throw new ToolTransitionError(toolId, 'cannot transition while another transition is active');
            }
            this.transitioning = true;
            try {
                await task();
            }
            finally {
                this.transitioning = false;
            }
        }
        assertActive(operation) {
            if (this.disposed)
                throw new PluginKernelDisposedError(operation);
        }
    }

    function isPluginApi(value) {
        return (typeof value === 'object' && value !== null) || typeof value === 'function';
    }
    function sameArray(left, right, equal) {
        if (left === undefined || right === undefined)
            return left === right;
        return (left.length === right.length &&
            left.every((leftValue, index) => equal(leftValue, right[index])));
    }
    function sameInstallationDefinition(left, right) {
        return (left.ref === right.ref &&
            left.manifest.id === right.manifest.id &&
            left.manifest.version === right.manifest.version &&
            left.manifest.apiVersion === right.manifest.apiVersion &&
            left.manifest.engine === right.manifest.engine &&
            sameArray(left.manifest.requiresPlugins, right.manifest.requiresPlugins, (leftRef, rightRef) => leftRef === rightRef) &&
            sameArray(left.manifest.requires, right.manifest.requires, (leftRequirement, rightRequirement) => leftRequirement.token === rightRequirement.token &&
                leftRequirement.range === rightRequirement.range) &&
            sameArray(left.manifest.optional, right.manifest.optional, (leftRequirement, rightRequirement) => leftRequirement.token === rightRequirement.token &&
                leftRequirement.range === rightRequirement.range) &&
            sameArray(left.manifest.permissions, right.manifest.permissions, (leftPermission, rightPermission) => leftPermission === rightPermission) &&
            left.setupMode === right.setupMode &&
            left.setup === right.setup &&
            left.onInit === right.onInit &&
            left.onImageLoaded === right.onImageLoaded &&
            left.onImageCleared === right.onImageCleared &&
            left.onDispose === right.onDispose);
    }
    const pluginPackageHints = new Map([
        ['foundation:overlay', '@bensitu/image-editor/plugins/overlay'],
        ['plugin:transform', '@bensitu/image-editor/plugins/transform'],
        ['plugin:mask', '@bensitu/image-editor/plugins/mask'],
        ['plugin:history', '@bensitu/image-editor/plugins/history'],
        ['plugin:filters', '@bensitu/image-editor/plugins/filters'],
    ]);
    class PluginManager {
        constructor(options = {}) {
            var _a;
            Object.defineProperty(this, "options", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: options
            });
            Object.defineProperty(this, "operationRegistry", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new OperationRegistry()
            });
            Object.defineProperty(this, "stateStore", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new PluginStateStore()
            });
            Object.defineProperty(this, "installed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Map()
            });
            Object.defineProperty(this, "installationOrder", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: []
            });
            Object.defineProperty(this, "hostState", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'created'
            });
            Object.defineProperty(this, "topLevelInstallActive", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
            Object.defineProperty(this, "disposePromise", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: null
            });
            this.capabilityRegistry = new CapabilityRegistry(options);
            this.toolCoordinator = new ToolCoordinator({ errorSink: options.errorSink });
            this.eventBus = new CommittedEventBus(options);
            for (const provider of (_a = options.hostCapabilities) !== null && _a !== void 0 ? _a : []) {
                this.capabilityRegistry.provideHost(provider.token, provider.implementation, provider.providerId, provider.requiredPermission);
            }
        }
        get state() {
            return this.hostState;
        }
        async install(plugin) {
            this.assertCanInstall();
            if (this.topLevelInstallActive) {
                throw new PluginKernelStateError('start a concurrent plugin installation', this.hostState);
            }
            this.topLevelInstallActive = true;
            try {
                const outcome = await this.performInstall(plugin, 'strict', []);
                return outcome.api;
            }
            finally {
                this.topLevelInstallActive = false;
            }
        }
        installSync(plugin) {
            this.assertCanInstall();
            if (this.topLevelInstallActive) {
                throw new PluginKernelStateError('start a concurrent plugin installation', this.hostState);
            }
            this.topLevelInstallActive = true;
            try {
                const outcome = this.performInstallSync(plugin, 'strict', []);
                return outcome.api;
            }
            finally {
                this.topLevelInstallActive = false;
            }
        }
        installBatchSync(plugins) {
            this.assertCanInstall();
            if (this.topLevelInstallActive) {
                throw new PluginKernelStateError('start a concurrent plugin installation', this.hostState);
            }
            this.topLevelInstallActive = true;
            try {
                const prepared = this.prepareBatch(plugins);
                const visibleTransactions = new Set();
                const pendingRecords = [];
                try {
                    for (const entry of prepared.ordered) {
                        const record = this.performPendingInstallSync(entry.plugin, visibleTransactions);
                        pendingRecords.push(record);
                        prepared.apisByPluginId.set(entry.plugin.ref.id, record.api);
                    }
                    for (const record of pendingRecords)
                        record.scope.commit();
                    for (const record of pendingRecords) {
                        const pluginId = record.plugin.ref.id;
                        this.installed.set(pluginId, record);
                        this.installationOrder.push(pluginId);
                    }
                }
                catch (cause) {
                    const cleanupErrors = [
                        ...(cause instanceof PluginSetupError ? cause.cleanupErrors : []),
                        ...this.rollbackPendingBatchSync(pendingRecords),
                    ];
                    throw new PluginBatchInstallError(cause, cleanupErrors);
                }
                return Object.freeze({
                    apisByPluginId: prepared.apisByPluginId,
                    installedPlugins: Object.freeze(pendingRecords.map((record) => record.plugin)),
                });
            }
            finally {
                this.topLevelInstallActive = false;
            }
        }
        get(ref) {
            this.assertUsable('query a plugin');
            const record = this.installed.get(ref.id);
            if (!record || record.refObject !== ref)
                return null;
            return record.api;
        }
        require(ref) {
            const api = this.get(ref);
            if (api === null)
                throw new PluginNotInstalledError(ref.id);
            return api;
        }
        getById(pluginId) {
            var _a, _b;
            this.assertUsable('query a plugin by id');
            return (_b = (_a = this.installed.get(pluginId)) === null || _a === void 0 ? void 0 : _a.api) !== null && _b !== void 0 ? _b : null;
        }
        has(refOrId) {
            this.assertUsable('inspect installed plugins');
            if (typeof refOrId === 'string')
                return this.installed.has(refOrId);
            const record = this.installed.get(refOrId.id);
            return (record === null || record === void 0 ? void 0 : record.refObject) === refOrId;
        }
        hasOperation(operationId) {
            return this.operationRegistry.has(operationId);
        }
        getOperationForHost(operationId) {
            return this.operationRegistry.get(operationId);
        }
        registerHostOperation(definition) {
            this.assertCanInstall();
            return this.operationRegistry.register(definition, 'core:host');
        }
        beginOperationForHost(operationId) {
            if (!this.toolCoordinator.canRunOperation(operationId)) {
                throw new PluginKernelStateError(`run operation "${operationId}" while the active tool rejects it`, this.hostState);
            }
            return this.operationRegistry.beginForHost(operationId);
        }
        runOperationForHost(operationId, args, task, options = {}) {
            if (!this.toolCoordinator.canRunOperation(operationId)) {
                return Promise.reject(new PluginKernelStateError(`run operation "${operationId}" while the active tool rejects it`, this.hostState));
            }
            return this.operationRegistry.runForHost(operationId, args, task, options);
        }
        waitForOperations() {
            return this.operationRegistry.waitForIdle();
        }
        abortOperationsForHost(reason) {
            return this.operationRegistry.abortAll(reason);
        }
        suspendOperationsForHost(reason) {
            return this.operationRegistry.suspend(reason);
        }
        exitActiveToolForHost() {
            return this.toolCoordinator.exit('host-dispose');
        }
        emitCommitted(eventName, payload) {
            return this.eventBus.emitCommitted(eventName, payload);
        }
        async initialize() {
            var _a;
            this.assertUsable('initialize the Plugin Kernel');
            if (this.hostState !== 'created' || this.topLevelInstallActive) {
                throw new PluginKernelStateError('initialize the Plugin Kernel', this.hostState);
            }
            this.hostState = 'initializing';
            try {
                for (const pluginId of this.installationOrder) {
                    const record = this.installed.get(pluginId);
                    if (!(record === null || record === void 0 ? void 0 : record.plugin.onInit))
                        continue;
                    try {
                        await record.plugin.onInit(record.lifecycleContext);
                    }
                    catch (error) {
                        throw new PluginLifecycleError(pluginId, 'init', error);
                    }
                }
                this.hostState = 'initialized';
            }
            catch (error) {
                this.hostState = 'disposing';
                const cleanupErrors = await this.cleanupAll();
                this.hostState = 'disposed';
                const lifecycleError = error instanceof PluginLifecycleError
                    ? error
                    : new PluginLifecycleError('plugin-kernel', 'init', error);
                throw new PluginLifecycleError((_a = lifecycleError.pluginId) !== null && _a !== void 0 ? _a : 'plugin-kernel', 'init', lifecycleError.cause, cleanupErrors);
            }
        }
        initializeSync() {
            var _a;
            this.assertUsable('initialize the Plugin Kernel');
            if (this.hostState !== 'created' || this.topLevelInstallActive) {
                throw new PluginKernelStateError('initialize the Plugin Kernel', this.hostState);
            }
            this.hostState = 'initializing';
            try {
                for (const pluginId of this.installationOrder) {
                    const record = this.installed.get(pluginId);
                    if (!(record === null || record === void 0 ? void 0 : record.plugin.onInit))
                        continue;
                    const result = record.plugin.onInit(record.lifecycleContext);
                    if (isPromiseLike(result)) {
                        throw new PluginLifecycleError(pluginId, 'init', new Error('Synchronous plugin onInit returned a Promise.'));
                    }
                }
                this.hostState = 'initialized';
            }
            catch (error) {
                this.hostState = 'disposing';
                const cleanupErrors = this.cleanupAllSync();
                this.hostState = 'disposed';
                const lifecycleError = error instanceof PluginLifecycleError
                    ? error
                    : new PluginLifecycleError('plugin-kernel', 'init', error);
                throw new PluginLifecycleError((_a = lifecycleError.pluginId) !== null && _a !== void 0 ? _a : 'plugin-kernel', 'init', lifecycleError.cause, cleanupErrors);
            }
        }
        async notifyImageLoaded(image) {
            this.assertLifecycleReady('notify plugins that an image loaded');
            for (const pluginId of this.installationOrder) {
                const record = this.installed.get(pluginId);
                if (!(record === null || record === void 0 ? void 0 : record.plugin.onImageLoaded))
                    continue;
                try {
                    await record.plugin.onImageLoaded(image, record.lifecycleContext);
                }
                catch (error) {
                    throw new PluginLifecycleError(pluginId, 'image-loaded', error);
                }
            }
        }
        async notifyImageCleared() {
            this.assertLifecycleReady('notify plugins that an image cleared');
            for (const pluginId of this.installationOrder) {
                const record = this.installed.get(pluginId);
                if (!(record === null || record === void 0 ? void 0 : record.plugin.onImageCleared))
                    continue;
                try {
                    await record.plugin.onImageCleared(record.lifecycleContext);
                }
                catch (error) {
                    throw new PluginLifecycleError(pluginId, 'image-cleared', error);
                }
            }
        }
        dispose() {
            var _a;
            if (this.hostState === 'disposed')
                return Promise.resolve();
            if (this.hostState === 'disposing')
                return (_a = this.disposePromise) !== null && _a !== void 0 ? _a : Promise.resolve();
            if (this.hostState === 'initializing') {
                return Promise.reject(new PluginKernelStateError('dispose the Plugin Kernel', this.hostState));
            }
            this.hostState = 'disposing';
            this.disposePromise = this.performDispose();
            return this.disposePromise;
        }
        disposeSync() {
            if (this.hostState === 'disposed')
                return;
            if (this.hostState === 'disposing' || this.hostState === 'initializing') {
                throw new PluginKernelStateError('dispose the Plugin Kernel synchronously', this.hostState);
            }
            this.hostState = 'disposing';
            const errors = this.cleanupAllSync();
            this.hostState = 'disposed';
            if (errors.length > 0) {
                throw new PluginAggregateError('[ImageEditor] Plugin Kernel synchronous disposal completed with cleanup errors.', errors);
            }
        }
        prepareBatch(inputs) {
            var _a;
            if (!Array.isArray(inputs) || inputs.length === 0) {
                throw new InvalidPluginDefinitionError('Plugin batch must contain at least one Plugin.');
            }
            const candidatesById = new Map();
            const apisByPluginId = new Map();
            for (const input of inputs) {
                const plugin = this.normalizePluginDefinition(input);
                const pluginId = plugin.ref.id;
                const existing = this.installed.get(pluginId);
                if (existing) {
                    if (!sameInstallationDefinition(existing.plugin, plugin)) {
                        throw new PluginDefinitionConflictError(pluginId);
                    }
                    apisByPluginId.set(pluginId, existing.api);
                    continue;
                }
                const duplicate = candidatesById.get(pluginId);
                if (duplicate) {
                    if (!sameInstallationDefinition(duplicate.plugin, plugin)) {
                        throw new PluginDefinitionConflictError(pluginId);
                    }
                    continue;
                }
                candidatesById.set(pluginId, { plugin });
            }
            const candidates = [...candidatesById.values()];
            const dependencies = new Map();
            for (const candidate of candidates) {
                const pluginDependencies = new Set();
                for (const dependency of (_a = candidate.plugin.manifest.requiresPlugins) !== null && _a !== void 0 ? _a : []) {
                    const installedDependency = this.installed.get(dependency.id);
                    if ((installedDependency === null || installedDependency === void 0 ? void 0 : installedDependency.refObject) === dependency)
                        continue;
                    const batchDependency = candidatesById.get(dependency.id);
                    if ((batchDependency === null || batchDependency === void 0 ? void 0 : batchDependency.plugin.ref) === dependency) {
                        pluginDependencies.add(dependency.id);
                        continue;
                    }
                    throw this.createDependencyError(candidate.plugin.ref.id, dependency, [
                        ...this.installed.keys(),
                        ...candidatesById.keys(),
                    ]);
                }
                dependencies.set(candidate.plugin.ref.id, pluginDependencies);
            }
            const remaining = new Set(candidatesById.keys());
            const ordered = [];
            while (remaining.size > 0) {
                const next = candidates.find((candidate) => {
                    var _a;
                    return remaining.has(candidate.plugin.ref.id) &&
                        [...((_a = dependencies.get(candidate.plugin.ref.id)) !== null && _a !== void 0 ? _a : [])].every((dependencyId) => !remaining.has(dependencyId));
                });
                if (!next) {
                    throw new PluginDependencyCycleError(this.findDependencyCycle(remaining, dependencies));
                }
                remaining.delete(next.plugin.ref.id);
                ordered.push(next);
            }
            return { ordered: Object.freeze(ordered), apisByPluginId };
        }
        findDependencyCycle(remaining, dependencies) {
            const visited = new Set();
            const visiting = new Set();
            const stack = [];
            const visit = (pluginId) => {
                var _a;
                if (visiting.has(pluginId)) {
                    const start = stack.indexOf(pluginId);
                    return Object.freeze([...stack.slice(start), pluginId]);
                }
                if (visited.has(pluginId))
                    return null;
                visiting.add(pluginId);
                stack.push(pluginId);
                for (const dependencyId of (_a = dependencies.get(pluginId)) !== null && _a !== void 0 ? _a : []) {
                    if (!remaining.has(dependencyId))
                        continue;
                    const cycle = visit(dependencyId);
                    if (cycle)
                        return cycle;
                }
                stack.pop();
                visiting.delete(pluginId);
                visited.add(pluginId);
                return null;
            };
            for (const pluginId of remaining) {
                const cycle = visit(pluginId);
                if (cycle)
                    return cycle;
            }
            return Object.freeze([...remaining, remaining.values().next().value]);
        }
        performPendingInstallSync(plugin, visibleTransactions) {
            if (plugin.setupMode !== 'sync') {
                throw new InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" must declare setupMode "sync" for install().`, plugin.ref.id);
            }
            const { required, optional } = this.resolveCapabilities(plugin, visibleTransactions);
            const scope = new RegistrationScope(plugin.ref.id, this.options);
            visibleTransactions.add(scope.transactionId);
            try {
                const contexts = this.createContexts(plugin.ref, scope, required, optional, [
                    plugin.ref.id,
                ]);
                const api = plugin.setup(contexts.setup);
                if (isPromiseLike(api)) {
                    throw new InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" returned a Promise from synchronous setup.`, plugin.ref.id);
                }
                if (!isPluginApi(api)) {
                    throw new InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" setup must return a non-null object or function API.`, plugin.ref.id);
                }
                return {
                    plugin,
                    refObject: plugin.ref,
                    api,
                    scope,
                    lifecycleContext: contexts.lifecycle,
                };
            }
            catch (error) {
                visibleTransactions.delete(scope.transactionId);
                const cleanupErrors = scope.rollbackSync();
                throw new PluginSetupError(plugin.ref.id, error, cleanupErrors);
            }
        }
        rollbackPendingBatchSync(pendingRecords) {
            const cleanupErrors = [];
            for (const record of [...pendingRecords].reverse()) {
                if (record.plugin.onDispose) {
                    try {
                        const result = record.plugin.onDispose(record.lifecycleContext);
                        if (isPromiseLike(result)) {
                            void Promise.resolve(result).catch((error) => {
                                reportErrorSafely(this.options.errorSink, error);
                            });
                            throw new Error('Synchronous Plugin onDispose returned a Promise.');
                        }
                    }
                    catch (error) {
                        cleanupErrors.push(new PluginLifecycleError(record.plugin.ref.id, 'dispose', error));
                    }
                }
                cleanupErrors.push(...record.scope.rollbackSync());
            }
            return Object.freeze(cleanupErrors);
        }
        createDependencyError(consumerPluginId, dependency, availablePluginIds) {
            return new PluginDependencyError({
                consumerPluginId,
                dependencyId: dependency.id,
                requiredApiVersion: dependency.apiVersion,
                availablePluginIds: Object.freeze([...new Set(availablePluginIds)].sort()),
                packageHint: pluginPackageHints.get(dependency.id),
                planHint: 'Pass the dependency to install([...]) or include it in composePlugins(...).',
            });
        }
        assertPluginDependenciesInstalled(plugin) {
            var _a;
            for (const dependency of (_a = plugin.manifest.requiresPlugins) !== null && _a !== void 0 ? _a : []) {
                const installedDependency = this.installed.get(dependency.id);
                if ((installedDependency === null || installedDependency === void 0 ? void 0 : installedDependency.refObject) === dependency)
                    continue;
                throw this.createDependencyError(plugin.ref.id, dependency, [...this.installed.keys()]);
            }
        }
        async performInstall(input, mode, parentStack) {
            const plugin = this.normalizePluginDefinition(input);
            const pluginId = plugin.ref.id;
            if (parentStack.includes(pluginId)) {
                throw new InvalidPluginDefinitionError(`Plugin dependency cycle detected: ${[...parentStack, pluginId].join(' -> ')}.`, pluginId);
            }
            const existing = this.installed.get(pluginId);
            if (existing) {
                if (mode === 'strict')
                    throw new PluginAlreadyInstalledError(pluginId);
                const compatible = sameInstallationDefinition(existing.plugin, plugin);
                if (!compatible) {
                    throw new PluginVersionMismatchError(pluginId, existing.plugin.manifest.version, plugin.manifest.version, existing.plugin.ref.apiVersion, plugin.ref.apiVersion);
                }
                return { api: existing.api };
            }
            this.assertPluginDependenciesInstalled(plugin);
            const { required, optional } = this.resolveCapabilities(plugin);
            const scope = new RegistrationScope(pluginId, this.options);
            const stack = [...parentStack, pluginId];
            try {
                const contexts = this.createContexts(plugin.ref, scope, required, optional, stack);
                const api = await plugin.setup(contexts.setup);
                if (!isPluginApi(api)) {
                    throw new InvalidPluginDefinitionError(`Plugin "${pluginId}" setup must return a non-null object or function API.`, pluginId);
                }
                scope.commit();
                const record = {
                    plugin,
                    refObject: plugin.ref,
                    api,
                    scope,
                    lifecycleContext: contexts.lifecycle,
                };
                this.installed.set(pluginId, record);
                this.installationOrder.push(pluginId);
                return { api };
            }
            catch (error) {
                const cleanupErrors = await scope.rollback();
                throw new PluginSetupError(pluginId, error, cleanupErrors);
            }
        }
        performInstallSync(input, mode, parentStack) {
            const plugin = this.normalizePluginDefinition(input);
            if (plugin.setupMode !== 'sync') {
                throw new InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" must declare setupMode "sync" for installSync().`, plugin.ref.id);
            }
            const pluginId = plugin.ref.id;
            if (parentStack.includes(pluginId)) {
                throw new InvalidPluginDefinitionError(`Plugin dependency cycle detected: ${[...parentStack, pluginId].join(' -> ')}.`, pluginId);
            }
            const existing = this.installed.get(pluginId);
            if (existing) {
                if (mode === 'strict')
                    throw new PluginAlreadyInstalledError(pluginId);
                const compatible = sameInstallationDefinition(existing.plugin, plugin);
                if (!compatible) {
                    throw new PluginVersionMismatchError(pluginId, existing.plugin.manifest.version, plugin.manifest.version, existing.plugin.ref.apiVersion, plugin.ref.apiVersion);
                }
                return { api: existing.api };
            }
            this.assertPluginDependenciesInstalled(plugin);
            const { required, optional } = this.resolveCapabilities(plugin);
            const scope = new RegistrationScope(pluginId, this.options);
            try {
                const contexts = this.createContexts(plugin.ref, scope, required, optional, [
                    ...parentStack,
                    pluginId,
                ]);
                const api = plugin.setup(contexts.setup);
                if (isPromiseLike(api)) {
                    throw new InvalidPluginDefinitionError(`Plugin "${pluginId}" returned a Promise from synchronous setup.`, pluginId);
                }
                if (!isPluginApi(api)) {
                    throw new InvalidPluginDefinitionError(`Plugin "${pluginId}" setup must return a non-null object or function API.`, pluginId);
                }
                scope.commit();
                this.installed.set(pluginId, {
                    plugin,
                    refObject: plugin.ref,
                    api,
                    scope,
                    lifecycleContext: contexts.lifecycle,
                });
                this.installationOrder.push(pluginId);
                return { api };
            }
            catch (error) {
                const cleanupErrors = scope.rollbackSync();
                throw new PluginSetupError(pluginId, error, cleanupErrors);
            }
        }
        resolveCapabilities(plugin, visibleTransactions) {
            var _a, _b;
            const required = new Map();
            const optional = new Map();
            for (const requirement of (_a = plugin.manifest.requires) !== null && _a !== void 0 ? _a : []) {
                this.assertCapabilityPermission(plugin, requirement.token.id, visibleTransactions);
                required.set(requirement.token.id, {
                    token: requirement.token,
                    value: this.capabilityRegistry.requireDefinition(requirement, plugin.ref.id, visibleTransactions),
                });
            }
            for (const requirement of (_b = plugin.manifest.optional) !== null && _b !== void 0 ? _b : []) {
                this.assertCapabilityPermission(plugin, requirement.token.id, visibleTransactions);
                const value = this.capabilityRegistry.optionalDefinition(requirement, plugin.ref.id, visibleTransactions);
                optional.set(requirement.token.id, {
                    token: requirement.token,
                    value,
                    status: value !== null
                        ? 'available'
                        : this.capabilityRegistry.getProviderInfo(requirement.token.id)
                            ? 'incompatible'
                            : 'missing',
                });
            }
            return { required, optional };
        }
        assertCapabilityPermission(plugin, capabilityId, visibleTransactions) {
            var _a;
            const permission = this.capabilityRegistry.getRequiredPermission(capabilityId, visibleTransactions);
            if (!permission || ((_a = plugin.manifest.permissions) === null || _a === void 0 ? void 0 : _a.includes(permission)))
                return;
            throw new PluginPermissionError(plugin.ref.id, permission, capabilityId);
        }
        createContexts(plugin, scope, required, optional, stack) {
            const pluginId = plugin.id;
            const state = this.stateStore.createScoped(pluginId, (disposable) => scope.add(disposable), (disposable) => scope.addFinalizer(disposable), () => scope.active);
            const capabilities = Object.freeze({
                require: (token) => {
                    const resolved = required.get(token.id);
                    if (!resolved || resolved.token !== token) {
                        throw new PluginCapabilityError({
                            consumerPluginId: pluginId,
                            capabilityId: token.id,
                            requestedRange: 'undeclared-required-capability',
                            reason: 'missing',
                        });
                    }
                    return resolved.value;
                },
                optional: (token) => {
                    const resolved = optional.get(token.id);
                    if (!resolved || resolved.token !== token) {
                        throw new PluginCapabilityError({
                            consumerPluginId: pluginId,
                            capabilityId: token.id,
                            requestedRange: 'undeclared-optional-capability',
                            reason: 'missing',
                        });
                    }
                    return resolved.value;
                },
                getOptionalStatus: (token) => {
                    const resolved = optional.get(token.id);
                    if (!resolved || resolved.token !== token) {
                        throw new PluginCapabilityError({
                            consumerPluginId: pluginId,
                            capabilityId: token.id,
                            requestedRange: 'undeclared-optional-capability',
                            reason: 'missing',
                        });
                    }
                    return resolved.status;
                },
            });
            const operations = Object.freeze({
                begin: (operationId) => this.operationRegistry.begin(operationId, pluginId),
                run: (operationId, args, task, options = {}) => this.operationRegistry.run(operationId, pluginId, args, task, options),
                get: (operationId) => this.operationRegistry.get(operationId),
                isActive: (operationId) => this.operationRegistry.isActive(operationId),
            });
            const tools = Object.freeze({
                enter: (toolId) => this.toolCoordinator.enter(toolId, pluginId),
                exit: (reason) => this.toolCoordinator.exit(reason),
                getActiveToolId: () => this.toolCoordinator.getActiveToolId(),
                canRunOperation: (operationId) => this.toolCoordinator.canRunOperation(operationId),
            });
            const events = Object.freeze({
                emitCommitted: (eventName, payload) => this.eventBus.emitCommitted(eventName, payload),
            });
            const lifecycle = Object.freeze({
                plugin,
                pluginId,
                state,
                capabilities,
                operations,
                tools,
                events,
            });
            const setupCapabilities = Object.freeze({
                ...capabilities,
                provide: (token, implementation, options) => {
                    var _a;
                    scope.assertOpen();
                    return scope.add(this.capabilityRegistry.providePending(token, implementation, pluginId, scope.transactionId, (_a = options === null || options === void 0 ? void 0 : options.version) !== null && _a !== void 0 ? _a : token.version, options === null || options === void 0 ? void 0 : options.requiredPermission));
                },
            });
            const setupOperations = Object.freeze({
                ...operations,
                register: (definition) => {
                    scope.assertOpen();
                    return scope.add(this.operationRegistry.register(definition, pluginId));
                },
            });
            const setupTools = Object.freeze({
                ...tools,
                register: (definition) => {
                    scope.assertOpen();
                    return scope.add(this.toolCoordinator.register(definition, pluginId));
                },
            });
            const setupEvents = Object.freeze({
                ...events,
                on: (eventName, listener) => {
                    scope.assertOpen();
                    return scope.add(this.eventBus.on(eventName, listener));
                },
            });
            const ensurePluginNow = async (dependency) => {
                scope.assertOpen('ensure a composed plugin dependency');
                const before = new Set(this.installationOrder);
                const outcome = await this.performInstall(dependency, 'ensure', stack);
                const newlyInstalled = this.installationOrder.filter((id) => !before.has(id));
                for (const installedPluginId of newlyInstalled) {
                    scope.addRollback(createDisposable(() => this.rollbackInstalledPlugin(installedPluginId)));
                }
                return outcome.api;
            };
            let ensureQueue = Promise.resolve();
            const ensurePlugin = (dependency) => {
                const result = ensureQueue.then(() => ensurePluginNow(dependency));
                ensureQueue = result.then(() => undefined, () => undefined);
                return result;
            };
            const disposables = Object.freeze({
                get active() {
                    return scope.active;
                },
                add: (disposable) => {
                    scope.assertOpen();
                    return scope.add(disposable);
                },
            });
            const setup = Object.freeze({
                plugin,
                pluginId,
                state,
                capabilities: setupCapabilities,
                operations: setupOperations,
                tools: setupTools,
                events: setupEvents,
                disposables,
                addDisposable: (disposable) => {
                    scope.assertOpen();
                    return scope.add(disposable);
                },
                ensure: async (dependency) => {
                    const api = await ensurePlugin(dependency);
                    return api;
                },
                ensurePlugin,
            });
            return { setup, lifecycle };
        }
        async rollbackInstalledPlugin(pluginId) {
            const record = this.installed.get(pluginId);
            if (!record)
                return;
            this.installed.delete(pluginId);
            const orderIndex = this.installationOrder.lastIndexOf(pluginId);
            if (orderIndex >= 0)
                this.installationOrder.splice(orderIndex, 1);
            const errors = [];
            if (record.plugin.onDispose) {
                try {
                    await record.plugin.onDispose(record.lifecycleContext);
                }
                catch (error) {
                    errors.push(new PluginLifecycleError(pluginId, 'dispose', error));
                }
            }
            try {
                await record.scope.dispose();
            }
            catch (error) {
                errors.push(error);
            }
            if (errors.length > 0) {
                throw new PluginAggregateError(`[ImageEditor] Rollback of composed plugin "${pluginId}" failed.`, errors, { pluginId });
            }
        }
        normalizePluginDefinition(plugin) {
            if (typeof plugin !== 'object' || plugin === null) {
                throw new InvalidPluginDefinitionError('Plugin definition must be an object.');
            }
            if (!isPluginRef(plugin.ref)) {
                throw new InvalidPluginDefinitionError('Plugin definition must use a PluginRef created by definePluginRef().');
            }
            if (typeof plugin.setup !== 'function') {
                throw new InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" must define setup().`, plugin.ref.id);
            }
            const manifest = validatePluginManifest(plugin.ref, 'manifest' in plugin
                ? plugin.manifest
                : {
                    id: plugin.ref.id,
                    version: plugin.version,
                    apiVersion: plugin.ref.apiVersion,
                    engine: '*',
                    requires: plugin.requires,
                    optional: plugin.optional,
                    permissions: plugin.permissions,
                });
            return Object.freeze({ ...plugin, ref: plugin.ref, manifest });
        }
        async performDispose() {
            const errors = await this.cleanupAll();
            this.hostState = 'disposed';
            if (errors.length > 0) {
                throw new PluginAggregateError('[ImageEditor] Plugin Kernel disposal completed with cleanup errors.', errors);
            }
        }
        async cleanupAll() {
            const errors = [];
            const records = [...this.installationOrder]
                .reverse()
                .map((pluginId) => this.installed.get(pluginId))
                .filter((record) => record !== undefined);
            for (const record of records) {
                if (!record.plugin.onDispose)
                    continue;
                try {
                    await record.plugin.onDispose(record.lifecycleContext);
                }
                catch (error) {
                    const lifecycleError = new PluginLifecycleError(record.plugin.ref.id, 'dispose', error);
                    errors.push(lifecycleError);
                    reportErrorSafely(this.options.errorSink, lifecycleError);
                }
            }
            for (const record of records) {
                try {
                    await record.scope.dispose();
                }
                catch (error) {
                    errors.push(error);
                    reportErrorSafely(this.options.errorSink, error);
                }
            }
            this.installed.clear();
            this.installationOrder.length = 0;
            const kernelDisposables = [
                this.toolCoordinator,
                this.operationRegistry,
                this.eventBus,
                this.capabilityRegistry,
                this.stateStore,
            ];
            for (const disposable of kernelDisposables) {
                try {
                    await disposable.dispose();
                }
                catch (error) {
                    errors.push(error);
                    reportErrorSafely(this.options.errorSink, error);
                }
            }
            return errors;
        }
        cleanupAllSync() {
            const errors = [];
            const records = [...this.installationOrder]
                .reverse()
                .map((pluginId) => this.installed.get(pluginId))
                .filter((record) => record !== undefined);
            for (const record of records) {
                if (!record.plugin.onDispose)
                    continue;
                try {
                    const result = record.plugin.onDispose(record.lifecycleContext);
                    if (isPromiseLike(result)) {
                        void Promise.resolve(result).catch((error) => {
                            reportErrorSafely(this.options.errorSink, error);
                        });
                        throw new PluginLifecycleError(record.plugin.ref.id, 'dispose', new Error('Synchronous plugin onDispose returned a Promise.'));
                    }
                }
                catch (error) {
                    const lifecycleError = error instanceof PluginLifecycleError
                        ? error
                        : new PluginLifecycleError(record.plugin.ref.id, 'dispose', error);
                    errors.push(lifecycleError);
                    reportErrorSafely(this.options.errorSink, lifecycleError);
                }
            }
            for (const record of records) {
                try {
                    record.scope.disposeSync();
                }
                catch (error) {
                    errors.push(error);
                    reportErrorSafely(this.options.errorSink, error);
                }
            }
            this.installed.clear();
            this.installationOrder.length = 0;
            const cleanup = [
                () => this.toolCoordinator.disposeSync(),
                () => this.operationRegistry.dispose(),
                () => this.eventBus.dispose(),
                () => this.capabilityRegistry.dispose(),
                () => this.stateStore.dispose(),
            ];
            for (const dispose of cleanup) {
                try {
                    dispose();
                }
                catch (error) {
                    errors.push(error);
                    reportErrorSafely(this.options.errorSink, error);
                }
            }
            return Object.freeze(errors);
        }
        assertCanInstall() {
            this.assertUsable('install a plugin');
            if (this.hostState !== 'created') {
                throw new PluginKernelStateError('install a plugin', this.hostState);
            }
        }
        assertLifecycleReady(operation) {
            this.assertUsable(operation);
            if (this.hostState !== 'initialized') {
                throw new PluginKernelStateError(operation, this.hostState);
            }
        }
        assertUsable(operation) {
            if (this.hostState === 'disposed' || this.hostState === 'disposing') {
                throw new PluginKernelDisposedError(operation);
            }
        }
    }

    const pluginPlanDefinition = Symbol('image-editor.plugin-plan.definition');
    function isPluginPlan(value) {
        return (typeof value === 'object' &&
            value !== null &&
            pluginPlanDefinition in value &&
            Array.isArray(value.plugins));
    }
    function assertPluginPlanItem(value, key) {
        if (isPluginPlan(value))
            return;
        if (typeof value !== 'object' || value === null || !('ref' in value) || !('setup' in value)) {
            throw new InvalidPluginDefinitionError(`Plugin Plan entry "${key}" must be a Plugin or nested Plugin Plan.`);
        }
    }
    function composePlugins(definitions) {
        if (typeof definitions !== 'object' || definitions === null) {
            throw new InvalidPluginDefinitionError('Plugin Plan definitions must be an object.');
        }
        const entries = Object.entries(definitions);
        if (entries.length === 0) {
            throw new InvalidPluginDefinitionError('Plugin Plan must contain at least one Plugin.');
        }
        const plugins = [];
        for (const [key, value] of entries) {
            assertPluginPlanItem(value, key);
            if (isPluginPlan(value))
                plugins.push(...value.plugins);
            else
                plugins.push(value);
        }
        const preservedDefinitions = Object.freeze({ ...definitions });
        return Object.freeze({
            plugins: Object.freeze(plugins),
            [pluginPlanDefinition]: preservedDefinitions,
        });
    }
    function resolvePluginPlanApis(plan, resolveApi) {
        const result = Object.create(null);
        for (const [key, value] of Object.entries(plan[pluginPlanDefinition])) {
            result[key] = isPluginPlan(value)
                ? resolvePluginPlanApis(value, resolveApi)
                : resolveApi(value);
        }
        return Object.freeze(result);
    }

    function forceReflow(element) {
        if (!element)
            return;
        void element.offsetWidth;
    }

    function selectLayoutStrategy(mode) {
        return mode;
    }
    class ViewportCache {
        constructor() {
            Object.defineProperty(this, "lastVisible", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: null
            });
        }
        measure(container, fallback, scrollbarSize) {
            var _a;
            if (!container)
                return fallback;
            const containerWidth = Math.floor(container.clientWidth);
            const containerHeight = Math.floor(container.clientHeight);
            if (containerWidth > 0 && containerHeight > 0) {
                this.lastVisible = measureContainerViewport(container, fallback, scrollbarSize);
                return this.lastVisible;
            }
            return (_a = this.lastVisible) !== null && _a !== void 0 ? _a : fallback;
        }
        peek() {
            return this.lastVisible;
        }
        clear() {
            this.lastVisible = null;
        }
    }
    const OVERFLOW_EPSILON = 0.5;
    function normalizeOverflowValue(value) {
        return String(value !== null && value !== void 0 ? value : '')
            .trim()
            .toLowerCase();
    }
    function getContainerOverflowValues(container) {
        var _a, _b;
        const style = container.style;
        let computedOverflow = '';
        let computedOverflowX = '';
        let computedOverflowY = '';
        const view = (_b = (_a = container.ownerDocument) === null || _a === void 0 ? void 0 : _a.defaultView) !== null && _b !== void 0 ? _b : (typeof window === 'undefined' ? null : window);
        if (typeof (view === null || view === void 0 ? void 0 : view.getComputedStyle) === 'function') {
            const computed = view.getComputedStyle(container);
            computedOverflow = computed.overflow;
            computedOverflowX = computed.overflowX;
            computedOverflowY = computed.overflowY;
        }
        const x = [
            normalizeOverflowValue(style === null || style === void 0 ? void 0 : style.overflow),
            normalizeOverflowValue(style === null || style === void 0 ? void 0 : style.overflowX),
            normalizeOverflowValue(computedOverflow),
            normalizeOverflowValue(computedOverflowX),
        ];
        const y = [
            normalizeOverflowValue(style === null || style === void 0 ? void 0 : style.overflow),
            normalizeOverflowValue(style === null || style === void 0 ? void 0 : style.overflowY),
            normalizeOverflowValue(computedOverflow),
            normalizeOverflowValue(computedOverflowY),
        ];
        return { x, y, all: [...x, ...y] };
    }
    function isAutoScrollableOverflow(value) {
        return value === 'auto' || value === 'overlay';
    }
    function measureScrollbarSize(ownerDocument) {
        const doc = ownerDocument !== null && ownerDocument !== void 0 ? ownerDocument : (typeof document === 'undefined' ? null : document);
        if (!(doc === null || doc === void 0 ? void 0 : doc.body))
            return { width: 0, height: 0 };
        const probe = doc.createElement('div');
        probe.style.position = 'absolute';
        probe.style.left = '-9999px';
        probe.style.top = '-9999px';
        probe.style.width = '100px';
        probe.style.height = '100px';
        probe.style.overflow = 'scroll';
        probe.style.visibility = 'hidden';
        probe.style.pointerEvents = 'none';
        doc.body.appendChild(probe);
        const width = Math.max(0, probe.offsetWidth - probe.clientWidth);
        const height = Math.max(0, probe.offsetHeight - probe.clientHeight);
        probe.remove();
        return { width, height };
    }
    function normalizeScrollbarSize(scrollbarSize) {
        return {
            width: Math.max(0, Number(scrollbarSize === null || scrollbarSize === void 0 ? void 0 : scrollbarSize.width) || 0),
            height: Math.max(0, Number(scrollbarSize === null || scrollbarSize === void 0 ? void 0 : scrollbarSize.height) || 0),
        };
    }
    function measureContainerViewport(container, fallback, scrollbarSize) {
        if (!container)
            return fallback;
        const clientWidth = Math.floor(container.clientWidth || 0);
        const clientHeight = Math.floor(container.clientHeight || 0);
        if (clientWidth <= 0 || clientHeight <= 0)
            return fallback;
        const overflow = getContainerOverflowValues(container);
        if (overflow.all.includes('scroll')) {
            return { width: clientWidth, height: clientHeight };
        }
        const scrollbar = normalizeScrollbarSize(scrollbarSize);
        const canAutoScrollX = overflow.x.some(isAutoScrollableOverflow);
        const canAutoScrollY = overflow.y.some(isAutoScrollableOverflow);
        const scrollWidth = Math.ceil(container.scrollWidth || 0);
        const scrollHeight = Math.ceil(container.scrollHeight || 0);
        const hasHorizontalScrollbar = canAutoScrollX && scrollWidth > clientWidth + OVERFLOW_EPSILON;
        const hasVerticalScrollbar = canAutoScrollY && scrollHeight > clientHeight + OVERFLOW_EPSILON;
        return {
            width: clientWidth + (hasVerticalScrollbar ? scrollbar.width : 0),
            height: clientHeight + (hasHorizontalScrollbar ? scrollbar.height : 0),
        };
    }
    function computeScrollableCanvasSize(contentWidth, contentHeight, viewport, scrollbarSize) {
        const viewportW = Math.max(1, viewport.width || 1);
        const viewportH = Math.max(1, viewport.height || 1);
        const scrollbar = normalizeScrollbarSize(scrollbarSize);
        let hasHorizontal = false;
        let hasVertical = false;
        for (let i = 0; i < 4; i += 1) {
            const effectiveW = Math.max(1, viewportW - (hasVertical ? scrollbar.width : 0));
            const effectiveH = Math.max(1, viewportH - (hasHorizontal ? scrollbar.height : 0));
            const nextHorizontal = contentWidth > effectiveW + OVERFLOW_EPSILON;
            const nextVertical = contentHeight > effectiveH + OVERFLOW_EPSILON;
            if (nextHorizontal === hasHorizontal && nextVertical === hasVertical)
                break;
            hasHorizontal = nextHorizontal;
            hasVertical = nextVertical;
        }
        const effectiveW = Math.max(1, viewportW - (hasVertical ? scrollbar.width : 0));
        const effectiveH = Math.max(1, viewportH - (hasHorizontal ? scrollbar.height : 0));
        return {
            width: hasHorizontal ? Math.ceil(contentWidth) : effectiveW,
            height: hasVertical ? Math.ceil(contentHeight) : effectiveH,
        };
    }
    function computeFitLayout(imageWidth, imageHeight, optionsCanvasWidth, optionsCanvasHeight, containerSize) {
        const canvasWidth = Math.max(1, (containerSize.width || optionsCanvasWidth) - 1);
        const canvasHeight = Math.max(1, (containerSize.height || optionsCanvasHeight) - 1);
        const fitScale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight, 1);
        return {
            canvasWidth,
            canvasHeight,
            imageScale: fitScale,
            imageLeft: 0,
            imageTop: 0,
            baseImageScale: fitScale,
        };
    }
    function computeCoverLayout(imageWidth, imageHeight, optionsCanvasWidth, optionsCanvasHeight, containerSize, scrollbarSize) {
        const viewportW = containerSize.width || optionsCanvasWidth;
        const viewportH = containerSize.height || optionsCanvasHeight;
        const scrollbar = normalizeScrollbarSize(scrollbarSize);
        let hasHorizontal = false;
        let hasVertical = false;
        let coverScale = 1;
        let scaledW = imageWidth;
        let scaledH = imageHeight;
        for (let i = 0; i < 4; i += 1) {
            const effectiveW = Math.max(1, viewportW - (hasVertical ? scrollbar.width : 0));
            const effectiveH = Math.max(1, viewportH - (hasHorizontal ? scrollbar.height : 0));
            coverScale = Math.min(1, Math.max(effectiveW / imageWidth, effectiveH / imageHeight));
            scaledW = imageWidth * coverScale;
            scaledH = imageHeight * coverScale;
            const nextHasHorizontal = scaledW > effectiveW + OVERFLOW_EPSILON;
            const nextHasVertical = scaledH > effectiveH + OVERFLOW_EPSILON;
            if (nextHasHorizontal === hasHorizontal && nextHasVertical === hasVertical)
                break;
            hasHorizontal = nextHasHorizontal;
            hasVertical = nextHasVertical;
        }
        const canvasSize = computeScrollableCanvasSize(scaledW, scaledH, {
            width: viewportW,
            height: viewportH,
        }, scrollbar);
        return {
            canvasWidth: canvasSize.width,
            canvasHeight: canvasSize.height,
            imageScale: coverScale,
            imageLeft: 0,
            imageTop: 0,
            baseImageScale: coverScale,
        };
    }
    function computeExpandLayout(imageWidth, imageHeight, containerSize) {
        const canvasWidth = Math.max(containerSize.width, Math.floor(imageWidth));
        const canvasHeight = Math.max(containerSize.height, Math.floor(imageHeight));
        return {
            canvasWidth,
            canvasHeight,
            imageScale: 1,
            imageLeft: 0,
            imageTop: 0,
            baseImageScale: 1,
        };
    }
    function applyCanvasDimensions(canvas, width, height, containerElement) {
        const integerWidth = Math.max(1, Math.round(Number(width) || 1));
        const integerHeight = Math.max(1, Math.round(Number(height) || 1));
        canvas.setDimensions({ width: integerWidth, height: integerHeight });
        forceReflow(containerElement);
    }

    function severityFor(behavior) {
        if (behavior === 'operation-cancelled')
            return 'cancelled';
        if (behavior === 'recoverable-object' ||
            behavior === 'recoverable-optional-capability' ||
            behavior === 'operation-conflict') {
            return 'recoverable';
        }
        return 'fatal';
    }
    function errorCode(value) {
        if (!value || typeof value !== 'object' || !('code' in value))
            return null;
        return typeof value.code === 'string' ? value.code : null;
    }
    function classifyCoreError(error) {
        if (error instanceof CoreRuntimeError) {
            return Object.freeze({ behavior: error.behavior, severity: error.severity });
        }
        if (error instanceof DOMException && error.name === 'AbortError') {
            return Object.freeze({ behavior: 'operation-cancelled', severity: 'cancelled' });
        }
        const code = errorCode(error);
        if (code === 'OPTIONAL_CAPABILITY_INCOMPATIBLE') {
            return Object.freeze({
                behavior: 'recoverable-optional-capability',
                severity: 'recoverable',
            });
        }
        if (code === 'OPERATION_CONFLICT') {
            return Object.freeze({ behavior: 'operation-conflict', severity: 'recoverable' });
        }
        return Object.freeze({ behavior: 'fatal-participant', severity: 'fatal' });
    }
    class CoreRuntimeError extends Error {
        constructor(message, options = {}) {
            var _a, _b;
            super(message);
            Object.defineProperty(this, "code", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: void 0
            });
            Object.defineProperty(this, "cause", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: void 0
            });
            Object.defineProperty(this, "behavior", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: void 0
            });
            Object.defineProperty(this, "severity", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: void 0
            });
            this.name = new.target.name;
            this.code = (_a = options.code) !== null && _a !== void 0 ? _a : 'CORE_RUNTIME_ERROR';
            this.cause = options.cause;
            this.behavior = (_b = options.behavior) !== null && _b !== void 0 ? _b : 'fatal-participant';
            this.severity = severityFor(this.behavior);
        }
    }
    class EditorAlreadyInitializedError extends CoreRuntimeError {
        constructor() {
            super('[ImageEditor] The editor is already initialized.', {
                code: 'EDITOR_ALREADY_INITIALIZED',
                behavior: 'lifecycle',
            });
        }
    }
    class EditorInitializationInProgressError extends CoreRuntimeError {
        constructor(operation = 'initialize') {
            super(`[ImageEditor] Cannot ${operation} while initialization is in progress.`, {
                code: 'EDITOR_INITIALIZATION_IN_PROGRESS',
                behavior: 'lifecycle',
            });
        }
    }
    class EditorDisposingError extends CoreRuntimeError {
        constructor(operation) {
            super(`[ImageEditor] Cannot ${operation} while the editor is disposing.`, {
                code: 'EDITOR_DISPOSING',
                behavior: 'lifecycle',
            });
        }
    }
    class EditorDisposedError extends CoreRuntimeError {
        constructor(operation) {
            super(`[ImageEditor] Cannot ${operation} after the editor has been disposed.`, {
                code: 'EDITOR_DISPOSED',
                behavior: 'lifecycle',
            });
        }
    }
    class EditorFaultedError extends CoreRuntimeError {
        constructor(operation) {
            super(`[ImageEditor] Cannot ${operation} while the editor is faulted.`, {
                code: 'EDITOR_FAULTED',
                behavior: 'lifecycle',
            });
        }
    }
    class StateRegistrationError extends CoreRuntimeError {
        constructor(message, sliceId) {
            super(`[ImageEditor] ${message}`, { code: 'STATE_REGISTRATION_ERROR' });
            Object.defineProperty(this, "sliceId", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: sliceId
            });
        }
    }
    class StateCloneError extends CoreRuntimeError {
        constructor(message, cause) {
            super(`[ImageEditor] ${message}`, { code: 'STATE_CLONE_ERROR', cause });
        }
    }
    class MementoCaptureError extends CoreRuntimeError {
        constructor(sliceId, cause) {
            super(`[ImageEditor] Failed to capture state slice "${sliceId}".`, {
                code: 'MEMENTO_CAPTURE_ERROR',
                cause,
            });
            Object.defineProperty(this, "sliceId", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: sliceId
            });
        }
    }
    class MementoRestoreError extends CoreRuntimeError {
        constructor(sliceId, phase, cause, rollbackErrors = []) {
            super(`[ImageEditor] Failed to ${phase} state slice "${sliceId}"${rollbackErrors.length > 0
            ? `; ${rollbackErrors.length} rollback error(s) followed`
            : ''}.`, {
                code: 'MEMENTO_RESTORE_ERROR',
                cause,
                behavior: rollbackErrors.length > 0 ? 'fatal-rollback' : 'fatal-restore',
            });
            Object.defineProperty(this, "sliceId", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: sliceId
            });
            Object.defineProperty(this, "phase", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: phase
            });
            Object.defineProperty(this, "rollbackErrors", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: rollbackErrors
            });
        }
    }
    class SnapshotValidationError extends CoreRuntimeError {
        constructor(message, path = '$', cause, code = 'SNAPSHOT_VALIDATION_ERROR') {
            super(`[ImageEditor] Invalid snapshot at ${path}: ${message}`, {
                code,
                cause,
                behavior: 'snapshot-validation',
            });
            Object.defineProperty(this, "path", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: path
            });
        }
    }
    class SnapshotVersionUnsupportedError extends SnapshotValidationError {
        constructor(detectedVersion = 'unversioned') {
            super(`snapshot version "${detectedVersion}" is unsupported; migrate it with "@bensitu/image-editor/migrate-v2" before loading.`, '$.version', undefined, 'SNAPSHOT_VERSION_UNSUPPORTED');
            Object.defineProperty(this, "detectedVersion", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: detectedVersion
            });
            Object.defineProperty(this, "migrationEntry", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: '@bensitu/image-editor/migrate-v2'
            });
        }
    }
    class EmergencyResetError extends CoreRuntimeError {
        constructor(diagnostics, cause) {
            super(`[ImageEditor] Emergency reset failed with ${diagnostics.length} diagnostic(s); the editor was permanently disposed.`, { code: 'EMERGENCY_RESET_ERROR', cause, behavior: 'lifecycle' });
            Object.defineProperty(this, "diagnostics", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: diagnostics
            });
        }
    }
    class GeometryRegistrationError extends CoreRuntimeError {
        constructor(message, participantId) {
            super(`[ImageEditor] ${message}`, { code: 'GEOMETRY_REGISTRATION_ERROR' });
            Object.defineProperty(this, "participantId", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: participantId
            });
        }
    }
    class GeometryMutationError extends CoreRuntimeError {
        constructor(mutationId, message, cause, rollbackErrors = []) {
            super(`[ImageEditor] Geometry mutation "${mutationId}" failed: ${message}`, {
                code: 'GEOMETRY_MUTATION_ERROR',
                cause,
            });
            Object.defineProperty(this, "mutationId", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: mutationId
            });
            Object.defineProperty(this, "rollbackErrors", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: rollbackErrors
            });
        }
    }
    class GeometryRecoverableObjectError extends CoreRuntimeError {
        constructor(message, objectIdentity, objectKind, cause) {
            super(`[ImageEditor] Recoverable overlay geometry failure: ${message}`, {
                code: 'GEOMETRY_RECOVERABLE_OBJECT_ERROR',
                cause,
                behavior: 'recoverable-object',
            });
            Object.defineProperty(this, "objectIdentity", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: objectIdentity
            });
            Object.defineProperty(this, "objectKind", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: objectKind
            });
        }
    }
    class GeometryUnrecoverableError extends CoreRuntimeError {
        constructor(mutationId, cause, errors) {
            super(`[ImageEditor] Geometry mutation "${mutationId}" could not restore its pre-operation state.`, { code: 'GEOMETRY_UNRECOVERABLE_ERROR', cause, behavior: 'fatal-restore' });
            Object.defineProperty(this, "mutationId", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: mutationId
            });
            Object.defineProperty(this, "errors", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: errors
            });
        }
    }
    class DocumentMutationRegistrationError extends CoreRuntimeError {
        constructor(message, transactionId) {
            super(`[ImageEditor] ${message}`, { code: 'DOCUMENT_MUTATION_REGISTRATION_ERROR' });
            Object.defineProperty(this, "transactionId", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: transactionId
            });
        }
    }
    class DocumentMutationError extends CoreRuntimeError {
        constructor(transactionId, message, cause, rollbackErrors = [], code = 'DOCUMENT_MUTATION_ERROR', behavior = rollbackErrors.length > 0
            ? 'fatal-rollback'
            : 'fatal-participant') {
            super(`[ImageEditor] Document mutation "${transactionId}" failed: ${message}`, {
                code,
                cause,
                behavior,
            });
            Object.defineProperty(this, "transactionId", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: transactionId
            });
            Object.defineProperty(this, "rollbackErrors", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: rollbackErrors
            });
        }
    }
    class DocumentMutationInvariantError extends DocumentMutationError {
        constructor(transactionId, cause) {
            super(transactionId, cause instanceof Error ? cause.message : 'invariant validation failed.', cause, [], 'DOCUMENT_MUTATION_INVARIANT_ERROR', 'fatal-invariant');
        }
    }
    class DocumentMutationUnrecoverableError extends DocumentMutationError {
        constructor(transactionId, cause, rollbackErrors) {
            super(transactionId, 'the pre-operation state could not be restored.', cause, rollbackErrors, 'DOCUMENT_MUTATION_UNRECOVERABLE_ERROR', 'fatal-restore');
        }
    }

    const DEFAULT_SECURITY_LIMITS = Object.freeze({
        maxDecodedPixels: 50000000,
        maxImageDimension: 32768,
        decodeTimeoutMs: 15000,
    });
    function isRecord$a(value) {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
    function isPositiveFinite(value) {
        return typeof value === 'number' && Number.isFinite(value) && value > 0;
    }
    function isImageMimeType(value) {
        return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp';
    }
    function isBaseImage(object) {
        return (object.editorObjectKind ===
            'baseImage');
    }
    class CanvasCoreStateAdapter {
        constructor(access, properties, transientObjects, externalObjects, securityLimits = DEFAULT_SECURITY_LIMITS) {
            Object.defineProperty(this, "access", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: access
            });
            Object.defineProperty(this, "properties", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: properties
            });
            Object.defineProperty(this, "transientObjects", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: transientObjects
            });
            Object.defineProperty(this, "externalObjects", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: externalObjects
            });
            Object.defineProperty(this, "securityLimits", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: securityLimits
            });
        }
        capture(context) {
            const canvas = this.access.getCanvas();
            if (!canvas) {
                return {
                    initialized: false,
                    canvasWidth: 0,
                    canvasHeight: 0,
                    canvas: null,
                    imageMimeType: null,
                    baseImageScale: 1,
                    geometryRevision: this.access.getGeometryRevision(),
                };
            }
            const serializableCanvas = canvas;
            const serializedValue = serializableCanvas.toJSON(this.properties.listKeys());
            if (!isRecord$a(serializedValue)) {
                throw new SnapshotValidationError('Fabric canvas serialization must be an object.');
            }
            const serialized = { ...serializedValue };
            const serializedObjects = Array.isArray(serialized.objects) ? serialized.objects : [];
            const liveObjects = canvas.getObjects();
            const propertyKeys = this.properties.listKeys();
            for (let index = 0; index < serializedObjects.length; index += 1) {
                const serializedObject = serializedObjects[index];
                const liveObject = liveObjects[index];
                if (!isRecord$a(serializedObject) || !liveObject)
                    continue;
                const liveRecord = liveObject;
                for (const key of propertyKeys) {
                    if (liveRecord[key] !== undefined)
                        serializedObject[key] = liveRecord[key];
                }
            }
            serialized.objects = serializedObjects.filter((entry, index) => {
                const liveObject = liveObjects[index];
                if (!entry ||
                    !liveObject ||
                    this.transientObjects.isTransient(liveObject) ||
                    this.externalObjects.isTransient(liveObject))
                    return false;
                if (context.mode === 'snapshot')
                    return isBaseImage(liveObject);
                return true;
            });
            return {
                initialized: true,
                canvasWidth: canvas.getWidth(),
                canvasHeight: canvas.getHeight(),
                canvas: serialized,
                imageMimeType: this.access.getImageMimeType(),
                baseImageScale: this.access.getBaseImageScale(),
                geometryRevision: this.access.getGeometryRevision(),
            };
        }
        async restore(state, context) {
            var _a, _b, _c;
            if (this.access.isDisposed()) {
                throw new Error('Cannot restore Core state after disposal.');
            }
            const validated = this.validateState(state, context.mode === 'public-snapshot');
            if (!validated.valid)
                throw new SnapshotValidationError(validated.message, validated.path);
            const next = validated.value;
            if (!next.initialized) {
                const canvas = this.access.getCanvas();
                canvas === null || canvas === void 0 ? void 0 : canvas.clear();
                this.access.setBaseImage(null);
                this.access.setImageMimeType(null);
                this.access.setBaseImageScale(1);
                this.access.setGeometryRevision(next.geometryRevision);
                return;
            }
            if (context.signal.aborted)
                throw (_a = context.signal.reason) !== null && _a !== void 0 ? _a : new Error('State restore aborted.');
            const canvas = this.access.getCanvas();
            if (!canvas)
                throw new Error('Core Canvas must be initialized before state restore.');
            this.access.setCanvasSize(next.canvasWidth, next.canvasHeight);
            if (!next.canvas)
                throw new Error('Initialized Core state requires Canvas JSON.');
            const controller = new AbortController();
            const abort = () => controller.abort(context.signal.reason);
            context.signal.addEventListener('abort', abort, { once: true });
            if (context.signal.aborted)
                abort();
            const timeout = setTimeout(() => {
                controller.abort(new SnapshotValidationError(`Canvas decode timed out after ${this.securityLimits.decodeTimeoutMs}ms.`, '$.core.canvas'));
            }, this.securityLimits.decodeTimeoutMs);
            try {
                await canvas.loadFromJSON(next.canvas, undefined, { signal: controller.signal });
            }
            catch (error) {
                if (controller.signal.aborted && controller.signal.reason) {
                    throw controller.signal.reason;
                }
                throw error;
            }
            finally {
                clearTimeout(timeout);
                context.signal.removeEventListener('abort', abort);
            }
            if (context.signal.aborted)
                throw (_b = context.signal.reason) !== null && _b !== void 0 ? _b : new Error('State restore aborted.');
            const baseImages = canvas.getObjects().filter(isBaseImage);
            if (baseImages.length > 1)
                throw new Error('Restored Core state contains multiple base images.');
            const baseImage = (_c = baseImages[0]) !== null && _c !== void 0 ? _c : null;
            if (baseImage) {
                baseImage.set({ selectable: false, evented: false });
                baseImage.setCoords();
                canvas.sendObjectToBack(baseImage);
            }
            this.access.setBaseImage(baseImage);
            this.access.setImageMimeType(next.imageMimeType);
            this.access.setBaseImageScale(next.baseImageScale);
            this.access.setGeometryRevision(next.geometryRevision);
        }
        validateSnapshot(value) {
            return this.validateState(value, true);
        }
        validateState(value, publicInput) {
            if (!isRecord$a(value))
                return { valid: false, message: 'Core state must be an object.' };
            if (typeof value.initialized !== 'boolean') {
                return {
                    valid: false,
                    message: 'initialized must be boolean.',
                    path: '$.core.initialized',
                };
            }
            if (!Number.isSafeInteger(value.geometryRevision) || Number(value.geometryRevision) < 0) {
                return {
                    valid: false,
                    message: 'geometryRevision must be a non-negative integer.',
                    path: '$.core:geometryRevision',
                };
            }
            if (!value.initialized) {
                return {
                    valid: true,
                    value: {
                        initialized: false,
                        canvasWidth: 0,
                        canvasHeight: 0,
                        canvas: null,
                        imageMimeType: null,
                        baseImageScale: 1,
                        geometryRevision: Number(value.geometryRevision),
                    },
                };
            }
            if (!isPositiveFinite(value.canvasWidth) || !isPositiveFinite(value.canvasHeight)) {
                return {
                    valid: false,
                    message: 'Canvas dimensions must be positive finite numbers.',
                    path: '$.core.canvasWidth',
                };
            }
            if (Number(value.canvasWidth) > this.securityLimits.maxImageDimension ||
                Number(value.canvasHeight) > this.securityLimits.maxImageDimension ||
                Number(value.canvasWidth) * Number(value.canvasHeight) >
                    this.securityLimits.maxDecodedPixels) {
                return {
                    valid: false,
                    message: 'Canvas dimensions exceed the configured Snapshot budget.',
                    path: '$.core.canvasWidth',
                };
            }
            if (!isRecord$a(value.canvas)) {
                return { valid: false, message: 'canvas must be an object.', path: '$.core.canvas' };
            }
            if (publicInput) {
                const objects = value.canvas.objects;
                if (!Array.isArray(objects)) {
                    return {
                        valid: false,
                        message: 'Canvas objects must be an array.',
                        path: '$.core.canvas.objects',
                    };
                }
                for (let index = 0; index < objects.length; index += 1) {
                    const object = objects[index];
                    if (!isRecord$a(object)) {
                        return {
                            valid: false,
                            message: 'Canvas object must be a record.',
                            path: `$.core.canvas.objects.${index}`,
                        };
                    }
                    if (object.type !== 'Image') {
                        return {
                            valid: false,
                            message: `unknown Fabric class "${String(object.type)}".`,
                            path: `$.core.canvas.objects.${index}.type`,
                        };
                    }
                    if (object.editorObjectKind !== 'baseImage') {
                        return {
                            valid: false,
                            message: 'persistent Canvas objects require an installed Object Codec.',
                            path: `$.core.canvas.objects.${index}.editorObjectKind`,
                        };
                    }
                    if ('filters' in object &&
                        (!Array.isArray(object.filters) || object.filters.length > 0)) {
                        return {
                            valid: false,
                            message: 'Base Image Fabric filters are not accepted in public Snapshots.',
                            path: `$.core.canvas.objects.${index}.filters`,
                        };
                    }
                }
                if (objects.length > 1) {
                    return {
                        valid: false,
                        message: 'Public Core Snapshot may contain at most one base image.',
                        path: '$.core.canvas.objects',
                    };
                }
            }
            if (value.imageMimeType !== null &&
                value.imageMimeType !== undefined &&
                !isImageMimeType(value.imageMimeType)) {
                return {
                    valid: false,
                    message: 'imageMimeType is unsupported.',
                    path: '$.core.imageMimeType',
                };
            }
            if (!isPositiveFinite(value.baseImageScale)) {
                return {
                    valid: false,
                    message: 'baseImageScale must be positive and finite.',
                    path: '$.core.baseImageScale',
                };
            }
            return {
                valid: true,
                value: {
                    initialized: true,
                    canvasWidth: value.canvasWidth,
                    canvasHeight: value.canvasHeight,
                    canvas: value.canvas,
                    imageMimeType: isImageMimeType(value.imageMimeType) ? value.imageMimeType : null,
                    baseImageScale: value.baseImageScale,
                    geometryRevision: Number(value.geometryRevision),
                },
            };
        }
    }

    class ExportContributorRegistry {
        constructor() {
            Object.defineProperty(this, "contributors", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Map()
            });
            Object.defineProperty(this, "registrationSequence", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
        }
        register(owner, contributor) {
            this.assertActive('register an export contributor');
            if (!isRuntimeIdentifier(owner)) {
                throw new CoreRuntimeError('[ImageEditor] Export contributor owner must match "namespace:kebab-case".');
            }
            if (!isRuntimeIdentifier(contributor.id)) {
                throw new CoreRuntimeError('[ImageEditor] Export contributor id must match "namespace:kebab-case".');
            }
            if (!Number.isFinite(contributor.order)) {
                throw new CoreRuntimeError(`[ImageEditor] Export contributor "${contributor.id}" must use a finite order.`);
            }
            const existing = this.contributors.get(contributor.id);
            if (existing) {
                throw new CoreRuntimeError(`[ImageEditor] Export contributor "${contributor.id}" is already registered by "${existing.owner}".`);
            }
            const record = {
                owner,
                contributor: Object.freeze({ ...contributor }),
                registrationOrder: this.registrationSequence++,
            };
            this.contributors.set(contributor.id, record);
            return createDisposable(() => {
                if (this.contributors.get(contributor.id) === record) {
                    this.contributors.delete(contributor.id);
                }
            });
        }
        async render(context) {
            this.assertActive('render export contributors');
            const records = [...this.contributors.values()].sort((left, right) => left.contributor.order - right.contributor.order ||
                left.registrationOrder - right.registrationOrder);
            for (const record of records) {
                let enabled;
                try {
                    enabled = record.contributor.isEnabled(context.options);
                }
                catch (error) {
                    throw new CoreRuntimeError(`[ImageEditor] Export contributor "${record.contributor.id}" enablement failed.`, { code: 'EXPORT_CONTRIBUTOR_ERROR', cause: error });
                }
                if (!enabled)
                    continue;
                try {
                    await record.contributor.render(context);
                }
                catch (error) {
                    throw new CoreRuntimeError(`[ImageEditor] Export contributor "${record.contributor.id}" render failed.`, { code: 'EXPORT_CONTRIBUTOR_ERROR', cause: error });
                }
            }
        }
        dispose() {
            if (this.disposed)
                return;
            this.contributors.clear();
            this.disposed = true;
        }
        assertActive(operation) {
            if (this.disposed) {
                throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} after disposal.`);
            }
        }
    }

    const IDENTITY_AFFINE_MATRIX = Object.freeze([1, 0, 0, 1, 0, 0]);
    const AFFINE_EPSILON = 1e-10;
    function isFiniteAffineMatrix(value) {
        return (Array.isArray(value) &&
            value.length === 6 &&
            value.every((entry) => typeof entry === 'number' && Number.isFinite(entry)));
    }
    function affineDeterminant(matrix) {
        return matrix[0] * matrix[3] - matrix[1] * matrix[2];
    }
    function hasAffineReflection(matrix) {
        return affineDeterminant(matrix) < 0;
    }
    function multiplyAffine(left, right) {
        const [a1, b1, c1, d1, e1, f1] = left;
        const [a2, b2, c2, d2, e2, f2] = right;
        return Object.freeze([
            a1 * a2 + c1 * b2,
            b1 * a2 + d1 * b2,
            a1 * c2 + c1 * d2,
            b1 * c2 + d1 * d2,
            a1 * e2 + c1 * f2 + e1,
            b1 * e2 + d1 * f2 + f1,
        ]);
    }
    function invertAffine(matrix, epsilon = AFFINE_EPSILON) {
        const [a, b, c, d, e, f] = matrix;
        const determinant = affineDeterminant(matrix);
        if (!Number.isFinite(determinant) || Math.abs(determinant) <= epsilon) {
            throw new GeometryMutationError('affine', 'matrix is singular and cannot be inverted.');
        }
        return Object.freeze([
            d / determinant,
            -b / determinant,
            -c / determinant,
            a / determinant,
            (c * f - d * e) / determinant,
            (b * e - a * f) / determinant,
        ]);
    }
    function applyAffineToPoint(matrix, point) {
        return Object.freeze({
            x: matrix[0] * point.x + matrix[2] * point.y + matrix[4],
            y: matrix[1] * point.x + matrix[3] * point.y + matrix[5],
        });
    }
    function sanitizeAffineMatrix(matrix, epsilon = AFFINE_EPSILON) {
        return Object.freeze(matrix.map((entry) => (Math.abs(entry) <= epsilon ? 0 : entry)));
    }
    function computeAffineDelta(before, after) {
        return sanitizeAffineMatrix(multiplyAffine(after, invertAffine(before)));
    }

    const dangerousKeys$2 = new Set(['__proto__', 'constructor', 'prototype']);
    function isObject$1(value) {
        return typeof value === 'object' && value !== null;
    }
    function cloneFallback(value, seen) {
        var _a, _b;
        if (!isObject$1(value)) {
            if (typeof value === 'function' || typeof value === 'symbol') {
                throw new StateCloneError(`State contains an unsupported ${typeof value} value.`);
            }
            return value;
        }
        const existing = seen.get(value);
        if (existing !== undefined)
            return existing;
        if (value instanceof Date)
            return new Date(value.getTime());
        if (value instanceof ArrayBuffer)
            return value.slice(0);
        if (ArrayBuffer.isView(value)) {
            const source = value;
            return new Uint8Array(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength));
        }
        if (value instanceof Map) {
            const result = new Map();
            seen.set(value, result);
            for (const [key, entry] of value) {
                result.set(cloneFallback(key, seen), cloneFallback(entry, seen));
            }
            return result;
        }
        if (value instanceof Set) {
            const result = new Set();
            seen.set(value, result);
            for (const entry of value)
                result.add(cloneFallback(entry, seen));
            return result;
        }
        if (Array.isArray(value)) {
            const result = [];
            seen.set(value, result);
            for (const entry of value)
                result.push(cloneFallback(entry, seen));
            return result;
        }
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) {
            throw new StateCloneError(`State contains unsupported object type "${(_b = (_a = prototype === null || prototype === void 0 ? void 0 : prototype.constructor) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : 'unknown'}".`);
        }
        const result = Object.create(null);
        seen.set(value, result);
        for (const key of Object.keys(value)) {
            if (dangerousKeys$2.has(key)) {
                throw new StateCloneError(`State contains dangerous key "${key}".`);
            }
            result[key] = cloneFallback(value[key], seen);
        }
        return result;
    }
    function deepFreeze(value, seen = new WeakSet()) {
        if (!isObject$1(value) || seen.has(value))
            return value;
        seen.add(value);
        if (value instanceof Map) {
            for (const [key, entry] of value) {
                deepFreeze(key, seen);
                deepFreeze(entry, seen);
            }
        }
        else if (value instanceof Set) {
            for (const entry of value)
                deepFreeze(entry, seen);
        }
        else {
            for (const key of Object.keys(value)) {
                deepFreeze(value[key], seen);
            }
        }
        try {
            Object.freeze(value);
        }
        catch {
        }
        return value;
    }
    function cloneStateValue(value) {
        try {
            const structuredCloneFunction = globalThis.structuredClone;
            const cloned = typeof structuredCloneFunction === 'function'
                ? structuredCloneFunction(value)
                : cloneFallback(value, new Map());
            return deepFreeze(cloned);
        }
        catch (error) {
            if (error instanceof StateCloneError)
                throw error;
            throw new StateCloneError('State could not be cloned safely.', error);
        }
    }
    function assertSafeImmutableReference(value, path = '$', seen = new WeakSet()) {
        var _a, _b;
        if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
            throw new StateCloneError(`Reference state at ${path} contains an unsupported ${typeof value}.`);
        }
        if (typeof value === 'number' && !Number.isFinite(value)) {
            throw new StateCloneError(`Reference state at ${path} contains a non-finite number.`);
        }
        if (!isObject$1(value))
            return;
        if (seen.has(value)) {
            throw new StateCloneError(`Reference state at ${path} contains a cyclic reference.`);
        }
        if (!Object.isFrozen(value)) {
            throw new StateCloneError(`Reference state at ${path} must be frozen.`);
        }
        const prototype = Object.getPrototypeOf(value);
        if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
            throw new StateCloneError(`Reference state at ${path} contains unsupported object type "${(_b = (_a = prototype === null || prototype === void 0 ? void 0 : prototype.constructor) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : 'unknown'}".`);
        }
        seen.add(value);
        for (const key of Object.keys(value)) {
            if (dangerousKeys$2.has(key)) {
                throw new StateCloneError(`Reference state at ${path} contains dangerous key "${key}".`);
            }
            assertSafeImmutableReference(value[key], Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`, seen);
        }
        seen.delete(value);
    }
    function isDangerousStateKey(key) {
        return dangerousKeys$2.has(key);
    }

    function assertIdentifier$2(value, label) {
        if (value.trim().length === 0 || value.trim() !== value) {
            throw new GeometryMutationError(value || 'unknown', `${label} must be non-empty and trimmed.`);
        }
    }
    function freezeGeometry(snapshot) {
        if (!isFiniteAffineMatrix(snapshot.matrix) ||
            !Number.isFinite(snapshot.canvasWidth) ||
            !Number.isFinite(snapshot.canvasHeight) ||
            !Number.isSafeInteger(snapshot.revision) ||
            snapshot.revision < 0) {
            throw new GeometryMutationError('geometry', 'captured geometry is malformed.');
        }
        return Object.freeze({
            ...snapshot,
            matrix: Object.freeze([...snapshot.matrix]),
            boundingBox: Object.freeze({ ...snapshot.boundingBox }),
        });
    }
    function createDescriptor(request, before, after, metadata, provisional) {
        const affineDelta = provisional
            ? IDENTITY_AFFINE_MATRIX
            : request.kind === 'raster-replace'
                ? null
                : computeAffineDelta(before.matrix, after.matrix);
        return Object.freeze({
            id: request.id,
            kind: request.kind,
            operationId: request.operationId,
            before,
            after,
            affineDelta,
            hasReflection: affineDelta ? hasAffineReflection(affineDelta) : false,
            sourceRect: request.sourceRect ? Object.freeze({ ...request.sourceRect }) : undefined,
            targetSize: request.targetSize ? Object.freeze({ ...request.targetSize }) : undefined,
            metadata,
        });
    }
    class GeometryMutationCoordinator {
        constructor(options) {
            Object.defineProperty(this, "options", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: options
            });
            Object.defineProperty(this, "participants", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Map()
            });
            Object.defineProperty(this, "usedMutationIds", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Set()
            });
            Object.defineProperty(this, "activeControllers", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Set()
            });
            Object.defineProperty(this, "activePromises", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Set()
            });
            Object.defineProperty(this, "registrationCounter", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
        }
        get isRunning() {
            return this.activePromises.size > 0;
        }
        registerParticipant(participant) {
            this.assertActive('register a participant');
            assertIdentifier$2(participant.id, 'Participant id');
            if (!Number.isFinite(participant.order)) {
                throw new GeometryRegistrationError(`Geometry participant "${participant.id}" must use a finite order.`, participant.id);
            }
            if (this.participants.has(participant.id)) {
                throw new GeometryRegistrationError(`Geometry participant "${participant.id}" is already registered.`, participant.id);
            }
            const record = {
                participant: Object.freeze({ ...participant }),
                registrationOrder: this.registrationCounter++,
            };
            this.participants.set(participant.id, record);
            return createDisposable(() => {
                if (this.participants.get(participant.id) === record) {
                    this.participants.delete(participant.id);
                }
            });
        }
        run(request) {
            this.assertActive('run a geometry mutation');
            try {
                this.validateRequest(request);
            }
            catch (error) {
                return Promise.reject(error);
            }
            const controller = new AbortController();
            this.activeControllers.add(controller);
            const operation = this.performRun(request, controller.signal);
            this.activePromises.add(operation);
            return operation.finally(() => {
                this.activePromises.delete(operation);
                this.activeControllers.delete(controller);
            });
        }
        async dispose() {
            if (this.disposed)
                return;
            this.disposed = true;
            for (const controller of this.activeControllers) {
                controller.abort(new DOMException('Geometry coordinator was disposed.', 'AbortError'));
            }
            await Promise.allSettled([...this.activePromises]);
            this.participants.clear();
            this.usedMutationIds.clear();
        }
        async abortActive(reason) {
            this.assertActive('abort geometry mutations');
            for (const controller of this.activeControllers)
                controller.abort(reason);
            await Promise.allSettled([...this.activePromises]);
        }
        reset() {
            this.assertActive('reset geometry mutations');
            if (this.activePromises.size > 0) {
                throw new GeometryRegistrationError('Cannot reset while a geometry mutation is active.');
            }
            this.participants.clear();
            this.usedMutationIds.clear();
            this.registrationCounter = 0;
        }
        disposeSync() {
            if (this.disposed)
                return;
            if (this.activePromises.size > 0) {
                throw new GeometryRegistrationError('Cannot synchronously dispose an active geometry mutation.');
            }
            this.disposed = true;
            this.participants.clear();
            this.usedMutationIds.clear();
        }
        async performRun(request, signal) {
            var _a, _b, _c;
            const metadata = cloneStateValue((_a = request.metadata) !== null && _a !== void 0 ? _a : {});
            let before = null;
            let provisional = null;
            const participantSnapshot = Object.freeze([...this.participants.values()].sort((left, right) => left.participant.order - right.participant.order ||
                left.registrationOrder - right.registrationOrder));
            const geometryParticipant = Object.freeze({
                id: 'core:geometry-participants',
                order: 0,
                prepare: async (context) => {
                    const capturedBefore = freezeGeometry(this.options.state.captureGeometry());
                    const provisionalDescriptor = createDescriptor(request, capturedBefore, capturedBefore, metadata, true);
                    before = capturedBefore;
                    provisional = provisionalDescriptor;
                    const participantContext = this.createParticipantContext(request.id, context.signal);
                    const entries = [];
                    for (const record of participantSnapshot) {
                        if (!record.participant.supports(provisionalDescriptor))
                            continue;
                        const prepared = record.participant.prepare
                            ? await record.participant.prepare(provisionalDescriptor, participantContext)
                            : undefined;
                        entries.push({ record, prepared });
                    }
                    return Object.freeze({
                        entries: Object.freeze(entries),
                        context: participantContext,
                    });
                },
                apply: async (descriptor, prepared) => {
                    for (const entry of prepared.entries) {
                        try {
                            await entry.record.participant.apply(descriptor, entry.prepared, prepared.context);
                        }
                        catch (error) {
                            if (error instanceof GeometryRecoverableObjectError) {
                                this.warnRecoverable(request.id, entry.record.participant.id, error);
                                continue;
                            }
                            throw error;
                        }
                    }
                },
                synchronize: async (descriptor, prepared) => {
                    var _a, _b;
                    for (const entry of prepared.entries) {
                        try {
                            await ((_b = (_a = entry.record.participant).synchronize) === null || _b === void 0 ? void 0 : _b.call(_a, descriptor, prepared.context));
                        }
                        catch (error) {
                            if (error instanceof GeometryRecoverableObjectError) {
                                this.warn({
                                    code: 'GEOMETRY_SYNCHRONIZE_WARNING',
                                    message: error.message,
                                    mutationId: request.id,
                                    participantId: entry.record.participant.id,
                                    objectIdentity: error.objectIdentity,
                                    objectKind: error.objectKind,
                                    cause: error.cause,
                                });
                                continue;
                            }
                            throw error;
                        }
                    }
                },
                rollback: participantSnapshot.some(({ participant }) => participant.rollback)
                    ? async (prepared, rollbackContext) => {
                        var _a, _b, _c;
                        const descriptor = (_a = rollbackContext.result) !== null && _a !== void 0 ? _a : provisional;
                        if (!descriptor)
                            return;
                        for (let index = prepared.entries.length - 1; index >= 0; index -= 1) {
                            const entry = prepared.entries[index];
                            if (!entry)
                                continue;
                            await ((_c = (_b = entry.record.participant).rollback) === null || _c === void 0 ? void 0 : _c.call(_b, descriptor, entry.prepared, prepared.context));
                        }
                    }
                    : undefined,
            });
            try {
                return await this.options.mutations.run({
                    id: request.id,
                    kind: 'geometry',
                    operationId: request.operationId,
                    conflictDomains: ['document', 'base-image', 'geometry', 'overlay', 'state'],
                    signal,
                    parent: request.parent,
                    metadata,
                    participants: [geometryParticipant],
                    mutate: async (context) => {
                        const capturedBefore = before;
                        if (!capturedBefore) {
                            throw new GeometryMutationError(request.id, 'geometry preparation did not capture the before state.');
                        }
                        await request.mutateBase(Object.freeze({ signal: context.signal, transaction: context }));
                        await this.options.state.finalizeGeometry();
                        const after = freezeGeometry(this.options.state.captureGeometry());
                        if (after.revision <= capturedBefore.revision) {
                            throw new GeometryMutationError(request.id, `geometry revision must increase (${capturedBefore.revision} -> ${after.revision}).`);
                        }
                        return createDescriptor(request, capturedBefore, after, metadata, false);
                    },
                    rollback: request.rollbackBase
                        ? async (context) => {
                            var _a, _b, _c;
                            await ((_a = request.rollbackBase) === null || _a === void 0 ? void 0 : _a.call(request, Object.freeze({ signal: context.signal, cause: context.cause })));
                            if (before)
                                await ((_c = (_b = this.options.state).restoreGeometry) === null || _c === void 0 ? void 0 : _c.call(_b, before));
                        }
                        : undefined,
                });
            }
            catch (error) {
                const failure = this.toGeometryFailure(request.id, error);
                (_c = (_b = this.options).errorSink) === null || _c === void 0 ? void 0 : _c.call(_b, failure);
                throw failure;
            }
        }
        createParticipantContext(mutationId, signal) {
            return Object.freeze({
                signal,
                warnRecoverable: (error, objectIdentity, objectKind) => {
                    this.warn({
                        code: 'GEOMETRY_OBJECT_SKIPPED',
                        message: 'An overlay transform skipped a malformed or unsupported object.',
                        mutationId,
                        objectIdentity,
                        objectKind,
                        cause: error,
                    });
                },
            });
        }
        warnRecoverable(mutationId, participantId, error) {
            this.warn({
                code: 'GEOMETRY_OBJECT_SKIPPED',
                message: error.message,
                mutationId,
                participantId,
                objectIdentity: error.objectIdentity,
                objectKind: error.objectKind,
                cause: error.cause,
            });
        }
        toGeometryFailure(mutationId, error) {
            if (error instanceof DocumentMutationUnrecoverableError) {
                return new GeometryUnrecoverableError(mutationId, error.cause, error.rollbackErrors);
            }
            if (error instanceof DocumentMutationError) {
                return new GeometryMutationError(mutationId, error.cause instanceof Error ? error.cause.message : error.message, error.cause, error.rollbackErrors);
            }
            if (error instanceof GeometryMutationError)
                return error;
            return new GeometryMutationError(mutationId, error instanceof Error ? error.message : 'unknown failure.', error);
        }
        validateRequest(request) {
            var _a, _b;
            assertIdentifier$2(request.id, 'Mutation id');
            assertIdentifier$2(request.kind, 'Mutation kind');
            assertIdentifier$2(request.operationId, 'Operation id');
            if (this.usedMutationIds.has(request.id)) {
                throw new GeometryMutationError(request.id, 'mutation id has already been used.');
            }
            if (typeof request.mutateBase !== 'function') {
                throw new GeometryMutationError(request.id, 'mutateBase must be a function.');
            }
            const metadata = JSON.stringify((_a = request.metadata) !== null && _a !== void 0 ? _a : {});
            const maxMetadataBytes = (_b = this.options.maxMetadataBytes) !== null && _b !== void 0 ? _b : 64 * 1024;
            if (new TextEncoder().encode(metadata).byteLength > maxMetadataBytes) {
                throw new GeometryMutationError(request.id, `metadata exceeds ${maxMetadataBytes} bytes.`);
            }
            this.usedMutationIds.add(request.id);
        }
        warn(warning) {
            var _a, _b, _c, _d;
            try {
                (_b = (_a = this.options).warningSink) === null || _b === void 0 ? void 0 : _b.call(_a, Object.freeze(warning));
            }
            catch (error) {
                (_d = (_c = this.options).errorSink) === null || _d === void 0 ? void 0 : _d.call(_c, error);
            }
        }
        assertActive(operation) {
            if (this.disposed) {
                throw new GeometryRegistrationError(`Cannot ${operation} after coordinator disposal.`);
            }
        }
    }

    const unavailableHistory = Object.freeze({
        isAvailable: () => false,
        commit: () => undefined,
    });
    class HistoryCommitRouter {
        constructor() {
            Object.defineProperty(this, "provider", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: unavailableHistory
            });
            Object.defineProperty(this, "owner", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: null
            });
        }
        register(owner, provider) {
            if (!isRuntimeIdentifier(owner)) {
                throw new CoreRuntimeError('[ImageEditor] History provider owner must match "namespace:kebab-case".');
            }
            if (this.owner) {
                throw new CoreRuntimeError(`[ImageEditor] History commit provider is already registered by "${this.owner}".`);
            }
            this.owner = owner;
            this.provider = provider;
            return createDisposable(() => {
                if (this.owner !== owner || this.provider !== provider)
                    return;
                this.owner = null;
                this.provider = unavailableHistory;
            });
        }
        isAvailable() {
            return this.provider.isAvailable();
        }
        commit(record) {
            const coreRecord = Object.freeze({
                operationId: record.operationId,
                before: record.before,
                after: record.after,
                timestamp: record.timestamp,
                detail: record.detail,
            });
            return this.provider.commit(coreRecord);
        }
    }

    const CORE_STATUS_CAPABILITY = createCapabilityToken('core:status', '1.0.0');
    const CORE_DIAGNOSTICS_CAPABILITY = createCapabilityToken('core:diagnostics', '1.0.0');
    const CORE_PRESENTATION_CAPABILITY = createCapabilityToken('core:presentation', '1.0.0');
    const FABRIC_RUNTIME_CAPABILITY = createCapabilityToken('fabric:runtime', '1.0.0');
    const CANVAS_READ_CAPABILITY = createCapabilityToken('core:canvas-read', '1.0.0');
    const BASE_IMAGE_READ_CAPABILITY = createCapabilityToken('core:base-image-read', '1.0.0');
    const BASE_IMAGE_INFO_CAPABILITY = createCapabilityToken('core:base-image-info', '1.0.0');
    const IMAGE_RESOURCE_POLICY_CAPABILITY = createCapabilityToken('core:image-resource-policy', '1.0.0');
    const RENDER_REQUEST_CAPABILITY = createCapabilityToken('core:render-request', '1.0.0');
    const CANVAS_RESIZE_CAPABILITY = createCapabilityToken('core:canvas-resize', '1.0.0');
    const RASTER_MUTATION_CAPABILITY = createCapabilityToken('core:raster-mutation', '1.0.0');
    const SNAPSHOT_REGISTRATION_CAPABILITY = createCapabilityToken('core:snapshot-registration', '1.0.0');
    const MEMENTO_HISTORY_CAPABILITY = createCapabilityToken('core:memento-history', '1.0.0');
    const GEOMETRY_MUTATION_CAPABILITY = createCapabilityToken('core:geometry', '1.0.0');
    const DOCUMENT_MUTATION_CAPABILITY = createCapabilityToken('core:document-mutation', '1.0.0');
    const EXPORT_CONTRIBUTION_CAPABILITY = createCapabilityToken('core:export', '1.0.0');

    const CORE_ENVIRONMENT_CAPABILITY = createCapabilityToken('core:environment', '1.0.0');

    const ALLOWED_TRANSITIONS = {
        configured: ['initializing', 'disposing'],
        initializing: ['configured', 'initialized', 'faulted'],
        initialized: ['disposing', 'faulted'],
        disposing: ['disposed'],
        disposed: [],
        faulted: ['configured', 'disposing'],
    };
    class EditorLifecycleController {
        constructor() {
            Object.defineProperty(this, "state", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'configured'
            });
        }
        get current() {
            return this.state;
        }
        beginInitialization() {
            switch (this.state) {
                case 'configured':
                    this.transition('initializing');
                    return;
                case 'initializing':
                    throw new EditorInitializationInProgressError();
                case 'initialized':
                    throw new EditorAlreadyInitializedError();
                case 'disposing':
                    throw new EditorDisposingError('initialize');
                case 'disposed':
                    throw new EditorDisposedError('initialize');
                case 'faulted':
                    throw new EditorFaultedError('initialize');
            }
        }
        completeInitialization() {
            this.transition('initialized');
        }
        recoverInitialization() {
            this.transition('configured');
        }
        failInitialization() {
            this.transition('faulted');
        }
        failRuntime() {
            if (this.state === 'faulted')
                return;
            if (this.state !== 'initialized') {
                throw new CoreRuntimeError(`[ImageEditor] Cannot enter faulted from "${this.state}" during runtime.`, { code: 'INVALID_LIFECYCLE_TRANSITION', behavior: 'lifecycle' });
            }
            this.transition('faulted');
        }
        recoverFault() {
            if (this.state !== 'faulted') {
                throw new CoreRuntimeError(`[ImageEditor] Cannot complete emergency reset from "${this.state}".`, { code: 'INVALID_LIFECYCLE_TRANSITION', behavior: 'lifecycle' });
            }
            this.transition('configured');
        }
        beginDisposal() {
            if (this.state === 'disposing' || this.state === 'disposed')
                return false;
            if (this.state === 'initializing') {
                throw new EditorInitializationInProgressError('dispose');
            }
            this.transition('disposing');
            return true;
        }
        completeDisposal() {
            this.transition('disposed');
        }
        assertOperational(operation) {
            switch (this.state) {
                case 'initialized':
                    return;
                case 'configured':
                    throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} before initialization.`, { code: 'EDITOR_NOT_INITIALIZED' });
                case 'initializing':
                    throw new EditorInitializationInProgressError(operation);
                case 'disposing':
                    throw new EditorDisposingError(operation);
                case 'disposed':
                    throw new EditorDisposedError(operation);
                case 'faulted':
                    throw new EditorFaultedError(operation);
            }
        }
        assertAvailable(operation) {
            switch (this.state) {
                case 'disposing':
                    throw new EditorDisposingError(operation);
                case 'disposed':
                    throw new EditorDisposedError(operation);
                case 'faulted':
                    throw new EditorFaultedError(operation);
                default:
                    return;
            }
        }
        transition(next) {
            const allowed = ALLOWED_TRANSITIONS[this.state];
            if (!allowed.includes(next)) {
                throw new CoreRuntimeError(`[ImageEditor] Invalid lifecycle transition from "${this.state}" to "${next}".`, { code: 'INVALID_LIFECYCLE_TRANSITION' });
            }
            this.state = next;
        }
    }

    function isCancellation(error) {
        return (typeof error === 'object' &&
            error !== null &&
            'name' in error &&
            error.name === 'AbortError');
    }
    function assertIdentifier$1(value, label) {
        if (value.trim().length === 0 || value.trim() !== value) {
            throw new DocumentMutationRegistrationError(`${label} must be non-empty and trimmed.`);
        }
    }
    function immutableMetadata(value) {
        const cloned = cloneStateValue(value !== null && value !== void 0 ? value : {});
        if (typeof cloned !== 'object' || cloned === null || Array.isArray(cloned)) {
            throw new DocumentMutationRegistrationError('Mutation metadata must be an object.');
        }
        return Object.freeze(cloned);
    }
    class DocumentMutationCoordinator {
        constructor(options) {
            Object.defineProperty(this, "options", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: options
            });
            Object.defineProperty(this, "usedTransactionIds", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Set()
            });
            Object.defineProperty(this, "contextRecords", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new WeakMap()
            });
            Object.defineProperty(this, "activeControllers", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Set()
            });
            Object.defineProperty(this, "activePromises", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Set()
            });
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
        }
        get isRunning() {
            return this.activePromises.size > 0;
        }
        assertContextActive(context) {
            const record = this.contextRecords.get(context);
            if (!record || record.session.closed || context.signal.aborted) {
                throw new DocumentMutationInvariantError(context.transactionId, new Error('The document mutation context is not active.'));
            }
        }
        run(request) {
            var _a, _b, _c, _d;
            let normalized;
            let parentRecord;
            try {
                this.assertActive('run a document mutation');
                (_b = (_a = this.options.state).assertOperational) === null || _b === void 0 ? void 0 : _b.call(_a, 'run a document mutation');
                normalized = this.normalizeRequest(request);
                parentRecord = normalized.parent ? this.requireParent(normalized.parent) : null;
            }
            catch (error) {
                return Promise.reject(error);
            }
            const controller = new AbortController();
            const abort = () => { var _a; return controller.abort((_a = normalized.signal) === null || _a === void 0 ? void 0 : _a.reason); };
            if ((_c = normalized.signal) === null || _c === void 0 ? void 0 : _c.aborted)
                abort();
            else
                (_d = normalized.signal) === null || _d === void 0 ? void 0 : _d.addEventListener('abort', abort, { once: true });
            this.activeControllers.add(controller);
            const operation = this.options.operations.run(normalized.operationId, (operationContext) => parentRecord
                ? this.performNested(normalized, operationContext.token, parentRecord)
                : this.performTopLevel(normalized, operationContext.token), {
                parent: parentRecord === null || parentRecord === void 0 ? void 0 : parentRecord.operationToken,
                signal: controller.signal,
            });
            this.activePromises.add(operation);
            return operation.finally(() => {
                var _a;
                (_a = normalized.signal) === null || _a === void 0 ? void 0 : _a.removeEventListener('abort', abort);
                this.activeControllers.delete(controller);
                this.activePromises.delete(operation);
            });
        }
        async dispose() {
            if (this.disposed)
                return;
            this.disposed = true;
            const reason = new DOMException('Document Mutation Coordinator was disposed.', 'AbortError');
            for (const controller of this.activeControllers)
                controller.abort(reason);
            await Promise.allSettled([...this.activePromises]);
            this.activeControllers.clear();
            this.usedTransactionIds.clear();
        }
        async abortActive(reason) {
            this.assertActive('abort document mutations');
            for (const controller of this.activeControllers)
                controller.abort(reason);
            await Promise.allSettled([...this.activePromises]);
        }
        reset() {
            this.assertActive('reset document mutations');
            if (this.activePromises.size > 0) {
                throw new DocumentMutationRegistrationError('Cannot reset while a document mutation is active.');
            }
            this.usedTransactionIds.clear();
        }
        disposeSync() {
            if (this.disposed)
                return;
            if (this.activePromises.size > 0) {
                throw new DocumentMutationRegistrationError('Cannot synchronously dispose an active document mutation.');
            }
            this.disposed = true;
            this.usedTransactionIds.clear();
        }
        async performTopLevel(request, operationToken) {
            const before = this.options.mementos.capture();
            const session = {
                before,
                rollbackEntries: [],
                validators: [],
                diagnostics: [],
                failure: null,
                closed: false,
            };
            const context = this.createContext(request, operationToken, session, null);
            let result;
            let committedResult;
            try {
                result = await this.executeRequest(request, context, session);
                if (session.failure)
                    throw session.failure;
                this.throwIfUnavailable(context.signal, request.id);
                this.options.state.requestRender();
                for (const validate of session.validators) {
                    this.throwIfUnavailable(context.signal, request.id);
                    try {
                        await validate();
                    }
                    catch (error) {
                        throw new DocumentMutationInvariantError(request.id, error);
                    }
                }
                this.throwIfUnavailable(context.signal, request.id);
                committedResult = request.describeCommit
                    ? await request.describeCommit(result, context)
                    : result;
                this.throwIfUnavailable(context.signal, request.id);
            }
            catch (error) {
                session.closed = true;
                throw await this.restoreAfterFailure(request.id, session, error);
            }
            let descriptor;
            try {
                const after = this.options.mementos.capture();
                descriptor = Object.freeze({
                    transactionId: request.id,
                    parentTransactionId: null,
                    kind: request.kind,
                    operationId: request.operationId,
                    conflictDomains: request.conflictDomains,
                    metadata: request.metadata,
                    diagnostics: Object.freeze([...session.diagnostics]),
                    result: committedResult,
                    committedAt: Date.now(),
                });
                if (this.options.history.isAvailable()) {
                    await this.options.history.commit(Object.freeze({
                        operationId: request.operationId,
                        before,
                        after,
                        timestamp: descriptor.committedAt,
                        detail: descriptor,
                    }));
                }
            }
            catch (error) {
                session.closed = true;
                throw await this.restoreAfterFailure(request.id, session, error);
            }
            session.closed = true;
            try {
                await this.options.events.emitCommitted(descriptor);
            }
            catch (error) {
                this.warn({
                    code: 'DOCUMENT_COMMITTED_OBSERVER_FAILED',
                    message: 'A committed document observer failed after the transaction committed.',
                    transactionId: request.id,
                    cause: error,
                });
            }
            return result;
        }
        async performNested(request, operationToken, parentRecord) {
            var _a;
            var _b;
            const parent = request.parent;
            if (!parent) {
                throw new DocumentMutationRegistrationError('Nested mutation requires a parent.');
            }
            const context = this.createContext(request, operationToken, parentRecord.session, parent);
            try {
                return await this.executeRequest(request, context, parentRecord.session);
            }
            catch (error) {
                (_a = (_b = parentRecord.session).failure) !== null && _a !== void 0 ? _a : (_b.failure = error);
                throw error;
            }
        }
        async executeRequest(request, context, session) {
            var _a, _b, _c, _d, _e;
            const outcome = { result: undefined };
            const requestRollback = request.rollback
                ? {
                    enabled: false,
                    run: async (cause) => {
                        var _a;
                        const rollbackContext = this.createRollbackContext(context, cause, outcome.result);
                        await ((_a = request.rollback) === null || _a === void 0 ? void 0 : _a.call(request, rollbackContext));
                    },
                }
                : null;
            if (requestRollback)
                session.rollbackEntries.push(requestRollback);
            const prepared = [];
            for (const participant of request.participants) {
                this.throwIfUnavailable(context.signal, request.id);
                const preparedValue = participant.prepare
                    ? await participant.prepare(context)
                    : undefined;
                prepared.push({ participant, value: preparedValue });
                if (participant.rollback) {
                    session.rollbackEntries.push({
                        enabled: true,
                        run: async (cause) => {
                            var _a;
                            const rollbackContext = this.createRollbackContext(context, cause, outcome.result);
                            await ((_a = participant.rollback) === null || _a === void 0 ? void 0 : _a.call(participant, preparedValue, rollbackContext));
                        },
                    });
                }
            }
            this.throwIfUnavailable(context.signal, request.id);
            if (requestRollback)
                requestRollback.enabled = true;
            const result = await request.mutate(context);
            outcome.result = result;
            this.throwIfUnavailable(context.signal, request.id);
            for (const entry of prepared) {
                await ((_b = (_a = entry.participant).apply) === null || _b === void 0 ? void 0 : _b.call(_a, result, entry.value, context));
                this.throwIfUnavailable(context.signal, request.id);
            }
            for (const entry of prepared) {
                await ((_d = (_c = entry.participant).synchronize) === null || _d === void 0 ? void 0 : _d.call(_c, result, entry.value, context));
                this.throwIfUnavailable(context.signal, request.id);
            }
            await ((_e = request.synchronize) === null || _e === void 0 ? void 0 : _e.call(request, result, context));
            this.throwIfUnavailable(context.signal, request.id);
            if (request.validate) {
                session.validators.push(async () => { var _a; return (_a = request.validate) === null || _a === void 0 ? void 0 : _a.call(request, result, context); });
            }
            return result;
        }
        createContext(request, operationToken, session, parent) {
            var _a, _b;
            const participantIds = Object.freeze(request.participants.map(({ id }) => id));
            const context = Object.freeze({
                transactionId: request.id,
                parentTransactionId: (_a = parent === null || parent === void 0 ? void 0 : parent.transactionId) !== null && _a !== void 0 ? _a : null,
                operationId: request.operationId,
                conflictDomains: request.conflictDomains,
                historyOwner: parent ? 'parent' : 'self',
                eventOwner: parent ? 'parent' : 'self',
                signal: operationToken.signal,
                participantIds,
                metadata: request.metadata,
            });
            this.contextRecords.set(context, { session, operationToken });
            session.diagnostics.push(Object.freeze({
                transactionId: request.id,
                parentTransactionId: (_b = parent === null || parent === void 0 ? void 0 : parent.transactionId) !== null && _b !== void 0 ? _b : null,
                participantIds,
                metadata: request.metadata,
            }));
            return context;
        }
        createRollbackContext(context, cause, result) {
            return Object.freeze({
                ...context,
                signal: new AbortController().signal,
                cause,
                result,
            });
        }
        async restoreAfterFailure(transactionId, session, cause) {
            var _a, _b, _c, _d, _e, _f;
            const rollbackErrors = [];
            for (let index = session.rollbackEntries.length - 1; index >= 0; index -= 1) {
                const entry = session.rollbackEntries[index];
                if (!(entry === null || entry === void 0 ? void 0 : entry.enabled))
                    continue;
                try {
                    await entry.run(cause);
                }
                catch (error) {
                    rollbackErrors.push(error);
                }
            }
            let targetedStateMatches = false;
            const targetedRollbackRan = session.rollbackEntries.some((entry) => entry.enabled);
            if (targetedRollbackRan && rollbackErrors.length === 0 && this.options.mementos.matches) {
                try {
                    targetedStateMatches = await this.options.mementos.matches(session.before);
                }
                catch (error) {
                    rollbackErrors.push(error);
                }
            }
            if (!targetedStateMatches) {
                try {
                    await this.options.mementos.restore(session.before, {
                        rollbackOnFailure: false,
                    });
                }
                catch (restoreError) {
                    rollbackErrors.push(restoreError);
                    const failure = new DocumentMutationUnrecoverableError(transactionId, cause, Object.freeze(rollbackErrors));
                    (_b = (_a = this.options).faultSink) === null || _b === void 0 ? void 0 : _b.call(_a, failure);
                    (_d = (_c = this.options).errorSink) === null || _d === void 0 ? void 0 : _d.call(_c, failure);
                    return failure;
                }
            }
            if (!this.options.state.isDisposed()) {
                try {
                    this.options.state.requestRender();
                }
                catch (error) {
                    rollbackErrors.push(error);
                }
            }
            if (isCancellation(cause))
                return cause;
            const failure = cause instanceof DocumentMutationError
                ? cause
                : new DocumentMutationError(transactionId, cause instanceof Error ? cause.message : 'unknown failure.', cause, Object.freeze(rollbackErrors));
            (_f = (_e = this.options).errorSink) === null || _f === void 0 ? void 0 : _f.call(_e, failure);
            return failure;
        }
        normalizeRequest(request) {
            var _a, _b;
            assertIdentifier$1(request.id, 'Transaction id');
            assertIdentifier$1(request.kind, 'Mutation kind');
            assertIdentifier$1(request.operationId, 'Operation id');
            if (this.usedTransactionIds.has(request.id)) {
                throw new DocumentMutationRegistrationError(`Transaction id "${request.id}" has already been used.`, request.id);
            }
            if (!this.options.operations.has(request.operationId)) {
                throw new DocumentMutationRegistrationError(`Operation "${request.operationId}" is not registered.`, request.id);
            }
            const operation = this.options.operations.get(request.operationId);
            if (!operation) {
                throw new DocumentMutationRegistrationError(`Operation "${request.operationId}" is unavailable.`, request.id);
            }
            if (!Array.isArray(request.conflictDomains) ||
                request.conflictDomains.length === 0 ||
                request.conflictDomains.some((domain) => !operation.conflictDomains.includes(domain))) {
                throw new DocumentMutationRegistrationError('Mutation conflict domains must be covered by its registered operation.', request.id);
            }
            if (typeof request.mutate !== 'function') {
                throw new DocumentMutationRegistrationError('Mutation request must define mutate().', request.id);
            }
            const participants = [...((_a = request.participants) !== null && _a !== void 0 ? _a : [])];
            const participantIds = new Set();
            for (const participant of participants) {
                assertIdentifier$1(participant.id, 'Participant id');
                if (!Number.isFinite(participant.order)) {
                    throw new DocumentMutationRegistrationError(`Participant "${participant.id}" must use a finite order.`, request.id);
                }
                if (participantIds.has(participant.id)) {
                    throw new DocumentMutationRegistrationError(`Participant "${participant.id}" is duplicated.`, request.id);
                }
                participantIds.add(participant.id);
            }
            participants.sort((left, right) => left.order - right.order);
            const metadata = immutableMetadata(request.metadata);
            const serializedMetadata = JSON.stringify(metadata);
            const maxMetadataBytes = (_b = this.options.maxMetadataBytes) !== null && _b !== void 0 ? _b : 64 * 1024;
            if (new TextEncoder().encode(serializedMetadata).byteLength > maxMetadataBytes) {
                throw new DocumentMutationRegistrationError(`Mutation metadata exceeds ${maxMetadataBytes} bytes.`, request.id);
            }
            this.usedTransactionIds.add(request.id);
            return Object.freeze({
                ...request,
                conflictDomains: Object.freeze([...request.conflictDomains]),
                participants: Object.freeze(participants),
                metadata,
            });
        }
        requireParent(parent) {
            const record = this.contextRecords.get(parent);
            if (!record || record.session.closed || parent.signal.aborted) {
                throw new DocumentMutationRegistrationError(`Parent transaction "${parent.transactionId}" is not active.`, parent.transactionId);
            }
            return record;
        }
        throwIfUnavailable(signal, transactionId) {
            var _a;
            if (signal.aborted) {
                throw (_a = signal.reason) !== null && _a !== void 0 ? _a : new DOMException('Document mutation was aborted.', 'AbortError');
            }
            if (this.options.state.isDisposed()) {
                throw new DocumentMutationError(transactionId, 'Core state is disposed.');
            }
        }
        warn(warning) {
            var _a, _b, _c, _d;
            try {
                (_b = (_a = this.options).warningSink) === null || _b === void 0 ? void 0 : _b.call(_a, Object.freeze(warning));
            }
            catch (error) {
                (_d = (_c = this.options).errorSink) === null || _d === void 0 ? void 0 : _d.call(_c, error);
            }
        }
        assertActive(operation) {
            if (this.disposed) {
                throw new DocumentMutationRegistrationError(`Cannot ${operation} after coordinator disposal.`);
            }
        }
    }

    function createAbortError(message) {
        if (typeof DOMException === 'function')
            return new DOMException(message, 'AbortError');
        const error = new Error(message);
        error.name = 'AbortError';
        return error;
    }
    function throwIfAborted$1(signal) {
        var _a;
        if (signal.aborted)
            throw (_a = signal.reason) !== null && _a !== void 0 ? _a : createAbortError('State restoration was aborted.');
    }
    class MementoService {
        constructor(coreAdapter, slices) {
            Object.defineProperty(this, "coreAdapter", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: coreAdapter
            });
            Object.defineProperty(this, "slices", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: slices
            });
            Object.defineProperty(this, "trustedMementos", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new WeakSet()
            });
            Object.defineProperty(this, "revision", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "restoring", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
        }
        capture() {
            this.assertActive('capture a memento');
            if (this.restoring) {
                throw new StateRegistrationError('Cannot capture a new memento during restoration.');
            }
            return this.captureInternal();
        }
        isTrusted(value) {
            return typeof value === 'object' && value !== null && this.trustedMementos.has(value);
        }
        matches(memento) {
            this.assertActive('compare a memento');
            if (!this.isTrusted(memento))
                return false;
            const current = this.captureInternal(false);
            return (JSON.stringify(current.core) === JSON.stringify(memento.core) &&
                JSON.stringify(current.plugins) === JSON.stringify(memento.plugins));
        }
        async restore(memento, options = {}) {
            this.assertActive('restore a memento');
            if (!this.isTrusted(memento)) {
                throw new MementoRestoreError('core', 'restore', new Error('Untrusted memento.'));
            }
            if (this.restoring) {
                throw new MementoRestoreError('core', 'restore', new Error('Reentrant memento restoration is not allowed.'));
            }
            const controller = new AbortController();
            const providedSignal = options.signal;
            const abort = () => controller.abort(providedSignal === null || providedSignal === void 0 ? void 0 : providedSignal.reason);
            providedSignal === null || providedSignal === void 0 ? void 0 : providedSignal.addEventListener('abort', abort, { once: true });
            if (providedSignal === null || providedSignal === void 0 ? void 0 : providedSignal.aborted)
                abort();
            this.restoring = true;
            let rollback = null;
            try {
                if (options.rollbackOnFailure !== false)
                    rollback = this.captureInternal(false);
                await this.restoreInternal(memento, 'trusted-memento', controller.signal);
            }
            catch (error) {
                if (!rollback) {
                    if (error instanceof MementoRestoreError)
                        throw error;
                    throw new MementoRestoreError('core', 'restore', error);
                }
                const rollbackErrors = [];
                try {
                    await this.restoreInternal(rollback, 'rollback', new AbortController().signal);
                }
                catch (rollbackError) {
                    rollbackErrors.push(rollbackError);
                }
                if (error instanceof MementoRestoreError) {
                    throw new MementoRestoreError(error.sliceId, 'restore', error.cause, rollbackErrors);
                }
                throw new MementoRestoreError('core', 'restore', error, rollbackErrors);
            }
            finally {
                providedSignal === null || providedSignal === void 0 ? void 0 : providedSignal.removeEventListener('abort', abort);
                this.restoring = false;
            }
        }
        dispose() {
            this.disposed = true;
        }
        reset() {
            this.assertActive('reset MementoService');
            if (this.restoring) {
                throw new StateRegistrationError('Cannot reset MementoService during restoration.');
            }
            this.trustedMementos = new WeakSet();
            this.revision = 0;
        }
        captureInternal(validateReferenceIdentity = true) {
            var _a;
            const capturedAt = Date.now();
            const context = Object.freeze({ mode: 'memento', capturedAt });
            let core;
            try {
                core = cloneStateValue(this.coreAdapter.capture(context));
                assertSafeImmutableReference(core);
            }
            catch (error) {
                throw new MementoCaptureError('core', error);
            }
            const plugins = Object.create(null);
            for (const slice of this.slices.list()) {
                try {
                    const captured = slice.capture(context);
                    let capturePolicy = (_a = slice.capturePolicy) !== null && _a !== void 0 ? _a : 'always';
                    let data;
                    if (capturePolicy === 'reference') {
                        if (validateReferenceIdentity) {
                            const validation = slice.validate(captured, {
                                sliceId: slice.id,
                                version: slice.version,
                            });
                            if (!validation.valid || validation.value !== captured) {
                                throw new Error(validation.valid
                                    ? 'Reference validation must preserve the captured identity.'
                                    : validation.message);
                            }
                            assertSafeImmutableReference(captured);
                            data = captured;
                        }
                        else {
                            data = cloneStateValue(captured);
                            capturePolicy = 'always';
                        }
                    }
                    else {
                        data = cloneStateValue(captured);
                    }
                    assertSafeImmutableReference(data);
                    plugins[slice.id] = Object.freeze({
                        version: slice.version,
                        capturePolicy,
                        data,
                    });
                }
                catch (error) {
                    throw new MementoCaptureError(slice.id, error);
                }
            }
            const memento = Object.freeze({
                revision: ++this.revision,
                capturedAt,
                core,
                plugins: Object.freeze(plugins),
            });
            this.trustedMementos.add(memento);
            return memento;
        }
        async restoreInternal(memento, mode, signal) {
            var _a;
            const context = Object.freeze({ mode, signal });
            throwIfAborted$1(signal);
            try {
                await this.coreAdapter.restore(cloneStateValue(memento.core), context);
            }
            catch (error) {
                throw new MementoRestoreError('core', mode === 'rollback' ? 'rollback' : 'restore', error);
            }
            for (const slice of this.slices.list()) {
                throwIfAborted$1(signal);
                const entry = memento.plugins[slice.id];
                try {
                    if (!entry) {
                        await ((_a = slice.clearState) === null || _a === void 0 ? void 0 : _a.call(slice, context));
                        continue;
                    }
                    if (entry.version !== slice.version) {
                        throw new Error(`Captured version ${entry.version} does not match installed version ${slice.version}.`);
                    }
                    await slice.restore(entry.capturePolicy === 'reference' ? entry.data : cloneStateValue(entry.data), context);
                }
                catch (error) {
                    throw new MementoRestoreError(slice.id, mode === 'rollback' ? 'rollback' : 'restore', error);
                }
            }
        }
        assertActive(operation) {
            if (this.disposed) {
                throw new StateRegistrationError(`Cannot ${operation} after MementoService disposal.`);
            }
        }
    }

    function assertIdentifier(value, label) {
        if (value.trim().length === 0 || value.trim() !== value) {
            throw new StateRegistrationError(`${label} must be a non-empty trimmed string.`);
        }
    }
    class ObjectPropertyRegistry {
        constructor() {
            Object.defineProperty(this, "properties", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Map()
            });
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
        }
        register(registration) {
            this.assertActive();
            if (!isRuntimeIdentifier(registration.owner)) {
                throw new StateRegistrationError('Object property owner must match "namespace:kebab-case".', registration.owner);
            }
            if (registration.keys.length === 0) {
                throw new StateRegistrationError(`Object property registration for "${registration.owner}" must include a key.`);
            }
            const keys = [...new Set(registration.keys)];
            for (const key of keys) {
                assertIdentifier(key, 'Object property key');
                if (isDangerousStateKey(key)) {
                    throw new StateRegistrationError(`Object property key "${key}" is forbidden.`);
                }
                const existing = this.properties.get(key);
                if (existing && existing.owner !== registration.owner) {
                    throw new StateRegistrationError(`Object property "${key}" is already owned by "${existing.owner}".`);
                }
            }
            for (const key of keys) {
                const existing = this.properties.get(key);
                if (existing)
                    existing.references += 1;
                else
                    this.properties.set(key, { owner: registration.owner, references: 1 });
            }
            return createDisposable(() => {
                for (const key of keys) {
                    const record = this.properties.get(key);
                    if (!record || record.owner !== registration.owner)
                        continue;
                    record.references -= 1;
                    if (record.references === 0)
                        this.properties.delete(key);
                }
            });
        }
        listKeys() {
            this.assertActive();
            return Object.freeze([...this.properties.keys()]);
        }
        getOwner(key) {
            var _a, _b;
            this.assertActive();
            return (_b = (_a = this.properties.get(key)) === null || _a === void 0 ? void 0 : _a.owner) !== null && _b !== void 0 ? _b : null;
        }
        dispose() {
            if (this.disposed)
                return;
            this.properties.clear();
            this.disposed = true;
        }
        assertActive() {
            if (this.disposed)
                throw new StateRegistrationError('Object property registry is disposed.');
        }
    }

    const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const HEADER_PROBE_BYTES = 256 * 1024;
    function matchesAscii(bytes, offset, value) {
        if (offset < 0 || offset + value.length > bytes.length)
            return false;
        for (let index = 0; index < value.length; index += 1) {
            if (bytes[offset + index] !== value.charCodeAt(index))
                return false;
        }
        return true;
    }
    function uint16BE(bytes, offset) {
        if (offset < 0 || offset + 2 > bytes.length)
            return null;
        return (bytes[offset] << 8) | bytes[offset + 1];
    }
    function uint16LE(bytes, offset) {
        if (offset < 0 || offset + 2 > bytes.length)
            return null;
        return bytes[offset] | (bytes[offset + 1] << 8);
    }
    function uint24LE(bytes, offset) {
        if (offset < 0 || offset + 3 > bytes.length)
            return null;
        return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
    }
    function uint32BE(bytes, offset) {
        if (offset < 0 || offset + 4 > bytes.length)
            return null;
        return (bytes[offset] * 0x1000000 +
            ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]));
    }
    function positiveDimensions(width, height) {
        return width !== null && height !== null && width > 0 && height > 0
            ? Object.freeze({ width, height })
            : null;
    }
    function readPngDimensions(bytes) {
        if (bytes.length < 24 ||
            !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte) ||
            !matchesAscii(bytes, 12, 'IHDR')) {
            return null;
        }
        return positiveDimensions(uint32BE(bytes, 16), uint32BE(bytes, 20));
    }
    function isJpegStartOfFrame(marker) {
        return ((marker >= 0xc0 && marker <= 0xc3) ||
            (marker >= 0xc5 && marker <= 0xc7) ||
            (marker >= 0xc9 && marker <= 0xcb) ||
            (marker >= 0xcd && marker <= 0xcf));
    }
    function readJpegDimensions(bytes) {
        if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8)
            return null;
        let offset = 2;
        while (offset + 1 < bytes.length) {
            while (offset < bytes.length && bytes[offset] === 0xff)
                offset += 1;
            if (offset >= bytes.length)
                return null;
            const marker = bytes[offset];
            offset += 1;
            if (marker === 0xda || marker === 0xd9)
                return null;
            if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7))
                continue;
            const length = uint16BE(bytes, offset);
            if (length === null || length < 2 || offset + length > bytes.length)
                return null;
            if (isJpegStartOfFrame(marker) && length >= 7) {
                return positiveDimensions(uint16BE(bytes, offset + 5), uint16BE(bytes, offset + 3));
            }
            offset += length;
        }
        return null;
    }
    function readWebpDimensions(bytes) {
        var _a, _b;
        if (bytes.length < 20 || !matchesAscii(bytes, 0, 'RIFF') || !matchesAscii(bytes, 8, 'WEBP')) {
            return null;
        }
        if (matchesAscii(bytes, 12, 'VP8X') && bytes.length >= 30) {
            const width = uint24LE(bytes, 24);
            const height = uint24LE(bytes, 27);
            return width === null || height === null
                ? null
                : Object.freeze({ width: width + 1, height: height + 1 });
        }
        if (matchesAscii(bytes, 12, 'VP8 ') && bytes.length >= 30) {
            return positiveDimensions(((_a = uint16LE(bytes, 26)) !== null && _a !== void 0 ? _a : 0) & 0x3fff, ((_b = uint16LE(bytes, 28)) !== null && _b !== void 0 ? _b : 0) & 0x3fff);
        }
        if (matchesAscii(bytes, 12, 'VP8L') && bytes.length >= 25 && bytes[20] === 0x2f) {
            return Object.freeze({
                width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
                height: 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10),
            });
        }
        return null;
    }
    function decodePrefix(base64) {
        const encoded = base64.slice(0, Math.ceil(HEADER_PROBE_BYTES / 3) * 4).replace(/\s+/g, '');
        if (!encoded)
            return new Uint8Array();
        const remainder = encoded.length % 4;
        if (remainder === 1)
            return null;
        const padded = remainder === 0 ? encoded : `${encoded}${'='.repeat(4 - remainder)}`;
        const buffer = globalThis.Buffer;
        if (buffer)
            return buffer.from(padded, 'base64');
        if (typeof globalThis.atob !== 'function')
            return null;
        const binary = globalThis.atob(padded);
        return Uint8Array.from(binary, (character) => character.charCodeAt(0));
    }
    function inspectEncodedImageDataUrl(value) {
        var _a, _b;
        const match = /^data:(image\/(?:png|jpeg|webp));base64,([\s\S]*)$/i.exec(value);
        if (!match)
            return null;
        const mimeType = match[1].toLowerCase();
        const base64 = match[2].replace(/\s+/g, '');
        const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
        const encodedBytes = Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
        const prefix = decodePrefix(base64);
        const dimensions = prefix
            ? ((_b = (_a = readPngDimensions(prefix)) !== null && _a !== void 0 ? _a : readJpegDimensions(prefix)) !== null && _b !== void 0 ? _b : readWebpDimensions(prefix))
            : null;
        return Object.freeze({ mimeType, encodedBytes, dimensions });
    }

    const DEFAULT_SNAPSHOT_LIMITS = Object.freeze({
        maxInputBytes: 16 * 1024 * 1024,
        maxDepth: 64,
        maxObjectCount: 100000,
        maxPluginCount: 256,
        maxPluginPayloadBytes: 4 * 1024 * 1024,
        maxMetadataBytes: 256 * 1024,
        maxStringLength: 16 * 1024 * 1024,
        maxDataUrlBytes: 16 * 1024 * 1024,
        maxDecodedPixels: 50000000,
        maxImageDimension: 32768,
        externalUrlPolicy: 'reject',
    });
    function byteLength(value) {
        return new TextEncoder().encode(value).byteLength;
    }
    function inspectTree(value, limits, path = '$', depth = 0, ancestors = new WeakSet(), counter = { count: 0 }, propertyName) {
        if (depth > limits.maxDepth) {
            throw new SnapshotValidationError(`nesting exceeds ${limits.maxDepth}.`, path);
        }
        if (value === null || typeof value !== 'object') {
            if (typeof value === 'number' && !Number.isFinite(value)) {
                throw new SnapshotValidationError('number must be finite.', path);
            }
            if (typeof value === 'string') {
                if (value.length > limits.maxStringLength) {
                    throw new SnapshotValidationError(`string length exceeds ${limits.maxStringLength}.`, path);
                }
                if (value.startsWith('data:')) {
                    const inspection = inspectEncodedImageDataUrl(value);
                    if (!inspection) {
                        throw new SnapshotValidationError('Data URL must be a base64 PNG, JPEG, or WebP image.', path);
                    }
                    if (inspection.encodedBytes > limits.maxDataUrlBytes) {
                        throw new SnapshotValidationError(`Data URL exceeds ${limits.maxDataUrlBytes} bytes.`, path);
                    }
                    if (inspection.dimensions) {
                        const { width, height } = inspection.dimensions;
                        if (width * height > limits.maxDecodedPixels) {
                            throw new SnapshotValidationError(`decoded pixel count exceeds ${limits.maxDecodedPixels}.`, path);
                        }
                        if (width > limits.maxImageDimension || height > limits.maxImageDimension) {
                            throw new SnapshotValidationError(`image dimensions exceed ${limits.maxImageDimension}.`, path);
                        }
                    }
                }
                else if (limits.externalUrlPolicy === 'reject' &&
                    (propertyName === 'src' || propertyName === 'url') &&
                    /^(?:https?:)?\/\//i.test(value)) {
                    throw new SnapshotValidationError('external URL references are forbidden.', path);
                }
            }
            if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
                throw new SnapshotValidationError(`unsupported ${typeof value} value.`, path);
            }
            return;
        }
        counter.count += 1;
        if (counter.count > limits.maxObjectCount) {
            throw new SnapshotValidationError(`object count exceeds ${limits.maxObjectCount}.`, path);
        }
        if (ancestors.has(value))
            throw new SnapshotValidationError('cyclic value.', path);
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) {
            throw new SnapshotValidationError('only plain objects and arrays are accepted.', path);
        }
        ancestors.add(value);
        for (const key of Object.keys(value)) {
            if (isDangerousStateKey(key)) {
                throw new SnapshotValidationError(`dangerous key "${key}" is forbidden.`, `${path}.${key}`);
            }
            inspectTree(value[key], limits, `${path}.${key}`, depth + 1, ancestors, counter, key);
            if (key === 'metadata') {
                const metadataBytes = byteLength(JSON.stringify(value[key]));
                if (metadataBytes > limits.maxMetadataBytes) {
                    throw new SnapshotValidationError(`metadata exceeds ${limits.maxMetadataBytes} bytes.`, `${path}.${key}`);
                }
            }
        }
        if (!Array.isArray(value)) {
            const record = value;
            if (typeof record.width === 'number' && typeof record.height === 'number') {
                const width = record.width;
                const height = record.height;
                if (width > 0 && height > 0 && width * height > limits.maxDecodedPixels) {
                    throw new SnapshotValidationError(`decoded pixel count exceeds ${limits.maxDecodedPixels}.`, path);
                }
                if (width > limits.maxImageDimension || height > limits.maxImageDimension) {
                    throw new SnapshotValidationError(`image dimensions exceed ${limits.maxImageDimension}.`, path);
                }
            }
        }
        ancestors.delete(value);
    }
    function stableJson(value, limits) {
        inspectTree(value, limits);
        const sortValue = (entry) => {
            if (Array.isArray(entry))
                return entry.map(sortValue);
            if (entry && typeof entry === 'object') {
                const result = {};
                for (const key of Object.keys(entry).sort()) {
                    result[key] = sortValue(entry[key]);
                }
                return result;
            }
            return entry;
        };
        return JSON.stringify(sortValue(value));
    }
    function parseInput(input, limits) {
        if (typeof input !== 'string') {
            inspectTree(input, limits);
            const serialized = JSON.stringify(input);
            if (byteLength(serialized) > limits.maxInputBytes) {
                throw new SnapshotValidationError(`input exceeds ${limits.maxInputBytes} bytes.`);
            }
            return input;
        }
        if (byteLength(input) > limits.maxInputBytes) {
            throw new SnapshotValidationError(`input exceeds ${limits.maxInputBytes} bytes.`);
        }
        try {
            const parsed = JSON.parse(input);
            inspectTree(parsed, limits);
            return parsed;
        }
        catch (error) {
            if (error instanceof SnapshotValidationError)
                throw error;
            throw new SnapshotValidationError('input is not valid JSON.', '$', error);
        }
    }
    function isRecord$9(value) {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
    function isUnsupportedCanvasEnvelope(value) {
        if ('schema' in value || !Array.isArray(value.objects) || !isRecord$9(value._editorState)) {
            return false;
        }
        const editorState = value._editorState;
        return ['currentScale', 'currentRotation', 'baseImageScale'].every((key) => typeof editorState[key] === 'number');
    }
    class SnapshotService {
        constructor(coreAdapter, slices, mementos, warningSink, limits = DEFAULT_SNAPSHOT_LIMITS) {
            Object.defineProperty(this, "coreAdapter", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: coreAdapter
            });
            Object.defineProperty(this, "slices", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: slices
            });
            Object.defineProperty(this, "mementos", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: mementos
            });
            Object.defineProperty(this, "warningSink", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: warningSink
            });
            Object.defineProperty(this, "limits", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: limits
            });
            Object.defineProperty(this, "opaque", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Map()
            });
            Object.defineProperty(this, "prepared", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new WeakSet()
            });
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
        }
        capture() {
            this.assertActive('capture a public snapshot');
            const capturedAt = Date.now();
            const context = Object.freeze({ mode: 'snapshot', capturedAt });
            const plugins = Object.create(null);
            for (const [id, entry] of this.opaque)
                plugins[id] = cloneStateValue(entry);
            for (const slice of this.slices.list()) {
                plugins[slice.id] = Object.freeze({
                    version: slice.version,
                    data: cloneStateValue(slice.capture(context)),
                });
            }
            return Object.freeze({
                schema: 'image-editor.state',
                version: 3,
                core: cloneStateValue(this.coreAdapter.capture(context)),
                plugins: Object.freeze(plugins),
            });
        }
        stringify() {
            return stableJson(this.capture(), this.limits);
        }
        async load(input, options = {}) {
            this.assertActive('load a public snapshot');
            const prepared = await this.prepareForLoad(input, options);
            await this.loadPrepared(prepared, options);
        }
        prepare(input, options = {}) {
            this.assertActive('prepare a public snapshot');
            return this.prepareParsed(parseInput(input, this.limits), options);
        }
        async prepareForLoad(input, options = {}) {
            var _a;
            this.assertActive('prepare a public snapshot');
            const parsed = parseInput(input, this.limits);
            if (!((_a = options.migrations) === null || _a === void 0 ? void 0 : _a.length) ||
                (isRecord$9(parsed) && parsed.schema === 'image-editor.state' && parsed.version === 3)) {
                return this.prepareParsed(parsed, options);
            }
            const immutableInput = cloneStateValue(parsed);
            const migration = options.migrations.find((candidate) => candidate.canMigrate(immutableInput));
            if (!migration)
                return this.prepareParsed(parsed, options);
            const context = { signal: options.signal };
            const migrated = await migration.migrate(immutableInput, context);
            return this.prepareParsed(parseInput(migrated, this.limits), options);
        }
        prepareParsed(input, options) {
            var _a, _b, _c, _d;
            const snapshot = this.validateEnvelope(input);
            const policy = (_a = options.missingPluginPolicy) !== null && _a !== void 0 ? _a : 'warn-and-skip';
            const coreValidation = this.coreAdapter.validateSnapshot(snapshot.core);
            if (!coreValidation.valid) {
                throw new SnapshotValidationError(coreValidation.message, (_b = coreValidation.path) !== null && _b !== void 0 ? _b : '$.core');
            }
            const validatedSlices = [];
            const opaqueSlices = [];
            for (const [id, entry] of Object.entries(snapshot.plugins)) {
                const serializedBytes = byteLength(stableJson(entry.data, this.limits));
                if (serializedBytes > this.limits.maxPluginPayloadBytes) {
                    throw new SnapshotValidationError(`plugin payload exceeds ${this.limits.maxPluginPayloadBytes} bytes.`, `$.plugins.${id}.data`);
                }
                const slice = this.slices.get(id);
                if (!slice) {
                    if (policy === 'error') {
                        throw new SnapshotValidationError('required plugin is not installed.', `$.plugins.${id}`);
                    }
                    if (policy === 'preserve-opaque') {
                        opaqueSlices.push(Object.freeze({ id, entry: cloneStateValue(entry) }));
                    }
                    (_c = this.warningSink) === null || _c === void 0 ? void 0 : _c.call(this, {
                        code: 'SNAPSHOT_PLUGIN_MISSING',
                        message: `Snapshot data for missing plugin "${id}" was ${policy === 'preserve-opaque' ? 'preserved opaquely' : 'skipped'}.`,
                        sliceId: id,
                    });
                    continue;
                }
                if (entry.version !== slice.version) {
                    throw new SnapshotValidationError(`version ${entry.version} is incompatible with installed version ${slice.version}.`, `$.plugins.${id}.version`);
                }
                const validation = slice.validate(entry.data, {
                    sliceId: id,
                    version: entry.version,
                });
                if (!validation.valid) {
                    throw new SnapshotValidationError(validation.message, (_d = validation.path) !== null && _d !== void 0 ? _d : `$.plugins.${id}.data`);
                }
                validatedSlices.push(Object.freeze({ id, value: cloneStateValue(validation.value) }));
            }
            const prepared = Object.freeze({
                core: cloneStateValue(coreValidation.value),
                validatedSlices: Object.freeze(validatedSlices),
                opaqueSlices: Object.freeze(opaqueSlices),
            });
            this.prepared.add(prepared);
            return prepared;
        }
        async loadPrepared(prepared, options = {}) {
            var _a, _b, _c, _d;
            this.assertActive('load a prepared public snapshot');
            if (!this.prepared.has(prepared)) {
                throw new SnapshotValidationError('prepared snapshot is not trusted.');
            }
            const before = options.rollbackOnFailure === false ? null : this.mementos.capture();
            const controller = new AbortController();
            const abort = () => { var _a; return controller.abort((_a = options.signal) === null || _a === void 0 ? void 0 : _a.reason); };
            (_a = options.signal) === null || _a === void 0 ? void 0 : _a.addEventListener('abort', abort, { once: true });
            if ((_b = options.signal) === null || _b === void 0 ? void 0 : _b.aborted)
                abort();
            const context = Object.freeze({
                mode: 'public-snapshot',
                signal: controller.signal,
            });
            const validatedSlices = new Map(prepared.validatedSlices.map(({ id, value }) => [id, value]));
            const nextOpaque = new Map(prepared.opaqueSlices.map(({ id, entry }) => [id, entry]));
            try {
                await this.coreAdapter.restore(cloneStateValue(prepared.core), context);
                for (const slice of this.slices.list()) {
                    if (validatedSlices.has(slice.id)) {
                        await slice.restore(validatedSlices.get(slice.id), context);
                    }
                    else {
                        await ((_c = slice.clearState) === null || _c === void 0 ? void 0 : _c.call(slice, context));
                    }
                }
                this.opaque = nextOpaque;
            }
            catch (error) {
                if (!before)
                    throw error;
                try {
                    await this.mementos.restore(before, { rollbackOnFailure: false });
                }
                catch (rollbackError) {
                    const combinedError = new Error('Snapshot load and rollback both failed.');
                    combinedError.causes = Object.freeze([error, rollbackError]);
                    throw new SnapshotValidationError('load failed and rollback could not restore the previous state.', '$', combinedError);
                }
                throw error;
            }
            finally {
                (_d = options.signal) === null || _d === void 0 ? void 0 : _d.removeEventListener('abort', abort);
            }
        }
        dispose() {
            this.opaque.clear();
            this.disposed = true;
        }
        reset() {
            this.assertActive('reset SnapshotService');
            this.opaque.clear();
            this.prepared = new WeakSet();
        }
        validateEnvelope(value) {
            if (!isRecord$9(value))
                throw new SnapshotValidationError('snapshot must be an object.');
            if (isUnsupportedCanvasEnvelope(value)) {
                throw new SnapshotVersionUnsupportedError(typeof value.version === 'number' ? value.version : 'unversioned');
            }
            if (value.schema !== 'image-editor.state') {
                throw new SnapshotValidationError('schema must be "image-editor.state".', '$.schema');
            }
            if (value.version !== 3) {
                throw new SnapshotVersionUnsupportedError(typeof value.version === 'number' ? value.version : 'unversioned');
            }
            if (!isRecord$9(value.core))
                throw new SnapshotValidationError('core must be an object.', '$.core');
            if (!isRecord$9(value.plugins)) {
                throw new SnapshotValidationError('plugins must be an object.', '$.plugins');
            }
            const entries = Object.entries(value.plugins);
            if (entries.length > this.limits.maxPluginCount) {
                throw new SnapshotValidationError(`plugin count exceeds ${this.limits.maxPluginCount}.`, '$.plugins');
            }
            const plugins = Object.create(null);
            for (const [id, entry] of entries) {
                if (!isRuntimeIdentifier(id) || isDangerousStateKey(id)) {
                    throw new SnapshotValidationError('plugin id is invalid.', `$.plugins.${id}`);
                }
                if (!isRecord$9(entry) ||
                    !Number.isSafeInteger(entry.version) ||
                    Number(entry.version) <= 0) {
                    throw new SnapshotValidationError('plugin entry requires a positive integer version and data.', `$.plugins.${id}`);
                }
                plugins[id] = Object.freeze({ version: Number(entry.version), data: entry.data });
            }
            return Object.freeze({
                schema: 'image-editor.state',
                version: 3,
                core: cloneStateValue(value.core),
                plugins: Object.freeze(plugins),
            });
        }
        assertActive(operation) {
            if (this.disposed)
                throw new StateRegistrationError(`Cannot ${operation} after disposal.`);
        }
    }

    function assertDefinition(definition) {
        if (!isRuntimeIdentifier(definition.id)) {
            throw new StateRegistrationError('State slice id must match "namespace:kebab-case".', definition.id);
        }
        if (!Number.isSafeInteger(definition.version) || definition.version <= 0) {
            throw new StateRegistrationError(`State slice "${definition.id}" must use a positive integer version.`, definition.id);
        }
        if (typeof definition.capture !== 'function' ||
            typeof definition.validate !== 'function' ||
            typeof definition.restore !== 'function') {
            throw new StateRegistrationError(`State slice "${definition.id}" has an incomplete contract.`, definition.id);
        }
        if (definition.capturePolicy !== undefined &&
            definition.capturePolicy !== 'always' &&
            definition.capturePolicy !== 'reference') {
            throw new StateRegistrationError(`State slice "${definition.id}" capturePolicy must be "always" or "reference".`, definition.id);
        }
    }
    class StateSliceRegistry {
        constructor() {
            Object.defineProperty(this, "definitions", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Map()
            });
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
        }
        register(definition) {
            var _a;
            this.assertActive();
            assertDefinition(definition);
            if (this.definitions.has(definition.id)) {
                throw new StateRegistrationError(`State slice "${definition.id}" is already registered.`, definition.id);
            }
            const stored = Object.freeze({
                ...definition,
                capturePolicy: (_a = definition.capturePolicy) !== null && _a !== void 0 ? _a : 'always',
            });
            this.definitions.set(definition.id, stored);
            return createDisposable(() => {
                if (this.definitions.get(definition.id) === stored) {
                    this.definitions.delete(definition.id);
                }
            });
        }
        get(id) {
            var _a;
            this.assertActive();
            return (_a = this.definitions.get(id)) !== null && _a !== void 0 ? _a : null;
        }
        list() {
            this.assertActive();
            return Object.freeze([...this.definitions.values()]);
        }
        dispose() {
            if (this.disposed)
                return;
            this.definitions.clear();
            this.disposed = true;
        }
        assertActive() {
            if (this.disposed)
                throw new StateRegistrationError('State slice registry is disposed.');
        }
    }

    class TransientObjectRegistry {
        constructor(warningSink) {
            Object.defineProperty(this, "warningSink", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: warningSink
            });
            Object.defineProperty(this, "predicates", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: []
            });
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
        }
        register(owner, predicate) {
            this.assertActive();
            if (!isRuntimeIdentifier(owner)) {
                throw new StateRegistrationError('Transient predicate owner must match "namespace:kebab-case".');
            }
            if (typeof predicate !== 'function') {
                throw new StateRegistrationError(`Transient predicate for "${owner}" must be a function.`);
            }
            const record = { owner, predicate };
            this.predicates.push(record);
            return createDisposable(() => {
                const index = this.predicates.indexOf(record);
                if (index >= 0)
                    this.predicates.splice(index, 1);
            });
        }
        isTransient(object) {
            var _a;
            this.assertActive();
            for (const record of [...this.predicates]) {
                try {
                    if (record.predicate(object))
                        return true;
                }
                catch (error) {
                    (_a = this.warningSink) === null || _a === void 0 ? void 0 : _a.call(this, {
                        code: 'TRANSIENT_PREDICATE_FAILED',
                        message: `Transient object predicate owned by "${record.owner}" failed and was ignored.`,
                        details: Object.freeze({ owner: record.owner, cause: error }),
                    });
                }
            }
            return false;
        }
        dispose() {
            if (this.disposed)
                return;
            this.predicates.length = 0;
            this.disposed = true;
        }
        assertActive() {
            if (this.disposed)
                throw new StateRegistrationError('Transient object registry is disposed.');
        }
    }

    const DEFAULT_CORE_OPTIONS = Object.freeze({
        canvasWidth: 800,
        canvasHeight: 600,
        backgroundColor: '#ffffff',
        layoutMode: 'expand',
        groupSelection: true,
        maxInputBytes: 32 * 1024 * 1024,
        maxInputPixels: 64 * 1024 * 1024,
        imageLoadTimeoutMs: 30000,
        maxExportPixels: 64 * 1024 * 1024,
        maxExportDimension: 16384,
        exportMultiplier: 1,
        initialImageBase64: '',
    });
    function positiveFinite(value, fallback) {
        return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
    }
    function positiveInteger(value, fallback) {
        return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
    }
    function resolveOptions(options) {
        var _a, _b, _c;
        const layoutMode = options.defaultLayoutMode;
        return Object.freeze({
            canvasWidth: positiveFinite(options.canvasWidth, DEFAULT_CORE_OPTIONS.canvasWidth),
            canvasHeight: positiveFinite(options.canvasHeight, DEFAULT_CORE_OPTIONS.canvasHeight),
            backgroundColor: (_a = options.backgroundColor) !== null && _a !== void 0 ? _a : DEFAULT_CORE_OPTIONS.backgroundColor,
            layoutMode: layoutMode === 'fit' || layoutMode === 'cover' || layoutMode === 'expand'
                ? layoutMode
                : DEFAULT_CORE_OPTIONS.layoutMode,
            groupSelection: (_b = options.groupSelection) !== null && _b !== void 0 ? _b : DEFAULT_CORE_OPTIONS.groupSelection,
            maxInputBytes: positiveInteger(options.maxInputBytes, DEFAULT_CORE_OPTIONS.maxInputBytes),
            maxInputPixels: positiveInteger(options.maxInputPixels, DEFAULT_CORE_OPTIONS.maxInputPixels),
            imageLoadTimeoutMs: positiveInteger(options.imageLoadTimeoutMs, DEFAULT_CORE_OPTIONS.imageLoadTimeoutMs),
            maxExportPixels: positiveInteger(options.maxExportPixels, DEFAULT_CORE_OPTIONS.maxExportPixels),
            maxExportDimension: positiveInteger(options.maxExportDimension, DEFAULT_CORE_OPTIONS.maxExportDimension),
            exportMultiplier: positiveFinite(options.exportMultiplier, DEFAULT_CORE_OPTIONS.exportMultiplier),
            initialImageBase64: (_c = options.initialImageBase64) !== null && _c !== void 0 ? _c : '',
            onError: options.onError,
            onWarning: options.onWarning,
        });
    }
    function resolveElement$1(target, ownerDocument) {
        if (!target)
            return null;
        if (typeof target === 'string')
            return ownerDocument.getElementById(target);
        return target;
    }
    function inferMimeType(source) {
        var _a;
        const match = /^data:(image\/(?:jpeg|png|webp))(?:[;,])/i.exec(source);
        const mimeType = (_a = match === null || match === void 0 ? void 0 : match[1]) === null || _a === void 0 ? void 0 : _a.toLowerCase();
        return mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp'
            ? mimeType
            : null;
    }
    function loadAbortError(message) {
        return new DOMException(message, 'AbortError');
    }
    function loadAbortReason(signal, message) {
        const reason = signal.reason;
        return reason instanceof DOMException && reason.name === 'AbortError'
            ? reason
            : loadAbortError(message);
    }
    function isLoadCancellation(error) {
        return (typeof error === 'object' &&
            error !== null &&
            'name' in error &&
            error.name === 'AbortError');
    }
    function withCoreTimeout(promise, timeoutMs, label, signal) {
        return new Promise((resolve, reject) => {
            const startedAt = Date.now();
            let settled = false;
            const finish = (body) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timeoutId);
                signal.removeEventListener('abort', abort);
                body();
            };
            const abort = () => finish(() => reject(loadAbortReason(signal, `${label} was aborted.`)));
            const timeoutId = setTimeout(() => {
                finish(() => reject(new CoreRuntimeError(`[ImageEditor] ${label} timed out after ${Date.now() - startedAt}ms.`, { code: 'IMAGE_LOAD_TIMEOUT' })));
            }, timeoutMs);
            signal.addEventListener('abort', abort, { once: true });
            if (signal.aborted) {
                abort();
                return;
            }
            promise.then((value) => finish(() => resolve(value)), (error) => finish(() => reject(error)));
        });
    }
    function toAffineMatrix(value) {
        if (value.length !== 6 || value.some((entry) => !Number.isFinite(entry))) {
            throw new CoreRuntimeError('[ImageEditor] Base image returned a malformed transform matrix.');
        }
        return Object.freeze([value[0], value[1], value[2], value[3], value[4], value[5]]);
    }
    function markBaseImage(image) {
        image.editorObjectKind = 'baseImage';
        return image;
    }
    function isCoreImageInfo(value) {
        if (!value || typeof value !== 'object')
            return false;
        const candidate = value;
        return (typeof candidate.width === 'number' &&
            typeof candidate.height === 'number' &&
            typeof candidate.naturalWidth === 'number' &&
            typeof candidate.naturalHeight === 'number' &&
            typeof candidate.geometryRevision === 'number');
    }
    function reportSafely(callback, error, message, fallback) {
        try {
            callback === null || callback === void 0 ? void 0 : callback(error, message);
        }
        catch (callbackError) {
            fallback('[ImageEditor] Error callback failed.', callbackError);
        }
    }
    function base64ToFile(dataUrl, fileName) {
        var _a, _b;
        const [header = '', payload = ''] = dataUrl.split(',', 2);
        const mimeType = (_b = (_a = /data:([^;]+)/.exec(header)) === null || _a === void 0 ? void 0 : _a[1]) !== null && _b !== void 0 ? _b : 'application/octet-stream';
        const binary = /;base64/i.test(header) ? atob(payload) : decodeURIComponent(payload);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1)
            bytes[index] = binary.charCodeAt(index);
        return new File([bytes], fileName, { type: mimeType });
    }
    function freezePluginDefinition(definition) {
        if (!('manifest' in definition)) {
            return Object.freeze({
                ...definition,
                requires: definition.requires
                    ? Object.freeze(definition.requires.map((requirement) => Object.freeze({ ...requirement })))
                    : undefined,
                optional: definition.optional
                    ? Object.freeze(definition.optional.map((requirement) => Object.freeze({ ...requirement })))
                    : undefined,
                permissions: definition.permissions
                    ? Object.freeze([...definition.permissions])
                    : undefined,
            });
        }
        return Object.freeze({
            ...definition,
            manifest: Object.freeze({
                ...definition.manifest,
                requiresPlugins: definition.manifest.requiresPlugins
                    ? Object.freeze([...definition.manifest.requiresPlugins])
                    : undefined,
                requires: definition.manifest.requires
                    ? Object.freeze(definition.manifest.requires.map((requirement) => Object.freeze({ ...requirement })))
                    : undefined,
                optional: definition.manifest.optional
                    ? Object.freeze(definition.manifest.optional.map((requirement) => Object.freeze({ ...requirement })))
                    : undefined,
                permissions: definition.manifest.permissions
                    ? Object.freeze([...definition.manifest.permissions])
                    : undefined,
            }),
        });
    }
    class ImageEditorCore {
        constructor(fabric, options = {}) {
            Object.defineProperty(this, "fabric", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: fabric
            });
            this.slices = new StateSliceRegistry();
            this.objectProperties = new ObjectPropertyRegistry();
            this.history = new HistoryCommitRouter();
            this.exportContributors = new ExportContributorRegistry();
            this.installationPlan = [];
            this.lifecycle = new EditorLifecycleController();
            this.viewportCache = new ViewportCache();
            this.canvas = null;
            this.canvasElement = null;
            this.containerElement = null;
            this.placeholderElement = null;
            this.baseImage = null;
            this.imageMimeType = null;
            this.imageLoaded = false;
            this.baseImageScale = 1;
            this.geometryRevision = 0;
            this.loadSequence = 0;
            this.latestLoadSequence = 0;
            this.stateLoadSequence = 0;
            this.disposePromise = null;
            this.emergencyResetPromise = null;
            this.diagnostics = [];
            if (!fabric ||
                typeof fabric.Canvas !== 'function' ||
                typeof fabric.FabricImage !== 'function') {
                throw new CoreRuntimeError('[ImageEditor] ImageEditorCore requires a supported Fabric.js module.');
            }
            this.options = resolveOptions(options);
            this.layoutMode = this.options.layoutMode;
            this.transientObjects = new TransientObjectRegistry((warning) => {
                var _a;
                this.reportWarning((_a = warning.details) === null || _a === void 0 ? void 0 : _a.cause, warning.message);
            });
            this.externalObjects = new TransientObjectRegistry((warning) => {
                var _a;
                this.reportWarning((_a = warning.details) === null || _a === void 0 ? void 0 : _a.cause, warning.message);
            });
            this.objectProperties.register({
                owner: 'core:host',
                keys: ['editorObjectKind'],
            });
            const stateAdapter = new CanvasCoreStateAdapter({
                getCanvas: () => this.canvas,
                getBaseImage: () => this.baseImage,
                setBaseImage: (image) => {
                    this.baseImage = image;
                    this.imageLoaded = image !== null;
                },
                getImageMimeType: () => this.imageMimeType,
                setImageMimeType: (value) => {
                    this.imageMimeType = value;
                },
                getBaseImageScale: () => this.baseImageScale,
                setBaseImageScale: (value) => {
                    this.baseImageScale = value;
                },
                getGeometryRevision: () => this.geometryRevision,
                setGeometryRevision: (value) => {
                    this.geometryRevision = value;
                },
                setCanvasSize: (width, height) => this.setCanvasSize(width, height),
                isDisposed: () => this.lifecycle.current === 'disposed',
            }, this.objectProperties, this.transientObjects, this.externalObjects, {
                maxDecodedPixels: this.options.maxInputPixels,
                maxImageDimension: DEFAULT_SNAPSHOT_LIMITS.maxImageDimension,
                decodeTimeoutMs: this.options.imageLoadTimeoutMs,
            });
            this.mementos = new MementoService(stateAdapter, this.slices);
            this.snapshots = new SnapshotService(stateAdapter, this.slices, this.mementos, (warning) => { var _a; return this.reportWarning((_a = warning.details) === null || _a === void 0 ? void 0 : _a.cause, warning.message); }, Object.freeze({
                ...DEFAULT_SNAPSHOT_LIMITS,
                maxInputBytes: Math.ceil((this.options.maxInputBytes * 4) / 3) + 1024 * 1024,
                maxStringLength: Math.ceil((this.options.maxInputBytes * 4) / 3) + 1024,
                maxDataUrlBytes: this.options.maxInputBytes,
                maxDecodedPixels: this.options.maxInputPixels,
            }));
            this.documentMutations = new DocumentMutationCoordinator({
                mementos: this.mementos,
                operations: {
                    has: (operationId) => { var _a, _b; return (_b = (_a = this.plugins) === null || _a === void 0 ? void 0 : _a.hasOperation(operationId)) !== null && _b !== void 0 ? _b : false; },
                    get: (operationId) => { var _a, _b; return (_b = (_a = this.plugins) === null || _a === void 0 ? void 0 : _a.getOperationForHost(operationId)) !== null && _b !== void 0 ? _b : null; },
                    run: (operationId, task, operationOptions) => {
                        if (!this.plugins)
                            throw new Error('Plugin Manager is not ready.');
                        return this.plugins.runOperationForHost(operationId, null, (args, context) => {
                            return task(context);
                        }, operationOptions);
                    },
                },
                state: {
                    requestRender: () => this.requestRender(),
                    isDisposed: () => this.lifecycle.current === 'disposed',
                    assertOperational: (operation) => this.lifecycle.assertOperational(operation),
                },
                history: this.history,
                events: {
                    emitCommitted: (descriptor) => this.emitDocumentCommitted(descriptor),
                },
                warningSink: (warning) => this.reportWarning(warning.cause, warning.message),
                errorSink: (error) => this.reportError(error, 'Document mutation failed.'),
                faultSink: (error) => this.enterFaulted(error),
            });
            this.geometry = new GeometryMutationCoordinator({
                mutations: this.documentMutations,
                state: {
                    captureGeometry: () => this.captureGeometry(),
                    finalizeGeometry: () => {
                        var _a;
                        this.finalizeBaseImageGeometry();
                        (_a = this.baseImage) === null || _a === void 0 ? void 0 : _a.setCoords();
                        this.geometryRevision += 1;
                    },
                    restoreGeometry: (snapshot) => {
                        this.setCanvasSize(snapshot.canvasWidth, snapshot.canvasHeight);
                        this.geometryRevision = snapshot.revision;
                    },
                    requestRender: () => this.requestRender(),
                    isDisposed: () => this.isDisposingOrDisposed(),
                },
                warningSink: (warning) => this.reportWarning(warning.cause, warning.message),
                errorSink: (error) => this.reportError(error, 'Geometry mutation failed.'),
            });
            this.plugins = this.createPluginManager();
        }
        use(plugin) {
            this.lifecycle.assertAvailable('install a plugin');
            const api = this.plugins.installSync(plugin);
            this.installationPlan.push(Object.freeze({ definition: freezePluginDefinition(plugin) }));
            return api;
        }
        install(pluginsOrPlan) {
            this.lifecycle.assertAvailable('install a plugin batch');
            const plugins = isPluginPlan(pluginsOrPlan) ? pluginsOrPlan.plugins : pluginsOrPlan;
            const outcome = this.plugins.installBatchSync(plugins);
            for (const plugin of outcome.installedPlugins) {
                this.installationPlan.push(Object.freeze({ definition: freezePluginDefinition(plugin) }));
            }
            const resolveApi = (plugin) => {
                const api = outcome.apisByPluginId.get(plugin.ref.id);
                if (api === undefined) {
                    throw new PluginNotInstalledError(plugin.ref.id);
                }
                return api;
            };
            if (isPluginPlan(pluginsOrPlan)) {
                return resolvePluginPlanApis(pluginsOrPlan, resolveApi);
            }
            return Object.freeze(pluginsOrPlan.map((plugin) => resolveApi(plugin)));
        }
        async useAsync(plugin) {
            this.lifecycle.assertAvailable('install a plugin');
            const api = await this.plugins.install(plugin);
            this.installationPlan.push(Object.freeze({
                definition: freezePluginDefinition(plugin),
            }));
            return api;
        }
        getPlugin(ref) {
            return this.plugins.get(ref);
        }
        requirePlugin(ref) {
            return this.plugins.require(ref);
        }
        getPluginById(pluginId) {
            return this.plugins.getById(pluginId);
        }
        getLifecycleState() {
            return this.lifecycle.current;
        }
        getDiagnostics() {
            return Object.freeze([...this.diagnostics]);
        }
        async init(elements) {
            this.lifecycle.beginInitialization();
            let pluginInitializationStarted = false;
            try {
                this.createCanvas(elements);
                pluginInitializationStarted = true;
                await this.plugins.initialize();
                this.lifecycle.completeInitialization();
            }
            catch (error) {
                const cleanupErrors = await this.rollbackInitialization(error, pluginInitializationStarted);
                if (cleanupErrors.length > 0) {
                    this.lifecycle.failInitialization();
                    this.recordDiagnostic(error, 'Initialization failed and cleanup was incomplete.');
                    for (const cleanupError of cleanupErrors) {
                        this.recordDiagnostic(cleanupError, 'Initialization cleanup failed.');
                    }
                }
                else {
                    this.lifecycle.recoverInitialization();
                }
                throw error;
            }
            this.finishInitialization();
        }
        createCanvas(elements) {
            var _a, _b, _c, _d, _e, _f;
            const ownerDocument = typeof elements.canvas === 'string'
                ? globalThis.document
                : (_a = elements.canvas) === null || _a === void 0 ? void 0 : _a.ownerDocument;
            if (!ownerDocument)
                throw new CoreRuntimeError('[ImageEditor] Canvas document is unavailable.');
            const canvasElement = resolveElement$1(elements.canvas, ownerDocument);
            if (!(canvasElement instanceof ownerDocument.defaultView.HTMLCanvasElement)) {
                throw new CoreRuntimeError('[ImageEditor] Core canvas element was not found.');
            }
            this.canvasElement = canvasElement;
            this.containerElement =
                (_b = resolveElement$1(elements.canvasContainer, ownerDocument)) !== null && _b !== void 0 ? _b : canvasElement.parentElement;
            this.placeholderElement = resolveElement$1(elements.imagePlaceholder, ownerDocument);
            const containerWidth = Math.floor((_d = (_c = this.containerElement) === null || _c === void 0 ? void 0 : _c.clientWidth) !== null && _d !== void 0 ? _d : 0);
            const containerHeight = Math.floor((_f = (_e = this.containerElement) === null || _e === void 0 ? void 0 : _e.clientHeight) !== null && _f !== void 0 ? _f : 0);
            const hasVisibleContainer = containerWidth > 0 && containerHeight > 0;
            this.canvas = new this.fabric.Canvas(canvasElement, {
                width: hasVisibleContainer ? containerWidth : this.options.canvasWidth,
                height: hasVisibleContainer ? containerHeight : this.options.canvasHeight,
                backgroundColor: this.options.backgroundColor,
                selection: this.options.groupSelection,
                preserveObjectStacking: true,
            });
        }
        finishInitialization() {
            if (this.options.initialImageBase64) {
                void this.loadImage(this.options.initialImageBase64).catch(() => undefined);
            }
            else {
                this.updatePlaceholder();
            }
        }
        async loadImage(source, options = {}) {
            this.assertReady('load an image');
            const encodedImage = inspectEncodedImageDataUrl(source);
            if (!inferMimeType(source) || !encodedImage) {
                throw new CoreRuntimeError('[ImageEditor] Unsupported image Data URL.');
            }
            if (encodedImage.encodedBytes > this.options.maxInputBytes) {
                throw new CoreRuntimeError('[ImageEditor] Image input exceeds maxInputBytes.');
            }
            if (encodedImage.dimensions &&
                encodedImage.dimensions.width * encodedImage.dimensions.height >
                    this.options.maxInputPixels) {
                throw new CoreRuntimeError('[ImageEditor] Image input exceeds maxInputPixels.');
            }
            if (options.concurrency && options.concurrency !== 'replace-pending') {
                throw new CoreRuntimeError('[ImageEditor] Unsupported load concurrency policy.');
            }
            try {
                await this.plugins.runOperationForHost('core:load-image', source, async (loadSource, operationContext) => {
                    const sequence = ++this.loadSequence;
                    this.latestLoadSequence = sequence;
                    const image = await withCoreTimeout(this.fabric.FabricImage.fromURL(loadSource, {
                        crossOrigin: 'anonymous',
                        signal: operationContext.signal,
                    }), this.options.imageLoadTimeoutMs, 'FabricImage.fromURL', operationContext.signal);
                    this.assertCurrentLoad(sequence, operationContext.signal);
                    const naturalWidth = Number(image.width) || 0;
                    const naturalHeight = Number(image.height) || 0;
                    if (naturalWidth <= 0 ||
                        naturalHeight <= 0 ||
                        naturalWidth * naturalHeight > this.options.maxInputPixels) {
                        throw new CoreRuntimeError('[ImageEditor] Decoded image exceeds the pixel budget.');
                    }
                    const previousScroll = this.containerElement
                        ? {
                            left: this.containerElement.scrollLeft,
                            top: this.containerElement.scrollTop,
                        }
                        : null;
                    await this.documentMutations.run({
                        id: `core:load-image-transaction:${sequence}`,
                        kind: 'raster',
                        operationId: 'core:commit-load-image',
                        conflictDomains: [
                            'document',
                            'base-image',
                            'geometry',
                            'raster',
                            'overlay',
                            'state',
                        ],
                        signal: operationContext.signal,
                        metadata: Object.freeze({ sequence }),
                        mutate: async (commitContext) => {
                            this.assertCurrentLoad(sequence, commitContext.signal);
                            if (this.baseImage) {
                                await this.plugins.notifyImageCleared();
                                this.assertCurrentLoad(sequence, commitContext.signal);
                            }
                            const canvas = this.requireCanvas('loadImage');
                            canvas.discardActiveObject();
                            canvas.clear();
                            canvas.backgroundColor = this.options.backgroundColor;
                            const baseImage = markBaseImage(image);
                            baseImage.set({
                                originX: 'left',
                                originY: 'top',
                                selectable: false,
                                evented: false,
                            });
                            const layout = this.computeLayout(baseImage);
                            applyCanvasDimensions(canvas, layout.canvasWidth, layout.canvasHeight, this.containerElement);
                            baseImage.set({
                                left: layout.imageLeft,
                                top: layout.imageTop,
                                scaleX: layout.imageScale,
                                scaleY: layout.imageScale,
                            });
                            baseImage.setCoords();
                            canvas.add(baseImage);
                            canvas.sendObjectToBack(baseImage);
                            this.baseImage = baseImage;
                            this.imageLoaded = true;
                            this.baseImageScale = layout.imageScale;
                            this.imageMimeType = inferMimeType(loadSource);
                            this.geometryRevision += 1;
                            const imageInfo = this.getImageInfo();
                            if (!imageInfo) {
                                throw new Error('Loaded image information is unavailable.');
                            }
                            await this.plugins.notifyImageLoaded(imageInfo);
                            this.assertCurrentLoad(sequence, commitContext.signal);
                            return imageInfo;
                        },
                        validate: (imageInfo, commitContext) => {
                            if (!isCoreImageInfo(imageInfo)) {
                                throw new Error('Loaded image information is malformed.');
                            }
                            this.assertCurrentLoad(sequence, commitContext.signal);
                        },
                    });
                    if (options.preserveScroll && previousScroll && this.containerElement) {
                        this.containerElement.scrollLeft = previousScroll.left;
                        this.containerElement.scrollTop = previousScroll.top;
                    }
                    this.updatePlaceholder();
                }, { signal: options.signal });
            }
            catch (error) {
                if (!isLoadCancellation(error))
                    this.reportError(error, 'loadImage failed.');
                throw error;
            }
        }
        async loadImageFile(file, options = {}) {
            var _a;
            if (!(file instanceof File))
                throw new TypeError('[ImageEditor] loadImageFile expects a File.');
            if (file.size > this.options.maxInputBytes) {
                throw new CoreRuntimeError('[ImageEditor] Image file exceeds maxInputBytes.');
            }
            if ((_a = options.signal) === null || _a === void 0 ? void 0 : _a.aborted) {
                throw loadAbortReason(options.signal, 'Image file read was aborted.');
            }
            const dataUrl = await new Promise((resolve, reject) => {
                var _a;
                const reader = new FileReader();
                const cleanup = () => { var _a; return (_a = options.signal) === null || _a === void 0 ? void 0 : _a.removeEventListener('abort', abort); };
                const abort = () => {
                    reader.abort();
                    cleanup();
                    reject(loadAbortReason(options.signal, 'Image file read was aborted.'));
                };
                reader.onerror = () => {
                    var _a;
                    cleanup();
                    reject((_a = reader.error) !== null && _a !== void 0 ? _a : new Error('FileReader failed.'));
                };
                reader.onload = () => {
                    cleanup();
                    if (typeof reader.result === 'string')
                        resolve(reader.result);
                    else
                        reject(new Error('FileReader did not produce a Data URL.'));
                };
                (_a = options.signal) === null || _a === void 0 ? void 0 : _a.addEventListener('abort', abort, { once: true });
                reader.readAsDataURL(file);
            });
            await this.loadImage(dataUrl, options);
        }
        saveState() {
            this.assertReady('save state');
            return this.snapshots.stringify();
        }
        async loadFromState(input, options = {}) {
            this.assertReady('load state');
            const prepared = await this.snapshots.prepareForLoad(input, {
                missingPluginPolicy: options.missingPluginPolicy,
                migrations: options.migrations,
                signal: options.signal,
            });
            const sequence = ++this.stateLoadSequence;
            try {
                await this.documentMutations.run({
                    id: `core:load-state-transaction:${sequence}`,
                    kind: 'compound',
                    operationId: 'core:load-state',
                    conflictDomains: [
                        'document',
                        'base-image',
                        'geometry',
                        'raster',
                        'overlay',
                        'state',
                    ],
                    signal: options.signal,
                    metadata: Object.freeze({ sequence }),
                    mutate: async (context) => {
                        await this.snapshots.loadPrepared(prepared, {
                            signal: context.signal,
                            rollbackOnFailure: false,
                        });
                        return Object.freeze({ schemaVersion: 3 });
                    },
                });
                this.updatePlaceholder();
            }
            catch (error) {
                this.reportError(error, 'loadFromState failed.');
                throw error;
            }
        }
        exportImageBase64(options = {}) {
            return this.runExport(options);
        }
        async exportImageFile(options = {}) {
            var _a, _b;
            const dataUrl = await this.runExport(options);
            const format = (_a = options.format) !== null && _a !== void 0 ? _a : 'png';
            return base64ToFile(dataUrl, (_b = options.fileName) !== null && _b !== void 0 ? _b : `image.${format === 'jpeg' ? 'jpg' : format}`);
        }
        isImageLoaded() {
            return this.imageLoaded && this.baseImage !== null;
        }
        getImageInfo() {
            const image = this.baseImage;
            if (!image)
                return null;
            image.setCoords();
            const bounds = image.getBoundingRect();
            return Object.freeze({
                width: bounds.width,
                height: bounds.height,
                naturalWidth: Number(image.width) || 0,
                naturalHeight: Number(image.height) || 0,
                mimeType: this.imageMimeType,
                geometryRevision: this.geometryRevision,
            });
        }
        getCanvas() {
            return this.canvas;
        }
        setLayoutMode(mode) {
            this.assertNotDisposed('set layout mode');
            this.layoutMode = mode;
            this.viewportCache.clear();
        }
        emergencyReset() {
            if (this.emergencyResetPromise)
                return this.emergencyResetPromise;
            if (this.lifecycle.current !== 'faulted') {
                return Promise.reject(new CoreRuntimeError(`[ImageEditor] emergencyReset() is available only while the editor is faulted.`, { code: 'EMERGENCY_RESET_NOT_ALLOWED', behavior: 'lifecycle' }));
            }
            const reset = this.performEmergencyReset();
            this.emergencyResetPromise = reset;
            void reset.then(() => {
                if (this.emergencyResetPromise === reset)
                    this.emergencyResetPromise = null;
            }, () => {
                if (this.emergencyResetPromise === reset)
                    this.emergencyResetPromise = null;
            });
            return reset;
        }
        async forceDispose() {
            if (this.lifecycle.current === 'disposed')
                return;
            if (this.lifecycle.current !== 'faulted') {
                throw new CoreRuntimeError('[ImageEditor] forceDispose() is available only while the editor is faulted.', { code: 'FORCE_DISPOSE_NOT_ALLOWED', behavior: 'lifecycle' });
            }
            try {
                await this.disposeAsync();
            }
            catch (error) {
                this.recordDiagnostic(error, 'Forced disposal completed with cleanup failures.');
            }
        }
        dispose() {
            if (this.lifecycle.current === 'disposed' || this.lifecycle.current === 'disposing')
                return;
            if (this.geometry.isRunning || this.documentMutations.isRunning) {
                void this.disposeAsync();
                return;
            }
            if (!this.lifecycle.beginDisposal())
                return;
            const errors = [];
            for (const cleanup of [
                () => this.plugins.disposeSync(),
                () => this.geometry.disposeSync(),
                () => this.documentMutations.disposeSync(),
                () => this.exportContributors.dispose(),
                () => this.snapshots.dispose(),
                () => this.mementos.dispose(),
                () => this.transientObjects.dispose(),
                () => this.externalObjects.dispose(),
                () => this.objectProperties.dispose(),
                () => this.slices.dispose(),
            ]) {
                try {
                    cleanup();
                }
                catch (error) {
                    errors.push(error);
                }
            }
            const canvas = this.canvas;
            this.clearRuntimeReferences();
            if (canvas) {
                const canvasDispose = canvas.dispose();
                if (canvasDispose && typeof canvasDispose.then === 'function') {
                    this.disposePromise = Promise.resolve(canvasDispose).then(() => undefined);
                }
            }
            this.lifecycle.completeDisposal();
            if (errors.length > 0) {
                throw new CoreRuntimeError(`[ImageEditor] Core disposal completed with ${errors.length} cleanup error(s).`, { code: 'CORE_DISPOSE_ERROR', cause: Object.freeze(errors) });
            }
        }
        disposeAsync() {
            var _a;
            if (this.disposePromise)
                return this.disposePromise;
            if (this.lifecycle.current === 'disposed')
                return Promise.resolve();
            if (!this.lifecycle.beginDisposal())
                return (_a = this.disposePromise) !== null && _a !== void 0 ? _a : Promise.resolve();
            this.disposePromise = this.performDisposeAsync();
            return this.disposePromise;
        }
        async performEmergencyReset() {
            const failures = [];
            const abortReason = new DOMException('Core emergency reset aborted active work.', 'AbortError');
            await Promise.all([
                this.runEmergencyStep(failures, 'Operation abort failed during emergency reset.', () => this.plugins.abortOperationsForHost(abortReason)),
                this.runEmergencyStep(failures, 'Document mutation abort failed during emergency reset.', () => this.documentMutations.abortActive(abortReason)),
                this.runEmergencyStep(failures, 'Geometry mutation abort failed during emergency reset.', () => this.geometry.abortActive(abortReason)),
            ]);
            await this.runEmergencyStep(failures, 'Tool exit failed during emergency reset.', () => this.plugins.exitActiveToolForHost());
            const canvas = this.canvas;
            if (canvas) {
                await this.runEmergencyStep(failures, 'Canvas disposal failed during emergency reset.', () => canvas.dispose());
            }
            this.clearRuntimeReferences();
            await this.runEmergencyStep(failures, 'Plugin scope disposal failed during emergency reset.', () => this.plugins.dispose());
            await this.runEmergencyStep(failures, 'Snapshot reset failed during emergency reset.', () => this.snapshots.reset());
            await this.runEmergencyStep(failures, 'Memento reset failed during emergency reset.', () => this.mementos.reset());
            await this.runEmergencyStep(failures, 'Document mutation reset failed during emergency reset.', () => this.documentMutations.reset());
            await this.runEmergencyStep(failures, 'Geometry mutation reset failed during emergency reset.', () => this.geometry.reset());
            this.geometryRevision = 0;
            this.loadSequence = 0;
            this.latestLoadSequence = 0;
            this.stateLoadSequence = 0;
            this.layoutMode = this.options.layoutMode;
            this.disposePromise = null;
            if (failures.length > 0) {
                const failure = new CoreRuntimeError(`[ImageEditor] Emergency reset cleanup failed in ${failures.length} step(s).`, {
                    code: 'EMERGENCY_RESET_CLEANUP_ERROR',
                    cause: Object.freeze([...failures]),
                    behavior: 'lifecycle',
                });
                await this.failEmergencyReset(failure);
            }
            try {
                await this.replayInstallationPlan();
            }
            catch (error) {
                this.recordDiagnostic(error, 'Plugin replay failed during emergency reset.');
                await this.failEmergencyReset(error);
            }
            this.lifecycle.recoverFault();
        }
        async runEmergencyStep(failures, message, task) {
            try {
                await task();
            }
            catch (error) {
                failures.push(error);
                this.recordDiagnostic(error, message);
            }
        }
        async failEmergencyReset(cause) {
            await this.disposeAfterEmergencyFailure();
            throw new EmergencyResetError(this.getDiagnostics(), cause);
        }
        async disposeAfterEmergencyFailure() {
            if (!this.lifecycle.beginDisposal())
                return;
            const cleanupSteps = [
                ['Plugin cleanup failed after emergency reset.', () => this.plugins.dispose()],
                ['Geometry cleanup failed after emergency reset.', () => this.geometry.dispose()],
                [
                    'Document mutation cleanup failed after emergency reset.',
                    () => this.documentMutations.dispose(),
                ],
                ['Snapshot cleanup failed after emergency reset.', () => this.snapshots.dispose()],
                [
                    'Export registry cleanup failed after emergency reset.',
                    () => this.exportContributors.dispose(),
                ],
                ['Memento cleanup failed after emergency reset.', () => this.mementos.dispose()],
                [
                    'Transient registry cleanup failed after emergency reset.',
                    () => this.transientObjects.dispose(),
                ],
                [
                    'External object registry cleanup failed after emergency reset.',
                    () => this.externalObjects.dispose(),
                ],
                [
                    'Object property registry cleanup failed after emergency reset.',
                    () => this.objectProperties.dispose(),
                ],
                ['State Slice cleanup failed after emergency reset.', () => this.slices.dispose()],
            ];
            for (const [message, cleanup] of cleanupSteps) {
                try {
                    await cleanup();
                }
                catch (error) {
                    this.recordDiagnostic(error, message);
                }
            }
            this.clearRuntimeReferences();
            this.lifecycle.completeDisposal();
        }
        createPluginManager() {
            const manager = new PluginManager({
                warningSink: (warning) => this.reportWarning(warning.cause, warning.message),
                errorSink: (error) => this.reportError(error, 'Plugin lifecycle failed.'),
                hostCapabilities: [
                    {
                        token: CORE_ENVIRONMENT_CAPABILITY,
                        implementation: this.createEnvironmentPort(),
                    },
                    {
                        token: CORE_STATUS_CAPABILITY,
                        implementation: this.createStatusPort(),
                    },
                    {
                        token: CORE_DIAGNOSTICS_CAPABILITY,
                        implementation: this.createDiagnosticsPort(),
                    },
                    {
                        token: CORE_PRESENTATION_CAPABILITY,
                        implementation: this.createPresentationPort(),
                    },
                    {
                        token: FABRIC_RUNTIME_CAPABILITY,
                        implementation: this.createFabricRuntimePort(),
                        requiredPermission: 'fabric:objects',
                    },
                    {
                        token: CANVAS_READ_CAPABILITY,
                        implementation: this.createCanvasReadPort(),
                        requiredPermission: 'fabric:canvas-read',
                    },
                    {
                        token: BASE_IMAGE_READ_CAPABILITY,
                        implementation: this.createBaseImageReadPort(),
                    },
                    {
                        token: BASE_IMAGE_INFO_CAPABILITY,
                        implementation: this.createBaseImageInfoPort(),
                    },
                    {
                        token: IMAGE_RESOURCE_POLICY_CAPABILITY,
                        implementation: this.createImageResourcePolicyPort(),
                    },
                    {
                        token: RENDER_REQUEST_CAPABILITY,
                        implementation: this.createRenderRequestPort(),
                    },
                    {
                        token: CANVAS_RESIZE_CAPABILITY,
                        implementation: this.createCanvasResizePort(),
                    },
                    {
                        token: RASTER_MUTATION_CAPABILITY,
                        implementation: this.createRasterMutationPort(),
                        requiredPermission: 'core:raster-mutation',
                    },
                    {
                        token: SNAPSHOT_REGISTRATION_CAPABILITY,
                        implementation: this.createSnapshotRegistrationPort(),
                    },
                    {
                        token: MEMENTO_HISTORY_CAPABILITY,
                        implementation: this.createMementoHistoryPort(),
                    },
                    {
                        token: GEOMETRY_MUTATION_CAPABILITY,
                        implementation: this.geometry,
                        requiredPermission: 'core:geometry-participant',
                    },
                    { token: DOCUMENT_MUTATION_CAPABILITY, implementation: this.documentMutations },
                    {
                        token: EXPORT_CONTRIBUTION_CAPABILITY,
                        implementation: this.exportContributors,
                        requiredPermission: 'core:export-contributor',
                    },
                ],
            });
            manager.registerHostOperation({
                id: 'core:load-image',
                mode: 'busy',
                conflictDomains: ['image-decode'],
                reentrancy: 'replace',
            });
            manager.registerHostOperation({
                id: 'core:commit-load-image',
                mode: 'mutation',
                conflictDomains: ['document', 'base-image', 'geometry', 'raster', 'overlay', 'state'],
                reentrancy: 'queue',
            });
            manager.registerHostOperation({
                id: 'core:load-state',
                mode: 'mutation',
                conflictDomains: ['document', 'base-image', 'geometry', 'raster', 'overlay', 'state'],
                reentrancy: 'reject',
            });
            manager.registerHostOperation({
                id: 'core:export',
                mode: 'read',
                conflictDomains: ['document', 'base-image', 'overlay', 'export', 'state'],
                reentrancy: 'queue',
            });
            return manager;
        }
        async rollbackInitialization(failure, pluginInitializationStarted) {
            const cleanupErrors = this.getInitializationCleanupErrors(failure);
            const canvas = this.canvas;
            this.clearRuntimeReferences();
            if (canvas) {
                try {
                    await canvas.dispose();
                }
                catch (error) {
                    cleanupErrors.push(error);
                }
            }
            if (pluginInitializationStarted && cleanupErrors.length === 0) {
                try {
                    await this.replayInstallationPlan();
                }
                catch (error) {
                    cleanupErrors.push(error);
                }
            }
            return Object.freeze(cleanupErrors);
        }
        getInitializationCleanupErrors(failure) {
            return failure instanceof PluginLifecycleError ? [...failure.cleanupErrors] : [];
        }
        async replayInstallationPlan() {
            const manager = this.createPluginManager();
            try {
                for (const planned of this.installationPlan) {
                    await manager.install(planned.definition);
                }
            }
            catch (error) {
                await manager.dispose().catch(() => undefined);
                throw error;
            }
            this.plugins = manager;
        }
        createEnvironmentPort() {
            return Object.freeze({
                options: this.options,
                isDisposed: () => this.isDisposingOrDisposed(),
                reportWarning: (error, message) => this.reportWarning(error, message),
                reportError: (error, message) => this.reportError(error, message),
            });
        }
        createStatusPort() {
            return Object.freeze({ isDisposed: () => this.isDisposingOrDisposed() });
        }
        createDiagnosticsPort() {
            return Object.freeze({
                reportWarning: (error, message) => this.reportWarning(error, message),
                reportError: (error, message) => this.reportError(error, message),
            });
        }
        createPresentationPort() {
            return Object.freeze({
                backgroundColor: this.options.backgroundColor,
                layoutMode: this.layoutMode,
            });
        }
        createFabricRuntimePort() {
            return Object.freeze({ fabric: this.fabric });
        }
        createCanvasReadPort() {
            return Object.freeze({
                getCanvas: () => this.canvas,
                requireCanvas: (operation) => this.requireCanvasForPlugin(operation),
            });
        }
        createBaseImageReadPort() {
            return Object.freeze({
                getBaseImage: () => this.baseImage,
                ...this.createBaseImageInfoPort(),
            });
        }
        createBaseImageInfoPort() {
            return Object.freeze({
                getBaseImageScale: () => this.baseImageScale,
                getGeometryRevision: () => this.geometryRevision,
                getCanvasSize: () => {
                    var _a, _b, _c, _d;
                    return Object.freeze({
                        width: (_b = (_a = this.canvas) === null || _a === void 0 ? void 0 : _a.getWidth()) !== null && _b !== void 0 ? _b : 0,
                        height: (_d = (_c = this.canvas) === null || _c === void 0 ? void 0 : _c.getHeight()) !== null && _d !== void 0 ? _d : 0,
                    });
                },
                getImageInfo: () => this.getImageInfo(),
                isImageLoaded: () => this.isImageLoaded(),
            });
        }
        createImageResourcePolicyPort() {
            return Object.freeze({
                getImageResourcePolicy: () => Object.freeze({
                    maxInputBytes: this.options.maxInputBytes,
                    maxInputPixels: this.options.maxInputPixels,
                    imageLoadTimeoutMs: this.options.imageLoadTimeoutMs,
                    maxExportPixels: this.options.maxExportPixels,
                    maxExportDimension: this.options.maxExportDimension,
                }),
            });
        }
        createRenderRequestPort() {
            return Object.freeze({ requestRender: () => this.requestRender() });
        }
        createCanvasResizePort() {
            return Object.freeze({
                resizeCanvas: (width, height) => this.setCanvasSize(width, height),
            });
        }
        createRasterMutationPort() {
            return Object.freeze({
                replaceBaseImage: (context, image, replacementOptions) => {
                    var _a;
                    this.documentMutations.assertContextActive(context);
                    const canvas = this.requireCanvasForPlugin('replace the base image');
                    if (this.baseImage && this.baseImage !== image)
                        canvas.remove(this.baseImage);
                    markBaseImage(image);
                    if (!canvas.getObjects().includes(image))
                        canvas.add(image);
                    canvas.sendObjectToBack(image);
                    this.baseImage = image;
                    this.imageLoaded = true;
                    this.baseImageScale = positiveFinite(replacementOptions === null || replacementOptions === void 0 ? void 0 : replacementOptions.baseScale, 1);
                    this.imageMimeType = (_a = replacementOptions === null || replacementOptions === void 0 ? void 0 : replacementOptions.mimeType) !== null && _a !== void 0 ? _a : this.imageMimeType;
                    this.geometryRevision += 1;
                    this.updatePlaceholder();
                },
            });
        }
        createSnapshotRegistrationPort() {
            return Object.freeze({
                registerSlice: (definition) => this.slices.register(definition),
                registerObjectProperties: (registration) => this.objectProperties.register(registration),
                registerTransientObject: (owner, predicate) => this.transientObjects.register(owner, predicate),
                registerExternalObject: (owner, predicate) => this.externalObjects.register(owner, predicate),
            });
        }
        createMementoHistoryPort() {
            return Object.freeze({
                captureMemento: () => this.mementos.capture(),
                restoreMemento: (memento, options) => this.mementos.restore(memento, options),
                registerHistoryProvider: (owner, provider) => this.history.register(owner, provider),
                reportFatal: (error) => this.enterFaulted(error),
            });
        }
        computeLayout(image) {
            var _a, _b;
            const scrollbarSize = measureScrollbarSize((_b = (_a = this.containerElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : null);
            const viewport = this.viewportCache.measure(this.containerElement, { width: this.options.canvasWidth, height: this.options.canvasHeight }, scrollbarSize);
            const strategy = selectLayoutStrategy(this.layoutMode);
            const width = Number(image.width) || 0;
            const height = Number(image.height) || 0;
            if (strategy === 'fit') {
                return computeFitLayout(width, height, this.options.canvasWidth, this.options.canvasHeight, viewport);
            }
            if (strategy === 'cover') {
                return computeCoverLayout(width, height, this.options.canvasWidth, this.options.canvasHeight, viewport, scrollbarSize);
            }
            return computeExpandLayout(width, height, viewport);
        }
        captureGeometry() {
            const canvas = this.requireCanvas('capture base-image geometry');
            const image = this.baseImage;
            if (!image) {
                return Object.freeze({
                    matrix: IDENTITY_AFFINE_MATRIX,
                    boundingBox: Object.freeze({ left: 0, top: 0, width: 0, height: 0 }),
                    canvasWidth: canvas.getWidth(),
                    canvasHeight: canvas.getHeight(),
                    revision: this.geometryRevision,
                });
            }
            image.setCoords();
            const bounds = image.getBoundingRect();
            return Object.freeze({
                matrix: toAffineMatrix(image.calcTransformMatrix()),
                boundingBox: Object.freeze({
                    left: bounds.left,
                    top: bounds.top,
                    width: bounds.width,
                    height: bounds.height,
                }),
                canvasWidth: canvas.getWidth(),
                canvasHeight: canvas.getHeight(),
                revision: this.geometryRevision,
            });
        }
        finalizeBaseImageGeometry() {
            var _a, _b, _c, _d, _e, _f;
            const image = this.baseImage;
            const canvas = this.canvas;
            if (!image || !canvas)
                return;
            image.setCoords();
            const bounds = image.getBoundingRect();
            const scrollbarSize = measureScrollbarSize((_d = (_b = (_a = this.containerElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : (_c = this.canvasElement) === null || _c === void 0 ? void 0 : _c.ownerDocument) !== null && _d !== void 0 ? _d : null);
            const viewport = this.viewportCache.measure(this.containerElement, { width: this.options.canvasWidth, height: this.options.canvasHeight }, scrollbarSize);
            const imageFitsViewport = bounds.width <= viewport.width + 0.5 && bounds.height <= viewport.height + 0.5;
            if (imageFitsViewport) {
                this.setCanvasSize(Math.max(1, viewport.width - 1), Math.max(1, viewport.height - 1));
            }
            else if (this.layoutMode === 'fit' || this.layoutMode === 'cover') {
                const size = computeScrollableCanvasSize(bounds.width, bounds.height, viewport, scrollbarSize);
                this.setCanvasSize(size.width, size.height);
            }
            else {
                this.setCanvasSize(Math.max(viewport.width, Math.ceil(bounds.width)), Math.max(viewport.height, Math.ceil(bounds.height)));
            }
            image.set({ left: ((_e = image.left) !== null && _e !== void 0 ? _e : 0) - bounds.left, top: ((_f = image.top) !== null && _f !== void 0 ? _f : 0) - bounds.top });
            image.setCoords();
            canvas.sendObjectToBack(image);
        }
        setCanvasSize(width, height) {
            if (!this.canvas)
                return;
            applyCanvasDimensions(this.canvas, Math.max(1, Math.ceil(width)), Math.max(1, Math.ceil(height)), this.containerElement);
        }
        async runExport(options) {
            var _a, _b, _c, _d;
            this.assertReady('export an image');
            const operation = this.plugins.beginOperationForHost('core:export');
            try {
                const canvas = this.requireCanvas('exportImageBase64');
                const multiplier = positiveFinite(options.multiplier, this.options.exportMultiplier);
                const format = (_a = options.format) !== null && _a !== void 0 ? _a : 'png';
                const quality = Math.max(0, Math.min(1, (_b = options.quality) !== null && _b !== void 0 ? _b : 0.92));
                let left = 0;
                let top = 0;
                let width = canvas.getWidth();
                let height = canvas.getHeight();
                if (((_c = options.area) !== null && _c !== void 0 ? _c : 'image') === 'image') {
                    if (!this.baseImage)
                        throw new CoreRuntimeError('[ImageEditor] No image is loaded.');
                    this.baseImage.setCoords();
                    const bounds = this.baseImage.getBoundingRect();
                    left = bounds.left;
                    top = bounds.top;
                    width = bounds.width;
                    height = bounds.height;
                }
                if (width * multiplier > this.options.maxExportDimension ||
                    height * multiplier > this.options.maxExportDimension ||
                    width * height * multiplier * multiplier > this.options.maxExportPixels) {
                    throw new CoreRuntimeError('[ImageEditor] Export dimensions exceed the configured budget.');
                }
                const exportElement = (_d = this.canvasElement) === null || _d === void 0 ? void 0 : _d.ownerDocument.createElement('canvas');
                if (!exportElement) {
                    throw new CoreRuntimeError('[ImageEditor] Export requires an initialized Canvas.');
                }
                const exportCanvas = new this.fabric.StaticCanvas(exportElement, {
                    width: canvas.getWidth(),
                    height: canvas.getHeight(),
                    backgroundColor: this.options.backgroundColor,
                    renderOnAddRemove: false,
                });
                try {
                    if (this.baseImage) {
                        const clonedBaseImage = await this.baseImage.clone();
                        exportCanvas.add(clonedBaseImage);
                        exportCanvas.sendObjectToBack(clonedBaseImage);
                    }
                    await this.exportContributors.render({ canvas: exportCanvas, options });
                    exportCanvas.renderAll();
                    return exportCanvas.toDataURL({
                        format,
                        quality,
                        multiplier,
                        left,
                        top,
                        width,
                        height,
                    });
                }
                finally {
                    await exportCanvas.dispose();
                }
            }
            finally {
                await operation.dispose();
            }
        }
        async emitDocumentCommitted(descriptor) {
            var _a, _b, _c, _d;
            if (descriptor.kind === 'geometry') {
                await ((_a = this.plugins) === null || _a === void 0 ? void 0 : _a.emitCommitted('geometry:committed', descriptor.result));
                return;
            }
            if (descriptor.operationId === 'core:commit-load-image' &&
                isCoreImageInfo(descriptor.result)) {
                await ((_b = this.plugins) === null || _b === void 0 ? void 0 : _b.emitCommitted('image:loaded', descriptor.result));
                return;
            }
            if (descriptor.operationId === 'core:load-state') {
                await ((_c = this.plugins) === null || _c === void 0 ? void 0 : _c.emitCommitted('state:loaded', { schemaVersion: 3 }));
                return;
            }
            await ((_d = this.plugins) === null || _d === void 0 ? void 0 : _d.emitCommitted('document:committed', descriptor));
        }
        assertCurrentLoad(sequence, signal) {
            if (signal.aborted) {
                throw loadAbortReason(signal, 'Image load was aborted.');
            }
            if (sequence !== this.latestLoadSequence) {
                throw loadAbortError('Image load result is stale.');
            }
        }
        requireCanvas(operation) {
            this.assertReady(operation);
            if (!this.canvas)
                throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} without Canvas.`);
            return this.canvas;
        }
        requireCanvasForPlugin(operation) {
            if (this.lifecycle.current !== 'initializing')
                this.lifecycle.assertOperational(operation);
            if (!this.canvas)
                throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} without Canvas.`);
            return this.canvas;
        }
        requestRender() {
            var _a;
            if (this.lifecycle.current !== 'disposed')
                (_a = this.canvas) === null || _a === void 0 ? void 0 : _a.requestRenderAll();
        }
        updatePlaceholder() {
            if (this.placeholderElement)
                this.placeholderElement.hidden = this.baseImage !== null;
        }
        reportWarning(error, message) {
            reportSafely(this.options.onWarning, error, message, console.warn);
        }
        reportError(error, message) {
            reportSafely(this.options.onError, error, message, console.error);
        }
        enterFaulted(error) {
            const state = this.lifecycle.current;
            if (state === 'disposed' || state === 'disposing')
                return;
            if (state === 'initialized')
                this.lifecycle.failRuntime();
            else if (state !== 'faulted') {
                this.recordDiagnostic(error, `A fatal error occurred while Core was ${state}.`);
                return;
            }
            const suspension = this.plugins.suspendOperationsForHost(new EditorFaultedError('run an operation'));
            void suspension.catch((suspensionError) => {
                this.recordDiagnostic(suspensionError, 'Faulted operation suspension failed.');
            });
            this.recordDiagnostic(error);
            this.reportError(error, 'Core entered the faulted lifecycle state.');
        }
        recordDiagnostic(error, message) {
            const classification = classifyCoreError(error);
            const code = error && typeof error === 'object' && typeof Reflect.get(error, 'code') === 'string'
                ? String(Reflect.get(error, 'code'))
                : 'UNCLASSIFIED_CORE_ERROR';
            const diagnostic = Object.freeze({
                ...classification,
                timestamp: Date.now(),
                code,
                message: message !== null && message !== void 0 ? message : (error instanceof Error ? error.message : String(error)),
                cause: error instanceof CoreRuntimeError && error.cause !== undefined
                    ? error.cause
                    : error,
            });
            this.diagnostics.push(diagnostic);
            return diagnostic;
        }
        assertReady(operation) {
            this.lifecycle.assertOperational(operation);
            if (!this.canvas)
                throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} without Canvas.`);
        }
        assertNotDisposed(operation) {
            this.lifecycle.assertAvailable(operation);
        }
        isDisposingOrDisposed() {
            return this.lifecycle.current === 'disposing' || this.lifecycle.current === 'disposed';
        }
        clearRuntimeReferences() {
            this.canvas = null;
            this.canvasElement = null;
            this.containerElement = null;
            this.placeholderElement = null;
            this.baseImage = null;
            this.imageLoaded = false;
            this.imageMimeType = null;
            this.baseImageScale = 1;
            this.viewportCache.clear();
        }
        async performDisposeAsync() {
            const errors = [];
            for (const cleanup of [
                () => this.geometry.dispose(),
                () => this.documentMutations.dispose(),
                () => this.plugins.dispose(),
            ]) {
                try {
                    await cleanup();
                }
                catch (error) {
                    errors.push(error);
                }
            }
            this.snapshots.dispose();
            this.exportContributors.dispose();
            this.mementos.dispose();
            this.transientObjects.dispose();
            this.externalObjects.dispose();
            this.objectProperties.dispose();
            this.slices.dispose();
            const canvas = this.canvas;
            this.clearRuntimeReferences();
            if (canvas) {
                try {
                    await canvas.dispose();
                }
                catch (error) {
                    errors.push(error);
                }
            }
            this.lifecycle.completeDisposal();
            if (errors.length > 0) {
                throw new CoreRuntimeError(`[ImageEditor] Async disposal completed with ${errors.length} cleanup error(s).`, { code: 'CORE_DISPOSE_ERROR', cause: Object.freeze(errors) });
            }
        }
    }

    const VISIBLE_RASTER_BAKE_CAPABILITY = createCapabilityToken('raster:visible-bake', '1.0.0');

    function definePlugin(definition) {
        if (typeof definition !== 'object' || definition === null) {
            throw new InvalidPluginDefinitionError('Plugin definition must be an object.');
        }
        if (!isPluginRef(definition.ref)) {
            throw new InvalidPluginDefinitionError('Plugin definition must use a PluginRef created by definePluginRef().');
        }
        if (typeof definition.setup !== 'function') {
            throw new InvalidPluginDefinitionError(`Plugin "${definition.ref.id}" must define setup().`, definition.ref.id);
        }
        const manifest = validatePluginManifest(definition.ref, definition.manifest);
        return Object.freeze({ ...definition, manifest });
    }

    function isFiniteTransformMatrix(matrix) {
        return matrix.length === 6 && matrix.every((value) => Number.isFinite(value));
    }
    function isApproximatelyIdentityTransform(matrix, epsilon = 1e-10) {
        const identity = [1, 0, 0, 1, 0, 0];
        return (matrix.length === identity.length &&
            matrix.every((value, index) => Math.abs(value - identity[index]) <= epsilon));
    }
    function deltaHasReflection(delta) {
        if (!isFiniteTransformMatrix(delta))
            return false;
        const [a, b, c, d] = delta;
        return a * d - b * c < 0;
    }
    function transformPointByMatrix(point, matrix, fabricUtil) {
        const [a, b, c, d, e, f] = matrix;
        return new fabricUtil.Point(a * point.x + c * point.y + e, b * point.x + d * point.y + f);
    }
    function stripReflectionFromDelta(delta, fabricUtil) {
        if (!deltaHasReflection(delta))
            return delta;
        const flipXCandidate = fabricUtil.multiplyTransformMatrices(delta, [-1, 0, 0, 1, 0, 0]);
        const flipYCandidate = fabricUtil.multiplyTransformMatrices(delta, [1, 0, 0, -1, 0, 0]);
        const normalizedAngleMagnitude = (matrix) => {
            try {
                const angle = fabricUtil.qrDecompose(matrix).angle;
                return Number.isFinite(angle)
                    ? Math.abs((((angle % 360) + 540) % 360) - 180)
                    : Number.POSITIVE_INFINITY;
            }
            catch {
                return Number.POSITIVE_INFINITY;
            }
        };
        return normalizedAngleMagnitude(flipYCandidate) < normalizedAngleMagnitude(flipXCandidate)
            ? flipYCandidate
            : flipXCandidate;
    }
    function applyDeltaToObject(object, fullDelta, context) {
        var _a, _b, _c;
        if (!isFiniteTransformMatrix(fullDelta) || isApproximatelyIdentityTransform(fullDelta))
            return;
        const { fabricUtil } = context;
        object.setCoords();
        const previousOriginX = (_a = object.originX) !== null && _a !== void 0 ? _a : 'left';
        const previousOriginY = (_b = object.originY) !== null && _b !== void 0 ? _b : 'top';
        const originalCenter = object.getCenterPoint();
        const targetCenter = transformPointByMatrix(originalCenter, fullDelta, fabricUtil);
        const orientationDelta = context.preserveReadableText
            ? stripReflectionFromDelta(fullDelta, fabricUtil)
            : fullDelta;
        let restoreCenter = originalCenter;
        try {
            object.set({ originX: 'center', originY: 'center' });
            object.setPositionByOrigin(originalCenter, 'center', 'center');
            object.setCoords();
            const nextMatrix = fabricUtil.multiplyTransformMatrices(orientationDelta, object.calcTransformMatrix());
            if (!isFiniteTransformMatrix(nextMatrix))
                return;
            const decomposed = fabricUtil.qrDecompose(nextMatrix);
            object.set({ flipX: false, flipY: false });
            object.set({
                angle: decomposed.angle,
                scaleX: decomposed.scaleX,
                scaleY: decomposed.scaleY,
                skewX: decomposed.skewX,
                skewY: (_c = decomposed.skewY) !== null && _c !== void 0 ? _c : 0,
            });
            if (typeof decomposed.flipX === 'boolean' || typeof decomposed.flipY === 'boolean') {
                object.set({
                    ...(typeof decomposed.flipX === 'boolean' ? { flipX: decomposed.flipX } : {}),
                    ...(typeof decomposed.flipY === 'boolean' ? { flipY: decomposed.flipY } : {}),
                });
            }
            restoreCenter = targetCenter;
        }
        finally {
            object.set({ originX: previousOriginX, originY: previousOriginY });
            object.setPositionByOrigin(restoreCenter, 'center', 'center');
            object.setCoords();
        }
    }

    class OverlayRecoverableObjectError extends CoreRuntimeError {
        constructor(message, cause) {
            super(`[ImageEditor] Recoverable overlay object failure: ${message}`, {
                code: 'OVERLAY_RECOVERABLE_OBJECT_ERROR',
                cause,
                behavior: 'recoverable-object',
            });
        }
    }

    function getActiveCanvasObjects(canvas) {
        var _a;
        const candidate = canvas;
        if (typeof candidate.getActiveObjects === 'function')
            return candidate.getActiveObjects();
        const active = (_a = candidate.getActiveObject) === null || _a === void 0 ? void 0 : _a.call(candidate);
        return active ? [active] : [];
    }
    function isAbortError(error) {
        return (typeof error === 'object' &&
            error !== null &&
            'name' in error &&
            error.name === 'AbortError');
    }
    function abortError$2(message) {
        if (typeof DOMException === 'function')
            return new DOMException(message, 'AbortError');
        const error = new Error(message);
        error.name = 'AbortError';
        return error;
    }
    function gestureAction(value) {
        if (value === 'rotate' || (value === null || value === void 0 ? void 0 : value.includes('rotate')))
            return 'rotate';
        if (value === 'scale' || (value === null || value === void 0 ? void 0 : value.includes('scale')))
            return 'scale';
        return 'move';
    }
    const OVERLAY_STATE_ID = 'foundation:overlay';
    const OVERLAY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
    function isRecord$8(value) {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
    function freezePersistence(definition) {
        const persistence = definition.persistence;
        const failure = (message) => {
            throw new PluginManifestError(`Plugin "${definition.ownerPluginId}" Overlay Kind "${definition.id}" ${message}`, { pluginId: definition.ownerPluginId });
        };
        if (!isRecord$8(persistence))
            return failure('must declare persistence.');
        if (persistence.mode === 'transient') {
            if (Object.prototype.hasOwnProperty.call(persistence, 'codec')) {
                return failure('must not attach a Codec in transient mode.');
            }
            return Object.freeze({ mode: 'transient' });
        }
        if (persistence.mode !== 'persistent') {
            return failure('must use persistent or transient mode.');
        }
        const codec = persistence.codec;
        if (!isRecord$8(codec) ||
            typeof codec.type !== 'string' ||
            !isRuntimeIdentifier(codec.type) ||
            typeof codec.version !== 'string' ||
            !isValidSemVer(codec.version) ||
            typeof codec.serialize !== 'function' ||
            typeof codec.validate !== 'function' ||
            typeof codec.deserialize !== 'function') {
            return failure('requires a valid Codec with type, SemVer version, serialize, validate, and deserialize.');
        }
        const frozenCodec = Object.freeze({
            type: codec.type,
            version: codec.version,
            serialize: codec.serialize,
            validate: codec.validate,
            deserialize: codec.deserialize,
        });
        return Object.freeze({ mode: 'persistent', codec: frozenCodec });
    }
    function isSerializedRecord(value) {
        return (isRecord$8(value) &&
            typeof value.kind === 'string' &&
            value.kind.trim().length > 0 &&
            typeof value.persistentId === 'string' &&
            OVERLAY_ID_PATTERN.test(value.persistentId) &&
            typeof value.hidden === 'boolean' &&
            typeof value.locked === 'boolean' &&
            isRecord$8(value.codec) &&
            typeof value.codec.type === 'string' &&
            isRuntimeIdentifier(value.codec.type) &&
            typeof value.codec.version === 'string' &&
            isValidSemVer(value.codec.version) &&
            Object.prototype.hasOwnProperty.call(value, 'data'));
    }
    function validateStateShape(value) {
        return (isRecord$8(value) &&
            value.version === 1 &&
            Array.isArray(value.overlays) &&
            value.overlays.length <= 100000 &&
            value.overlays.every(isSerializedRecord) &&
            Array.isArray(value.selectionIds) &&
            value.selectionIds.every((persistentId) => typeof persistentId === 'string' && OVERLAY_ID_PATTERN.test(persistentId)) &&
            new Set(value.selectionIds).size === value.selectionIds.length);
    }
    function getImageExportRegion(image, canvas) {
        image.setCoords();
        const bounds = image.getBoundingRect();
        const canvasWidth = Math.max(1, Math.round(canvas.getWidth()));
        const canvasHeight = Math.max(1, Math.round(canvas.getHeight()));
        const left = Math.min(canvasWidth - 1, Math.max(0, Math.floor(bounds.left)));
        const top = Math.min(canvasHeight - 1, Math.max(0, Math.floor(bounds.top)));
        const right = Math.min(canvasWidth, Math.max(left + 1, Math.ceil(bounds.left + bounds.width)));
        const bottom = Math.min(canvasHeight, Math.max(top + 1, Math.ceil(bounds.top + bounds.height)));
        return Object.freeze({
            left,
            top,
            width: Math.max(1, right - left),
            height: Math.max(1, bottom - top),
        });
    }
    function captureTransform(object) {
        var _a, _b;
        return Object.freeze({
            left: Number(object.left) || 0,
            top: Number(object.top) || 0,
            scaleX: Number(object.scaleX) || 1,
            scaleY: Number(object.scaleY) || 1,
            angle: Number(object.angle) || 0,
            skewX: Number(object.skewX) || 0,
            skewY: Number(object.skewY) || 0,
            flipX: object.flipX === true,
            flipY: object.flipY === true,
            originX: (_a = object.originX) !== null && _a !== void 0 ? _a : 'left',
            originY: (_b = object.originY) !== null && _b !== void 0 ? _b : 'top',
            visible: object.visible !== false,
            selectable: object.selectable !== false,
            evented: object.evented !== false,
        });
    }
    function parseExportOptions(value) {
        if (!isRecord$8(value))
            return {};
        const includeKinds = Array.isArray(value.includeKinds)
            ? value.includeKinds.filter((kind) => typeof kind === 'string')
            : undefined;
        const excludeKinds = Array.isArray(value.excludeKinds)
            ? value.excludeKinds.filter((kind) => typeof kind === 'string')
            : undefined;
        return Object.freeze({
            includeKinds: includeKinds ? Object.freeze(includeKinds) : undefined,
            excludeKinds: excludeKinds ? Object.freeze(excludeKinds) : undefined,
            includeHidden: value.includeHidden === true,
        });
    }
    class OverlayFoundationController {
        constructor(host, state, geometry, mutations, exportPort) {
            Object.defineProperty(this, "host", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: host
            });
            Object.defineProperty(this, "geometry", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: geometry
            });
            Object.defineProperty(this, "mutations", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: mutations
            });
            Object.defineProperty(this, "kinds", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Map()
            });
            Object.defineProperty(this, "policies", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Map()
            });
            Object.defineProperty(this, "interactionPolicies", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Map()
            });
            Object.defineProperty(this, "serializers", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Map()
            });
            Object.defineProperty(this, "renderers", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Map()
            });
            Object.defineProperty(this, "byId", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Map()
            });
            Object.defineProperty(this, "byObject", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new WeakMap()
            });
            Object.defineProperty(this, "selectionListeners", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Set()
            });
            Object.defineProperty(this, "registrations", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: []
            });
            Object.defineProperty(this, "preservedRecords", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: []
            });
            Object.defineProperty(this, "registrationSequence", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "generatedIdSequence", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "activeGesture", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: null
            });
            Object.defineProperty(this, "lastGestureTransaction", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: null
            });
            Object.defineProperty(this, "attached", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
            Object.defineProperty(this, "onObjectAdded", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: (event) => {
                    if (event.target)
                        this.indexObject(event.target);
                }
            });
            Object.defineProperty(this, "onObjectRemoved", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: (event) => {
                    if (event.target)
                        this.unindexObject(event.target);
                }
            });
            Object.defineProperty(this, "onSelectionChanged", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: () => this.emitSelection()
            });
            Object.defineProperty(this, "onBeforeTransform", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: (event) => {
                    var _a;
                    if (!event.target)
                        return;
                    this.beginGesture(event.target, gestureAction((_a = event.transform) === null || _a === void 0 ? void 0 : _a.action));
                }
            });
            Object.defineProperty(this, "onObjectMoving", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: (event) => {
                    this.previewGesture(event.target, 'move');
                }
            });
            Object.defineProperty(this, "onObjectScaling", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: (event) => {
                    this.previewGesture(event.target, 'scale');
                }
            });
            Object.defineProperty(this, "onObjectRotating", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: (event) => {
                    this.previewGesture(event.target, 'rotate');
                }
            });
            Object.defineProperty(this, "onObjectModified", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: (event) => {
                    if (!event.target || !this.activeGesture)
                        return;
                    const eventIds = new Set(this.resolveOverlayTargets(event.target).map((entry) => entry.persistentId));
                    if (eventIds.size > 0 &&
                        this.activeGesture.targets.some((entry) => !eventIds.has(entry.persistentId))) {
                        this.failGesture(this.activeGesture, new CoreRuntimeError('[ImageEditor] Overlay gesture target changed before commit.'));
                        return;
                    }
                    this.resolveGesture(this.activeGesture);
                }
            });
            try {
                this.registrations.push(state.registerObjectProperties({
                    owner: OVERLAY_STATE_ID,
                    keys: [
                        'editorOverlayKind',
                        'editorOverlayId',
                        'editorOverlayHidden',
                        'editorOverlayLocked',
                    ],
                }));
                this.registrations.push(state.registerExternalObject(OVERLAY_STATE_ID, (object) => typeof object.editorOverlayKind === 'string'));
                this.registrations.push(state.registerSlice({
                    id: OVERLAY_STATE_ID,
                    version: 1,
                    capturePolicy: 'always',
                    capture: () => this.captureState(),
                    validate: (value) => this.validateSnapshotState(value),
                    restore: (value) => this.restoreState(value),
                    clearState: () => this.resetState(),
                }));
                this.registrations.push(geometry.registerParticipant({
                    id: OVERLAY_STATE_ID,
                    order: 100,
                    supports: () => true,
                    prepare: (mutation) => this.prepareGeometry(mutation),
                    apply: (mutation, prepared, context) => this.applyGeometry(mutation, prepared, context),
                    synchronize: (mutation) => this.synchronizeGeometry(mutation),
                    rollback: (mutation, prepared) => {
                        void mutation;
                        this.rollbackGeometry(prepared);
                    },
                }));
                this.registrations.push(exportPort.register(OVERLAY_STATE_ID, {
                    id: OVERLAY_STATE_ID,
                    order: 100,
                    isEnabled: () => this.byId.size > 0,
                    render: (context) => this.renderExport(context.canvas, context.options),
                }));
            }
            catch (error) {
                disposeInReverseSync(this.registrations, { pluginId: OVERLAY_STATE_ID });
                this.registrations.length = 0;
                throw error;
            }
            if (host.getCanvas())
                this.attach();
        }
        attach() {
            this.assertActive('attach Overlay Foundation');
            if (this.attached)
                return;
            const canvas = this.host.requireCanvas('attach Overlay Foundation');
            if (typeof canvas.on === 'function') {
                canvas.on('object:added', this.onObjectAdded);
                canvas.on('object:removed', this.onObjectRemoved);
                canvas.on('before:transform', this.onBeforeTransform);
                canvas.on('object:moving', this.onObjectMoving);
                canvas.on('object:scaling', this.onObjectScaling);
                canvas.on('object:rotating', this.onObjectRotating);
                canvas.on('object:modified', this.onObjectModified);
                canvas.on('selection:created', this.onSelectionChanged);
                canvas.on('selection:updated', this.onSelectionChanged);
                canvas.on('selection:cleared', this.onSelectionChanged);
            }
            this.attached = true;
            this.rebuildIndex();
        }
        registerKind(definition) {
            this.assertActive('register an overlay kind');
            if (!isRecord$8(definition) ||
                typeof definition.classify !== 'function' ||
                typeof definition.getPersistentId !== 'function' ||
                (definition.setPersistentId !== undefined &&
                    typeof definition.setPersistentId !== 'function')) {
                throw new PluginManifestError('Overlay Kind registration requires callable classify and persistent identity members.', {
                    pluginId: isRecord$8(definition) && typeof definition.ownerPluginId === 'string'
                        ? definition.ownerPluginId
                        : undefined,
                });
            }
            this.assertRuntimeIdentifier(definition.id, 'Overlay kind id');
            this.assertRuntimeIdentifier(definition.ownerPluginId, 'Overlay kind owner');
            const persistence = freezePersistence(definition);
            const existing = this.kinds.get(definition.id);
            if (existing) {
                throw new CoreRuntimeError(`[ImageEditor] Overlay kind "${definition.id}" is already registered by "${existing.definition.ownerPluginId}".`);
            }
            const record = {
                definition: Object.freeze({ ...definition, persistence }),
                registrationOrder: this.registrationSequence++,
            };
            this.kinds.set(definition.id, record);
            if (persistence.mode === 'persistent') {
                this.serializers.set(definition.id, persistence.codec);
            }
            this.rebuildIndex();
            return createDisposable(() => {
                if (this.kinds.get(definition.id) !== record)
                    return;
                this.kinds.delete(definition.id);
                this.serializers.delete(definition.id);
                const canvas = this.host.getCanvas();
                for (const indexed of [...this.byId.values()]) {
                    if (indexed.kind !== record)
                        continue;
                    if (persistence.mode === 'transient' && canvas)
                        canvas.remove(indexed.object);
                    else
                        this.unindexObject(indexed.object);
                }
                this.rebuildIndex();
            });
        }
        registerGeometryPolicy(policy) {
            this.assertActive('register an overlay geometry policy');
            this.assertRuntimeIdentifier(policy.id, 'Overlay geometry policy id');
            this.requireKindOwner(policy.kind, policy.ownerPluginId);
            if (this.policies.has(policy.kind)) {
                throw new CoreRuntimeError(`[ImageEditor] Overlay kind "${policy.kind}" already has a geometry policy.`);
            }
            const frozen = Object.freeze({ ...policy });
            this.policies.set(policy.kind, frozen);
            return createDisposable(() => {
                if (this.policies.get(policy.kind) === frozen)
                    this.policies.delete(policy.kind);
            });
        }
        registerInteractionPolicy(policy) {
            this.assertActive('register an overlay interaction policy');
            this.assertRuntimeIdentifier(policy.id, 'Overlay interaction policy id');
            this.requireKindOwner(policy.kind, policy.ownerPluginId);
            if (this.interactionPolicies.has(policy.kind)) {
                throw new CoreRuntimeError(`[ImageEditor] Overlay kind "${policy.kind}" already has an interaction policy.`);
            }
            const frozen = Object.freeze({ ...policy });
            this.interactionPolicies.set(policy.kind, frozen);
            return createDisposable(() => {
                if (this.interactionPolicies.get(policy.kind) === frozen) {
                    this.interactionPolicies.delete(policy.kind);
                }
            });
        }
        registerExportRenderer(renderer) {
            this.assertActive('register an overlay export renderer');
            this.assertRuntimeIdentifier(renderer.id, 'Overlay export renderer id');
            this.requireKindOwner(renderer.kind, renderer.ownerPluginId);
            if (!Number.isFinite(renderer.order)) {
                throw new CoreRuntimeError('[ImageEditor] Overlay export renderer order must be finite.');
            }
            if (this.renderers.has(renderer.kind)) {
                throw new CoreRuntimeError(`[ImageEditor] Overlay kind "${renderer.kind}" already has an export renderer.`);
            }
            const frozen = Object.freeze({ ...renderer });
            this.renderers.set(renderer.kind, frozen);
            return createDisposable(() => {
                if (this.renderers.get(renderer.kind) === frozen)
                    this.renderers.delete(renderer.kind);
            });
        }
        list(query = {}) {
            this.assertActive('list overlays');
            const kinds = query.kinds ? new Set(query.kinds) : null;
            const ids = query.ids ? new Set(query.ids) : null;
            const canvas = this.host.requireCanvas('list overlays');
            return Object.freeze(canvas.getObjects().filter((object) => {
                const indexed = this.byObject.get(object);
                if (!indexed)
                    return false;
                const classification = this.classificationFor(indexed);
                return ((!kinds || kinds.has(classification.kind)) &&
                    (!ids || ids.has(classification.persistentId)) &&
                    (query.includeHidden === true || !classification.hidden) &&
                    (query.includeLocked === true || !classification.locked));
            }));
        }
        getByPersistentId(id) {
            var _a, _b;
            this.assertActive('get an overlay');
            return (_b = (_a = this.byId.get(id)) === null || _a === void 0 ? void 0 : _a.object) !== null && _b !== void 0 ? _b : null;
        }
        classify(object) {
            this.assertActive('classify an overlay');
            const indexed = this.byObject.get(object);
            return indexed ? this.classificationFor(indexed) : null;
        }
        getStateKind(kind) {
            var _a, _b;
            return (_b = (_a = this.kinds.get(kind)) === null || _a === void 0 ? void 0 : _a.definition) !== null && _b !== void 0 ? _b : null;
        }
        getSelection() {
            var _a, _b;
            this.assertActive('read overlay selection');
            const active = getActiveCanvasObjects(this.host.requireCanvas('read overlay selection'));
            const classifications = active
                .map((object) => this.byObject.get(object))
                .filter((entry) => entry !== undefined)
                .map((entry) => this.classificationFor(entry));
            return Object.freeze({
                ids: Object.freeze(classifications.map((entry) => entry.persistentId)),
                primaryId: (_b = (_a = classifications[0]) === null || _a === void 0 ? void 0 : _a.persistentId) !== null && _b !== void 0 ? _b : null,
                kinds: Object.freeze([...new Set(classifications.map((entry) => entry.kind))]),
            });
        }
        select(ids) {
            this.assertActive('select overlays');
            this.applySelection(ids);
        }
        applySelection(ids) {
            const canvas = this.host.getCanvas();
            if (!canvas)
                throw new CoreRuntimeError('[ImageEditor] Overlay selection requires Canvas.');
            const objects = ids.map((id) => this.requireIndexed(id).object);
            if (objects.length === 0) {
                canvas.discardActiveObject();
            }
            else if (objects.length === 1) {
                canvas.setActiveObject(objects[0]);
            }
            else {
                canvas.setActiveObject(new this.host.fabric.ActiveSelection(objects, { canvas }));
            }
            this.host.requestRender();
            this.emitSelection();
        }
        discardSelection() {
            this.assertActive('discard overlay selection');
            this.host.requireCanvas('discard overlay selection').discardActiveObject();
            this.host.requestRender();
            this.emitSelection();
        }
        onSelectionChange(listener) {
            this.assertActive('subscribe to overlay selection');
            this.selectionListeners.add(listener);
            return createDisposable(() => {
                this.selectionListeners.delete(listener);
            });
        }
        hideForPreview(ids) {
            this.assertActive('hide overlays');
            const targets = this.resolveOverlayIds(ids);
            for (const target of targets) {
                const existing = target.preview;
                if (existing) {
                    existing[2] += 1;
                    continue;
                }
                target.preview = [
                    target.object.visible !== false,
                    this.classificationFor(target).hidden,
                    1,
                ];
                target.object.visible = false;
            }
            if (targets.length)
                this.host.requestRender();
            return createDisposable(() => {
                let restored = false;
                for (const target of targets) {
                    const record = target.preview;
                    if (!record)
                        continue;
                    if (--record[2])
                        continue;
                    target.preview = undefined;
                    target.object.visible = record[0];
                    restored = true;
                }
                if (restored && !this.disposed)
                    this.host.requestRender();
            });
        }
        setHidden(id, hidden) {
            return this.mutate({
                id: this.nextMutationId('visibility'),
                operationId: 'overlay:set-hidden',
                action: 'visibility',
                objectIds: [id],
                metadata: Object.freeze({ hidden }),
                mutate: () => this.applyHidden(id, hidden),
            });
        }
        setLocked(id, locked) {
            return this.mutate({
                id: this.nextMutationId('locking'),
                operationId: 'overlay:set-locked',
                action: 'locking',
                objectIds: [id],
                metadata: Object.freeze({ locked }),
                mutate: () => this.applyLocked(id, locked),
            });
        }
        bringForward(id) {
            return this.mutateLayer(id, 'forward', () => this.moveRelative(id, 1));
        }
        sendBackward(id) {
            return this.mutateLayer(id, 'backward', () => this.moveRelative(id, -1));
        }
        bringToFront(id) {
            return this.mutateLayer(id, 'front', () => {
                const overlays = this.indexedCanvasObjects();
                this.moveToOverlayIndex(id, overlays.length - 1, overlays);
            });
        }
        sendToBack(id) {
            return this.mutateLayer(id, 'back', () => this.moveToOverlayIndex(id, 0, this.indexedCanvasObjects()));
        }
        async mutate(request) {
            var _a;
            this.assertActive('run an overlay mutation');
            this.assertOpaqueIdentifier(request.id, 'Overlay mutation id');
            this.assertRuntimeIdentifier(request.operationId, 'Overlay mutation operation id');
            this.assertOpaqueIdentifier(request.action, 'Overlay mutation action');
            const initialTargets = this.resolveOverlayIds((_a = request.objectIds) !== null && _a !== void 0 ? _a : []);
            let affectedTargets = initialTargets;
            let descriptor = null;
            return this.mutations.run({
                id: request.id,
                kind: 'overlay',
                operationId: request.operationId,
                conflictDomains: ['document', 'overlay', 'selection', 'state'],
                parent: request.parent,
                metadata: request.metadata,
                mutate: async (transaction) => {
                    const context = this.createMutationContext(transaction, request.action, initialTargets);
                    return request.mutate(context);
                },
                synchronize: async (result, transaction) => {
                    var _a;
                    this.rebuildIndex();
                    const context = this.createMutationContext(transaction, request.action, initialTargets);
                    const additional = request.affectedObjects
                        ? await request.affectedObjects(result, context)
                        : [];
                    affectedTargets = this.mergeTargets(initialTargets, this.resolveOverlayObjects(additional));
                    descriptor = this.createMutationDescriptor(request.id, request.operationId, request.action, affectedTargets, transaction.metadata);
                    await this.runInteractionPolicies(affectedTargets, descriptor, transaction, 'synchronize');
                    await ((_a = request.synchronize) === null || _a === void 0 ? void 0 : _a.call(request, result, context));
                },
                validate: async (result, transaction) => {
                    var _a;
                    const currentDescriptor = descriptor;
                    if (!currentDescriptor) {
                        throw new CoreRuntimeError('[ImageEditor] Overlay mutation synchronization did not produce a descriptor.');
                    }
                    await this.validateMutation(affectedTargets, currentDescriptor, transaction);
                    await ((_a = request.validate) === null || _a === void 0 ? void 0 : _a.call(request, result, this.createMutationContext(transaction, request.action, affectedTargets)));
                },
                describeCommit: () => {
                    if (!descriptor) {
                        throw new CoreRuntimeError('[ImageEditor] Overlay mutation descriptor is unavailable at commit.');
                    }
                    return descriptor;
                },
            });
        }
        add(objects) {
            if (objects.length === 0)
                return Promise.resolve();
            const uniqueObjects = Object.freeze([...new Set(objects)]);
            return this.mutate({
                id: this.nextMutationId('create'),
                operationId: 'overlay:add',
                action: 'create',
                metadata: Object.freeze({ objectCount: uniqueObjects.length }),
                mutate: () => {
                    const canvas = this.host.requireCanvas('add overlays');
                    for (const object of uniqueObjects)
                        canvas.add(object);
                },
                affectedObjects: () => {
                    const indexed = this.resolveOverlayObjects(uniqueObjects);
                    if (indexed.length !== uniqueObjects.length ||
                        indexed.some((entry) => entry.kind.definition.persistence.mode !== 'persistent')) {
                        throw new CoreRuntimeError('[ImageEditor] Overlay insertion accepts only registered persistent kinds.');
                    }
                    return uniqueObjects;
                },
            });
        }
        addTransient(objects) {
            if (objects.length === 0)
                return Promise.resolve();
            const uniqueObjects = Object.freeze([...new Set(objects)]);
            return this.host.runOperation('overlay:transient', async () => {
                const canvas = this.host.requireCanvas('add transient overlays');
                try {
                    for (const object of uniqueObjects)
                        canvas.add(object);
                    this.rebuildIndex();
                    const indexed = this.resolveOverlayObjects(uniqueObjects);
                    if (indexed.length !== uniqueObjects.length ||
                        indexed.some((entry) => entry.kind.definition.persistence.mode !== 'transient')) {
                        throw new CoreRuntimeError('[ImageEditor] Transient overlay insertion accepts only registered transient kinds.');
                    }
                    this.host.requestRender();
                }
                catch (error) {
                    for (const object of uniqueObjects)
                        canvas.remove(object);
                    this.rebuildIndex();
                    throw error;
                }
            });
        }
        replaceTransient(ids, objects) {
            const uniqueIds = Object.freeze([...new Set(ids)]);
            const uniqueObjects = Object.freeze([...new Set(objects)]);
            if (uniqueIds.length === 0)
                return this.addTransient(uniqueObjects);
            if (uniqueObjects.length === 0)
                return this.removeTransient(uniqueIds);
            return this.host.runOperation('overlay:transient', async () => {
                const canvas = this.host.requireCanvas('replace transient overlays');
                const removed = uniqueIds.map((id) => this.requireIndexed(id));
                if (removed.some((entry) => entry.kind.definition.persistence.mode !== 'transient')) {
                    throw new CoreRuntimeError('[ImageEditor] Transient overlay replacement accepts only transient kinds.');
                }
                try {
                    for (const entry of removed)
                        canvas.remove(entry.object);
                    for (const object of uniqueObjects)
                        canvas.add(object);
                    this.rebuildIndex();
                    const inserted = this.resolveOverlayObjects(uniqueObjects);
                    if (inserted.length !== uniqueObjects.length ||
                        inserted.some((entry) => entry.kind.definition.persistence.mode !== 'transient')) {
                        throw new CoreRuntimeError('[ImageEditor] Transient overlay replacement produced an invalid kind.');
                    }
                    this.host.requestRender();
                }
                catch (error) {
                    for (const object of uniqueObjects)
                        canvas.remove(object);
                    for (const entry of removed) {
                        if (!canvas.getObjects().includes(entry.object))
                            canvas.add(entry.object);
                    }
                    this.rebuildIndex();
                    throw error;
                }
            });
        }
        remove(ids) {
            if (ids.length === 0)
                return Promise.resolve();
            const uniqueIds = Object.freeze([...new Set(ids)]);
            return this.mutate({
                id: this.nextMutationId('delete'),
                operationId: 'overlay:remove',
                action: 'delete',
                objectIds: uniqueIds,
                metadata: Object.freeze({ objectCount: uniqueIds.length }),
                mutate: () => {
                    const canvas = this.host.requireCanvas('remove overlays');
                    const objects = uniqueIds.map((id) => this.requireIndexed(id).object);
                    if (getActiveCanvasObjects(canvas).some((object) => objects.includes(object))) {
                        canvas.discardActiveObject();
                    }
                    for (const object of objects)
                        canvas.remove(object);
                },
            });
        }
        removeTransient(ids) {
            if (ids.length === 0)
                return Promise.resolve();
            const uniqueIds = Object.freeze([...new Set(ids)]);
            return this.host.runOperation('overlay:transient', async () => {
                const entries = uniqueIds.map((id) => this.requireIndexed(id));
                if (entries.some((entry) => entry.kind.definition.persistence.mode !== 'transient')) {
                    throw new CoreRuntimeError('[ImageEditor] Transient overlay removal accepts only transient kinds.');
                }
                const canvas = this.host.requireCanvas('remove transient overlays');
                if (getActiveCanvasObjects(canvas).some((object) => entries.some((entry) => entry.object === object))) {
                    canvas.discardActiveObject();
                }
                for (const entry of entries)
                    canvas.remove(entry.object);
                this.rebuildIndex();
                this.host.requestRender();
            });
        }
        async cancelActiveGesture(reason = abortError$2('Overlay gesture was cancelled.')) {
            const gesture = this.activeGesture;
            if (!(gesture === null || gesture === void 0 ? void 0 : gesture.transaction))
                return;
            this.failGesture(gesture, reason);
            try {
                await gesture.transaction;
            }
            catch (error) {
                if (!isAbortError(error) && error !== reason)
                    throw error;
            }
        }
        waitForIdle() {
            var _a, _b, _c;
            return (_c = (_b = (_a = this.activeGesture) === null || _a === void 0 ? void 0 : _a.transaction) !== null && _b !== void 0 ? _b : this.lastGestureTransaction) !== null && _c !== void 0 ? _c : Promise.resolve();
        }
        async flatten(query = {}, options = {}) {
            this.assertActive('flatten overlays');
            const selected = this.list({
                ...query,
                includeHidden: query.includeHidden === true,
                includeLocked: true,
            });
            if (selected.length === 0)
                return;
            await this.geometry.run({
                id: `overlay:flatten:${Date.now()}:${++this.generatedIdSequence}`,
                kind: 'flatten',
                operationId: 'overlay:flatten',
                metadata: Object.freeze({ overlayCount: selected.length }),
                mutateBase: async ({ transaction }) => {
                    var _a, _b;
                    const canvas = this.host.requireCanvas('flatten overlays');
                    const baseImage = this.host.getBaseImage();
                    if (!baseImage) {
                        throw new CoreRuntimeError('[ImageEditor] Cannot flatten without a base image.');
                    }
                    const exportElement = canvas.lowerCanvasEl.ownerDocument.createElement('canvas');
                    const exportCanvas = new this.host.fabric.StaticCanvas(exportElement, {
                        width: canvas.getWidth(),
                        height: canvas.getHeight(),
                        backgroundColor: this.host.backgroundColor,
                        renderOnAddRemove: false,
                    });
                    try {
                        const format = (_a = options.format) !== null && _a !== void 0 ? _a : 'png';
                        const quality = Math.max(0, Math.min(1, (_b = options.quality) !== null && _b !== void 0 ? _b : 0.92));
                        const exportOptions = Object.freeze({
                            area: 'image',
                            format,
                            quality,
                            multiplier: 1,
                        });
                        const baseClone = await baseImage.clone();
                        exportCanvas.add(baseClone);
                        exportCanvas.sendObjectToBack(baseClone);
                        await this.renderObjects(exportCanvas, selected, exportOptions);
                        exportCanvas.renderAll();
                        const dataUrl = exportCanvas.toDataURL({
                            format,
                            quality,
                            multiplier: 1,
                            ...getImageExportRegion(baseImage, canvas),
                        });
                        const replacement = await this.host.fabric.FabricImage.fromURL(dataUrl);
                        replacement.set({
                            left: 0,
                            top: 0,
                            originX: 'left',
                            originY: 'top',
                            scaleX: 1,
                            scaleY: 1,
                            selectable: false,
                            evented: false,
                        });
                        replacement.setCoords();
                        this.host.replaceBaseImage(transaction, replacement, {
                            baseScale: 1,
                            mimeType: format === 'jpeg' ? 'image/jpeg' : `image/${format}`,
                        });
                        for (const object of selected)
                            canvas.remove(object);
                    }
                    finally {
                        await exportCanvas.dispose();
                    }
                },
            });
        }
        dispose() {
            if (this.disposed)
                return;
            if (this.activeGesture) {
                this.failGesture(this.activeGesture, abortError$2('Overlay Foundation was disposed during an active gesture.'));
            }
            const canvas = this.host.getCanvas();
            if (canvas) {
                for (const indexed of [...this.byId.values()]) {
                    if (indexed.kind.definition.persistence.mode === 'transient') {
                        canvas.remove(indexed.object);
                    }
                }
            }
            if (canvas && typeof canvas.off === 'function') {
                canvas.off('object:added', this.onObjectAdded);
                canvas.off('object:removed', this.onObjectRemoved);
                canvas.off('before:transform', this.onBeforeTransform);
                canvas.off('object:moving', this.onObjectMoving);
                canvas.off('object:scaling', this.onObjectScaling);
                canvas.off('object:rotating', this.onObjectRotating);
                canvas.off('object:modified', this.onObjectModified);
                canvas.off('selection:created', this.onSelectionChanged);
                canvas.off('selection:updated', this.onSelectionChanged);
                canvas.off('selection:cleared', this.onSelectionChanged);
            }
            const registrationErrors = disposeInReverseSync(this.registrations, {
                pluginId: OVERLAY_STATE_ID,
            });
            this.registrations.length = 0;
            this.selectionListeners.clear();
            this.setPreviewObjectsHidden(false);
            this.byId.clear();
            this.kinds.clear();
            this.policies.clear();
            this.interactionPolicies.clear();
            this.serializers.clear();
            this.renderers.clear();
            this.preservedRecords = [];
            this.attached = false;
            this.disposed = true;
            if (registrationErrors.length > 0) {
                throw new CoreRuntimeError(`[ImageEditor] Overlay Foundation disposal had ${registrationErrors.length} registration cleanup error(s).`);
            }
        }
        captureState() {
            var _a;
            this.setPreviewObjectsHidden(false);
            try {
                const canvas = this.host.getCanvas();
                for (const object of (_a = canvas === null || canvas === void 0 ? void 0 : canvas.getObjects()) !== null && _a !== void 0 ? _a : []) {
                    const marked = object;
                    if (typeof marked.editorOverlayKind === 'string' && !this.byObject.has(object)) {
                        throw new CoreRuntimeError(`[ImageEditor] Persistent overlay kind "${marked.editorOverlayKind}" is not registered.`);
                    }
                }
                const overlays = [];
                for (const object of this.indexedCanvasObjects()) {
                    const indexed = this.byObject.get(object);
                    if (indexed.kind.definition.persistence.mode === 'transient')
                        continue;
                    const serializer = this.serializers.get(indexed.kind.definition.id);
                    if (!serializer) {
                        throw new CoreRuntimeError(`[ImageEditor] Overlay kind "${indexed.kind.definition.id}" has no serializer.`);
                    }
                    const classification = this.classificationFor(indexed);
                    overlays.push(Object.freeze({
                        kind: classification.kind,
                        persistentId: classification.persistentId,
                        hidden: classification.hidden,
                        locked: classification.locked,
                        codec: Object.freeze({
                            type: serializer.type,
                            version: serializer.version,
                        }),
                        data: serializer.serialize(object),
                    }));
                }
                overlays.push(...this.preservedRecords);
                return Object.freeze({
                    version: 1,
                    overlays: Object.freeze(overlays),
                    selectionIds: this.getSelection().ids,
                });
            }
            finally {
                this.setPreviewObjectsHidden(true);
            }
        }
        validateSnapshotState(value) {
            if (!validateStateShape(value)) {
                return { valid: false, message: 'Overlay Foundation state is malformed.' };
            }
            const persistentIds = value.overlays.map((record) => record.persistentId);
            if (new Set(persistentIds).size !== persistentIds.length) {
                return {
                    valid: false,
                    message: 'Overlay Foundation state is malformed: duplicate persistent ID detected.',
                };
            }
            for (const record of value.overlays) {
                const kind = this.kinds.get(record.kind);
                const serializer = this.serializers.get(record.kind);
                if (!kind || !serializer) {
                    return {
                        valid: false,
                        message: `Overlay kind "${record.kind}" has no installed Object Codec.`,
                    };
                }
                if (kind.definition.persistence.mode !== 'persistent' ||
                    record.codec.type !== serializer.type ||
                    record.codec.version !== serializer.version) {
                    return {
                        valid: false,
                        message: `Overlay kind "${record.kind}" Object Codec identity is incompatible.`,
                    };
                }
                if (!serializer.validate(record.data)) {
                    return {
                        valid: false,
                        message: `Overlay "${record.persistentId}" failed Object Codec validation.`,
                    };
                }
            }
            return { valid: true, value };
        }
        async restoreState(value) {
            var _a, _b;
            const canvas = this.host.getCanvas();
            if (!canvas) {
                throw new CoreRuntimeError('[ImageEditor] Overlay state restore requires Canvas.');
            }
            canvas.discardActiveObject();
            for (const indexed of [...this.byId.values()])
                canvas.remove(indexed.object);
            this.byId.clear();
            this.preservedRecords = [];
            for (const record of value.overlays) {
                const serializer = this.serializers.get(record.kind);
                const kind = this.kinds.get(record.kind);
                if (!serializer ||
                    !kind ||
                    kind.definition.persistence.mode !== 'persistent' ||
                    record.codec.type !== serializer.type ||
                    record.codec.version !== serializer.version) {
                    this.preservedRecords.push(record);
                    continue;
                }
                if (!serializer.validate(record.data)) {
                    throw new CoreRuntimeError(`[ImageEditor] Serialized overlay "${record.persistentId}" is invalid.`);
                }
                const object = await serializer.deserialize(record.data, { fabric: this.host.fabric });
                const marked = object;
                marked.editorOverlayKind = record.kind;
                marked.editorOverlayId = record.persistentId;
                marked.editorOverlayHidden = record.hidden;
                marked.editorOverlayLocked = record.locked;
                (_b = (_a = kind.definition).setPersistentId) === null || _b === void 0 ? void 0 : _b.call(_a, object, record.persistentId);
                canvas.add(object);
                this.applyHidden(record.persistentId, record.hidden);
                this.applyLocked(record.persistentId, record.locked);
            }
            this.rebuildIndex();
            const restoredSelection = value.selectionIds.filter((persistentId) => this.byId.has(persistentId));
            if (restoredSelection.length > 0)
                this.applySelection(restoredSelection);
            this.host.requestRender();
        }
        resetState() {
            const canvas = this.host.getCanvas();
            if (canvas) {
                canvas.discardActiveObject();
                for (const indexed of [...this.byId.values()])
                    canvas.remove(indexed.object);
            }
            this.byId.clear();
            this.preservedRecords = [];
        }
        beginGesture(target, action) {
            if (this.disposed)
                return;
            const targets = this.resolveOverlayTargets(target);
            if (targets.length === 0)
                return;
            if (this.activeGesture) {
                const currentIds = this.activeGesture.targets.map((entry) => entry.persistentId);
                const nextIds = targets.map((entry) => entry.persistentId);
                if (JSON.stringify(currentIds) === JSON.stringify(nextIds))
                    return;
                this.failGesture(this.activeGesture, abortError$2('Overlay gesture was superseded by another target.'));
                return;
            }
            let resolveCompletion;
            let rejectCompletion;
            const completion = new Promise((resolve, reject) => {
                resolveCompletion = resolve;
                rejectCompletion = reject;
            });
            const id = this.nextMutationId('gesture');
            const gesture = {
                id,
                action,
                targets,
                completion,
                resolve: resolveCompletion,
                reject: rejectCompletion,
                completionSettled: false,
                previewWork: Promise.resolve(),
                transaction: null,
                context: null,
            };
            this.activeGesture = gesture;
            const transaction = this.mutations
                .run({
                id,
                kind: 'overlay',
                operationId: 'overlay:gesture',
                conflictDomains: ['document', 'overlay', 'selection', 'state'],
                metadata: Object.freeze({
                    interactive: true,
                    objectIds: targets.map((entry) => entry.persistentId),
                }),
                mutate: async (context) => {
                    gesture.context = context;
                    await this.waitForGestureCompletion(gesture, context.signal);
                    await gesture.previewWork;
                    return this.createMutationDescriptor(id, 'overlay:gesture', gesture.action, targets, context.metadata);
                },
                synchronize: (descriptor, context) => this.runInteractionPolicies(targets, descriptor, context, 'synchronize'),
                validate: (descriptor, context) => this.validateMutation(targets, descriptor, context),
                describeCommit: (descriptor) => descriptor,
            })
                .then(() => undefined);
            gesture.transaction = transaction;
            this.lastGestureTransaction = transaction;
            transaction.then(() => this.clearGesture(gesture), () => this.clearGesture(gesture));
            void transaction.catch((error) => {
                if (!isAbortError(error)) {
                    this.host.reportError(error, 'Overlay gesture transaction failed.');
                }
            });
        }
        previewGesture(target, action) {
            const gesture = this.activeGesture;
            if (!target || !gesture || !gesture.context || gesture.completionSettled)
                return;
            const previewIds = new Set(this.resolveOverlayTargets(target).map((entry) => entry.persistentId));
            if (gesture.targets.some((entry) => !previewIds.has(entry.persistentId))) {
                this.failGesture(gesture, new CoreRuntimeError('[ImageEditor] Overlay preview target changed mid-gesture.'));
                return;
            }
            gesture.action = action;
            const descriptor = this.createMutationDescriptor(gesture.id, 'overlay:gesture', action, gesture.targets, gesture.context.metadata);
            gesture.previewWork = gesture.previewWork
                .then(() => this.runInteractionPolicies(gesture.targets, descriptor, gesture.context, 'preview'))
                .catch((error) => {
                this.failGesture(gesture, error);
            });
        }
        resolveGesture(gesture) {
            if (gesture.completionSettled)
                return;
            gesture.completionSettled = true;
            gesture.resolve();
        }
        failGesture(gesture, error) {
            if (gesture.completionSettled)
                return;
            gesture.completionSettled = true;
            gesture.reject(error);
        }
        clearGesture(gesture) {
            if (this.activeGesture === gesture)
                this.activeGesture = null;
        }
        async waitForGestureCompletion(gesture, signal) {
            var _a;
            if (signal.aborted) {
                throw (_a = signal.reason) !== null && _a !== void 0 ? _a : abortError$2('Overlay gesture was aborted.');
            }
            let abort;
            const aborted = new Promise((resolve, reject) => {
                abort = () => { var _a; return reject((_a = signal.reason) !== null && _a !== void 0 ? _a : abortError$2('Overlay gesture was aborted.')); };
                signal.addEventListener('abort', abort, { once: true });
            });
            try {
                await Promise.race([gesture.completion, aborted]);
            }
            finally {
                signal.removeEventListener('abort', abort);
            }
        }
        createMutationContext(transaction, action, targets) {
            return Object.freeze({
                transaction,
                action,
                objectIds: Object.freeze(targets.map((entry) => entry.persistentId)),
            });
        }
        createMutationDescriptor(id, operationId, action, targets, metadata) {
            return Object.freeze({
                id,
                operationId,
                action,
                objectIds: Object.freeze(targets.map((entry) => entry.persistentId)),
                objectKinds: Object.freeze(targets.map((entry) => entry.kind.definition.id)),
                metadata,
            });
        }
        async runInteractionPolicies(targets, descriptor, transaction, phase) {
            var _a, _b, _c;
            for (const target of targets) {
                const policy = this.interactionPolicies.get(target.kind.definition.id);
                if (!policy)
                    continue;
                const context = Object.freeze({
                    ...this.createMutationContext(transaction, descriptor.action, targets),
                    descriptor,
                    phase,
                });
                try {
                    if (phase === 'preview')
                        await ((_a = policy.preview) === null || _a === void 0 ? void 0 : _a.call(policy, target.object, context));
                    else if (phase === 'synchronize') {
                        await ((_b = policy.synchronize) === null || _b === void 0 ? void 0 : _b.call(policy, target.object, context));
                    }
                    else {
                        await ((_c = policy.validate) === null || _c === void 0 ? void 0 : _c.call(policy, target.object, context));
                    }
                }
                catch (error) {
                    if (error instanceof OverlayRecoverableObjectError) {
                        this.host.reportWarning(error, `A recoverable overlay ${phase} failure was isolated for "${target.persistentId}".`);
                        continue;
                    }
                    throw error;
                }
            }
        }
        async validateMutation(targets, descriptor, transaction) {
            var _a;
            this.rebuildIndex();
            const canvas = this.host.requireCanvas('validate an overlay mutation');
            const liveObjects = new Set(canvas.getObjects());
            if (new Set(descriptor.objectIds).size !== descriptor.objectIds.length) {
                throw new CoreRuntimeError('[ImageEditor] Overlay mutation contains duplicate ids.');
            }
            for (const target of targets) {
                const currentId = target.kind.definition.getPersistentId(target.object);
                if (currentId !== target.persistentId) {
                    throw new CoreRuntimeError(`[ImageEditor] Overlay "${target.persistentId}" changed persistent identity.`);
                }
                if (descriptor.action !== 'delete' &&
                    (!liveObjects.has(target.object) ||
                        ((_a = this.byId.get(target.persistentId)) === null || _a === void 0 ? void 0 : _a.object) !== target.object)) {
                    throw new CoreRuntimeError(`[ImageEditor] Overlay "${target.persistentId}" is missing from the committed index.`);
                }
            }
            const selection = this.getSelection();
            if (selection.ids.some((id) => !this.byId.has(id))) {
                canvas.discardActiveObject();
                this.emitSelection();
            }
            await this.runInteractionPolicies(targets, descriptor, transaction, 'validate');
        }
        resolveOverlayTargets(target) {
            const direct = this.byObject.get(target);
            if (direct)
                return Object.freeze([direct]);
            const grouped = target;
            if (typeof grouped.getObjects !== 'function')
                return Object.freeze([]);
            return this.resolveOverlayObjects(grouped.getObjects());
        }
        resolveOverlayObjects(objects) {
            const targets = [];
            const ids = new Set();
            for (const object of objects) {
                const indexed = this.byObject.get(object);
                if (!indexed || ids.has(indexed.persistentId))
                    continue;
                ids.add(indexed.persistentId);
                targets.push(indexed);
            }
            return Object.freeze(targets);
        }
        resolveOverlayIds(ids) {
            return Object.freeze([...new Set(ids)].map((id) => this.requireIndexed(id)));
        }
        mergeTargets(first, second) {
            const merged = new Map();
            for (const target of [...first, ...second])
                merged.set(target.persistentId, target);
            return Object.freeze([...merged.values()]);
        }
        applyHidden(id, hidden) {
            const indexed = this.requireIndexed(id);
            const object = indexed.object;
            const preview = indexed.preview;
            const marked = object;
            marked.editorOverlayHidden = hidden;
            if (indexed.kind.definition.setHidden) {
                indexed.kind.definition.setHidden(object, hidden);
            }
            else {
                object.set({ visible: !hidden });
            }
            if (preview) {
                preview[0] = !hidden;
                preview[1] = hidden;
                object.visible = false;
            }
            if (hidden &&
                getActiveCanvasObjects(this.host.requireCanvas('hide an overlay')).includes(object)) {
                this.discardSelection();
            }
        }
        applyLocked(id, locked) {
            const indexed = this.requireIndexed(id);
            const marked = indexed.object;
            marked.editorOverlayLocked = locked;
            if (indexed.kind.definition.setLocked) {
                indexed.kind.definition.setLocked(indexed.object, locked);
            }
            else {
                indexed.object.set({ selectable: !locked, evented: !locked });
            }
            if (locked &&
                getActiveCanvasObjects(this.host.requireCanvas('lock an overlay')).includes(indexed.object)) {
                this.discardSelection();
            }
        }
        mutateLayer(id, direction, mutate) {
            return this.mutate({
                id: this.nextMutationId('layer'),
                operationId: 'overlay:layer',
                action: 'layer',
                objectIds: [id],
                metadata: Object.freeze({ direction }),
                mutate,
            });
        }
        nextMutationId(action) {
            return `overlay:${action}:${Date.now()}:${++this.generatedIdSequence}`;
        }
        async prepareGeometry(mutation) {
            var _a;
            const canvas = this.host.requireCanvas('prepare overlay geometry');
            for (const policy of this.policies.values()) {
                if (!policy.supports || policy.supports(mutation))
                    await ((_a = policy.prepare) === null || _a === void 0 ? void 0 : _a.call(policy, mutation));
            }
            const selectionIds = this.getSelection().ids;
            canvas.discardActiveObject();
            const entries = this.indexedCanvasObjects().map((object) => {
                const indexed = this.byObject.get(object);
                return Object.freeze({
                    object,
                    persistentId: indexed.persistentId,
                    kind: indexed.kind.definition.id,
                    transform: captureTransform(object),
                });
            });
            return Object.freeze({ entries: Object.freeze(entries), selectionIds });
        }
        async applyGeometry(mutation, prepared, context) {
            if (mutation.kind === 'flatten')
                return;
            const delta = mutation.kind === 'crop' ? null : mutation.affineDelta;
            for (const entry of prepared.entries) {
                const policy = this.policies.get(entry.kind);
                if ((policy === null || policy === void 0 ? void 0 : policy.supports) && !policy.supports(mutation))
                    continue;
                try {
                    if (policy === null || policy === void 0 ? void 0 : policy.apply) {
                        await policy.apply(entry.object, mutation);
                    }
                    else if (delta) {
                        applyDeltaToObject(entry.object, delta, {
                            fabricUtil: this.createFabricUtilAccess(),
                            preserveReadableText: (policy === null || policy === void 0 ? void 0 : policy.preserveReadable) === true,
                        });
                    }
                }
                catch (error) {
                    context.warnRecoverable(error, entry.persistentId, entry.kind);
                }
            }
        }
        async synchronizeGeometry(mutation) {
            var _a;
            for (const policy of this.policies.values()) {
                if (!policy.supports || policy.supports(mutation))
                    await ((_a = policy.synchronize) === null || _a === void 0 ? void 0 : _a.call(policy, mutation));
            }
            this.rebuildIndex();
        }
        rollbackGeometry(prepared) {
            const canvas = this.host.getCanvas();
            if (!canvas)
                return;
            for (let index = prepared.entries.length - 1; index >= 0; index -= 1) {
                const entry = prepared.entries[index];
                if (!canvas.getObjects().includes(entry.object))
                    canvas.add(entry.object);
                entry.object.set(entry.transform);
                entry.object.setCoords();
            }
            this.rebuildIndex();
            this.applySelection(prepared.selectionIds);
        }
        async renderExport(targetCanvas, options) {
            var _a;
            this.setPreviewObjectsHidden(false);
            try {
                const overlayOptions = parseExportOptions((_a = options.contributors) === null || _a === void 0 ? void 0 : _a[OVERLAY_STATE_ID]);
                const included = overlayOptions.includeKinds
                    ? new Set(overlayOptions.includeKinds)
                    : null;
                const excluded = overlayOptions.excludeKinds
                    ? new Set(overlayOptions.excludeKinds)
                    : null;
                const objects = this.indexedCanvasObjects().filter((object) => {
                    const indexed = this.byObject.get(object);
                    const classification = this.classificationFor(indexed);
                    if (included && !included.has(classification.kind))
                        return false;
                    if (excluded === null || excluded === void 0 ? void 0 : excluded.has(classification.kind))
                        return false;
                    return !classification.hidden || overlayOptions.includeHidden;
                });
                await this.renderObjects(targetCanvas, objects, options);
            }
            finally {
                this.setPreviewObjectsHidden(true);
            }
        }
        async renderObjects(targetCanvas, objects, options) {
            for (const object of objects) {
                const indexed = this.byObject.get(object);
                if (!indexed)
                    continue;
                const classification = this.classificationFor(indexed);
                const renderer = this.renderers.get(classification.kind);
                if (renderer) {
                    await renderer.render({ source: object, targetCanvas, options });
                }
                else {
                    const clone = await object.clone();
                    clone.set({ visible: true });
                    targetCanvas.add(clone);
                }
            }
        }
        indexObject(object) {
            if (this.byObject.has(object))
                return;
            const records = [...this.kinds.values()].sort((left, right) => left.registrationOrder - right.registrationOrder);
            for (const kind of records) {
                let matches = false;
                try {
                    matches = kind.definition.classify(object);
                }
                catch (error) {
                    this.host.reportWarning(error, `Overlay kind predicate "${kind.definition.id}" failed.`);
                }
                if (!matches)
                    continue;
                let persistentId = kind.definition.getPersistentId(object);
                if (!persistentId && kind.definition.setPersistentId) {
                    persistentId = this.generatePersistentId(kind.definition.id);
                    kind.definition.setPersistentId(object, persistentId);
                }
                if (!persistentId || !OVERLAY_ID_PATTERN.test(persistentId)) {
                    this.host.reportWarning(new Error('Malformed persistent overlay id.'), `Overlay kind "${kind.definition.id}" produced an invalid persistent id.`);
                    return;
                }
                const duplicate = this.byId.get(persistentId);
                if (duplicate && duplicate.object !== object) {
                    this.host.reportWarning(new Error(`Duplicate overlay id: ${persistentId}`), `Overlay "${persistentId}" was not indexed because its id is already in use.`);
                    return;
                }
                const indexed = { object, kind, persistentId };
                this.byId.set(persistentId, indexed);
                this.byObject.set(object, indexed);
                const marked = object;
                marked.editorOverlayKind = kind.definition.id;
                marked.editorOverlayId = persistentId;
                return;
            }
        }
        unindexObject(object) {
            const indexed = this.byObject.get(object);
            if (!indexed)
                return;
            if (this.byId.get(indexed.persistentId) === indexed)
                this.byId.delete(indexed.persistentId);
            this.byObject.delete(object);
        }
        rebuildIndex() {
            const canvas = this.host.getCanvas();
            if (!canvas)
                return;
            const live = new Set(canvas.getObjects());
            for (const indexed of [...this.byId.values()]) {
                if (!live.has(indexed.object))
                    this.unindexObject(indexed.object);
            }
            for (const object of canvas.getObjects())
                this.indexObject(object);
        }
        classificationFor(indexed) {
            const definition = indexed.kind.definition;
            const marked = indexed.object;
            const preview = indexed.preview;
            const hidden = preview
                ? preview[1]
                : definition.isHidden
                    ? definition.isHidden(indexed.object)
                    : marked.editorOverlayHidden === true || indexed.object.visible === false;
            return Object.freeze({
                kind: definition.id,
                persistentId: indexed.persistentId,
                ownerPluginId: definition.ownerPluginId,
                hidden,
                locked: definition.isLocked
                    ? definition.isLocked(indexed.object)
                    : marked.editorOverlayLocked === true,
            });
        }
        indexedCanvasObjects() {
            const canvas = this.host.requireCanvas('inspect overlay order');
            return canvas.getObjects().filter((object) => this.byObject.has(object));
        }
        setPreviewObjectsHidden(hidden) {
            for (const target of this.byId.values()) {
                if (target.preview) {
                    target.object.visible = hidden ? false : target.preview[0];
                }
            }
        }
        moveRelative(id, delta) {
            const overlays = this.indexedCanvasObjects();
            const current = overlays.indexOf(this.requireIndexed(id).object);
            this.moveToOverlayIndex(id, Math.max(0, Math.min(overlays.length - 1, current + delta)), overlays);
        }
        moveToOverlayIndex(id, target, overlays) {
            if (overlays.length === 0)
                return;
            const canvas = this.host.requireCanvas('change overlay layer');
            const object = this.requireIndexed(id).object;
            const targetObject = overlays[Math.max(0, Math.min(overlays.length - 1, target))];
            const targetCanvasIndex = canvas.getObjects().indexOf(targetObject);
            const movableCanvas = canvas;
            if (movableCanvas.moveObjectTo) {
                movableCanvas.moveObjectTo(object, targetCanvasIndex);
            }
            else {
                canvas.remove(object);
                canvas.insertAt(targetCanvasIndex, object);
            }
            this.host.requestRender();
        }
        requireIndexed(id) {
            this.assertActive('access an overlay');
            const indexed = this.byId.get(id);
            if (!indexed)
                throw new CoreRuntimeError(`[ImageEditor] Overlay "${id}" was not found.`);
            return indexed;
        }
        requireKindOwner(kindId, ownerPluginId) {
            const kind = this.kinds.get(kindId);
            if (!kind)
                throw new CoreRuntimeError(`[ImageEditor] Overlay kind "${kindId}" is not registered.`);
            if (kind.definition.ownerPluginId !== ownerPluginId) {
                throw new CoreRuntimeError(`[ImageEditor] Overlay kind "${kindId}" belongs to "${kind.definition.ownerPluginId}", not "${ownerPluginId}".`);
            }
        }
        emitSelection() {
            if (this.disposed)
                return;
            const selection = this.getSelection();
            for (const listener of [...this.selectionListeners]) {
                try {
                    listener(selection);
                }
                catch (error) {
                    this.host.reportWarning(error, 'Overlay selection listener failed.');
                }
            }
        }
        generatePersistentId(kind) {
            var _a, _b;
            const randomId = (_b = (_a = globalThis.crypto) === null || _a === void 0 ? void 0 : _a.randomUUID) === null || _b === void 0 ? void 0 : _b.call(_a);
            return randomId
                ? `${kind}:${randomId}`
                : `${kind}:${Date.now().toString(36)}:${++this.generatedIdSequence}`;
        }
        createFabricUtilAccess() {
            return {
                multiplyTransformMatrices: (left, right) => this.host.fabric.util.multiplyTransformMatrices(left, right),
                invertTransform: (matrix) => this.host.fabric.util.invertTransform(matrix),
                qrDecompose: (matrix) => this.host.fabric.util.qrDecompose(matrix),
                Point: this.host.fabric.Point,
            };
        }
        assertRuntimeIdentifier(value, label) {
            if (!isRuntimeIdentifier(value)) {
                throw new CoreRuntimeError(`[ImageEditor] ${label} must match "namespace:kebab-case".`);
            }
        }
        assertOpaqueIdentifier(value, label) {
            if (!OVERLAY_ID_PATTERN.test(value)) {
                throw new CoreRuntimeError(`[ImageEditor] ${label} must be a safe identifier no longer than 128 characters.`);
            }
        }
        assertActive(operation) {
            if (this.disposed)
                throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} after disposal.`);
        }
    }

    function isFinitePoint(value) {
        if (typeof value !== 'object' || value === null)
            return false;
        const point = value;
        return Number.isFinite(point.x) && Number.isFinite(point.y);
    }
    function isOverlayStateBoundsGeometry(value) {
        if (typeof value !== 'object' || value === null)
            return false;
        const geometry = value;
        return (geometry.type === 'bounds' &&
            Array.isArray(geometry.corners) &&
            geometry.corners.length === 4 &&
            geometry.corners.every(isFinitePoint));
    }
    function captureOverlayStateBounds(object, context) {
        object.setCoords();
        const corners = object.getCoords();
        if (corners.length !== 4) {
            throw new TypeError('Overlay State bounds require four object corners.');
        }
        return Object.freeze({
            type: 'bounds',
            corners: Object.freeze(corners.map((point) => Object.freeze(context.toImageNormalized(point)))),
        });
    }
    function frameFromCorners(corners) {
        const [topLeft, topRight, , bottomLeft] = corners;
        return [
            topRight.x - topLeft.x,
            topRight.y - topLeft.y,
            bottomLeft.x - topLeft.x,
            bottomLeft.y - topLeft.y,
            topLeft.x,
            topLeft.y,
        ];
    }
    function cornersMatch(actual, expected, epsilon = 1e-6) {
        return actual.every((point, index) => Math.abs(point.x - expected[index].x) <= epsilon &&
            Math.abs(point.y - expected[index].y) <= epsilon);
    }
    function restoreOverlayStateBounds(object, geometry, context, fabric) {
        if (!isOverlayStateBoundsGeometry(geometry)) {
            throw new TypeError('Overlay State bounds are malformed.');
        }
        const targetCorners = geometry.corners.map((point) => context.toCanvasPoint(point));
        const fabricUtil = {
            multiplyTransformMatrices: (left, right) => fabric.util.multiplyTransformMatrices(left, right),
            invertTransform: (matrix) => fabric.util.invertTransform(matrix),
            qrDecompose: (matrix) => fabric.util.qrDecompose(matrix),
            Point: fabric.Point,
        };
        for (let attempt = 0; attempt < 8; attempt += 1) {
            object.setCoords();
            const sourceCorners = object.getCoords();
            if (sourceCorners.length !== 4) {
                throw new TypeError('Overlay State bounds require four object corners.');
            }
            if (cornersMatch(sourceCorners, targetCorners))
                return;
            const delta = fabricUtil.multiplyTransformMatrices(frameFromCorners(targetCorners), fabricUtil.invertTransform(frameFromCorners(sourceCorners)));
            applyDeltaToObject(object, delta, { fabricUtil });
        }
        object.setCoords();
        if (!cornersMatch(object.getCoords(), targetCorners)) {
            throw new TypeError('Overlay State bounds could not be restored precisely.');
        }
    }
    function objectPointToCanvas(object, point) {
        var _a, _b;
        const offset = object
            .pathOffset;
        const x = point.x - ((_a = offset === null || offset === void 0 ? void 0 : offset.x) !== null && _a !== void 0 ? _a : 0);
        const y = point.y - ((_b = offset === null || offset === void 0 ? void 0 : offset.y) !== null && _b !== void 0 ? _b : 0);
        const [a, b, c, d, e, f] = object.calcTransformMatrix();
        return Object.freeze({ x: a * x + c * y + e, y: b * x + d * y + f });
    }

    const OVERLAY_CAPABILITY = createCapabilityToken('foundation:overlay', '1.0.0');
    const OVERLAY_REGISTRATION_CAPABILITY = createCapabilityToken('foundation:overlay-registration', '1.0.0');
    const overlayFoundationRef = definePluginRef('foundation:overlay', '1.0.0');
    function createRuntimeApi(controller) {
        const bind = (method) => method.bind(controller);
        const api = {
            list: bind(controller.list),
            getByPersistentId: bind(controller.getByPersistentId),
            classify: bind(controller.classify),
            getStateKind: bind(controller.getStateKind),
            flatten: bind(controller.flatten),
            mutate: bind(controller.mutate),
            add: bind(controller.add),
            addTransient: bind(controller.addTransient),
            replaceTransient: bind(controller.replaceTransient),
            remove: bind(controller.remove),
            removeTransient: bind(controller.removeTransient),
            cancelActiveGesture: bind(controller.cancelActiveGesture),
            waitForIdle: bind(controller.waitForIdle),
            getSelection: bind(controller.getSelection),
            select: bind(controller.select),
            discardSelection: bind(controller.discardSelection),
            onSelectionChange: bind(controller.onSelectionChange),
            hideForPreview: bind(controller.hideForPreview),
            setHidden: bind(controller.setHidden),
            setLocked: bind(controller.setLocked),
            bringForward: bind(controller.bringForward),
            sendBackward: bind(controller.sendBackward),
            bringToFront: bind(controller.bringToFront),
            sendToBack: bind(controller.sendToBack),
        };
        return Object.freeze(api);
    }
    function createRegistrationApi(controller) {
        const bind = (method) => method.bind(controller);
        const registration = {
            registerKind: bind(controller.registerKind),
            registerGeometryPolicy: bind(controller.registerGeometryPolicy),
            registerInteractionPolicy: bind(controller.registerInteractionPolicy),
            registerExportRenderer: bind(controller.registerExportRenderer),
        };
        return Object.freeze(registration);
    }
    function overlayFoundationPlugin() {
        let controller = null;
        return definePlugin({
            ref: overlayFoundationRef,
            manifest: {
                id: overlayFoundationRef.id,
                version: '1.0.0',
                apiVersion: overlayFoundationRef.apiVersion,
                engine: '^3.0.0',
                requires: [
                    { token: CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
                    { token: CORE_PRESENTATION_CAPABILITY, range: '^1.0.0' },
                    { token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                    { token: CANVAS_READ_CAPABILITY, range: '^1.0.0' },
                    { token: BASE_IMAGE_READ_CAPABILITY, range: '^1.0.0' },
                    { token: RENDER_REQUEST_CAPABILITY, range: '^1.0.0' },
                    { token: RASTER_MUTATION_CAPABILITY, range: '^1.0.0' },
                    { token: SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' },
                    { token: GEOMETRY_MUTATION_CAPABILITY, range: '^1.0.0' },
                    { token: EXPORT_CONTRIBUTION_CAPABILITY, range: '^1.0.0' },
                    { token: DOCUMENT_MUTATION_CAPABILITY, range: '^1.0.0' },
                ],
                permissions: [
                    'fabric:objects',
                    'fabric:canvas-read',
                    'core:raster-mutation',
                    'core:geometry-participant',
                    'core:export-contributor',
                ],
            },
            setupMode: 'sync',
            setup(context) {
                const diagnostics = context.capabilities.require(CORE_DIAGNOSTICS_CAPABILITY);
                const presentation = context.capabilities.require(CORE_PRESENTATION_CAPABILITY);
                const fabricRuntime = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY);
                const canvas = context.capabilities.require(CANVAS_READ_CAPABILITY);
                const baseImage = context.capabilities.require(BASE_IMAGE_READ_CAPABILITY);
                const render = context.capabilities.require(RENDER_REQUEST_CAPABILITY);
                const raster = context.capabilities.require(RASTER_MUTATION_CAPABILITY);
                const state = context.capabilities.require(SNAPSHOT_REGISTRATION_CAPABILITY);
                const geometry = context.capabilities.require(GEOMETRY_MUTATION_CAPABILITY);
                const exportPort = context.capabilities.require(EXPORT_CONTRIBUTION_CAPABILITY);
                const mutations = context.capabilities.require(DOCUMENT_MUTATION_CAPABILITY);
                const host = Object.freeze({
                    ...diagnostics,
                    ...presentation,
                    ...fabricRuntime,
                    ...canvas,
                    ...baseImage,
                    ...render,
                    ...raster,
                    runOperation: (operationId, task) => context.operations.run(operationId, null, () => task()),
                });
                for (const operationId of [
                    'overlay:gesture',
                    'overlay:add',
                    'overlay:remove',
                    'overlay:set-hidden',
                    'overlay:set-locked',
                    'overlay:layer',
                ]) {
                    context.operations.register({
                        id: operationId,
                        mode: 'mutation',
                        conflictDomains: ['document', 'overlay', 'selection', 'state'],
                        reentrancy: 'reject',
                    });
                }
                context.operations.register({
                    id: 'overlay:transient',
                    mode: 'busy',
                    conflictDomains: ['overlay', 'selection'],
                    reentrancy: 'queue',
                });
                context.operations.register({
                    id: 'overlay:flatten',
                    mode: 'mutation',
                    conflictDomains: [
                        'document',
                        'base-image',
                        'geometry',
                        'raster',
                        'overlay',
                        'state',
                    ],
                    reentrancy: 'reject',
                });
                controller = new OverlayFoundationController(host, state, geometry, mutations, exportPort);
                context.capabilities.provide(OVERLAY_CAPABILITY, createRuntimeApi(controller), {
                    version: OVERLAY_CAPABILITY.version,
                });
                context.capabilities.provide(OVERLAY_REGISTRATION_CAPABILITY, createRegistrationApi(controller), {
                    version: OVERLAY_REGISTRATION_CAPABILITY.version,
                    requiredPermission: 'fabric:custom-class',
                });
                return controller;
            },
            onInit() {
                controller === null || controller === void 0 ? void 0 : controller.attach();
            },
            onDispose() {
                controller === null || controller === void 0 ? void 0 : controller.dispose();
                controller = null;
            },
        });
    }

    function isFiniteMatrix(matrix) {
        return matrix.length === 6 && matrix.every((value) => Number.isFinite(value));
    }
    function hasReflection(matrix) {
        return isFiniteMatrix(matrix) && matrix[0] * matrix[3] - matrix[1] * matrix[2] < 0;
    }
    function stripReflection(matrix, fabric) {
        if (!hasReflection(matrix))
            return matrix;
        const flipX = fabric.multiplyTransformMatrices(matrix, [-1, 0, 0, 1, 0, 0]);
        const flipY = fabric.multiplyTransformMatrices(matrix, [1, 0, 0, -1, 0, 0]);
        const angleMagnitude = (candidate) => {
            const angle = fabric.qrDecompose(candidate).angle;
            return Number.isFinite(angle)
                ? Math.abs((((angle % 360) + 540) % 360) - 180)
                : Number.POSITIVE_INFINITY;
        };
        return angleMagnitude(flipY) < angleMagnitude(flipX) ? flipY : flipX;
    }
    function applyAnnotationGeometry(object, mutation, fabricModule, preserveReadable) {
        var _a, _b, _c;
        if (mutation.kind !== 'transform')
            return;
        const delta = mutation.affineDelta;
        if (!delta || !isFiniteMatrix(delta))
            return;
        const fabric = {
            multiplyTransformMatrices: (left, right) => fabricModule.util.multiplyTransformMatrices(left, right),
            qrDecompose: (matrix) => fabricModule.util.qrDecompose(matrix),
            Point: fabricModule.Point,
        };
        object.setCoords();
        const previousOriginX = (_a = object.originX) !== null && _a !== void 0 ? _a : 'left';
        const previousOriginY = (_b = object.originY) !== null && _b !== void 0 ? _b : 'top';
        const originalCenter = object.getCenterPoint();
        const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = delta;
        const targetCenter = new fabric.Point(a * originalCenter.x + c * originalCenter.y + e, b * originalCenter.x + d * originalCenter.y + f);
        const orientationDelta = preserveReadable ? stripReflection(delta, fabric) : delta;
        let restoreCenter = originalCenter;
        try {
            object.set({ originX: 'center', originY: 'center' });
            object.setPositionByOrigin(originalCenter, 'center', 'center');
            object.setCoords();
            const nextMatrix = fabric.multiplyTransformMatrices(orientationDelta, object.calcTransformMatrix());
            if (!isFiniteMatrix(nextMatrix))
                return;
            const decomposed = fabric.qrDecompose(nextMatrix);
            object.set({ flipX: false, flipY: false });
            object.set({
                angle: decomposed.angle,
                scaleX: decomposed.scaleX,
                scaleY: decomposed.scaleY,
                skewX: decomposed.skewX,
                skewY: (_c = decomposed.skewY) !== null && _c !== void 0 ? _c : 0,
            });
            if (typeof decomposed.flipX === 'boolean' || typeof decomposed.flipY === 'boolean') {
                object.set({
                    ...(typeof decomposed.flipX === 'boolean' ? { flipX: decomposed.flipX } : {}),
                    ...(typeof decomposed.flipY === 'boolean' ? { flipY: decomposed.flipY } : {}),
                });
            }
            restoreCenter = targetCenter;
        }
        finally {
            object.set({ originX: previousOriginX, originY: previousOriginY });
            object.setPositionByOrigin(restoreCenter, 'center', 'center');
            object.setCoords();
        }
    }

    class AnnotationError extends Error {
        constructor(message) {
            super(`[ImageEditor] ${message}`);
            this.name = 'AnnotationError';
        }
    }
    class AnnotationValidationError extends AnnotationError {
        constructor(message) {
            super(message);
            this.name = 'AnnotationValidationError';
        }
    }
    class AnnotationNotFoundError extends AnnotationError {
        constructor(message) {
            super(message);
            this.name = 'AnnotationNotFoundError';
        }
    }

    const MAX_ANNOTATION_NAME_LENGTH = 128;
    const MAX_ANNOTATION_METADATA_DEPTH = 4;
    const MAX_ANNOTATION_METADATA_KEYS = 32;
    const MAX_ANNOTATION_METADATA_STRING_BYTES = 8 * 1024;
    const dangerousKeys$1 = new Set(['__proto__', 'constructor', 'prototype']);
    function isPlainRecord$6(value) {
        if (typeof value !== 'object' || value === null || Array.isArray(value))
            return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }
    function cloneMetadataValue(value, depth, budget) {
        if (value === null || typeof value === 'boolean')
            return value;
        if (typeof value === 'number') {
            if (!Number.isFinite(value)) {
                throw new AnnotationValidationError('Annotation metadata numbers must be finite.');
            }
            return value;
        }
        if (typeof value === 'string') {
            budget.stringBytes += new TextEncoder().encode(value).byteLength;
            if (budget.stringBytes > MAX_ANNOTATION_METADATA_STRING_BYTES) {
                throw new AnnotationValidationError('Annotation metadata string data is too large.');
            }
            return value;
        }
        if (typeof value !== 'object' || value === null) {
            throw new AnnotationValidationError('Annotation metadata must be JSON-serializable.');
        }
        if (depth >= MAX_ANNOTATION_METADATA_DEPTH) {
            throw new AnnotationValidationError('Annotation metadata is nested too deeply.');
        }
        if (budget.ancestors.has(value)) {
            throw new AnnotationValidationError('Annotation metadata cannot contain cycles.');
        }
        budget.ancestors.add(value);
        try {
            if (Array.isArray(value)) {
                if (value.length > MAX_ANNOTATION_METADATA_KEYS) {
                    throw new AnnotationValidationError('Annotation metadata arrays are too large.');
                }
                return Object.freeze(value.map((entry) => cloneMetadataValue(entry, depth + 1, budget)));
            }
            if (!isPlainRecord$6(value)) {
                throw new AnnotationValidationError('Annotation metadata objects must be plain.');
            }
            const entries = Object.entries(value);
            budget.keyCount += entries.length;
            if (budget.keyCount > MAX_ANNOTATION_METADATA_KEYS) {
                throw new AnnotationValidationError('Annotation metadata contains too many keys.');
            }
            const clone = {};
            for (const [key, entry] of entries) {
                if (dangerousKeys$1.has(key) || key.length === 0 || key.length > 128) {
                    throw new AnnotationValidationError('Annotation metadata contains an unsafe key.');
                }
                budget.stringBytes += new TextEncoder().encode(key).byteLength;
                clone[key] = cloneMetadataValue(entry, depth + 1, budget);
            }
            return Object.freeze(clone);
        }
        finally {
            budget.ancestors.delete(value);
        }
    }
    function normalizeAnnotationName(value, fallback) {
        const candidate = value === undefined ? fallback : value;
        if (typeof candidate !== 'string' ||
            candidate.length === 0 ||
            candidate.trim() !== candidate ||
            candidate.length > MAX_ANNOTATION_NAME_LENGTH) {
            throw new AnnotationValidationError(`Annotation name must be a trimmed string of at most ${MAX_ANNOTATION_NAME_LENGTH} characters.`);
        }
        return candidate;
    }
    function normalizeAnnotationMetadata(value = {}) {
        if (!isPlainRecord$6(value)) {
            throw new AnnotationValidationError('Annotation metadata must be a plain object.');
        }
        return cloneMetadataValue(value, 0, {
            keyCount: 0,
            stringBytes: 0,
            ancestors: new Set(),
        });
    }
    function isValidAnnotationMetadata(value) {
        try {
            normalizeAnnotationMetadata(value);
            return true;
        }
        catch {
            return false;
        }
    }

    function booleanOr(value, fallback) {
        return typeof value === 'boolean' ? value : fallback;
    }
    function captureAnnotationInteraction(object) {
        return Object.freeze({
            selectable: booleanOr(object.editorAnnotationSelectable, object.selectable !== false),
            evented: booleanOr(object.editorAnnotationEvented, object.evented !== false),
            hasControls: booleanOr(object.editorAnnotationHasControls, object.hasControls !== false),
            ...(typeof object.editorAnnotationEditable === 'boolean' ||
                typeof object.editable === 'boolean'
                ? {
                    editable: booleanOr(object.editorAnnotationEditable, object.editable !== false),
                }
                : {}),
        });
    }
    function applyAnnotationInteraction(object, interaction) {
        object.editorAnnotationSelectable = interaction.selectable;
        object.editorAnnotationEvented = interaction.evented;
        object.editorAnnotationHasControls = interaction.hasControls;
        if (typeof interaction.editable === 'boolean') {
            object.editorAnnotationEditable = interaction.editable;
        }
        synchronizeAnnotationRuntimeState(object);
    }
    function synchronizeAnnotationRuntimeState(object) {
        const hidden = object.editorOverlayHidden === true;
        const locked = object.editorOverlayLocked === true;
        const interaction = captureAnnotationInteraction(object);
        object.set({
            visible: !hidden,
            selectable: locked ? false : interaction.selectable,
            evented: locked ? false : interaction.evented,
            hasControls: locked ? false : interaction.hasControls,
            lockMovementX: locked,
            lockMovementY: locked,
            lockScalingX: locked,
            lockScalingY: locked,
            lockRotation: locked,
        });
        if (typeof interaction.editable === 'boolean') {
            object.editable = locked ? false : interaction.editable;
        }
        object.setCoords();
    }

    const ANNOTATION_FOUNDATION_ID = 'foundation:annotation';
    const ANNOTATION_PREVIEW_KIND = 'annotation:preview';
    const featureKindPattern = /^annotation:[a-z][a-z0-9-]{0,63}$/;
    const identifierPattern = /^[A-Za-z0-9@][A-Za-z0-9@._:/-]{0,127}$/;
    const DEFAULT_MAX_ANNOTATION_COUNT = 2000;
    const HARD_MAX_ANNOTATION_COUNT = 10000;
    function isPlainRecord$5(value) {
        if (typeof value !== 'object' || value === null || Array.isArray(value))
            return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }
    function isInteractionState(value) {
        if (!isPlainRecord$5(value))
            return false;
        const keys = Object.keys(value);
        return (keys.every((key) => ['selectable', 'evented', 'hasControls', 'editable'].includes(key)) &&
            typeof value.selectable === 'boolean' &&
            typeof value.evented === 'boolean' &&
            typeof value.hasControls === 'boolean' &&
            (value.editable === undefined || typeof value.editable === 'boolean'));
    }
    function isEnvelopeShape(value) {
        if (!isPlainRecord$5(value))
            return false;
        return (Object.keys(value).every((key) => ['version', 'name', 'metadata', 'interaction', 'feature'].includes(key)) &&
            value.version === 1 &&
            typeof value.name === 'string' &&
            isValidAnnotationMetadata(value.metadata) &&
            isInteractionState(value.interaction) &&
            'feature' in value);
    }
    function equalMetadata(left, right) {
        if (Object.is(left, right))
            return true;
        if (Array.isArray(left) && Array.isArray(right)) {
            return (left.length === right.length &&
                left.every((entry, index) => equalMetadata(entry, right[index])));
        }
        if (isPlainRecord$5(left) && isPlainRecord$5(right)) {
            const leftKeys = Object.keys(left).sort();
            const rightKeys = Object.keys(right).sort();
            return (leftKeys.length === rightKeys.length &&
                leftKeys.every((key, index) => key === rightKeys[index] && equalMetadata(left[key], right[key])));
        }
        return false;
    }
    function freezeEnvelope(object, feature) {
        return Object.freeze({
            version: 1,
            name: normalizeAnnotationName(object.editorAnnotationName),
            metadata: normalizeAnnotationMetadata(object.editorAnnotationMetadata),
            interaction: captureAnnotationInteraction(object),
            feature,
        });
    }
    function isStateData(value) {
        return (isPlainRecord$5(value) &&
            Object.keys(value).every((key) => ['version', 'name', 'interaction', 'feature'].includes(key)) &&
            value.version === 1 &&
            typeof value.name === 'string' &&
            isInteractionState(value.interaction) &&
            Object.prototype.hasOwnProperty.call(value, 'feature'));
    }
    function validateBoolean$1(value, label) {
        if (value === undefined)
            return undefined;
        if (typeof value !== 'boolean') {
            throw new AnnotationValidationError(`${label} must be boolean.`);
        }
        return value;
    }
    function normalizeSharedUpdate(value) {
        if (!isPlainRecord$5(value)) {
            throw new AnnotationValidationError('Annotation update must be a plain object.');
        }
        const allowed = new Set(['name', 'metadata', 'hidden', 'locked']);
        if (Object.keys(value).some((key) => !allowed.has(key))) {
            throw new AnnotationValidationError('Annotation update contains unknown keys.');
        }
        return Object.freeze({
            ...(value.name !== undefined ? { name: normalizeAnnotationName(value.name) } : {}),
            ...(value.metadata !== undefined
                ? { metadata: normalizeAnnotationMetadata(value.metadata) }
                : {}),
            ...(value.hidden !== undefined
                ? { hidden: validateBoolean$1(value.hidden, 'Annotation hidden state') }
                : {}),
            ...(value.locked !== undefined
                ? { locked: validateBoolean$1(value.locked, 'Annotation locked state') }
                : {}),
        });
    }
    function validateStringList(value, label) {
        if (value === undefined)
            return undefined;
        if (!Array.isArray(value) ||
            value.length > 2000 ||
            value.some((entry) => typeof entry !== 'string' ||
                entry.length === 0 ||
                entry.length > 128 ||
                entry.trim() !== entry)) {
            throw new AnnotationValidationError(`${label} is invalid.`);
        }
        return Object.freeze([...new Set(value)]);
    }
    class AnnotationController {
        constructor(host, overlay, options) {
            Object.defineProperty(this, "host", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: host
            });
            Object.defineProperty(this, "overlay", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: overlay
            });
            Object.defineProperty(this, "features", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Map()
            });
            Object.defineProperty(this, "listeners", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Set()
            });
            Object.defineProperty(this, "registrations", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: []
            });
            Object.defineProperty(this, "maxAnnotationCount", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: void 0
            });
            Object.defineProperty(this, "mutationSequence", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "generatedIdSequence", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "lastInteractionId", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: null
            });
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
            const configuredLimit = options.maxAnnotationCount;
            if (configuredLimit !== undefined &&
                (!Number.isSafeInteger(configuredLimit) ||
                    configuredLimit <= 0 ||
                    configuredLimit > HARD_MAX_ANNOTATION_COUNT)) {
                throw new AnnotationValidationError(`Annotation count limit must be an integer from 1 to ${HARD_MAX_ANNOTATION_COUNT}.`);
            }
            this.maxAnnotationCount = configuredLimit !== null && configuredLimit !== void 0 ? configuredLimit : DEFAULT_MAX_ANNOTATION_COUNT;
            this.registrations.push(overlay.registerKind({
                id: ANNOTATION_PREVIEW_KIND,
                ownerPluginId: ANNOTATION_FOUNDATION_ID,
                classify: (object) => object.editorAnnotationPreviewOwner !== undefined &&
                    object.editorOverlayKind === ANNOTATION_PREVIEW_KIND,
                getPersistentId: (object) => { var _a; return (_a = object.editorAnnotationPreviewId) !== null && _a !== void 0 ? _a : null; },
                setPersistentId: (object, id) => {
                    const preview = object;
                    preview.editorAnnotationPreviewId = id;
                    preview.editorOverlayId = id;
                },
                persistence: { mode: 'transient' },
            }));
            this.registrations.push(overlay.onSelectionChange(() => this.emitStatus()));
        }
        list(query = {}) {
            this.assertActive('list Annotations');
            const normalized = this.normalizeQuery(query);
            const objects = this.overlay.list({
                kinds: normalized.kinds,
                ids: normalized.ids,
                includeHidden: normalized.includeHidden,
                includeLocked: normalized.includeLocked,
            });
            const selected = new Set(this.overlay.getSelection().ids);
            const allLayers = this.persistentOverlayObjects();
            return Object.freeze(objects
                .filter((object) => this.isAnnotationObject(object))
                .map((object) => this.describe(object, selected, allLayers)));
        }
        get(id) {
            this.assertIdentifier(id, 'Annotation id');
            const object = this.overlay.getByPersistentId(id);
            if (!object || !this.isAnnotationObject(object))
                return null;
            return this.describe(object, new Set(this.overlay.getSelection().ids), this.persistentOverlayObjects());
        }
        async update(id, patch) {
            const object = this.requireAnnotation(id);
            const normalized = normalizeSharedUpdate(patch);
            if (!this.hasSharedUpdate(object, normalized))
                return;
            await this.overlay.mutate({
                id: this.nextMutationId('update'),
                operationId: 'annotation:update',
                action: 'programmatic',
                objectIds: [id],
                metadata: Object.freeze({ annotationKind: object.editorAnnotationKind }),
                mutate: () => this.applySharedUpdate(object, normalized),
                synchronize: () => this.emitStatus(),
            });
        }
        async remove(id) {
            await this.removeFeatures({ ids: [id], operationId: 'annotation:remove' });
        }
        async removeAll(query = {}) {
            const ids = this.list({ ...query, includeHidden: true, includeLocked: true }).map((entry) => entry.id);
            await this.removeFeatures({ ids, operationId: 'annotation:remove-all' });
        }
        async select(ids) {
            var _a;
            const normalized = (_a = validateStringList(ids, 'Annotation selection')) !== null && _a !== void 0 ? _a : [];
            for (const id of normalized) {
                const descriptor = this.get(id);
                if (!descriptor)
                    throw new AnnotationNotFoundError(`Annotation "${id}" was not found.`);
                if (descriptor.hidden || descriptor.locked) {
                    throw new AnnotationValidationError(`Annotation "${id}" cannot be selected while hidden or locked.`);
                }
            }
            this.overlay.select(normalized);
        }
        async clearSelection() {
            this.overlay.discardSelection();
        }
        bringForward(id) {
            return this.moveLayer(id, 'forward');
        }
        sendBackward(id) {
            return this.moveLayer(id, 'backward');
        }
        bringToFront(id) {
            return this.moveLayer(id, 'front');
        }
        sendToBack(id) {
            return this.moveLayer(id, 'back');
        }
        async flatten(query = {}, options = {}) {
            const matches = this.list({ ...query, includeLocked: true });
            if (matches.length === 0)
                return;
            await this.overlay.flatten({
                ids: matches.map((entry) => entry.id),
                kinds: [...this.features.keys()],
                includeHidden: query.includeHidden === true,
                includeLocked: true,
            }, options);
            this.emitStatus();
        }
        subscribe(listener) {
            this.assertActive('subscribe to Annotation status');
            if (typeof listener !== 'function') {
                throw new AnnotationValidationError('Annotation listener must be a function.');
            }
            this.listeners.add(listener);
            return createDisposable(() => {
                this.listeners.delete(listener);
            });
        }
        registerFeature(definition) {
            this.assertActive('register an Annotation Feature');
            this.validateFeatureDefinition(definition);
            if (this.features.has(definition.kind)) {
                throw new AnnotationError(`Annotation Feature "${definition.kind}" is already registered.`);
            }
            const normalizedDefinition = Object.freeze({
                ...definition,
            });
            const registrations = [];
            try {
                registrations.push(this.overlay.registerKind({
                    id: normalizedDefinition.kind,
                    ownerPluginId: normalizedDefinition.ownerPluginId,
                    classify: (object) => object.editorAnnotationKind ===
                        normalizedDefinition.kind && normalizedDefinition.classify(object),
                    getPersistentId: (object) => { var _a; return (_a = object.editorOverlayId) !== null && _a !== void 0 ? _a : null; },
                    setPersistentId: (object, id) => {
                        object.editorOverlayId = id;
                    },
                    isHidden: (object) => object.editorOverlayHidden === true,
                    setHidden: (object, hidden) => {
                        const annotation = object;
                        annotation.editorOverlayHidden = hidden;
                        synchronizeAnnotationRuntimeState(annotation);
                    },
                    isLocked: (object) => object.editorOverlayLocked === true,
                    setLocked: (object, locked) => {
                        const annotation = object;
                        annotation.editorOverlayLocked = locked;
                        synchronizeAnnotationRuntimeState(annotation);
                    },
                    persistence: {
                        mode: 'persistent',
                        codec: {
                            type: normalizedDefinition.codec.type,
                            version: normalizedDefinition.codec.version,
                            serialize: (object) => freezeEnvelope(object, normalizedDefinition.codec.serialize(object)),
                            validate: (value) => isEnvelopeShape(value) &&
                                (() => {
                                    try {
                                        normalizeAnnotationName(value.name);
                                        normalizeAnnotationMetadata(value.metadata);
                                        return normalizedDefinition.codec.validate(value.feature);
                                    }
                                    catch {
                                        return false;
                                    }
                                })(),
                            deserialize: async (value, context) => {
                                var _a;
                                if (!isEnvelopeShape(value) ||
                                    !normalizedDefinition.codec.validate(value.feature)) {
                                    throw new AnnotationValidationError(`Serialized ${normalizedDefinition.kind} data is malformed.`);
                                }
                                const object = (await normalizedDefinition.codec.deserialize(value.feature, context));
                                object.editorAnnotationKind = normalizedDefinition.kind;
                                object.editorAnnotationName = normalizeAnnotationName(value.name);
                                object.editorAnnotationMetadata = normalizeAnnotationMetadata(value.metadata);
                                applyAnnotationInteraction(object, value.interaction);
                                (_a = normalizedDefinition.synchronize) === null || _a === void 0 ? void 0 : _a.call(normalizedDefinition, object);
                                return object;
                            },
                        },
                    },
                    ...(normalizedDefinition.stateCodec
                        ? {
                            stateCodec: {
                                type: normalizedDefinition.stateCodec.type,
                                version: normalizedDefinition.stateCodec.version,
                                serialize: (object, context) => {
                                    const annotation = object;
                                    const feature = normalizedDefinition.stateCodec.serialize(object, context);
                                    return Object.freeze({
                                        geometry: feature.geometry,
                                        metadata: normalizeAnnotationMetadata(annotation.editorAnnotationMetadata),
                                        data: Object.freeze({
                                            version: 1,
                                            name: normalizeAnnotationName(annotation.editorAnnotationName),
                                            interaction: captureAnnotationInteraction(annotation),
                                            feature: feature.data,
                                        }),
                                    });
                                },
                                validate: (value) => {
                                    if (!isStateData(value.data) ||
                                        !isValidAnnotationMetadata(value.metadata)) {
                                        return false;
                                    }
                                    try {
                                        normalizeAnnotationName(value.data.name);
                                        return normalizedDefinition.stateCodec.validate({
                                            geometry: value.geometry,
                                            data: value.data.feature,
                                        });
                                    }
                                    catch {
                                        return false;
                                    }
                                },
                                deserialize: async (value, context) => {
                                    var _a;
                                    if (!isStateData(value.data) ||
                                        !isValidAnnotationMetadata(value.metadata)) {
                                        throw new AnnotationValidationError(`Serialized ${normalizedDefinition.kind} State data is malformed.`);
                                    }
                                    const object = (await normalizedDefinition.stateCodec.deserialize({
                                        geometry: value.geometry,
                                        data: value.data.feature,
                                    }, context));
                                    object.editorAnnotationKind = normalizedDefinition.kind;
                                    object.editorAnnotationName = normalizeAnnotationName(value.data.name);
                                    object.editorAnnotationMetadata = normalizeAnnotationMetadata(value.metadata);
                                    applyAnnotationInteraction(object, value.data.interaction);
                                    (_a = normalizedDefinition.synchronize) === null || _a === void 0 ? void 0 : _a.call(normalizedDefinition, object);
                                    return object;
                                },
                            },
                        }
                        : {}),
                }));
                registrations.push(this.overlay.registerGeometryPolicy({
                    id: `${normalizedDefinition.kind}-geometry`,
                    kind: normalizedDefinition.kind,
                    ownerPluginId: normalizedDefinition.ownerPluginId,
                    supports: (mutation) => {
                        var _a;
                        return mutation.kind === 'crop' ||
                            (mutation.kind === 'transform' &&
                                ((_a = normalizedDefinition.bindToImageTransform) === null || _a === void 0 ? void 0 : _a.call(normalizedDefinition)) === true);
                    },
                    apply: (object, mutation) => {
                        var _a;
                        if (mutation.kind !== 'transform')
                            return;
                        this.applyGeometry(object, mutation, ((_a = normalizedDefinition.preserveReadable) === null || _a === void 0 ? void 0 : _a.call(normalizedDefinition)) === true);
                    },
                    synchronize: () => {
                        var _a;
                        for (const object of this.listObjects(normalizedDefinition.kind)) {
                            synchronizeAnnotationRuntimeState(object);
                            (_a = normalizedDefinition.synchronize) === null || _a === void 0 ? void 0 : _a.call(normalizedDefinition, object);
                        }
                    },
                }));
                registrations.push(this.overlay.registerExportRenderer({
                    id: `${normalizedDefinition.kind}-export`,
                    kind: normalizedDefinition.kind,
                    ownerPluginId: normalizedDefinition.ownerPluginId,
                    order: 200,
                    render: async (context) => {
                        if (normalizedDefinition.render) {
                            await normalizedDefinition.render(context);
                            return;
                        }
                        const clone = await context.source.clone();
                        clone.set({
                            visible: true,
                            selectable: false,
                            evented: false,
                            hasControls: false,
                        });
                        context.targetCanvas.add(clone);
                    },
                }));
                registrations.push(this.overlay.registerInteractionPolicy({
                    id: `${normalizedDefinition.kind}-interaction`,
                    kind: normalizedDefinition.kind,
                    ownerPluginId: normalizedDefinition.ownerPluginId,
                    synchronize: (object, context) => {
                        var _a;
                        synchronizeAnnotationRuntimeState(object);
                        (_a = normalizedDefinition.synchronize) === null || _a === void 0 ? void 0 : _a.call(normalizedDefinition, object);
                        if (this.lastInteractionId !== context.descriptor.id) {
                            this.lastInteractionId = context.descriptor.id;
                            this.emitStatus();
                        }
                    },
                    validate: (object) => {
                        const annotation = object;
                        normalizeAnnotationName(annotation.editorAnnotationName);
                        normalizeAnnotationMetadata(annotation.editorAnnotationMetadata);
                    },
                }));
            }
            catch (error) {
                this.disposeRegistrations(registrations);
                throw error;
            }
            const record = Object.freeze({
                definition: normalizedDefinition,
                registrations: Object.freeze(registrations),
            });
            this.features.set(normalizedDefinition.kind, record);
            return createDisposable(() => {
                if (this.features.get(normalizedDefinition.kind) !== record)
                    return;
                this.features.delete(normalizedDefinition.kind);
                this.disposeRegistrations(registrations);
                this.emitStatus();
            });
        }
        async create(request) {
            this.assertActive('create an Annotation');
            const feature = this.requireFeature(request.kind);
            this.assertIdentifier(request.operationId, 'Annotation operation id');
            if (this.list({ includeHidden: true, includeLocked: true }).length >=
                this.maxAnnotationCount) {
                throw new AnnotationValidationError('Annotation count limit was reached.');
            }
            const object = request.object;
            object.editorAnnotationKind = request.kind;
            if (!feature.definition.classify(object)) {
                throw new AnnotationValidationError(`Annotation object does not satisfy Feature "${request.kind}".`);
            }
            const id = this.createAnnotationId();
            object.editorOverlayId = id;
            object.editorAnnotationName = normalizeAnnotationName(request.name);
            object.editorAnnotationMetadata = normalizeAnnotationMetadata(request.metadata);
            object.editorOverlayHidden = request.hidden === true;
            object.editorOverlayLocked = request.locked === true;
            applyAnnotationInteraction(object, captureAnnotationInteraction(object));
            const canvas = this.host.requireCanvas('create an Annotation');
            await this.overlay.mutate({
                id: this.nextMutationId('create'),
                operationId: request.operationId,
                action: 'create',
                metadata: Object.freeze({ annotationKind: request.kind }),
                mutate: () => canvas.add(object),
                affectedObjects: () => [object],
                synchronize: () => {
                    if (request.select !== false &&
                        !object.editorOverlayHidden &&
                        !object.editorOverlayLocked) {
                        this.overlay.select([id]);
                    }
                    this.emitStatus();
                },
            });
            return id;
        }
        async updateFeature(request) {
            this.assertIdentifier(request.operationId, 'Annotation operation id');
            const feature = this.requireFeature(request.kind)
                .definition;
            const object = this.requireAnnotation(request.id, request.kind);
            const normalizedFeaturePatch = feature.normalizeUpdate
                ? feature.normalizeUpdate(request.patch)
                : request.patch;
            const normalizedShared = request.shared
                ? normalizeSharedUpdate(request.shared)
                : Object.freeze({});
            const featureChanged = feature.hasUpdate
                ? feature.hasUpdate(object, normalizedFeaturePatch)
                : false;
            const sharedChanged = this.hasSharedUpdate(object, normalizedShared);
            if (!featureChanged && !sharedChanged)
                return;
            await this.overlay.mutate({
                id: this.nextMutationId('feature-update'),
                operationId: request.operationId,
                action: 'programmatic',
                objectIds: [request.id],
                metadata: Object.freeze({ annotationKind: request.kind }),
                mutate: () => {
                    var _a, _b;
                    if (featureChanged)
                        (_a = feature.applyUpdate) === null || _a === void 0 ? void 0 : _a.call(feature, object, normalizedFeaturePatch);
                    if (sharedChanged)
                        this.applySharedUpdate(object, normalizedShared);
                    (_b = feature.synchronize) === null || _b === void 0 ? void 0 : _b.call(feature, object);
                },
                synchronize: () => this.emitStatus(),
            });
        }
        async removeFeatures(request) {
            var _a;
            this.assertIdentifier(request.operationId, 'Annotation operation id');
            const ids = (_a = validateStringList(request.ids, 'Annotation removal ids')) !== null && _a !== void 0 ? _a : [];
            if (ids.length === 0)
                return;
            const objects = ids.map((id) => this.requireAnnotation(id, request.kind));
            await this.overlay.mutate({
                id: this.nextMutationId('remove'),
                operationId: request.operationId,
                action: 'delete',
                objectIds: ids,
                metadata: Object.freeze({
                    ...(request.kind ? { annotationKind: request.kind } : {}),
                    objectCount: objects.length,
                }),
                mutate: () => {
                    const canvas = this.host.requireCanvas('remove Annotations');
                    for (const object of objects)
                        canvas.remove(object);
                },
                synchronize: () => this.emitStatus(),
            });
        }
        getObject(id, kind) {
            const object = this.overlay.getByPersistentId(id);
            if (!object || !this.isAnnotationObject(object))
                return null;
            const classification = this.overlay.classify(object);
            return !kind || (classification === null || classification === void 0 ? void 0 : classification.kind) === kind ? object : null;
        }
        listObjects(kind) {
            if (!this.features.has(kind))
                return Object.freeze([]);
            return Object.freeze(this.overlay.list({ kinds: [kind], includeHidden: true, includeLocked: true }));
        }
        addPreview(request) {
            this.assertActive('add an Annotation preview');
            this.assertPreviewRequest(request);
            const canvas = this.host.requireCanvas('add an Annotation preview');
            const preview = request.object;
            preview.editorAnnotationPreviewId = request.id;
            preview.editorAnnotationPreviewOwner = request.ownerKind;
            preview.editorOverlayKind = ANNOTATION_PREVIEW_KIND;
            preview.editorOverlayId = request.id;
            preview.set({
                visible: true,
                selectable: request.interactive === true,
                evented: request.interactive === true,
                hasControls: false,
                excludeFromExport: true,
            });
            canvas.add(preview);
            if (request.select === true)
                canvas.setActiveObject(preview);
            const classification = this.overlay.classify(preview);
            if ((classification === null || classification === void 0 ? void 0 : classification.kind) !== ANNOTATION_PREVIEW_KIND) {
                canvas.remove(preview);
                throw new AnnotationError('Annotation preview was not indexed as transient.');
            }
            this.host.requestRender();
        }
        replacePreview(previousIds, request) {
            this.removePreview(previousIds);
            this.addPreview(request);
        }
        removePreview(ids) {
            var _a;
            const normalized = (_a = validateStringList(ids, 'Annotation preview ids')) !== null && _a !== void 0 ? _a : [];
            const canvas = this.host.getCanvas();
            if (!canvas)
                return;
            for (const id of normalized) {
                const object = this.overlay.getByPersistentId(id);
                if (object === null || object === void 0 ? void 0 : object.editorAnnotationPreviewOwner) {
                    if (canvas.getActiveObject() === object)
                        canvas.discardActiveObject();
                    canvas.remove(object);
                    object.dispose();
                }
            }
            this.host.requestRender();
        }
        hideForPreview(ids) {
            return this.overlay.hideForPreview(ids);
        }
        applyGeometry(object, mutation, preserveReadable) {
            applyAnnotationGeometry(object, mutation, this.host.fabric, preserveReadable);
        }
        resetForImage() {
            this.removeAllPreviews();
            this.emitStatus();
        }
        dispose() {
            if (this.disposed)
                return;
            this.removeAllPreviews();
            this.listeners.clear();
            for (const feature of [...this.features.values()].reverse()) {
                this.disposeRegistrations(feature.registrations);
            }
            this.features.clear();
            this.disposeRegistrations(this.registrations);
            this.registrations.length = 0;
            this.disposed = true;
        }
        normalizeQuery(query) {
            if (!isPlainRecord$5(query)) {
                throw new AnnotationValidationError('Annotation query must be a plain object.');
            }
            const allowed = new Set(['kinds', 'ids', 'includeHidden', 'includeLocked']);
            if (Object.keys(query).some((key) => !allowed.has(key))) {
                throw new AnnotationValidationError('Annotation query contains unknown keys.');
            }
            const kinds = validateStringList(query.kinds, 'Annotation query kinds');
            if (kinds) {
                for (const kind of kinds)
                    this.requireFeature(kind);
            }
            return Object.freeze({
                kinds: kinds !== null && kinds !== void 0 ? kinds : Object.freeze([...this.features.keys()]),
                ids: validateStringList(query.ids, 'Annotation query ids'),
                includeHidden: validateBoolean$1(query.includeHidden, 'Query includeHidden'),
                includeLocked: validateBoolean$1(query.includeLocked, 'Query includeLocked'),
            });
        }
        describe(object, selected, layers) {
            const annotation = object;
            const classification = this.overlay.classify(object);
            if (!classification || !this.features.has(classification.kind)) {
                throw new AnnotationError('Annotation descriptor lost its Overlay classification.');
            }
            return Object.freeze({
                id: classification.persistentId,
                kind: classification.kind,
                name: normalizeAnnotationName(annotation.editorAnnotationName),
                hidden: classification.hidden,
                locked: classification.locked,
                selected: selected.has(classification.persistentId),
                layerIndex: layers.indexOf(object),
                metadata: normalizeAnnotationMetadata(annotation.editorAnnotationMetadata),
            });
        }
        hasSharedUpdate(object, patch) {
            return ((patch.name !== undefined && patch.name !== object.editorAnnotationName) ||
                (patch.metadata !== undefined &&
                    !equalMetadata(patch.metadata, object.editorAnnotationMetadata)) ||
                (patch.hidden !== undefined &&
                    patch.hidden !== (object.editorOverlayHidden === true)) ||
                (patch.locked !== undefined && patch.locked !== (object.editorOverlayLocked === true)));
        }
        applySharedUpdate(object, patch) {
            if (patch.name !== undefined)
                object.editorAnnotationName = patch.name;
            if (patch.metadata !== undefined) {
                object.editorAnnotationMetadata = normalizeAnnotationMetadata(patch.metadata);
            }
            if (patch.hidden !== undefined)
                object.editorOverlayHidden = patch.hidden;
            if (patch.locked !== undefined)
                object.editorOverlayLocked = patch.locked;
            synchronizeAnnotationRuntimeState(object);
        }
        async moveLayer(id, direction) {
            const object = this.requireAnnotation(id);
            const overlays = this.persistentOverlayObjects();
            const index = overlays.indexOf(object);
            if (index < 0 ||
                ((direction === 'forward' || direction === 'front') && index === overlays.length - 1) ||
                ((direction === 'backward' || direction === 'back') && index === 0)) {
                return;
            }
            if (direction === 'forward')
                await this.overlay.bringForward(id);
            else if (direction === 'backward')
                await this.overlay.sendBackward(id);
            else if (direction === 'front')
                await this.overlay.bringToFront(id);
            else
                await this.overlay.sendToBack(id);
            this.emitStatus();
        }
        persistentOverlayObjects() {
            return Object.freeze(this.overlay
                .list({ includeHidden: true, includeLocked: true })
                .filter((object) => { var _a; return ((_a = this.overlay.classify(object)) === null || _a === void 0 ? void 0 : _a.kind) !== ANNOTATION_PREVIEW_KIND; }));
        }
        isAnnotationObject(object) {
            const classification = this.overlay.classify(object);
            return !!classification && this.features.has(classification.kind);
        }
        requireAnnotation(id, kind) {
            this.assertIdentifier(id, 'Annotation id');
            const object = this.getObject(id, kind);
            if (!object) {
                throw new AnnotationNotFoundError(kind
                    ? `Annotation "${id}" of kind "${kind}" was not found.`
                    : `Annotation "${id}" was not found.`);
            }
            return object;
        }
        requireFeature(kind) {
            if (!featureKindPattern.test(kind) || kind === ANNOTATION_PREVIEW_KIND) {
                throw new AnnotationValidationError(`Annotation Feature kind "${kind}" is invalid.`);
            }
            const feature = this.features.get(kind);
            if (!feature) {
                throw new AnnotationNotFoundError(`Annotation Feature "${kind}" is not installed.`);
            }
            return feature;
        }
        validateFeatureDefinition(definition) {
            if (!isPlainRecord$5(definition)) {
                throw new AnnotationValidationError('Annotation Feature definition must be an object.');
            }
            if (!featureKindPattern.test(definition.kind) ||
                definition.kind === ANNOTATION_PREVIEW_KIND) {
                throw new AnnotationValidationError('Annotation Feature kind is invalid.');
            }
            this.assertIdentifier(definition.ownerPluginId, 'Annotation Feature owner');
            if (typeof definition.classify !== 'function' ||
                !isPlainRecord$5(definition.codec) ||
                !identifierPattern.test(definition.codec.type) ||
                !/^\d+\.\d+\.\d+$/.test(definition.codec.version) ||
                typeof definition.codec.serialize !== 'function' ||
                typeof definition.codec.validate !== 'function' ||
                typeof definition.codec.deserialize !== 'function') {
                throw new AnnotationValidationError('Annotation Feature codec is invalid.');
            }
        }
        assertPreviewRequest(request) {
            this.assertIdentifier(request.id, 'Annotation preview id');
            this.requireFeature(request.ownerKind);
            if (!request.object || typeof request.object !== 'object') {
                throw new AnnotationValidationError('Annotation preview object is invalid.');
            }
        }
        removeAllPreviews() {
            const canvas = this.host.getCanvas();
            if (!canvas)
                return;
            for (const object of [...canvas.getObjects()]) {
                if (object.editorOverlayKind !== ANNOTATION_PREVIEW_KIND)
                    continue;
                canvas.remove(object);
                object.dispose();
            }
            this.host.requestRender();
        }
        emitStatus() {
            if (this.disposed || this.listeners.size === 0)
                return;
            const status = Object.freeze({
                annotations: this.list({ includeHidden: true, includeLocked: true }),
                selectionIds: Object.freeze(this.overlay.getSelection().ids.filter((id) => this.get(id) !== null)),
            });
            for (const listener of [...this.listeners]) {
                try {
                    listener(status);
                }
                catch (error) {
                    this.host.reportWarning(error, 'An Annotation status listener failed.');
                }
            }
        }
        createAnnotationId() {
            var _a, _b;
            const randomId = (_b = (_a = globalThis.crypto) === null || _a === void 0 ? void 0 : _a.randomUUID) === null || _b === void 0 ? void 0 : _b.call(_a);
            return randomId
                ? `annotation:${randomId}`
                : `annotation:${Date.now().toString(36)}:${++this.generatedIdSequence}`;
        }
        nextMutationId(action) {
            return `annotation:${action}:${++this.mutationSequence}`;
        }
        disposeRegistrations(registrations) {
            const errors = [];
            for (let index = registrations.length - 1; index >= 0; index -= 1) {
                try {
                    const result = registrations[index].dispose();
                    if (result instanceof Promise) {
                        void result.catch((error) => this.host.reportWarning(error, 'Annotation cleanup failed.'));
                    }
                }
                catch (error) {
                    errors.push(error);
                }
            }
            if (errors.length > 0) {
                throw new AnnotationError(`Annotation cleanup had ${errors.length} synchronous error(s).`);
            }
        }
        assertIdentifier(value, label) {
            if (typeof value !== 'string' || !identifierPattern.test(value)) {
                throw new AnnotationValidationError(`${label} is invalid.`);
            }
        }
        assertActive(operation) {
            if (this.disposed)
                throw new AnnotationError(`Cannot ${operation} after disposal.`);
        }
    }

    const ANNOTATION_CAPABILITY = createCapabilityToken('foundation:annotation', '1.0.0');
    const ANNOTATION_AUTHORING_CAPABILITY = createCapabilityToken('foundation:annotation-authoring', '1.0.0');
    const annotationFoundationRef = definePluginRef('foundation:annotation', '1.0.0');
    function annotationFoundationPlugin(options = {}) {
        let controller = null;
        return definePlugin({
            ref: annotationFoundationRef,
            manifest: {
                id: annotationFoundationRef.id,
                version: '1.0.0',
                apiVersion: annotationFoundationRef.apiVersion,
                engine: '^3.0.0',
                requiresPlugins: [overlayFoundationRef],
                requires: [
                    { token: OVERLAY_CAPABILITY, range: '^1.0.0' },
                    { token: OVERLAY_REGISTRATION_CAPABILITY, range: '^1.0.0' },
                    { token: CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
                    { token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                    { token: CANVAS_READ_CAPABILITY, range: '^1.0.0' },
                    { token: RENDER_REQUEST_CAPABILITY, range: '^1.0.0' },
                ],
                permissions: ['fabric:objects', 'fabric:canvas-read', 'fabric:custom-class'],
            },
            setupMode: 'sync',
            setup(context) {
                const overlay = context.capabilities.require(OVERLAY_CAPABILITY);
                const registration = context.capabilities.require(OVERLAY_REGISTRATION_CAPABILITY);
                const diagnostics = context.capabilities.require(CORE_DIAGNOSTICS_CAPABILITY);
                const fabric = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY);
                const canvas = context.capabilities.require(CANVAS_READ_CAPABILITY);
                const render = context.capabilities.require(RENDER_REQUEST_CAPABILITY);
                for (const operationId of [
                    'annotation:update',
                    'annotation:remove',
                    'annotation:remove-all',
                ]) {
                    context.disposables.add(context.operations.register({
                        id: operationId,
                        mode: 'mutation',
                        conflictDomains: ['document', 'overlay', 'selection', 'state'],
                        reentrancy: 'reject',
                    }));
                }
                controller = new AnnotationController(Object.freeze({ ...diagnostics, ...fabric, ...canvas, ...render }), Object.freeze({ ...overlay, ...registration }), options);
                context.capabilities.provide(ANNOTATION_CAPABILITY, controller, {
                    version: ANNOTATION_CAPABILITY.version,
                });
                context.capabilities.provide(ANNOTATION_AUTHORING_CAPABILITY, controller, {
                    version: ANNOTATION_AUTHORING_CAPABILITY.version,
                    requiredPermission: 'fabric:objects',
                });
                return controller;
            },
            onImageCleared() {
                controller === null || controller === void 0 ? void 0 : controller.resetForImage();
            },
            onDispose() {
                controller === null || controller === void 0 ? void 0 : controller.dispose();
                controller = null;
            },
        });
    }

    const ANIMATION_SETTLE_GRACE_MS = 1000;
    function animateProps(object, props, options, guard) {
        return new Promise((resolve, reject) => {
            const propCount = Object.keys(props).length;
            if (propCount === 0 || guard.isDisposed()) {
                resolve();
                return;
            }
            let completed = 0;
            let settled = false;
            let aborters = [];
            let timeoutId = null;
            let unregisterAborter = null;
            const cleanup = () => {
                if (timeoutId !== null) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                unregisterAborter === null || unregisterAborter === void 0 ? void 0 : unregisterAborter();
                unregisterAborter = null;
            };
            const settle = () => {
                if (settled)
                    return;
                settled = true;
                cleanup();
                resolve();
            };
            const fail = (error) => {
                if (settled)
                    return;
                settled = true;
                cleanup();
                reject(error);
            };
            const abortAndSettle = () => {
                for (const abort of aborters) {
                    try {
                        abort();
                    }
                    catch {
                    }
                }
                settle();
            };
            const duration = Number.isFinite(options.duration) ? Math.max(0, options.duration) : 0;
            timeoutId = setTimeout(abortAndSettle, duration + ANIMATION_SETTLE_GRACE_MS);
            unregisterAborter = guard.registerAnimationAborter(abortAndSettle);
            try {
                const animationResult = object.animate(props, {
                    duration,
                    onChange: () => {
                        var _a;
                        if (guard.isDisposed())
                            return;
                        (_a = options.onChange) === null || _a === void 0 ? void 0 : _a.call(options);
                    },
                    onComplete: () => {
                        if (++completed >= propCount)
                            settle();
                    },
                });
                aborters = collectAnimationAborters(animationResult);
            }
            catch (error) {
                fail(error);
            }
        });
    }
    function collectAnimationAborters(animationResult) {
        const handles = Array.isArray(animationResult)
            ? animationResult
            : animationResult && typeof animationResult === 'object'
                ? Object.values(animationResult)
                : [animationResult];
        return handles.flatMap((handle) => {
            const abort = handle === null || handle === void 0 ? void 0 : handle.abort;
            return typeof abort === 'function' ? [() => abort.call(handle)] : [];
        });
    }
    function restoreOrigin(object, originX, originY) {
        try {
            object.set({ originX, originY });
            object.setCoords();
        }
        catch {
        }
    }

    const DEFAULT_OPTIONS = Object.freeze({
        animationDuration: 300,
        minScale: 0.1,
        maxScale: 5,
        scaleStep: 0.05,
        rotationStep: 90,
    });
    function nonNegative$1(value, fallback) {
        return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
    }
    function positive$1(value, fallback) {
        return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
    }
    function resolveTransformOptions(options = {}) {
        const minScale = positive$1(options.minScale, DEFAULT_OPTIONS.minScale);
        const maxScale = Math.max(minScale, positive$1(options.maxScale, DEFAULT_OPTIONS.maxScale));
        return Object.freeze({
            animationDuration: nonNegative$1(options.animationDuration, DEFAULT_OPTIONS.animationDuration),
            minScale,
            maxScale,
            scaleStep: positive$1(options.scaleStep, DEFAULT_OPTIONS.scaleStep),
            rotationStep: positive$1(options.rotationStep, DEFAULT_OPTIONS.rotationStep),
        });
    }
    function cloneState(state) {
        return Object.freeze({ ...state });
    }
    class PluginAnimationControl {
        constructor() {
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
            Object.defineProperty(this, "aborters", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Set()
            });
        }
        isDisposed() {
            return this.disposed;
        }
        registerAnimationAborter(abort) {
            if (this.disposed) {
                abort();
                return () => undefined;
            }
            this.aborters.add(abort);
            return () => this.aborters.delete(abort);
        }
        cancelAnimations() {
            for (const abort of [...this.aborters]) {
                try {
                    abort();
                }
                catch {
                }
            }
            this.aborters.clear();
        }
        dispose() {
            this.disposed = true;
            this.cancelAnimations();
        }
    }
    class TransformPluginController {
        constructor(environment, baseImage, render, geometry, options) {
            Object.defineProperty(this, "environment", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: environment
            });
            Object.defineProperty(this, "baseImage", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: baseImage
            });
            Object.defineProperty(this, "render", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: render
            });
            Object.defineProperty(this, "geometry", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: geometry
            });
            Object.defineProperty(this, "options", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: options
            });
            Object.defineProperty(this, "animations", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new PluginAnimationControl()
            });
            Object.defineProperty(this, "state", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: {
                    scale: 1,
                    rotationDegrees: 0,
                    flipX: false,
                    flipY: false,
                }
            });
            Object.defineProperty(this, "mutationSequence", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
        }
        scale(factor, options = {}) {
            return this.scaleWithOperation(factor, 'transform:scale', options);
        }
        scaleWithOperation(factor, operationId, options = {}) {
            if (!Number.isFinite(factor))
                return Promise.resolve();
            return this.enqueue(operationId, async (signal) => {
                const image = this.baseImage.getBaseImage();
                if (!image)
                    return;
                await this.applyScale(image, factor, signal);
            }, options);
        }
        zoomIn(options = {}) {
            return this.scaleWithOperation(this.state.scale + this.options.scaleStep, 'transform:zoom-in', options);
        }
        zoomOut(options = {}) {
            return this.scaleWithOperation(this.state.scale - this.options.scaleStep, 'transform:zoom-out', options);
        }
        rotate(degrees, options = {}) {
            if (!Number.isFinite(degrees))
                return Promise.resolve();
            return this.enqueue('transform:rotate', async (signal) => {
                const image = this.baseImage.getBaseImage();
                if (!image)
                    return;
                await this.applyRotation(image, degrees, signal);
            }, options);
        }
        flipHorizontal(options = {}) {
            return this.flip('flipX', 'transform:flip-horizontal', options);
        }
        flipVertical(options = {}) {
            return this.flip('flipY', 'transform:flip-vertical', options);
        }
        resetImageTransform(options = {}) {
            return this.enqueue('transform:reset', async (signal) => {
                const image = this.baseImage.getBaseImage();
                if (!image)
                    return;
                await this.applyScale(image, 1, signal);
                await this.applyRotation(image, 0, signal);
                image.set({ flipX: false, flipY: false });
                image.setCoords();
                this.state.flipX = false;
                this.state.flipY = false;
            }, options);
        }
        getState() {
            return cloneState(this.state);
        }
        restoreState(state) {
            this.state.scale = state.scale;
            this.state.rotationDegrees = state.rotationDegrees;
            this.state.flipX = state.flipX;
            this.state.flipY = state.flipY;
        }
        resetStateFromImage() {
            const image = this.baseImage.getBaseImage();
            this.state.scale = 1;
            this.state.rotationDegrees = Number(image === null || image === void 0 ? void 0 : image.angle) || 0;
            this.state.flipX = (image === null || image === void 0 ? void 0 : image.flipX) === true;
            this.state.flipY = (image === null || image === void 0 ? void 0 : image.flipY) === true;
        }
        dispose() {
            this.animations.dispose();
        }
        flip(property, operationId, options) {
            return this.enqueue(operationId, async () => {
                const image = this.baseImage.getBaseImage();
                if (!image)
                    return;
                const center = image.getCenterPoint();
                image.set({ originX: 'center', originY: 'center' });
                image.setPositionByOrigin(center, 'center', 'center');
                image.set({ [property]: !image[property] });
                image.setCoords();
                const topLeft = this.computeTopLeftPoint(image);
                image.set({ originX: 'left', originY: 'top' });
                image.setPositionByOrigin(topLeft, 'left', 'top');
                image.setCoords();
                this.state[property] = image[property] === true;
            }, options);
        }
        enqueue(operationId, mutate, options) {
            if (this.animations.isDisposed())
                return Promise.resolve();
            const image = this.baseImage.getBaseImage();
            if (!image)
                return Promise.resolve();
            const rollback = this.captureRollback(image);
            const mutationId = `${operationId}:${++this.mutationSequence}`;
            return this.geometry
                .run({
                id: mutationId,
                kind: 'transform',
                operationId,
                parent: options.parent,
                mutateBase: async ({ signal }) => {
                    await mutate(signal);
                },
                rollbackBase: () => this.restoreRollback(image, rollback),
                metadata: Object.freeze({ pluginId: 'plugin:transform' }),
            })
                .then(() => undefined);
        }
        async applyScale(image, factor, signal) {
            this.throwIfAborted(signal);
            const scale = Math.max(this.options.minScale, Math.min(this.options.maxScale, factor));
            const topLeft = this.computeTopLeftPoint(image);
            image.set({ originX: 'left', originY: 'top' });
            image.setPositionByOrigin(topLeft, 'left', 'top');
            image.setCoords();
            const target = this.baseImage.getBaseImageScale() * scale;
            await this.runAnimation(signal, () => animateProps(image, { scaleX: target, scaleY: target }, {
                duration: this.options.animationDuration,
                onChange: () => this.render.requestRender(),
            }, this.animations));
            this.throwIfAborted(signal);
            image.set({ scaleX: target, scaleY: target });
            image.setCoords();
            this.state.scale = scale;
        }
        async applyRotation(image, degrees, signal) {
            this.throwIfAborted(signal);
            const center = image.getCenterPoint();
            image.set({ originX: 'center', originY: 'center' });
            image.setPositionByOrigin(center, 'center', 'center');
            image.setCoords();
            try {
                await this.runAnimation(signal, () => animateProps(image, { angle: degrees }, {
                    duration: this.options.animationDuration,
                    onChange: () => this.render.requestRender(),
                }, this.animations));
                this.throwIfAborted(signal);
                image.set('angle', degrees);
                image.setCoords();
                const topLeft = this.computeTopLeftPoint(image);
                image.set({ originX: 'left', originY: 'top' });
                image.setPositionByOrigin(topLeft, 'left', 'top');
                image.setCoords();
                this.state.rotationDegrees = degrees;
            }
            finally {
                if (this.animations.isDisposed())
                    restoreOrigin(image, 'left', 'top');
            }
        }
        captureRollback(image) {
            var _a, _b;
            return Object.freeze({
                transform: this.getState(),
                image: Object.freeze({
                    left: Number(image.left) || 0,
                    top: Number(image.top) || 0,
                    scaleX: Number(image.scaleX) || 1,
                    scaleY: Number(image.scaleY) || 1,
                    angle: Number(image.angle) || 0,
                    flipX: image.flipX === true,
                    flipY: image.flipY === true,
                    originX: (_a = image.originX) !== null && _a !== void 0 ? _a : 'left',
                    originY: (_b = image.originY) !== null && _b !== void 0 ? _b : 'top',
                }),
            });
        }
        restoreRollback(image, rollback) {
            if (this.environment.isDisposed())
                return;
            image.set(rollback.image);
            image.setCoords();
            this.restoreState(rollback.transform);
            this.render.requestRender();
        }
        computeTopLeftPoint(image) {
            image.setCoords();
            const first = image.getCoords()[0];
            if (first)
                return first;
            const bounds = image.getBoundingRect();
            const PointConstructor = this.environment.fabric.Point;
            if (typeof PointConstructor === 'function') {
                return new PointConstructor(bounds.left, bounds.top);
            }
            return { x: bounds.left, y: bounds.top };
        }
        throwIfAborted(signal) {
            var _a;
            if (signal.aborted)
                throw (_a = signal.reason) !== null && _a !== void 0 ? _a : new Error('Transform operation aborted.');
            if (this.animations.isDisposed())
                throw new Error('Transform plugin is disposed.');
        }
        async runAnimation(signal, animation) {
            const cancel = () => this.animations.cancelAnimations();
            signal.addEventListener('abort', cancel, { once: true });
            if (signal.aborted)
                cancel();
            try {
                await animation();
            }
            finally {
                signal.removeEventListener('abort', cancel);
            }
        }
    }

    const transformPluginRef = definePluginRef('plugin:transform', '1.0.0');
    function isTransformState(value) {
        if (typeof value !== 'object' || value === null)
            return false;
        const candidate = value;
        return (typeof candidate.scale === 'number' &&
            Number.isFinite(candidate.scale) &&
            candidate.scale > 0 &&
            typeof candidate.rotationDegrees === 'number' &&
            Number.isFinite(candidate.rotationDegrees) &&
            typeof candidate.flipX === 'boolean' &&
            typeof candidate.flipY === 'boolean');
    }
    function transformPlugin(options = {}) {
        const resolved = resolveTransformOptions(options);
        let controller = null;
        return definePlugin({
            ref: transformPluginRef,
            manifest: {
                id: transformPluginRef.id,
                version: '1.0.0',
                apiVersion: transformPluginRef.apiVersion,
                engine: '^3.0.0',
                requires: [
                    { token: CORE_STATUS_CAPABILITY, range: '^1.0.0' },
                    { token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                    { token: BASE_IMAGE_READ_CAPABILITY, range: '^1.0.0' },
                    { token: RENDER_REQUEST_CAPABILITY, range: '^1.0.0' },
                    { token: SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' },
                    { token: GEOMETRY_MUTATION_CAPABILITY, range: '^1.0.0' },
                ],
                permissions: ['fabric:objects', 'core:geometry-participant'],
            },
            setupMode: 'sync',
            setup(context) {
                const status = context.capabilities.require(CORE_STATUS_CAPABILITY);
                const fabricRuntime = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY);
                const baseImage = context.capabilities.require(BASE_IMAGE_READ_CAPABILITY);
                const render = context.capabilities.require(RENDER_REQUEST_CAPABILITY);
                const state = context.capabilities.require(SNAPSHOT_REGISTRATION_CAPABILITY);
                const geometry = context.capabilities.require(GEOMETRY_MUTATION_CAPABILITY);
                controller = new TransformPluginController(Object.freeze({ ...status, ...fabricRuntime }), baseImage, render, geometry, resolved);
                for (const id of [
                    'transform:scale',
                    'transform:zoom-in',
                    'transform:zoom-out',
                    'transform:rotate',
                    'transform:flip-horizontal',
                    'transform:flip-vertical',
                    'transform:reset',
                ]) {
                    context.operations.register({
                        id,
                        mode: id.includes('flip') || id === 'transform:reset' ? 'mutation' : 'animation',
                        conflictDomains: ['document', 'base-image', 'geometry', 'overlay', 'state'],
                        reentrancy: 'queue',
                    });
                }
                context.disposables.add(state.registerSlice({
                    id: transformPluginRef.id,
                    version: 1,
                    capturePolicy: 'always',
                    capture: () => {
                        var _a;
                        return (_a = controller === null || controller === void 0 ? void 0 : controller.getState()) !== null && _a !== void 0 ? _a : {
                            scale: 1,
                            rotationDegrees: 0,
                            flipX: false,
                            flipY: false,
                        };
                    },
                    validate: (value) => isTransformState(value)
                        ? { valid: true, value }
                        : { valid: false, message: 'Transform state is malformed.' },
                    restore: (value) => controller === null || controller === void 0 ? void 0 : controller.restoreState(value),
                    clearState: () => controller === null || controller === void 0 ? void 0 : controller.resetStateFromImage(),
                }));
                const requireController = () => {
                    if (!controller)
                        throw new Error('Transform plugin is not installed.');
                    return controller;
                };
                return Object.freeze({
                    scale: (factor, mutationOptions) => requireController().scale(factor, mutationOptions),
                    zoomIn: (mutationOptions) => requireController().zoomIn(mutationOptions),
                    zoomOut: (mutationOptions) => requireController().zoomOut(mutationOptions),
                    rotate: (degrees, mutationOptions) => requireController().rotate(degrees, mutationOptions),
                    flipHorizontal: (mutationOptions) => requireController().flipHorizontal(mutationOptions),
                    flipVertical: (mutationOptions) => requireController().flipVertical(mutationOptions),
                    resetImageTransform: (mutationOptions) => requireController().resetImageTransform(mutationOptions),
                    getState: () => requireController().getState(),
                });
            },
            onImageLoaded() {
                controller === null || controller === void 0 ? void 0 : controller.resetStateFromImage();
            },
            onImageCleared() {
                controller === null || controller === void 0 ? void 0 : controller.resetStateFromImage();
            },
            onDispose() {
                controller === null || controller === void 0 ? void 0 : controller.dispose();
                controller = null;
            },
        });
    }

    function resolveMaxSize(value) {
        return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 50;
    }
    class HistoryPluginController {
        constructor(state, operations, options = {}, reportWarning) {
            Object.defineProperty(this, "state", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: state
            });
            Object.defineProperty(this, "operations", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: operations
            });
            Object.defineProperty(this, "reportWarning", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: reportWarning
            });
            Object.defineProperty(this, "records", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: []
            });
            Object.defineProperty(this, "position", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "baseline", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: null
            });
            Object.defineProperty(this, "listeners", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Set()
            });
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
            this.enabled = options.enabled !== false;
            this.maxSize = resolveMaxSize(options.maxSize);
            if (options.onChange)
                this.listeners.add(options.onChange);
        }
        get isEnabled() {
            return !this.disposed && this.enabled;
        }
        get length() {
            return this.records.length;
        }
        isAvailable() {
            return !this.disposed;
        }
        commit(record) {
            if (!this.isEnabled)
                return;
            if (record.operationId === 'core:load-image' ||
                record.operationId === 'core:commit-load-image' ||
                record.operationId === 'core:load-state') {
                const changed = this.resetTimeline();
                this.baseline = record.after;
                if (changed)
                    this.emitChange();
                return;
            }
            this.push(record);
        }
        push(record) {
            var _a;
            this.assertActive('push History');
            if (!this.enabled)
                return;
            if (!record || typeof record.operationId !== 'string' || record.operationId.length === 0) {
                throw new CoreRuntimeError('[ImageEditor] History record operationId is invalid.');
            }
            (_a = this.baseline) !== null && _a !== void 0 ? _a : (this.baseline = record.before);
            if (this.position < this.records.length) {
                this.records = this.records.slice(0, this.position);
            }
            this.records.push(Object.freeze({
                operationId: record.operationId,
                before: record.before,
                after: record.after,
                timestamp: record.timestamp,
                detail: record.detail,
            }));
            if (this.records.length > this.maxSize) {
                const overflow = this.records.length - this.maxSize;
                this.records.splice(0, overflow);
            }
            this.position = this.records.length;
            this.emitChange();
        }
        enable(options) {
            this.assertActive('enable History');
            if ((options === null || options === void 0 ? void 0 : options.baseline) !== 'current') {
                throw new CoreRuntimeError('[ImageEditor] History can enable only from the current baseline.', {
                    code: 'HISTORY_BASELINE_UNSUPPORTED',
                });
            }
            return this.operations.run('history:enable', async () => {
                if (this.enabled)
                    return;
                const baseline = this.state.captureMemento();
                this.records = [];
                this.position = 0;
                this.baseline = baseline;
                this.enabled = true;
                this.emitChange();
            });
        }
        disable(options = {}) {
            var _a;
            this.assertActive('disable History');
            if (options.clear !== undefined && typeof options.clear !== 'boolean') {
                throw new CoreRuntimeError('[ImageEditor] History disable clear must be a boolean.', {
                    code: 'HISTORY_DISABLE_OPTION_INVALID',
                });
            }
            const shouldClear = (_a = options.clear) !== null && _a !== void 0 ? _a : true;
            return this.operations.run('history:disable', async () => {
                const wasEnabled = this.enabled;
                const hadRecords = this.records.length > 0 || this.position !== 0;
                this.enabled = false;
                if (shouldClear)
                    this.resetTimeline();
                if (wasEnabled || (shouldClear && hadRecords))
                    this.emitChange();
            });
        }
        undo() {
            this.assertActive('undo');
            if (!this.canUndo())
                return Promise.resolve();
            return this.operations.run('history:undo', async () => {
                const record = this.records[this.position - 1];
                if (!record)
                    return;
                await this.restoreTransactionally(record.before, 'undo');
                this.position -= 1;
                this.emitChange();
            });
        }
        redo() {
            this.assertActive('redo');
            if (!this.canRedo())
                return Promise.resolve();
            return this.operations.run('history:redo', async () => {
                const record = this.records[this.position];
                if (!record)
                    return;
                await this.restoreTransactionally(record.after, 'redo');
                this.position += 1;
                this.emitChange();
            });
        }
        canUndo() {
            return this.isEnabled && this.position > 0;
        }
        canRedo() {
            return this.isEnabled && this.position < this.records.length;
        }
        clear() {
            if (this.disposed)
                return;
            if (this.resetTimeline())
                this.emitChange();
        }
        onChange(handler) {
            this.assertActive('subscribe to History');
            this.listeners.add(handler);
            return () => {
                this.listeners.delete(handler);
            };
        }
        getState() {
            return Object.freeze({
                isEnabled: this.isEnabled,
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                length: this.records.length,
                size: this.records.length,
                position: this.position,
            });
        }
        dispose() {
            if (this.disposed)
                return;
            this.records = [];
            this.position = 0;
            this.baseline = null;
            this.enabled = false;
            this.listeners.clear();
            this.disposed = true;
        }
        resetTimeline() {
            const changed = this.records.length > 0 || this.position !== 0;
            this.records = [];
            this.position = 0;
            this.baseline = null;
            return changed;
        }
        async restoreTransactionally(target, operation) {
            const rollback = this.state.captureMemento();
            try {
                await this.state.restoreMemento(target);
            }
            catch (error) {
                try {
                    await this.state.restoreMemento(rollback);
                }
                catch (rollbackError) {
                    const failure = new CoreRuntimeError(`[ImageEditor] History ${operation} failed and rollback could not restore state.`, {
                        code: 'HISTORY_UNRECOVERABLE_ERROR',
                        cause: Object.freeze([error, rollbackError]),
                        behavior: 'fatal-rollback',
                    });
                    this.state.reportFatal(failure);
                    throw failure;
                }
                throw new CoreRuntimeError(`[ImageEditor] History ${operation} failed.`, {
                    code: 'HISTORY_RESTORE_ERROR',
                    cause: error,
                });
            }
        }
        emitChange() {
            const availability = this.getState();
            for (const listener of [...this.listeners]) {
                try {
                    listener(availability);
                }
                catch (error) {
                    this.reportWarning(error, 'History onChange callback failed.');
                }
            }
        }
        assertActive(operation) {
            if (this.disposed) {
                throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} after History disposal.`);
            }
        }
    }

    const HISTORY_CAPABILITY = createCapabilityToken('plugin:history', '1.0.0');
    const historyPluginRef = definePluginRef('plugin:history', '1.0.0');
    function historyPlugin(options = {}) {
        let controller = null;
        return definePlugin({
            ref: historyPluginRef,
            manifest: {
                id: historyPluginRef.id,
                version: '1.0.0',
                apiVersion: historyPluginRef.apiVersion,
                engine: '^3.0.0',
                requires: [
                    { token: CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
                    { token: MEMENTO_HISTORY_CAPABILITY, range: '^1.0.0' },
                ],
            },
            setupMode: 'sync',
            setup(context) {
                const diagnostics = context.capabilities.require(CORE_DIAGNOSTICS_CAPABILITY);
                const state = context.capabilities.require(MEMENTO_HISTORY_CAPABILITY);
                context.operations.register({
                    id: 'history:undo',
                    mode: 'mutation',
                    conflictDomains: [
                        'document',
                        'base-image',
                        'geometry',
                        'raster',
                        'overlay',
                        'state',
                    ],
                    reentrancy: 'queue',
                });
                context.operations.register({
                    id: 'history:redo',
                    mode: 'mutation',
                    conflictDomains: [
                        'document',
                        'base-image',
                        'geometry',
                        'raster',
                        'overlay',
                        'state',
                    ],
                    reentrancy: 'queue',
                });
                for (const operationId of ['history:enable', 'history:disable']) {
                    context.operations.register({
                        id: operationId,
                        mode: 'mutation',
                        conflictDomains: [
                            'document',
                            'base-image',
                            'geometry',
                            'raster',
                            'overlay',
                            'state',
                        ],
                        reentrancy: 'queue',
                    });
                }
                controller = new HistoryPluginController(state, {
                    run: (operationId, body) => context.operations.run(operationId, null, () => body()),
                }, options, (error, message) => diagnostics.reportWarning(error, message));
                context.disposables.add(state.registerHistoryProvider(historyPluginRef.id, {
                    isAvailable: () => { var _a; return (_a = controller === null || controller === void 0 ? void 0 : controller.isEnabled) !== null && _a !== void 0 ? _a : false; },
                    commit: (record) => controller === null || controller === void 0 ? void 0 : controller.commit(record),
                }));
                context.capabilities.provide(HISTORY_CAPABILITY, controller, {
                    version: HISTORY_CAPABILITY.version,
                });
                return controller;
            },
            onDispose() {
                controller === null || controller === void 0 ? void 0 : controller.dispose();
                controller = null;
            },
        });
    }

    function markMaskObject(object, meta) {
        const mask = object;
        mask.editorObjectKind = 'mask';
        mask.maskId = meta.maskId;
        mask.maskUid = meta.maskUid;
        mask.maskName = meta.maskName;
        mask.originalAlpha = meta.originalAlpha;
        if (meta.originalStroke !== undefined)
            mask.originalStroke = meta.originalStroke;
        if (typeof meta.originalStrokeWidth === 'number') {
            mask.originalStrokeWidth = meta.originalStrokeWidth;
        }
        return mask;
    }
    function markSessionObject(object, sessionObjectType) {
        const sessionObject = object;
        sessionObject.editorObjectKind = 'session';
        sessionObject.sessionObjectType = sessionObjectType;
        return sessionObject;
    }

    function isMaskObject$1(object) {
        const candidate = object;
        return (!!candidate &&
            candidate.editorObjectKind === 'mask' &&
            typeof candidate.maskId === 'number' &&
            typeof candidate.maskUid === 'string' &&
            typeof candidate.maskName === 'string');
    }
    function isSessionObject(object) {
        const candidate = object;
        return (!!candidate &&
            candidate.editorObjectKind === 'session' &&
            typeof candidate.sessionObjectType === 'string');
    }

    function isPropertyMarkedSessionObject(object) {
        const candidate = object;
        return (candidate.isCropRect === true ||
            candidate.maskLabel === true ||
            candidate.isMosaicPreview === true);
    }
    function moveObjectTo(canvas, object, index) {
        const canvasWithLayerApi = canvas;
        if (typeof canvasWithLayerApi.moveObjectTo === 'function') {
            canvasWithLayerApi.moveObjectTo(object, index);
            return;
        }
        try {
            canvas.remove(object);
            canvas.insertAt(index, object);
        }
        catch {
            canvas.add(object);
        }
    }
    function ensureOnCanvas(canvas, object) {
        if (!canvas.getObjects().includes(object)) {
            canvas.add(object);
        }
    }
    function withoutObject(canvas, object) {
        return canvas.getObjects().filter((candidate) => candidate !== object);
    }
    function findFirstSessionIndex(objects) {
        return objects.findIndex((object) => isSessionObject(object) || isPropertyMarkedSessionObject(object));
    }
    function placeMaskObject(canvas, mask) {
        ensureOnCanvas(canvas, mask);
        const objects = withoutObject(canvas, mask);
        const firstSessionIndex = findFirstSessionIndex(objects);
        moveObjectTo(canvas, mask, firstSessionIndex === -1 ? objects.length : firstSessionIndex);
    }

    function reportWarning(options, error, message) {
        const warningCallback = options.onWarning;
        if (typeof warningCallback !== 'function')
            return;
        try {
            warningCallback(error, message);
        }
        catch (callbackError) {
            console.warn('[ImageEditor] onWarning callback threw', callbackError);
        }
    }

    const UNSAFE_OBJECT_COPY_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
    function canCopySafeObjectKey(key) {
        return !UNSAFE_OBJECT_COPY_KEYS.has(key);
    }
    function copySafeOwnProperties(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            return {};
        const output = Object.create(null);
        for (const [key, nestedValue] of Object.entries(value)) {
            if (!canCopySafeObjectKey(key))
                continue;
            output[key] = nestedValue;
        }
        return output;
    }

    const SELECTED_STROKE = '#ff0000';
    const SELECTED_STROKE_WIDTH = 1;
    const HOVER_STROKE = '#ff5500';
    const HOVER_STROKE_WIDTH = 2;
    const HOVER_OPACITY_BUMP = 0.2;
    const DEFAULT_STROKE_FALLBACK = '#ccc';
    const DEFAULT_STROKE_WIDTH_FALLBACK = 1;
    const DEFAULT_ALPHA_FALLBACK = 0.5;
    function getMaskNormalStyle(mask) {
        var _a;
        const strokeWidth = Number(mask.originalStrokeWidth);
        const opacity = Number(mask.originalAlpha);
        return {
            stroke: (_a = mask.originalStroke) !== null && _a !== void 0 ? _a : DEFAULT_STROKE_FALLBACK,
            strokeWidth: Number.isFinite(strokeWidth) ? strokeWidth : DEFAULT_STROKE_WIDTH_FALLBACK,
            opacity: Number.isFinite(opacity) ? opacity : DEFAULT_ALPHA_FALLBACK,
        };
    }
    function getMaskHoverStyle(mask) {
        const opacity = Number(mask.originalAlpha);
        const baseAlpha = Number.isFinite(opacity) ? opacity : DEFAULT_ALPHA_FALLBACK;
        return {
            stroke: HOVER_STROKE,
            strokeWidth: HOVER_STROKE_WIDTH,
            opacity: Math.min(baseAlpha + HOVER_OPACITY_BUMP, 1),
        };
    }
    function applyMaskSelectedStyle(mask) {
        mask.set({ stroke: SELECTED_STROKE, strokeWidth: SELECTED_STROKE_WIDTH });
    }
    function applyMaskUnselectedStyle(mask) {
        var _a;
        const strokeWidth = Number(mask.originalStrokeWidth);
        mask.set({
            stroke: (_a = mask.originalStroke) !== null && _a !== void 0 ? _a : DEFAULT_STROKE_FALLBACK,
            strokeWidth: Number.isFinite(strokeWidth) ? strokeWidth : DEFAULT_STROKE_WIDTH_FALLBACK,
        });
    }
    function attachMaskHoverHandlers(mask) {
        const tagged = mask;
        const mouseover = () => {
            var _a;
            tagged.set(getMaskHoverStyle(tagged));
            (_a = tagged.canvas) === null || _a === void 0 ? void 0 : _a.requestRenderAll();
        };
        const mouseout = () => {
            var _a;
            tagged.set(getMaskNormalStyle(tagged));
            (_a = tagged.canvas) === null || _a === void 0 ? void 0 : _a.requestRenderAll();
        };
        tagged.on('mouseover', mouseover);
        tagged.on('mouseout', mouseout);
        tagged.imageEditorMaskHandlers = { mouseover, mouseout };
    }
    function reattachMaskHoverHandlers(mask) {
        var _a;
        const tagged = mask;
        if (tagged.imageEditorMaskHandlers) {
            try {
                tagged.off('mouseover', tagged.imageEditorMaskHandlers.mouseover);
                tagged.off('mouseout', tagged.imageEditorMaskHandlers.mouseout);
            }
            catch {
            }
            delete tagged.imageEditorMaskHandlers;
        }
        const patch = {};
        if (!Number.isFinite(Number(tagged.originalAlpha))) {
            const opacity = Number(tagged.opacity);
            patch.originalAlpha = Number.isFinite(opacity) ? opacity : DEFAULT_ALPHA_FALLBACK;
        }
        if (tagged.originalStroke == null) {
            patch.originalStroke = (_a = tagged.stroke) !== null && _a !== void 0 ? _a : DEFAULT_STROKE_FALLBACK;
        }
        if (!Number.isFinite(Number(tagged.originalStrokeWidth))) {
            const sw = Number(tagged.strokeWidth);
            patch.originalStrokeWidth = Number.isFinite(sw) ? sw : DEFAULT_STROKE_WIDTH_FALLBACK;
        }
        if (Object.keys(patch).length > 0)
            tagged.set(patch);
        attachMaskHoverHandlers(tagged);
    }
    function detachMaskHoverHandlers(mask) {
        const tagged = mask;
        if (!tagged.imageEditorMaskHandlers)
            return;
        try {
            tagged.off('mouseover', tagged.imageEditorMaskHandlers.mouseover);
            tagged.off('mouseout', tagged.imageEditorMaskHandlers.mouseout);
        }
        catch {
        }
        delete tagged.imageEditorMaskHandlers;
    }

    function resolveNumeric(val, axis, fallback, canvas, options) {
        if (typeof val === 'number') {
            return val;
        }
        if (typeof val === 'function') {
            return val(canvas, options);
        }
        if (typeof val === 'string' && val.endsWith('%')) {
            const pct = parseFloat(val);
            if (!Number.isFinite(pct)) {
                return fallback;
            }
            const dim = axis === 'x' ? canvas.getWidth() : canvas.getHeight();
            return Math.floor(dim * (pct / 100));
        }
        return fallback;
    }
    function coercePoint(pt) {
        if (Array.isArray(pt)) {
            return { x: Number(pt[0]), y: Number(pt[1]) };
        }
        return { x: Number(pt.x), y: Number(pt.y) };
    }

    const POLYGON_AREA_EPSILON = 1e-6;
    const BUILT_IN_MASK_SHAPES = new Set(['rect', 'circle', 'ellipse', 'polygon']);
    function createMaskUid(maskId) {
        return `mask-${maskId}`;
    }
    function isFabricObjectLike(value) {
        if (!value || typeof value !== 'object')
            return false;
        const candidate = value;
        return typeof candidate.set === 'function' && typeof candidate.on === 'function';
    }
    function isStyleObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }
    function mergeMaskConfig(defaultMaskConfig, config) {
        const safeDefaultConfig = copySafeOwnProperties(defaultMaskConfig);
        const defaultStyles = safeDefaultConfig.styles;
        delete safeDefaultConfig.onCreate;
        delete safeDefaultConfig.fabricGenerator;
        delete safeDefaultConfig.styles;
        const safeConfig = copySafeOwnProperties(config);
        const configStyles = copySafeOwnProperties(config.styles);
        const safeDefaultStyles = copySafeOwnProperties(isStyleObject(defaultStyles) ? defaultStyles : {});
        return {
            ...safeDefaultConfig,
            ...safeConfig,
            styles: {
                ...safeDefaultStyles,
                ...configStyles,
            },
        };
    }
    function warnInvalidMask(options, reason) {
        reportWarning(options, null, `createMask skipped: ${reason}.`);
    }
    function isBuiltInMaskShape(value) {
        return typeof value === 'string' && BUILT_IN_MASK_SHAPES.has(value);
    }
    function resolveMaskShape(options, shape) {
        if (isBuiltInMaskShape(shape))
            return shape;
        reportWarning(options, null, `createMask received unsupported shape "${String(shape)}"; using "rect" instead.`);
        return 'rect';
    }
    function isResolvableNumericInput(value) {
        if (value === undefined)
            return true;
        if (typeof value === 'number')
            return Number.isFinite(value);
        if (typeof value === 'function')
            return true;
        if (typeof value === 'string' && value.endsWith('%')) {
            return Number.isFinite(Number.parseFloat(value));
        }
        return false;
    }
    function isFiniteNumber(value) {
        return typeof value === 'number' && Number.isFinite(value);
    }
    function validateFiniteField(options, fieldName, value) {
        if (isFiniteNumber(value))
            return true;
        warnInvalidMask(options, `${fieldName} must resolve to a finite number`);
        return false;
    }
    function validatePositiveField(options, fieldName, value) {
        if (isFiniteNumber(value) && value > 0)
            return true;
        warnInvalidMask(options, `${fieldName} must resolve to a positive number`);
        return false;
    }
    function validateNonNegativeField(options, fieldName, value) {
        if (isFiniteNumber(value) && value >= 0)
            return true;
        warnInvalidMask(options, `${fieldName} must resolve to a non-negative number`);
        return false;
    }
    function validateNumericInputs(options, config) {
        const fields = [
            ['width', config.width],
            ['height', config.height],
            ['rx', config.rx],
            ['ry', config.ry],
            ['radius', config.radius],
            ['left', config.left],
            ['top', config.top],
        ];
        for (const [fieldName, value] of fields) {
            if (!isResolvableNumericInput(value)) {
                warnInvalidMask(options, `${fieldName} is not a supported numeric value`);
                return false;
            }
        }
        return true;
    }
    function resolveMaskNumericField(options, fieldName, value, axis, fallback, canvas) {
        try {
            return resolveNumeric(value, axis, fallback, canvas, options);
        }
        catch (error) {
            reportWarning(options, error, `createMask skipped: ${fieldName} resolver threw.`);
            return null;
        }
    }
    function resolvePolygonPoints(options, points) {
        if (!Array.isArray(points) || points.length < 3) {
            warnInvalidMask(options, 'polygon masks require at least three points');
            return null;
        }
        const resolvedPoints = points.map(coercePoint);
        const allFinite = resolvedPoints.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
        if (!allFinite) {
            warnInvalidMask(options, 'polygon points must contain finite x/y values');
            return null;
        }
        if (polygonArea(resolvedPoints) <= POLYGON_AREA_EPSILON) {
            warnInvalidMask(options, 'polygon points must describe a non-zero area');
            return null;
        }
        return resolvedPoints;
    }
    function resizeMaskCanvas(context, width, height) {
        if (context.expandCanvasIfNeeded) {
            context.expandCanvasIfNeeded(width, height);
        }
        else {
            context.canvas.setDimensions({ width, height });
        }
    }
    function polygonArea(points) {
        let area = 0;
        for (let index = 0; index < points.length; index += 1) {
            const current = points[index];
            const next = points[(index + 1) % points.length];
            area += current.x * next.y - next.x * current.y;
        }
        return Math.abs(area) / 2;
    }
    function createMask(context, config = {}) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
        const { canvas, options, fabric: fabricModule } = context;
        if (!canvas)
            return null;
        const mergedConfig = mergeMaskConfig(options.defaultMaskConfig, config);
        const requestedShapeType = (_a = mergedConfig.shape) !== null && _a !== void 0 ? _a : 'rect';
        if (!validateNumericInputs(options, mergedConfig))
            return null;
        const shapeType = typeof config.fabricGenerator === 'function'
            ? requestedShapeType
            : resolveMaskShape(options, requestedShapeType);
        const resolvedConfig = {
            width: options.defaultMaskWidth,
            height: options.defaultMaskHeight,
            color: 'rgba(0,0,0,0.5)',
            alpha: 0.5,
            gap: 5,
            left: undefined,
            top: undefined,
            angle: 0,
            selectable: true,
            ...mergedConfig,
            shape: shapeType,
        };
        const firstOffset = 10;
        let left;
        let top;
        const previousMask = context.getLastMask();
        if (mergedConfig.left === undefined && previousMask) {
            const previousRight = ((_b = previousMask.left) !== null && _b !== void 0 ? _b : 0) +
                (typeof previousMask.getScaledWidth === 'function'
                    ? previousMask.getScaledWidth()
                    : ((_c = previousMask.width) !== null && _c !== void 0 ? _c : 0) * ((_d = previousMask.scaleX) !== null && _d !== void 0 ? _d : 1));
            left = Math.round(previousRight + ((_e = resolvedConfig.gap) !== null && _e !== void 0 ? _e : 5));
            top = (_f = previousMask.top) !== null && _f !== void 0 ? _f : firstOffset;
        }
        else {
            const resolvedLeft = resolveMaskNumericField(options, 'left', mergedConfig.left, 'x', firstOffset, canvas);
            const resolvedTop = resolveMaskNumericField(options, 'top', mergedConfig.top, 'y', firstOffset, canvas);
            if (resolvedLeft === null || resolvedTop === null)
                return null;
            left = resolvedLeft;
            top = resolvedTop;
        }
        const resolvedWidth = resolveMaskNumericField(options, 'width', mergedConfig.width, 'x', options.defaultMaskWidth, canvas);
        const resolvedHeight = resolveMaskNumericField(options, 'height', mergedConfig.height, 'y', options.defaultMaskHeight, canvas);
        if (resolvedWidth === null || resolvedHeight === null)
            return null;
        resolvedConfig.width = resolvedWidth;
        resolvedConfig.height = resolvedHeight;
        let rx;
        if (mergedConfig.rx !== undefined) {
            const resolvedRx = resolveMaskNumericField(options, 'rx', mergedConfig.rx, 'x', 0, canvas);
            if (resolvedRx === null)
                return null;
            rx = resolvedRx;
        }
        let ry;
        if (mergedConfig.ry !== undefined) {
            const resolvedRy = resolveMaskNumericField(options, 'ry', mergedConfig.ry, 'y', 0, canvas);
            if (resolvedRy === null)
                return null;
            ry = resolvedRy;
        }
        let radius;
        if (shapeType === 'circle') {
            const resolvedRadius = resolveMaskNumericField(options, 'radius', mergedConfig.radius, 'x', Math.min(resolvedConfig.width, resolvedConfig.height) / 2, canvas);
            if (resolvedRadius === null)
                return null;
            radius = resolvedRadius;
        }
        const polygonPoints = shapeType === 'polygon' ? resolvePolygonPoints(options, mergedConfig.points) : null;
        if (!validateFiniteField(options, 'left', left) ||
            !validateFiniteField(options, 'top', top) ||
            !validatePositiveField(options, 'width', resolvedConfig.width) ||
            !validatePositiveField(options, 'height', resolvedConfig.height) ||
            !validateFiniteField(options, 'gap', resolvedConfig.gap) ||
            !validateFiniteField(options, 'angle', resolvedConfig.angle) ||
            !validateFiniteField(options, 'alpha', resolvedConfig.alpha)) {
            return null;
        }
        if ((rx !== undefined && !validateNonNegativeField(options, 'rx', rx)) ||
            (ry !== undefined && !validateNonNegativeField(options, 'ry', ry)) ||
            (radius !== undefined && !validatePositiveField(options, 'radius', radius)) ||
            (shapeType === 'polygon' && polygonPoints === null)) {
            return null;
        }
        let preExpandCanvasSize = null;
        if (options.layoutMode === 'expand') {
            const requiredWidth = Math.ceil(left + resolvedConfig.width + 10);
            const requiredHeight = Math.ceil(top + resolvedConfig.height + 10);
            const nextWidth = Math.max(canvas.getWidth(), requiredWidth);
            const nextHeight = Math.max(canvas.getHeight(), requiredHeight);
            if (nextWidth !== canvas.getWidth() || nextHeight !== canvas.getHeight()) {
                preExpandCanvasSize = { width: canvas.getWidth(), height: canvas.getHeight() };
                resizeMaskCanvas(context, nextWidth, nextHeight);
            }
        }
        const rollbackCanvasExpansion = () => {
            if (!preExpandCanvasSize)
                return;
            try {
                resizeMaskCanvas(context, preExpandCanvasSize.width, preExpandCanvasSize.height);
            }
            catch (error) {
                reportWarning(options, error, 'createMask rollback canvas size failed.');
            }
        };
        let mask;
        if (typeof config.fabricGenerator === 'function') {
            let generated;
            try {
                generated = config.fabricGenerator(resolvedConfig, canvas, options);
            }
            catch (error) {
                rollbackCanvasExpansion();
                reportWarning(options, error, 'createMask skipped: fabricGenerator threw.');
                return null;
            }
            if (!isFabricObjectLike(generated)) {
                rollbackCanvasExpansion();
                reportWarning(options, generated, 'createMask skipped: fabricGenerator did not return a Fabric object.');
                return null;
            }
            mask = generated;
        }
        else {
            const originProps = {
                originX: 'left',
                originY: 'top',
            };
            switch (shapeType) {
                case 'circle':
                    mask = new fabricModule.Circle({
                        left,
                        top,
                        ...originProps,
                        radius,
                        fill: resolvedConfig.color,
                        opacity: resolvedConfig.alpha,
                        angle: (_g = resolvedConfig.angle) !== null && _g !== void 0 ? _g : 0,
                        ...resolvedConfig.styles,
                    });
                    break;
                case 'ellipse':
                    mask = new fabricModule.Ellipse({
                        left,
                        top,
                        ...originProps,
                        rx: rx !== null && rx !== void 0 ? rx : resolvedConfig.width / 2,
                        ry: ry !== null && ry !== void 0 ? ry : resolvedConfig.height / 2,
                        fill: resolvedConfig.color,
                        opacity: resolvedConfig.alpha,
                        angle: (_h = resolvedConfig.angle) !== null && _h !== void 0 ? _h : 0,
                        ...resolvedConfig.styles,
                    });
                    break;
                case 'polygon': {
                    const polygon = new fabricModule.Polygon(polygonPoints, {
                        ...originProps,
                        fill: resolvedConfig.color,
                        opacity: resolvedConfig.alpha,
                        angle: (_j = resolvedConfig.angle) !== null && _j !== void 0 ? _j : 0,
                        ...resolvedConfig.styles,
                    });
                    polygon.setCoords();
                    const boundingRect = polygon.getBoundingRect();
                    const deltaX = left - boundingRect.left;
                    const deltaY = top - boundingRect.top;
                    polygon.set({
                        left: ((_k = polygon.left) !== null && _k !== void 0 ? _k : 0) + deltaX,
                        top: ((_l = polygon.top) !== null && _l !== void 0 ? _l : 0) + deltaY,
                    });
                    polygon.setCoords();
                    mask = polygon;
                    break;
                }
                case 'rect':
                default:
                    mask = new fabricModule.Rect({
                        left,
                        top,
                        ...originProps,
                        width: resolvedConfig.width,
                        height: resolvedConfig.height,
                        fill: resolvedConfig.color,
                        opacity: resolvedConfig.alpha,
                        angle: (_m = resolvedConfig.angle) !== null && _m !== void 0 ? _m : 0,
                        ...(rx !== undefined ? { rx } : {}),
                        ...(ry !== undefined ? { ry } : {}),
                        ...resolvedConfig.styles,
                    });
            }
        }
        const maskObject = mask;
        maskObject.selectable = 'selectable' in mergedConfig ? !!mergedConfig.selectable : true;
        maskObject.evented = 'evented' in mergedConfig ? !!mergedConfig.evented : true;
        maskObject.hasControls = 'hasControls' in mergedConfig ? !!mergedConfig.hasControls : true;
        maskObject.transparentCorners =
            'transparentCorners' in mergedConfig ? !!mergedConfig.transparentCorners : false;
        maskObject.strokeUniform =
            'strokeUniform' in mergedConfig ? !!mergedConfig.strokeUniform : true;
        maskObject.lockRotation = !options.maskRotatable;
        maskObject.borderColor = (_o = mergedConfig.borderColor) !== null && _o !== void 0 ? _o : 'red';
        maskObject.cornerColor = (_p = mergedConfig.cornerColor) !== null && _p !== void 0 ? _p : 'black';
        maskObject.cornerSize = (_q = mergedConfig.cornerSize) !== null && _q !== void 0 ? _q : 8;
        const styles = ((_r = resolvedConfig.styles) !== null && _r !== void 0 ? _r : {});
        if ('stroke' in styles) {
            maskObject.stroke = styles.stroke;
        }
        else {
            maskObject.stroke = '#ccc';
        }
        if ('strokeWidth' in styles) {
            maskObject.strokeWidth = styles.strokeWidth;
        }
        else {
            maskObject.strokeWidth = 1;
        }
        if ('strokeDashArray' in styles) {
            maskObject.strokeDashArray = styles.strokeDashArray;
        }
        const nextId = context.getMaskCounter() + 1;
        context.setMaskCounter(nextId);
        markMaskObject(maskObject, {
            maskId: nextId,
            maskUid: createMaskUid(nextId),
            maskName: `${options.maskName}${nextId}`,
            originalAlpha: resolvedConfig.alpha,
            originalStroke: maskObject.stroke,
            originalStrokeWidth: maskObject.strokeWidth,
        });
        attachMaskHoverHandlers(maskObject);
        context.setLastMask(maskObject);
        placeMaskObject(canvas, maskObject);
        if (resolvedConfig.selectable !== false) {
            canvas.setActiveObject(maskObject);
        }
        canvas.renderAll();
        if (typeof config.onCreate === 'function') {
            try {
                config.onCreate(maskObject, canvas);
            }
            catch (error) {
                reportWarning(options, error, 'createMask onCreate callback threw.');
            }
        }
        return maskObject;
    }

    function removeLabelForMask(context, mask) {
        if (!context.canvas || !mask.labelObject)
            return;
        try {
            if (context.canvas.getObjects().includes(mask.labelObject)) {
                context.canvas.remove(mask.labelObject);
            }
        }
        catch {
        }
        try {
            delete mask.labelObject;
        }
        catch {
        }
    }
    function createLabelForMask(context, mask) {
        var _a;
        const { canvas, options, fabric: fabricModule } = context;
        if (!canvas || !options.maskLabelOnSelect)
            return;
        removeLabelForMask(context, mask);
        let labelTextObject = null;
        if (typeof options.label.create === 'function') {
            try {
                labelTextObject = options.label.create(mask, fabricModule);
            }
            catch (error) {
                reportWarning(options, error, 'label.create callback threw.');
                labelTextObject = null;
            }
        }
        if (!labelTextObject) {
            const indexForGetText = Math.max(0, mask.maskId - 1);
            let labelText = mask.maskName;
            if (typeof options.label.getText === 'function') {
                try {
                    labelText = options.label.getText(mask, indexForGetText);
                }
                catch (error) {
                    reportWarning(options, error, 'label.getText callback threw.');
                    labelText = mask.maskName;
                }
            }
            const textOptions = {
                left: 0,
                top: 0,
                ...((_a = options.label.textOptions) !== null && _a !== void 0 ? _a : {}),
                originX: 'left',
                originY: 'top',
            };
            labelTextObject = new fabricModule.FabricText(labelText, textOptions);
        }
        markSessionObject(labelTextObject, 'maskLabel');
        labelTextObject.maskLabel = true;
        mask.labelObject = labelTextObject;
        canvas.add(labelTextObject);
        canvas.bringObjectToFront(labelTextObject);
        syncMaskLabel(context, mask);
    }
    function syncMaskLabel(context, mask) {
        var _a, _b, _c;
        const { canvas, options } = context;
        if (!canvas || !options.maskLabelOnSelect || !mask.labelObject)
            return;
        const coords = (_a = mask.getCoords) === null || _a === void 0 ? void 0 : _a.call(mask);
        if (!(coords === null || coords === void 0 ? void 0 : coords.length))
            return;
        const tl = coords[0];
        if (!tl)
            return;
        const center = mask.getCenterPoint();
        const vx = center.x - tl.x;
        const vy = center.y - tl.y;
        const dist = Math.sqrt(vx * vx + vy * vy) || 1;
        const offset = Math.max(0, (_b = options.maskLabelOffset) !== null && _b !== void 0 ? _b : 3);
        mask.labelObject.set({
            left: Math.round(tl.x + (vx / dist) * offset),
            top: Math.round(tl.y + (vy / dist) * offset),
            angle: (_c = mask.angle) !== null && _c !== void 0 ? _c : 0,
            originX: 'left',
            originY: 'top',
            visible: true,
        });
        mask.labelObject.setCoords();
        canvas.renderAll();
    }
    function showLabelForMask(context, mask) {
        if (!context.options.maskLabelOnSelect)
            return;
        if (!mask.labelObject) {
            createLabelForMask(context, mask);
        }
        if (mask.labelObject) {
            mask.labelObject.visible = true;
            syncMaskLabel(context, mask);
        }
    }
    function hideAllMaskLabels(context) {
        const { canvas } = context;
        if (!canvas)
            return;
        const objs = canvas.getObjects();
        objs.filter((o) => o.maskLabel).forEach((l) => {
            try {
                canvas.remove(l);
            }
            catch {
            }
        });
        objs.filter(isMaskObject$1).forEach((o) => {
            try {
                delete o.labelObject;
            }
            catch {
            }
        });
    }

    const MASK_PLUGIN_ID = 'plugin:mask';
    const MASK_SERIALIZED_OBJECT_PROPERTIES = [
        'hasControls',
        'selectable',
        'evented',
        'strokeUniform',
        'lockRotation',
        'transparentCorners',
        'borderColor',
        'cornerColor',
        'cornerSize',
    ];
    const DEFAULT_LABEL = Object.freeze({
        getText: (mask) => mask.maskName,
        textOptions: Object.freeze({
            fontFamily: 'monospace',
            fontSize: 12,
            fill: '#ffffff',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
        }),
    });
    function positive(value, fallback) {
        return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
    }
    function nonNegative(value, fallback) {
        return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
    }
    function resolveMaskPluginOptions(options = {}) {
        var _a, _b;
        return Object.freeze({
            defaultWidth: positive(options.defaultWidth, 50),
            defaultHeight: positive(options.defaultHeight, 80),
            defaultConfig: Object.freeze({ ...((_a = options.defaultConfig) !== null && _a !== void 0 ? _a : {}) }),
            rotatable: options.rotatable === true,
            label: options.label === false ? false : Object.freeze({ ...DEFAULT_LABEL, ...options.label }),
            labelOffset: nonNegative(options.labelOffset, 3),
            listOrder: options.listOrder === 'back-to-front' ? 'back-to-front' : 'front-to-back',
            bindToImageTransform: options.bindToImageTransform === true,
            namePrefix: ((_b = options.namePrefix) === null || _b === void 0 ? void 0 : _b.trim()) || 'mask',
            onChange: options.onChange,
        });
    }
    function isMaskObject(value) {
        return (Reflect.get(value, 'editorObjectKind') === 'mask' &&
            typeof Reflect.get(value, 'maskId') === 'number' &&
            typeof Reflect.get(value, 'maskUid') === 'string' &&
            typeof Reflect.get(value, 'maskName') === 'string');
    }
    function isSerializedMaskData(value) {
        if (!value || typeof value !== 'object')
            return false;
        const candidate = value;
        return (!!candidate.object &&
            typeof candidate.object === 'object' &&
            Number.isSafeInteger(candidate.maskId) &&
            Number(candidate.maskId) > 0 &&
            typeof candidate.maskUid === 'string' &&
            candidate.maskUid.length > 0 &&
            typeof candidate.maskName === 'string' &&
            typeof candidate.originalAlpha === 'number' &&
            Number.isFinite(candidate.originalAlpha));
    }
    function isPlainRecord$4(value) {
        if (typeof value !== 'object' || value === null || Array.isArray(value))
            return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }
    function maskStateKind(object) {
        var _a;
        const kind = String((_a = object.type) !== null && _a !== void 0 ? _a : '').toLowerCase();
        if (kind === 'rect' || kind === 'circle' || kind === 'ellipse' || kind === 'polygon') {
            return kind;
        }
        throw new CoreRuntimeError(`[ImageEditor] Mask kind "${kind}" cannot be persisted.`);
    }
    function normalizedPolygonPoints(object) {
        const points = object
            .points;
        if (!Array.isArray(points) || points.length < 3 || points.length > 4096)
            return null;
        const xs = points.map((point) => point.x);
        const ys = points.map((point) => point.y);
        const left = Math.min(...xs);
        const top = Math.min(...ys);
        const width = Math.max(...xs) - left;
        const height = Math.max(...ys) - top;
        if (!(width > 0) || !(height > 0))
            return null;
        return Object.freeze(points.map((point) => Object.freeze({ x: (point.x - left) / width, y: (point.y - top) / height })));
    }
    function isMaskStateData(value) {
        if (!isPlainRecord$4(value) || value.version !== 1)
            return false;
        const validKind = value.kind === 'rect' ||
            value.kind === 'circle' ||
            value.kind === 'ellipse' ||
            value.kind === 'polygon';
        const validPoints = value.points === null ||
            (Array.isArray(value.points) &&
                value.points.length >= 3 &&
                value.points.length <= 4096 &&
                value.points.every((point) => isPlainRecord$4(point) &&
                    typeof point.x === 'number' &&
                    Number.isFinite(point.x) &&
                    typeof point.y === 'number' &&
                    Number.isFinite(point.y)));
        return (validKind &&
            Number.isSafeInteger(value.maskId) &&
            Number(value.maskId) > 0 &&
            typeof value.name === 'string' &&
            value.name.length > 0 &&
            value.name.length <= 128 &&
            typeof value.fill === 'string' &&
            value.fill.length <= 128 &&
            typeof value.opacity === 'number' &&
            Number.isFinite(value.opacity) &&
            value.opacity >= 0 &&
            value.opacity <= 1 &&
            (value.stroke === null ||
                (typeof value.stroke === 'string' && value.stroke.length <= 128)) &&
            typeof value.strokeWidth === 'number' &&
            Number.isFinite(value.strokeWidth) &&
            value.strokeWidth >= 0 &&
            (value.strokeDashArray === null ||
                (Array.isArray(value.strokeDashArray) &&
                    value.strokeDashArray.length <= 32 &&
                    value.strokeDashArray.every((entry) => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0))) &&
            typeof value.cornerRadiusX === 'number' &&
            Number.isFinite(value.cornerRadiusX) &&
            value.cornerRadiusX >= 0 &&
            typeof value.cornerRadiusY === 'number' &&
            Number.isFinite(value.cornerRadiusY) &&
            value.cornerRadiusY >= 0 &&
            validPoints &&
            (value.kind === 'polygon' ? value.points !== null : value.points === null) &&
            typeof value.hasControls === 'boolean' &&
            typeof value.selectable === 'boolean' &&
            typeof value.evented === 'boolean');
    }
    class MaskPluginController {
        constructor(host, state, overlay, options) {
            Object.defineProperty(this, "host", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: host
            });
            Object.defineProperty(this, "overlay", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: overlay
            });
            Object.defineProperty(this, "options", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: options
            });
            Object.defineProperty(this, "counter", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "lastMask", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: null
            });
            Object.defineProperty(this, "attached", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
            Object.defineProperty(this, "selectedMaskBeforeGeometry", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: null
            });
            Object.defineProperty(this, "mutationSequence", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "lastInteractionNotification", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: null
            });
            Object.defineProperty(this, "registrations", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: []
            });
            Object.defineProperty(this, "factoryOptions", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: void 0
            });
            this.factoryOptions = Object.freeze({
                layoutMode: host.layoutMode,
                defaultMaskWidth: options.defaultWidth,
                defaultMaskHeight: options.defaultHeight,
                defaultMaskConfig: options.defaultConfig,
                maskRotatable: options.rotatable,
                maskLabelOnSelect: options.label !== false,
                maskLabelOffset: options.labelOffset,
                maskName: options.namePrefix,
                maskListOrder: options.listOrder,
                label: options.label === false ? DEFAULT_LABEL : options.label,
                onWarning: (error, message) => host.reportWarning(error, message),
            });
            this.registrations.push(overlay.registerKind({
                id: 'mask:object',
                ownerPluginId: MASK_PLUGIN_ID,
                classify: isMaskObject,
                getPersistentId: (object) => isMaskObject(object) && object.maskUid ? object.maskUid : null,
                setPersistentId: (object, id) => {
                    if (isMaskObject(object))
                        object.maskUid = id;
                },
                persistence: {
                    mode: 'persistent',
                    codec: {
                        type: 'mask:object',
                        version: '1.0.0',
                        serialize: (object) => this.serializeMask(object),
                        validate: isSerializedMaskData,
                        deserialize: (data, context) => this.deserializeMask(data, context.fabric),
                    },
                },
                stateCodec: {
                    type: 'mask:object',
                    version: '1.0.0',
                    serialize: (object, context) => {
                        if (!isMaskObject(object)) {
                            throw new CoreRuntimeError('[ImageEditor] Mask State Codec received a non-mask.');
                        }
                        const kind = maskStateKind(object);
                        const metadata = object
                            .overlayMetadata;
                        return Object.freeze({
                            geometry: captureOverlayStateBounds(object, context),
                            metadata: isPlainRecord$4(metadata)
                                ? Object.freeze({ ...metadata })
                                : Object.freeze({}),
                            data: Object.freeze({
                                version: 1,
                                kind,
                                maskId: object.maskId,
                                name: object.maskName,
                                fill: typeof object.fill === 'string' ? object.fill : '#000000',
                                opacity: Number.isFinite(object.opacity) ? object.opacity : 1,
                                stroke: typeof object.stroke === 'string' ? object.stroke : null,
                                strokeWidth: context.toImageNormalizedScalar(Number(object.strokeWidth) || 0),
                                strokeDashArray: Array.isArray(object.strokeDashArray)
                                    ? Object.freeze(object.strokeDashArray.map((entry) => context.toImageNormalizedScalar(entry)))
                                    : null,
                                cornerRadiusX: context.toImageNormalizedScalar(Number(Reflect.get(object, 'rx')) || 0),
                                cornerRadiusY: context.toImageNormalizedScalar(Number(Reflect.get(object, 'ry')) || 0),
                                points: kind === 'polygon' ? normalizedPolygonPoints(object) : null,
                                hasControls: object.hasControls === true,
                                selectable: object.selectable !== false,
                                evented: object.evented !== false,
                            }),
                        });
                    },
                    validate: (value) => isOverlayStateBoundsGeometry(value.geometry) &&
                        isMaskStateData(value.data) &&
                        isPlainRecord$4(value.metadata),
                    deserialize: (value, context) => {
                        if (!isOverlayStateBoundsGeometry(value.geometry) ||
                            !isMaskStateData(value.data) ||
                            !isPlainRecord$4(value.metadata)) {
                            throw new CoreRuntimeError('[ImageEditor] Serialized Mask State data is malformed.');
                        }
                        const data = value.data;
                        const common = {
                            left: 0,
                            top: 0,
                            originX: 'left',
                            originY: 'top',
                            fill: data.fill,
                            opacity: data.opacity,
                            stroke: data.stroke,
                            strokeWidth: context.toCanvasScalar(data.strokeWidth),
                            strokeDashArray: data.strokeDashArray
                                ? data.strokeDashArray.map((entry) => context.toCanvasScalar(entry))
                                : undefined,
                            hasControls: data.hasControls,
                            selectable: data.selectable,
                            evented: data.evented,
                            strokeUniform: true,
                        };
                        let object;
                        if (data.kind === 'circle') {
                            object = new this.host.fabric.Circle({ ...common, radius: 0.5 });
                        }
                        else if (data.kind === 'ellipse') {
                            object = new this.host.fabric.Ellipse({ ...common, rx: 0.5, ry: 0.5 });
                        }
                        else if (data.kind === 'polygon') {
                            object = new this.host.fabric.Polygon(data.points.map((point) => ({ x: point.x, y: point.y })), common);
                        }
                        else {
                            object = new this.host.fabric.Rect({
                                ...common,
                                width: 1,
                                height: 1,
                                rx: context.toCanvasScalar(data.cornerRadiusX),
                                ry: context.toCanvasScalar(data.cornerRadiusY),
                            });
                        }
                        const mask = object;
                        mask.editorObjectKind = 'mask';
                        mask.maskId = data.maskId;
                        mask.maskUid = `mask-state-${data.maskId}`;
                        mask.maskName = data.name;
                        mask.originalAlpha = data.opacity;
                        mask.originalStroke = data.stroke;
                        mask.originalStrokeWidth = context.toCanvasScalar(data.strokeWidth);
                        mask.overlayMetadata = Object.freeze({ ...value.metadata });
                        mask.lockRotation = !this.options.rotatable;
                        restoreOverlayStateBounds(mask, value.geometry, context, this.host.fabric);
                        reattachMaskHoverHandlers(mask);
                        return mask;
                    },
                },
            }));
            this.registrations.push(overlay.registerGeometryPolicy({
                id: 'mask:geometry',
                kind: 'mask:object',
                ownerPluginId: MASK_PLUGIN_ID,
                supports: (mutation) => mutation.kind === 'crop' ||
                    (options.bindToImageTransform && mutation.kind === 'transform'),
                prepare: () => this.captureSelectionBeforeGeometry(),
                synchronize: () => this.synchronizeAfterGeometry(),
            }));
            this.registrations.push(overlay.registerExportRenderer({
                id: 'mask:export',
                kind: 'mask:object',
                ownerPluginId: MASK_PLUGIN_ID,
                order: 100,
                render: async ({ source, targetCanvas }) => {
                    const clone = await source.clone();
                    clone.set({
                        visible: true,
                        opacity: 1,
                        fill: '#000000',
                        stroke: null,
                        strokeWidth: 0,
                        selectable: false,
                        evented: false,
                    });
                    targetCanvas.add(clone);
                },
            }));
            this.registrations.push(overlay.registerInteractionPolicy({
                id: 'mask:interaction',
                kind: 'mask:object',
                ownerPluginId: MASK_PLUGIN_ID,
                preview: (object) => {
                    if (isMaskObject(object))
                        syncMaskLabel(this.labelContext(), object);
                },
                synchronize: (object, context) => {
                    if (isMaskObject(object) && object.labelObject) {
                        syncMaskLabel(this.labelContext(), object);
                    }
                    if (this.lastInteractionNotification !== context.descriptor.id) {
                        this.lastInteractionNotification = context.descriptor.id;
                        this.notifyChange();
                    }
                },
            }));
            this.registrations.push(state.registerTransientObject(MASK_PLUGIN_ID, (object) => {
                const candidate = object;
                return candidate.maskLabel === true;
            }));
            this.registrations.push(state.registerSlice({
                id: MASK_PLUGIN_ID,
                version: 1,
                capturePolicy: 'always',
                capture: () => Object.freeze({ counter: this.counter }),
                validate: (value) => {
                    const counter = value === null || value === void 0 ? void 0 : value.counter;
                    return Number.isSafeInteger(counter) && Number(counter) >= 0
                        ? { valid: true, value: { counter: Number(counter) } }
                        : { valid: false, message: 'Mask counter state is malformed.' };
                },
                restore: (value) => {
                    var _a;
                    this.counter = value.counter;
                    const masks = this.getAll();
                    this.lastMask = (_a = masks[masks.length - 1]) !== null && _a !== void 0 ? _a : null;
                    this.reattachRuntimeState();
                },
                clearState: () => {
                    this.counter = 0;
                    this.lastMask = null;
                    this.removeLabels();
                },
            }));
            this.registrations.push(overlay.onSelectionChange(() => this.synchronizeSelection()));
            if (host.getCanvas())
                this.attach();
        }
        attach() {
            this.assertActive('attach Mask plugin');
            if (this.attached)
                return;
            this.attached = true;
            this.reattachRuntimeState();
        }
        create(config = {}) {
            return this.overlay.mutate({
                id: `mask:create:${++this.mutationSequence}`,
                operationId: 'mask:create',
                action: 'create',
                metadata: Object.freeze({ pluginId: MASK_PLUGIN_ID }),
                mutate: () => {
                    this.synchronizeCounterFromCanvas();
                    const mask = createMask(this.createContext(), config);
                    if (!mask) {
                        throw new CoreRuntimeError('[ImageEditor] Mask configuration is invalid.');
                    }
                    return mask;
                },
                affectedObjects: (mask) => [mask],
                synchronize: () => {
                    this.synchronizeSelection();
                },
            });
        }
        getAll() {
            const masks = this.overlay
                .list({ kinds: ['mask:object'], includeHidden: true, includeLocked: true })
                .filter(isMaskObject);
            if (this.options.listOrder === 'back-to-front')
                masks.reverse();
            return Object.freeze(masks);
        }
        remove(id) {
            const object = this.overlay.getByPersistentId(id);
            if (!object || !isMaskObject(object)) {
                return Promise.reject(new CoreRuntimeError(`[ImageEditor] Mask "${id}" was not found.`));
            }
            return this.overlay.mutate({
                id: `mask:remove:${++this.mutationSequence}`,
                operationId: 'mask:remove',
                action: 'delete',
                objectIds: [id],
                metadata: Object.freeze({ pluginId: MASK_PLUGIN_ID }),
                mutate: () => this.removeMaskObject(object),
            });
        }
        removeSelected() {
            const selectedId = this.overlay.getSelection().ids.find((id) => {
                const object = this.overlay.getByPersistentId(id);
                return object ? isMaskObject(object) : false;
            });
            return selectedId ? this.remove(selectedId) : Promise.resolve();
        }
        removeAll(options = {}) {
            const masks = [...this.getAll()];
            if (masks.length === 0)
                return Promise.resolve();
            return this.overlay.mutate({
                id: `mask:remove-all:${++this.mutationSequence}`,
                operationId: 'mask:remove-all',
                action: 'delete',
                objectIds: masks.map((mask) => mask.maskUid),
                metadata: Object.freeze({ pluginId: MASK_PLUGIN_ID, objectCount: masks.length }),
                mutate: () => {
                    for (const mask of masks)
                        this.removeMaskObject(mask);
                    this.counter = 0;
                    this.lastMask = null;
                },
            });
        }
        flatten(options) {
            return this.overlay
                .flatten({ kinds: ['mask:object'], includeHidden: false, includeLocked: true }, options)
                .then(() => {
                var _a;
                const masks = this.getAll();
                this.lastMask = (_a = masks[masks.length - 1]) !== null && _a !== void 0 ? _a : null;
                this.notifyChange();
            });
        }
        resetForImage() {
            this.counter = 0;
            this.lastMask = null;
            this.removeLabels();
        }
        dispose() {
            var _a;
            if (this.disposed)
                return;
            const canvas = this.host.getCanvas();
            this.removeLabels();
            for (const object of (_a = canvas === null || canvas === void 0 ? void 0 : canvas.getObjects()) !== null && _a !== void 0 ? _a : []) {
                if (isMaskObject(object))
                    detachMaskHoverHandlers(object);
            }
            const errors = [];
            for (let index = this.registrations.length - 1; index >= 0; index -= 1) {
                try {
                    const result = this.registrations[index].dispose();
                    if (result instanceof Promise)
                        void result.catch((error) => errors.push(error));
                }
                catch (error) {
                    errors.push(error);
                }
            }
            this.registrations.length = 0;
            this.attached = false;
            this.disposed = true;
            if (errors.length > 0) {
                throw new CoreRuntimeError(`[ImageEditor] Mask disposal had ${errors.length} cleanup error(s).`);
            }
        }
        createContext() {
            return {
                fabric: this.host.fabric,
                canvas: this.host.requireCanvas('create a mask'),
                options: this.factoryOptions,
                getLastMask: () => this.lastMask,
                setLastMask: (mask) => {
                    this.lastMask = mask;
                },
                getMaskCounter: () => this.counter,
                setMaskCounter: (counter) => {
                    this.counter = counter;
                },
                expandCanvasIfNeeded: (width, height) => this.host.resizeCanvas(width, height),
            };
        }
        labelContext() {
            return {
                fabric: this.host.fabric,
                canvas: this.host.requireCanvas('synchronize mask labels'),
                options: this.factoryOptions,
            };
        }
        serializeMask(object) {
            if (!isMaskObject(object))
                throw new CoreRuntimeError('[ImageEditor] Mask serializer received a non-mask.');
            const serializedMask = object;
            return Object.freeze({
                object: object.toObject(MASK_SERIALIZED_OBJECT_PROPERTIES),
                maskId: object.maskId,
                maskUid: object.maskUid,
                maskName: object.maskName,
                originalAlpha: object.originalAlpha,
                originalStroke: object.originalStroke,
                originalStrokeWidth: object.originalStrokeWidth,
                overlayPersistentId: serializedMask.overlayPersistentId,
                overlayMetadata: serializedMask.overlayMetadata,
            });
        }
        async deserializeMask(data, fabricModule) {
            if (!isSerializedMaskData(data)) {
                throw new CoreRuntimeError('[ImageEditor] Serialized Mask data is malformed.');
            }
            const objects = await fabricModule.util.enlivenObjects([
                data.object,
            ]);
            const object = objects[0];
            if (!object)
                throw new CoreRuntimeError('[ImageEditor] Fabric did not restore a Mask object.');
            const mask = object;
            mask.editorObjectKind = 'mask';
            mask.maskId = data.maskId;
            mask.maskUid = data.maskUid;
            mask.maskName = data.maskName;
            mask.originalAlpha = data.originalAlpha;
            mask.originalStroke = data.originalStroke;
            mask.originalStrokeWidth = data.originalStrokeWidth;
            const serializedMask = mask;
            serializedMask.overlayPersistentId = data.overlayPersistentId;
            serializedMask.overlayMetadata = data.overlayMetadata;
            mask.lockRotation = !this.options.rotatable;
            reattachMaskHoverHandlers(mask);
            return mask;
        }
        synchronizeSelection() {
            if (!this.attached || this.disposed)
                return;
            const masks = this.getAll();
            for (const mask of masks) {
                applyMaskUnselectedStyle(mask);
                removeLabelForMask(this.labelContext(), mask);
            }
            const selection = this.overlay.getSelection();
            if (selection.ids.length !== 1)
                return;
            const selected = this.overlay.getByPersistentId(selection.ids[0]);
            if (!selected || !isMaskObject(selected))
                return;
            applyMaskSelectedStyle(selected);
            showLabelForMask(this.labelContext(), selected);
        }
        syncLabels() {
            if (!this.attached || this.disposed)
                return;
            for (const mask of this.getAll()) {
                if (mask.labelObject)
                    syncMaskLabel(this.labelContext(), mask);
            }
        }
        captureSelectionBeforeGeometry() {
            const selection = this.overlay.getSelection();
            if (selection.ids.length !== 1) {
                this.selectedMaskBeforeGeometry = null;
                return;
            }
            const selected = this.overlay.getByPersistentId(selection.ids[0]);
            this.selectedMaskBeforeGeometry =
                selected && isMaskObject(selected) ? selected.maskUid : null;
        }
        synchronizeAfterGeometry() {
            this.syncLabels();
            const selectedId = this.selectedMaskBeforeGeometry;
            this.selectedMaskBeforeGeometry = null;
            if (!selectedId || this.options.label === false)
                return;
            const selected = this.overlay.getByPersistentId(selectedId);
            if (!selected || !isMaskObject(selected))
                return;
            showLabelForMask(this.labelContext(), selected);
            syncMaskLabel(this.labelContext(), selected);
        }
        removeLabels() {
            const canvas = this.host.getCanvas();
            if (!canvas)
                return;
            hideAllMaskLabels({
                fabric: this.host.fabric,
                canvas,
                options: this.factoryOptions,
            });
        }
        reattachRuntimeState() {
            if (!this.attached)
                return;
            for (const mask of this.getAll())
                reattachMaskHoverHandlers(mask);
            this.synchronizeSelection();
        }
        synchronizeCounterFromCanvas() {
            const canvas = this.host.getCanvas();
            if (!canvas)
                return;
            for (const object of canvas.getObjects()) {
                if (isMaskObject(object))
                    this.counter = Math.max(this.counter, object.maskId);
            }
        }
        removeMaskObject(mask) {
            var _a, _b;
            removeLabelForMask(this.labelContext(), mask);
            detachMaskHoverHandlers(mask);
            const canvas = this.host.requireCanvas('remove a mask');
            const canvasWithSelection = canvas;
            const activeObjects = typeof canvasWithSelection.getActiveObjects === 'function'
                ? canvasWithSelection.getActiveObjects()
                : [(_a = canvasWithSelection.getActiveObject) === null || _a === void 0 ? void 0 : _a.call(canvasWithSelection)].filter((object) => !!object);
            if (activeObjects.includes(mask))
                canvas.discardActiveObject();
            canvas.remove(mask);
            if (this.lastMask === mask) {
                const masks = this.getAll();
                this.lastMask = (_b = masks[masks.length - 1]) !== null && _b !== void 0 ? _b : null;
            }
            this.host.requestRender();
        }
        notifyChange() {
            var _a, _b;
            try {
                (_b = (_a = this.options).onChange) === null || _b === void 0 ? void 0 : _b.call(_a, this.getAll());
            }
            catch (error) {
                this.host.reportWarning(error, 'Mask onChange callback failed.');
            }
        }
        assertActive(operation) {
            if (this.disposed)
                throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} after disposal.`);
        }
    }

    const maskPluginRef = definePluginRef('plugin:mask', '1.0.0');
    function maskPlugin(options = {}) {
        const resolved = resolveMaskPluginOptions(options);
        let controller = null;
        return definePlugin({
            ref: maskPluginRef,
            manifest: {
                id: maskPluginRef.id,
                version: '1.0.0',
                apiVersion: maskPluginRef.apiVersion,
                engine: '^3.0.0',
                requiresPlugins: [overlayFoundationRef],
                requires: [
                    { token: CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
                    { token: CORE_PRESENTATION_CAPABILITY, range: '^1.0.0' },
                    { token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                    { token: CANVAS_READ_CAPABILITY, range: '^1.0.0' },
                    { token: RENDER_REQUEST_CAPABILITY, range: '^1.0.0' },
                    { token: CANVAS_RESIZE_CAPABILITY, range: '^1.0.0' },
                    { token: SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' },
                    { token: OVERLAY_CAPABILITY, range: '^1.0.0' },
                    { token: OVERLAY_REGISTRATION_CAPABILITY, range: '^1.0.0' },
                ],
                permissions: ['fabric:objects', 'fabric:canvas-read', 'fabric:custom-class'],
            },
            setupMode: 'sync',
            setup(context) {
                const diagnostics = context.capabilities.require(CORE_DIAGNOSTICS_CAPABILITY);
                const presentation = context.capabilities.require(CORE_PRESENTATION_CAPABILITY);
                const fabricRuntime = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY);
                const canvas = context.capabilities.require(CANVAS_READ_CAPABILITY);
                const render = context.capabilities.require(RENDER_REQUEST_CAPABILITY);
                const resize = context.capabilities.require(CANVAS_RESIZE_CAPABILITY);
                const state = context.capabilities.require(SNAPSHOT_REGISTRATION_CAPABILITY);
                const overlay = context.capabilities.require(OVERLAY_CAPABILITY);
                const overlayRegistration = context.capabilities.require(OVERLAY_REGISTRATION_CAPABILITY);
                const host = Object.freeze({
                    ...diagnostics,
                    ...presentation,
                    ...fabricRuntime,
                    ...canvas,
                    ...render,
                    ...resize,
                });
                for (const operationId of ['mask:create', 'mask:remove', 'mask:remove-all']) {
                    context.operations.register({
                        id: operationId,
                        mode: 'mutation',
                        conflictDomains: ['document', 'overlay', 'selection', 'state'],
                        reentrancy: 'reject',
                    });
                }
                controller = new MaskPluginController(host, state, Object.freeze({ ...overlay, ...overlayRegistration }), resolved);
                return controller;
            },
            onInit() {
                controller === null || controller === void 0 ? void 0 : controller.attach();
            },
            onImageCleared() {
                controller === null || controller === void 0 ? void 0 : controller.resetForImage();
            },
            onDispose() {
                controller === null || controller === void 0 ? void 0 : controller.dispose();
                controller = null;
            },
        });
    }

    class FilterDefinitionError extends TypeError {
        constructor(message, path = '$') {
            super(`[ImageEditor] ${message}`);
            Object.defineProperty(this, "path", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: path
            });
            Object.defineProperty(this, "code", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'FILTER_DEFINITION_INVALID'
            });
            this.name = 'FilterDefinitionError';
        }
    }
    class FiltersPreviewMissingError extends Error {
        constructor() {
            super('[ImageEditor] Cannot commit Filters without definitions or an active preview.');
            Object.defineProperty(this, "code", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'FILTERS_PREVIEW_MISSING'
            });
            this.name = 'FiltersPreviewMissingError';
        }
    }
    class FiltersPluginDisposedError extends Error {
        constructor(operation) {
            super(`[ImageEditor] Cannot ${operation} after Filters Plugin disposal.`);
            Object.defineProperty(this, "code", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'FILTERS_PLUGIN_DISPOSED'
            });
            this.name = 'FiltersPluginDisposedError';
        }
    }
    class FilterImplementationError extends Error {
        constructor(filterType, cause) {
            super(`[ImageEditor] Fabric cannot apply the "${filterType}" Filter.`);
            Object.defineProperty(this, "code", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'FILTER_IMPLEMENTATION_UNAVAILABLE'
            });
            Object.defineProperty(this, "cause", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: void 0
            });
            this.name = 'FilterImplementationError';
            this.cause = cause;
        }
    }
    class FilterBakeValidationError extends Error {
        constructor(message, cause) {
            super(`[ImageEditor] ${message}`);
            Object.defineProperty(this, "code", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'FILTER_BAKE_INVALID'
            });
            Object.defineProperty(this, "cause", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: void 0
            });
            this.name = 'FilterBakeValidationError';
            this.cause = cause;
        }
    }

    const MAX_SUPPORTED_FILTER_COUNT = 8;
    const SUPPORTED_FILTER_TYPES = Object.freeze([
        'brightness',
        'contrast',
        'saturation',
        'grayscale',
        'sepia',
        'vintage',
        'blur',
        'sharpen',
    ]);
    const dangerousKeys = new Set(['__proto__', 'constructor', 'prototype']);
    const numericRanges = Object.freeze({
        brightness: [-1, 1],
        contrast: [-1, 1],
        saturation: [-1, 1],
        blur: [0, 1],
        sharpen: [0, 1],
    });
    function isRecord$7(value) {
        if (typeof value !== 'object' || value === null || Array.isArray(value))
            return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }
    function validateKeys(value, allowed, path) {
        for (const key of Reflect.ownKeys(value)) {
            if (typeof key !== 'string') {
                throw new FilterDefinitionError('Filter definition contains an unsupported symbol key.', path);
            }
            if (dangerousKeys.has(key)) {
                throw new FilterDefinitionError(`Filter definition contains dangerous key "${key}".`, path);
            }
            if (!allowed.includes(key)) {
                throw new FilterDefinitionError(`Filter definition contains unknown key "${key}".`, path);
            }
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor || !('value' in descriptor)) {
                throw new FilterDefinitionError(`Filter definition property "${key}" must be a data property.`, path);
            }
        }
    }
    function normalizeMaxFilterCount(value) {
        const maxFilterCount = value !== null && value !== void 0 ? value : MAX_SUPPORTED_FILTER_COUNT;
        if (!Number.isSafeInteger(maxFilterCount) ||
            maxFilterCount < 1 ||
            maxFilterCount > MAX_SUPPORTED_FILTER_COUNT) {
            throw new FilterDefinitionError(`maxFilterCount must be an integer from 1 to ${MAX_SUPPORTED_FILTER_COUNT}.`, '$.maxFilterCount');
        }
        return maxFilterCount;
    }
    function normalizeDefinition(value, index) {
        const path = `$[${index}]`;
        if (!isRecord$7(value)) {
            throw new FilterDefinitionError('Each Filter definition must be a plain object.', path);
        }
        validateKeys(value, ['type', 'value'], path);
        const type = value.type;
        if (typeof type !== 'string' || !SUPPORTED_FILTER_TYPES.includes(type)) {
            throw new FilterDefinitionError(`Unknown Filter type "${String(type)}".`, `${path}.type`);
        }
        if (type === 'grayscale' || type === 'sepia' || type === 'vintage') {
            validateKeys(value, ['type'], path);
            return Object.freeze({ type });
        }
        if (typeof value.value !== 'number' || !Number.isFinite(value.value)) {
            throw new FilterDefinitionError('Filter value must be finite.', `${path}.value`);
        }
        const numericType = type;
        const [minimum, maximum] = numericRanges[numericType];
        if (value.value < minimum || value.value > maximum) {
            throw new FilterDefinitionError(`${type} value must be within [${minimum}, ${maximum}].`, `${path}.value`);
        }
        if (value.value === 0)
            return null;
        return Object.freeze({ type: numericType, value: value.value });
    }
    function normalizeFilterDefinitions(value, limits = {}) {
        if (!Array.isArray(value)) {
            throw new FilterDefinitionError('Filter definitions must be an array.');
        }
        const maxFilterCount = normalizeMaxFilterCount(limits.maxFilterCount);
        if (value.length > maxFilterCount) {
            throw new FilterDefinitionError(`Filter count exceeds ${maxFilterCount}.`);
        }
        const definitionByType = new Map();
        const seenTypes = new Set();
        for (let index = 0; index < value.length; index += 1) {
            const definition = normalizeDefinition(value[index], index);
            const type = value[index].type;
            if (seenTypes.has(type)) {
                throw new FilterDefinitionError(`Duplicate Filter type "${type}" is not supported.`, `$[${index}].type`);
            }
            seenTypes.add(type);
            if (definition)
                definitionByType.set(definition.type, definition);
        }
        return Object.freeze(SUPPORTED_FILTER_TYPES.flatMap((type) => {
            const definition = definitionByType.get(type);
            return definition ? [definition] : [];
        }));
    }
    function areFilterDefinitionsEqual(left, right) {
        if (left.length !== right.length)
            return false;
        return left.every((definition, index) => {
            const candidate = right[index];
            if (!candidate || definition.type !== candidate.type)
                return false;
            return (!('value' in definition) ||
                ('value' in candidate && definition.value === candidate.value));
        });
    }

    function getFilterRegistry(fabric) {
        var _a;
        return (_a = fabric.filters) !== null && _a !== void 0 ? _a : {};
    }
    function createFilter(registry, definition) {
        let constructorName;
        let options;
        switch (definition.type) {
            case 'brightness':
                constructorName = 'Brightness';
                options = { brightness: definition.value };
                break;
            case 'contrast':
                constructorName = 'Contrast';
                options = { contrast: definition.value };
                break;
            case 'saturation':
                constructorName = 'Saturation';
                options = { saturation: definition.value };
                break;
            case 'grayscale':
                constructorName = 'Grayscale';
                break;
            case 'sepia':
                constructorName = 'Sepia';
                break;
            case 'vintage':
                constructorName = 'Vintage';
                break;
            case 'blur':
                constructorName = 'Blur';
                options = { blur: definition.value };
                break;
            case 'sharpen': {
                constructorName = 'Convolute';
                const strength = definition.value;
                options = {
                    matrix: [0, -strength, 0, -strength, 1 + 4 * strength, -strength, 0, -strength, 0],
                };
                break;
            }
        }
        const FilterConstructor = registry[constructorName];
        if (!FilterConstructor)
            throw new FilterImplementationError(definition.type);
        try {
            return new FilterConstructor(options);
        }
        catch (error) {
            throw new FilterImplementationError(definition.type, error);
        }
    }
    function createFabricFilters(fabric, definitions) {
        const registry = getFilterRegistry(fabric);
        return definitions.map((definition) => createFilter(registry, definition));
    }
    function applyFilterDefinitions(fabric, image, definitions) {
        var _a, _b;
        image.filters = [...createFabricFilters(fabric, definitions)];
        try {
            image.applyFilters();
            image.dirty = true;
        }
        catch (error) {
            const type = (_b = (_a = definitions[definitions.length - 1]) === null || _a === void 0 ? void 0 : _a.type) !== null && _b !== void 0 ? _b : 'brightness';
            image.filters = [];
            throw new FilterImplementationError(type, error);
        }
    }

    function abortError$1(message) {
        return new DOMException(message, 'AbortError');
    }
    function throwIfAborted(signal) {
        var _a;
        if (signal.aborted)
            throw (_a = signal.reason) !== null && _a !== void 0 ? _a : abortError$1('Filter rendering was aborted.');
    }
    function disposeFabricImage(image) {
        if (!image)
            return;
        image.dispose();
    }
    function copyBaseImagePresentation(source, target, options = {}) {
        var _a;
        target.set({
            left: source.left,
            top: source.top,
            scaleX: source.scaleX,
            scaleY: source.scaleY,
            angle: source.angle,
            skewX: source.skewX,
            skewY: source.skewY,
            flipX: source.flipX,
            flipY: source.flipY,
            originX: source.originX,
            originY: source.originY,
            opacity: source.opacity,
            visible: source.visible,
            selectable: options.transient ? false : source.selectable,
            evented: options.transient ? false : source.evented,
            hasControls: options.transient ? false : source.hasControls,
            hoverCursor: source.hoverCursor,
            excludeFromExport: source.excludeFromExport,
            backgroundColor: (_a = options.backgroundColor) !== null && _a !== void 0 ? _a : source.backgroundColor,
        });
        target.setCoords();
    }
    async function createFilteredImageClone(fabric, baseImage, definitions, signal, backgroundColor) {
        throwIfAborted(signal);
        const clone = await baseImage.clone();
        try {
            throwIfAborted(signal);
            applyFilterDefinitions(fabric, clone, definitions);
            copyBaseImagePresentation(baseImage, clone, { backgroundColor, transient: true });
            throwIfAborted(signal);
            return clone;
        }
        catch (error) {
            disposeFabricImage(clone);
            throw error;
        }
    }
    function normalizeFilterBakeOptions(options, sourceMimeType) {
        var _a;
        if (options !== undefined && (typeof options !== 'object' || options === null)) {
            throw new FilterBakeValidationError('Filter bake options must be an object.');
        }
        const record = (options !== null && options !== void 0 ? options : {});
        for (const key of Object.keys(record)) {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                throw new FilterBakeValidationError(`Filter bake options contain dangerous key "${key}".`);
            }
            if (key !== 'format' && key !== 'quality') {
                throw new FilterBakeValidationError(`Filter bake options contain unknown key "${key}".`);
            }
        }
        const sourceFormat = sourceMimeType === 'image/jpeg' ? 'jpeg' : sourceMimeType === 'image/webp' ? 'webp' : 'png';
        const format = (_a = record.format) !== null && _a !== void 0 ? _a : sourceFormat;
        if (format !== 'png' && format !== 'jpeg' && format !== 'webp') {
            throw new FilterBakeValidationError('Filter bake format must be png, jpeg, or webp.');
        }
        const quality = record.quality;
        if (quality !== undefined && (typeof quality !== 'number' || !Number.isFinite(quality))) {
            throw new FilterBakeValidationError('Filter bake quality must be finite.');
        }
        if (typeof quality === 'number' && (quality < 0 || quality > 1)) {
            throw new FilterBakeValidationError('Filter bake quality must be within [0, 1].');
        }
        return Object.freeze({
            format,
            quality: quality,
            mimeType: format === 'jpeg' ? 'image/jpeg' : `image/${format}`,
        });
    }
    function encodedBytes$2(dataUrl) {
        const commaIndex = dataUrl.indexOf(',');
        if (commaIndex < 0 || !/;base64$/i.test(dataUrl.slice(0, commaIndex))) {
            throw new FilterBakeValidationError('Filtered Raster output is not a base64 Data URL.');
        }
        const payload = dataUrl.slice(commaIndex + 1);
        const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
        return Math.floor((payload.length * 3) / 4) - padding;
    }
    async function decodeBakedImage(fabric, dataUrl, timeoutMs, signal) {
        var _a;
        const controller = new AbortController();
        const abort = () => controller.abort(signal.reason);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted)
            abort();
        const timeout = setTimeout(() => controller.abort(new FilterBakeValidationError('Filtered Raster decode timed out.')), timeoutMs);
        try {
            return await fabric.FabricImage.fromURL(dataUrl, {
                crossOrigin: 'anonymous',
                signal: controller.signal,
            });
        }
        catch (error) {
            if (controller.signal.aborted)
                throw (_a = controller.signal.reason) !== null && _a !== void 0 ? _a : error;
            throw new FilterBakeValidationError('Filtered Raster decode failed.', error);
        }
        finally {
            clearTimeout(timeout);
            signal.removeEventListener('abort', abort);
        }
    }
    async function renderBakedImage(fabric, baseImage, definitions, options, imageInfo, policy, signal) {
        var _a;
        const normalizedOptions = normalizeFilterBakeOptions(options, (_a = imageInfo === null || imageInfo === void 0 ? void 0 : imageInfo.mimeType) !== null && _a !== void 0 ? _a : null);
        const width = Number(baseImage.width);
        const height = Number(baseImage.height);
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            throw new FilterBakeValidationError('Base Image dimensions are invalid.');
        }
        if (width > policy.maxExportDimension ||
            height > policy.maxExportDimension ||
            width * height > Math.min(policy.maxInputPixels, policy.maxExportPixels)) {
            throw new FilterBakeValidationError('Filtered Raster dimensions exceed the Core policy.');
        }
        const clone = await createFilteredImageClone(fabric, baseImage, definitions, signal);
        let replacement = null;
        try {
            throwIfAborted(signal);
            const dataUrl = clone.toDataURL({
                format: normalizedOptions.format,
                quality: normalizedOptions.quality,
                multiplier: 1,
                withoutTransform: true,
                withoutShadow: true,
                enableRetinaScaling: false,
            });
            if (encodedBytes$2(dataUrl) > policy.maxInputBytes) {
                throw new FilterBakeValidationError('Filtered Raster exceeds the Core input budget.');
            }
            replacement = await decodeBakedImage(fabric, dataUrl, policy.imageLoadTimeoutMs, signal);
            throwIfAborted(signal);
            if (replacement.width !== width || replacement.height !== height) {
                throw new FilterBakeValidationError('Filtered Raster dimensions changed during decode.');
            }
            copyBaseImagePresentation(baseImage, replacement);
            return Object.freeze({ image: replacement, mimeType: normalizedOptions.mimeType });
        }
        catch (error) {
            disposeFabricImage(replacement);
            throw error;
        }
        finally {
            disposeFabricImage(clone);
        }
    }

    const FILTERS_STATE_SCHEMA = 'image-editor.filters';
    const FILTERS_STATE_VERSION = 1;
    const mutationConflictDomains = [
        'document',
        'base-image',
        'geometry',
        'raster',
        'overlay',
        'state',
    ];
    function createState(definitions) {
        return Object.freeze({
            schema: FILTERS_STATE_SCHEMA,
            version: FILTERS_STATE_VERSION,
            filters: definitions,
        });
    }
    const emptyDefinitions = Object.freeze([]);
    const emptyState = createState(emptyDefinitions);
    function normalizeConfiguration$1(options) {
        var _a, _b;
        normalizeFilterDefinitions([], {
            maxFilterCount: (_a = options.maxFilterCount) !== null && _a !== void 0 ? _a : MAX_SUPPORTED_FILTER_COUNT,
        });
        return Object.freeze({
            maxFilterCount: (_b = options.maxFilterCount) !== null && _b !== void 0 ? _b : MAX_SUPPORTED_FILTER_COUNT,
        });
    }
    function isRecord$6(value) {
        if (typeof value !== 'object' || value === null || Array.isArray(value))
            return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }
    function validateStateKeys(value) {
        for (const key of Object.keys(value)) {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                return `Filters state contains dangerous key "${key}".`;
            }
            if (key !== 'schema' && key !== 'version' && key !== 'filters') {
                return `Filters state contains unknown key "${key}".`;
            }
        }
        return null;
    }
    function abortError(message) {
        return new DOMException(message, 'AbortError');
    }
    function operationAbortReason(signal, fallback) {
        var _a;
        return (_a = signal.reason) !== null && _a !== void 0 ? _a : abortError(fallback);
    }
    class FiltersController {
        constructor(host, operations, mutations, raster, options) {
            Object.defineProperty(this, "host", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: host
            });
            Object.defineProperty(this, "operations", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: operations
            });
            Object.defineProperty(this, "mutations", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: mutations
            });
            Object.defineProperty(this, "raster", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: raster
            });
            Object.defineProperty(this, "configuration", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: void 0
            });
            Object.defineProperty(this, "committedState", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: emptyState
            });
            Object.defineProperty(this, "previewDefinitions", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: null
            });
            Object.defineProperty(this, "committedVisual", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: null
            });
            Object.defineProperty(this, "committedSource", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: null
            });
            Object.defineProperty(this, "previewVisual", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: null
            });
            Object.defineProperty(this, "previewSource", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: null
            });
            Object.defineProperty(this, "transientImages", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Set()
            });
            Object.defineProperty(this, "listeners", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Set()
            });
            Object.defineProperty(this, "previewSequence", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "mutationSequence", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
            this.configuration = normalizeConfiguration$1(options);
        }
        get isPreviewing() {
            return this.previewDefinitions !== null;
        }
        getState() {
            this.assertActive('read Filter state');
            return this.committedState;
        }
        hasVisibleState() {
            this.assertActive('inspect visible Filter state');
            return this.committedState.filters.length > 0;
        }
        getConfiguration() {
            this.assertActive('read Filter configuration');
            return this.configuration;
        }
        subscribe(listener) {
            this.assertActive('subscribe to Filter status');
            if (typeof listener !== 'function') {
                throw new TypeError('[ImageEditor] Filters status listener must be a function.');
            }
            this.listeners.add(listener);
            return createDisposable(() => {
                this.listeners.delete(listener);
            });
        }
        async preview(filters) {
            this.assertActive('preview Filters');
            const requestedDefinitions = this.normalizeDefinitions(filters);
            const sequence = ++this.previewSequence;
            await this.operations.run('filters:preview', async (operationSignal) => {
                const definitions = this.normalizeDefinitions(requestedDefinitions);
                this.assertImageLoaded('preview Filters');
                const baseImage = this.host.getBaseImage();
                if (!baseImage)
                    throw new Error('[ImageEditor] Cannot preview Filters without a Base Image.');
                const candidate = definitions.length === 0
                    ? null
                    : await createFilteredImageClone(this.host.fabric, baseImage, definitions, operationSignal, this.host.backgroundColor);
                if (this.disposed || operationSignal.aborted || sequence !== this.previewSequence) {
                    disposeFabricImage(candidate);
                    throw operationAbortReason(operationSignal, 'Filter preview became stale.');
                }
                try {
                    this.installPreview(candidate, baseImage, definitions);
                }
                catch (error) {
                    disposeFabricImage(candidate);
                    throw error;
                }
            });
        }
        cancelPreview() {
            this.assertActive('cancel Filter preview');
            this.previewSequence += 1;
            return this.operations.run('filters:cancel-preview', async (signal) => {
                if (signal.aborted)
                    throw operationAbortReason(signal, 'Filter preview cancellation aborted.');
                this.cancelPreviewSession(true);
            });
        }
        async commit(filters) {
            this.assertActive('commit Filters');
            const usesPreview = filters === undefined;
            if (usesPreview && this.previewDefinitions === null) {
                throw new FiltersPreviewMissingError();
            }
            const definitions = usesPreview
                ? this.previewDefinitions
                : this.normalizeDefinitions(filters);
            if (areFilterDefinitionsEqual(definitions, this.committedState.filters)) {
                await this.cancelPreview();
                return;
            }
            if (!usesPreview) {
                this.previewSequence += 1;
                this.cancelPreviewSession(true);
            }
            const previousState = this.committedState;
            let promotePreviewAfterCommit = false;
            const transactionId = `filters:commit:${++this.mutationSequence}`;
            await this.mutations.run({
                id: transactionId,
                kind: 'plugin-state',
                operationId: 'filters:commit',
                conflictDomains: mutationConflictDomains,
                metadata: Object.freeze({ filterCount: definitions.length }),
                mutate: () => {
                    this.committedState = createState(this.normalizeDefinitions(definitions));
                    return this.committedState;
                },
                synchronize: async (result, context) => {
                    if (usesPreview &&
                        this.previewDefinitions !== null &&
                        areFilterDefinitionsEqual(this.previewDefinitions, definitions)) {
                        promotePreviewAfterCommit = true;
                        return;
                    }
                    await this.replaceCommittedVisual(definitions, context.signal);
                },
                validate: () => this.validateBaseImageInvariant(transactionId),
                describeCommit: () => Object.freeze({ filterCount: definitions.length }),
                rollback: usesPreview
                    ? () => {
                        this.committedState = previousState;
                        promotePreviewAfterCommit = false;
                    }
                    : undefined,
            });
            if (promotePreviewAfterCommit)
                this.promotePreview();
            this.emitStatus();
        }
        async clear() {
            this.assertActive('clear Filters');
            if (this.committedState.filters.length === 0) {
                await this.cancelPreview();
                return;
            }
            this.previewSequence += 1;
            this.cancelPreviewSession(true);
            const transactionId = `filters:clear:${++this.mutationSequence}`;
            await this.mutations.run({
                id: transactionId,
                kind: 'plugin-state',
                operationId: 'filters:clear',
                conflictDomains: mutationConflictDomains,
                mutate: () => {
                    this.committedState = emptyState;
                },
                synchronize: () => this.replaceCommittedVisual(emptyDefinitions),
                validate: () => this.validateBaseImageInvariant(transactionId),
                describeCommit: () => Object.freeze({ filterCount: 0 }),
            });
            this.emitStatus();
        }
        async bake(options) {
            await this.bakeIntoBase(null, options);
        }
        async bakeIntoBase(parent, options) {
            var _a, _b, _c, _d, _e, _f, _g;
            this.assertActive('bake Filters');
            normalizeFilterBakeOptions(options, (_b = (_a = this.host.getImageInfo()) === null || _a === void 0 ? void 0 : _a.mimeType) !== null && _b !== void 0 ? _b : null);
            const definitions = this.committedState.filters;
            if (definitions.length === 0) {
                if (parent) {
                    this.previewSequence += 1;
                    this.cancelPreviewSession(true);
                }
                else {
                    await this.cancelPreview();
                }
                return Object.freeze({
                    didBake: false,
                    mimeType: (_d = (_c = this.host.getImageInfo()) === null || _c === void 0 ? void 0 : _c.mimeType) !== null && _d !== void 0 ? _d : null,
                });
            }
            this.previewSequence += 1;
            this.cancelPreviewSession(true);
            const baseImage = this.host.getBaseImage();
            if (!baseImage)
                throw new Error('[ImageEditor] Cannot bake Filters without a Base Image.');
            const baseScale = this.host.getBaseImageScale();
            let replacement = null;
            let committed = false;
            const transactionId = `filters:bake:${++this.mutationSequence}`;
            let mimeType = (_f = (_e = this.host.getImageInfo()) === null || _e === void 0 ? void 0 : _e.mimeType) !== null && _f !== void 0 ? _f : null;
            try {
                await this.mutations.run({
                    id: transactionId,
                    kind: 'compound',
                    operationId: (_g = parent === null || parent === void 0 ? void 0 : parent.operationId) !== null && _g !== void 0 ? _g : 'filters:bake',
                    conflictDomains: mutationConflictDomains,
                    parent: parent !== null && parent !== void 0 ? parent : undefined,
                    metadata: Object.freeze({ filterCount: definitions.length }),
                    mutate: async (context) => {
                        const baked = await renderBakedImage(this.host.fabric, baseImage, definitions, options, this.host.getImageInfo(), this.host.getImageResourcePolicy(), context.signal);
                        replacement = baked.image;
                        mimeType = baked.mimeType;
                        this.raster.replaceBaseImage(context, baked.image, {
                            baseScale,
                            mimeType: baked.mimeType,
                        });
                        this.committedState = emptyState;
                        return baked.image;
                    },
                    synchronize: () => this.replaceCommittedVisual(emptyDefinitions),
                    validate: (image) => {
                        if (!parent && this.host.getBaseImage() !== image) {
                            throw new Error('Raster Commit did not retain the baked Base Image.');
                        }
                        if (this.committedState.filters.length !== 0) {
                            throw new Error('Raster Commit did not clear the baked Filter state.');
                        }
                        this.validateBaseImageInvariant(transactionId);
                    },
                    describeCommit: () => Object.freeze({ filterCount: definitions.length }),
                });
                committed = true;
                disposeFabricImage(baseImage);
                this.emitStatus();
                return Object.freeze({ didBake: true, mimeType });
            }
            finally {
                if (!committed && replacement && this.host.getBaseImage() !== replacement) {
                    disposeFabricImage(replacement);
                }
            }
        }
        async configure(patch) {
            this.assertActive('configure Filters');
            await this.operations.run('filters:configure', async (signal) => {
                if (signal.aborted)
                    throw operationAbortReason(signal, 'Filter configuration aborted.');
                const next = this.normalizeConfigurationPatch(patch);
                this.configuration = next;
                this.emitStatus();
            });
        }
        captureState() {
            return this.committedState;
        }
        validateState(value) {
            if (!isRecord$6(value))
                return { valid: false, message: 'Filters state must be an object.' };
            const keyFailure = validateStateKeys(value);
            if (keyFailure)
                return { valid: false, message: keyFailure };
            if (value.schema !== FILTERS_STATE_SCHEMA) {
                return {
                    valid: false,
                    message: `Filters state schema must be "${FILTERS_STATE_SCHEMA}".`,
                };
            }
            if (value.version !== FILTERS_STATE_VERSION) {
                return {
                    valid: false,
                    message: `Filters state version ${String(value.version)} is unsupported.`,
                };
            }
            try {
                return {
                    valid: true,
                    value: createState(this.normalizeDefinitions(value.filters)),
                };
            }
            catch (error) {
                return {
                    valid: false,
                    message: error instanceof Error ? error.message : 'Filters state is malformed.',
                    path: error instanceof FilterDefinitionError ? error.path : undefined,
                };
            }
        }
        async restoreState(state, context) {
            this.previewSequence += 1;
            this.cancelPreviewSession(false);
            await this.replaceCommittedVisual(state.filters, context.signal);
            this.committedState = createState(state.filters);
            this.emitStatus();
        }
        clearState() {
            this.previewSequence += 1;
            this.cancelPreviewSession(false);
            this.committedState = emptyState;
            this.disposeCommittedVisual();
            this.host.requestRender();
            this.emitStatus();
        }
        ownsTransient(object) {
            return this.transientImages.has(object);
        }
        renderExport(canvas, options) {
            if (this.committedState.filters.length === 0)
                return;
            const baseImage = canvas
                .getObjects()
                .find((object) => object instanceof this.host.fabric.FabricImage);
            if (!baseImage)
                throw new Error('[ImageEditor] Filters export requires a Base Image.');
            applyFilterDefinitions(this.host.fabric, baseImage, this.committedState.filters);
        }
        async synchronizeAfterCommittedMutation() {
            if (this.disposed)
                return;
            const baseImage = this.host.getBaseImage();
            if (!baseImage) {
                this.clearForImage();
                return;
            }
            const committedVisualIsCurrent = this.committedState.filters.length === 0
                ? this.committedVisual === null
                : this.committedVisual !== null && this.committedSource === baseImage;
            const previewVisualIsCurrent = this.previewDefinitions === null || this.previewDefinitions.length === 0
                ? this.previewVisual === null
                : this.previewVisual !== null && this.previewSource === baseImage;
            if (committedVisualIsCurrent && previewVisualIsCurrent) {
                if (this.committedVisual) {
                    copyBaseImagePresentation(baseImage, this.committedVisual, {
                        backgroundColor: this.host.backgroundColor,
                        transient: true,
                    });
                }
                if (this.previewVisual) {
                    copyBaseImagePresentation(baseImage, this.previewVisual, {
                        backgroundColor: this.host.backgroundColor,
                        transient: true,
                    });
                }
                this.host.requestRender();
                return;
            }
            this.previewSequence += 1;
            this.cancelPreviewSession(true);
            await this.replaceCommittedVisual(this.committedState.filters);
        }
        clearForImage() {
            if (this.disposed)
                return;
            this.previewSequence += 1;
            this.previewDefinitions = null;
            this.disposePreviewVisual();
            this.disposeCommittedVisual();
            this.committedState = emptyState;
            this.host.requestRender();
            this.emitStatus();
        }
        dispose() {
            if (this.disposed)
                return;
            this.previewSequence += 1;
            this.previewDefinitions = null;
            this.disposePreviewVisual();
            this.disposeCommittedVisual();
            this.listeners.clear();
            this.disposed = true;
        }
        normalizeDefinitions(value) {
            return normalizeFilterDefinitions(value, {
                maxFilterCount: this.configuration.maxFilterCount,
            });
        }
        normalizeConfigurationPatch(patch) {
            var _a, _b, _c;
            if (!isRecord$6(patch)) {
                throw new TypeError('[ImageEditor] Filters configuration patch must be a plain object.');
            }
            for (const key of Object.keys(patch)) {
                if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                    throw new TypeError(`[ImageEditor] Filters configuration contains dangerous key "${key}".`);
                }
                if (key !== 'maxFilterCount') {
                    throw new TypeError(`[ImageEditor] Filters configuration contains unknown key "${key}".`);
                }
            }
            const maxFilterCount = (_a = patch.maxFilterCount) !== null && _a !== void 0 ? _a : this.configuration.maxFilterCount;
            normalizeFilterDefinitions([], { maxFilterCount });
            const requiredCount = Math.max(this.committedState.filters.length, (_c = (_b = this.previewDefinitions) === null || _b === void 0 ? void 0 : _b.length) !== null && _c !== void 0 ? _c : 0);
            if (maxFilterCount < requiredCount) {
                throw new TypeError(`[ImageEditor] maxFilterCount cannot be lower than the active Filter count ${requiredCount}.`);
            }
            return Object.freeze({ maxFilterCount });
        }
        installPreview(candidate, source, definitions) {
            if (candidate)
                this.attachVisual(candidate, source);
            this.detachVisual(this.committedVisual);
            const previous = this.previewVisual;
            this.previewVisual = candidate;
            this.previewSource = candidate ? source : null;
            this.previewDefinitions = definitions;
            if (candidate)
                this.transientImages.add(candidate);
            this.disposeDetachedVisual(previous);
            this.host.requestRender();
            this.emitStatus();
        }
        cancelPreviewSession(emit) {
            if (this.previewDefinitions === null && this.previewVisual === null)
                return false;
            this.previewDefinitions = null;
            this.disposePreviewVisual();
            const baseImage = this.host.getBaseImage();
            if (this.committedVisual && baseImage)
                this.attachVisual(this.committedVisual, baseImage);
            this.host.requestRender();
            if (emit)
                this.emitStatus();
            return true;
        }
        promotePreview() {
            this.disposeCommittedVisual();
            this.committedVisual = this.previewVisual;
            this.committedSource = this.previewSource;
            this.previewVisual = null;
            this.previewSource = null;
            this.previewDefinitions = null;
            this.host.requestRender();
        }
        async replaceCommittedVisual(definitions, signal = new AbortController().signal) {
            const baseImage = this.host.getBaseImage();
            const candidate = definitions.length === 0 || !baseImage
                ? null
                : await createFilteredImageClone(this.host.fabric, baseImage, definitions, signal, this.host.backgroundColor);
            if (signal.aborted) {
                disposeFabricImage(candidate);
                throw operationAbortReason(signal, 'Filter synchronization aborted.');
            }
            try {
                if (candidate && baseImage)
                    this.attachVisual(candidate, baseImage);
            }
            catch (error) {
                disposeFabricImage(candidate);
                throw error;
            }
            const previous = this.committedVisual;
            this.committedVisual = candidate;
            this.committedSource = candidate ? baseImage : null;
            if (candidate)
                this.transientImages.add(candidate);
            this.disposeDetachedVisual(previous);
            this.host.requestRender();
        }
        attachVisual(image, baseImage) {
            const canvas = this.host.requireCanvas('render Filters');
            copyBaseImagePresentation(baseImage, image, {
                backgroundColor: this.host.backgroundColor,
                transient: true,
            });
            if (!canvas.getObjects().includes(image))
                canvas.add(image);
            const baseIndex = canvas.getObjects().indexOf(baseImage);
            canvas.moveObjectTo(image, Math.max(0, baseIndex + 1));
        }
        detachVisual(image) {
            const canvas = this.host.getCanvas();
            if (image && (canvas === null || canvas === void 0 ? void 0 : canvas.getObjects().includes(image)))
                canvas.remove(image);
        }
        disposeDetachedVisual(image) {
            if (!image)
                return;
            this.detachVisual(image);
            this.transientImages.delete(image);
            disposeFabricImage(image);
        }
        disposePreviewVisual() {
            this.disposeDetachedVisual(this.previewVisual);
            this.previewVisual = null;
            this.previewSource = null;
        }
        disposeCommittedVisual() {
            this.disposeDetachedVisual(this.committedVisual);
            this.committedVisual = null;
            this.committedSource = null;
        }
        validateBaseImageInvariant(transactionId) {
            const canvas = this.host.requireCanvas('validate Filters');
            const baseImage = this.host.getBaseImage();
            const baseImages = canvas
                .getObjects()
                .filter((object) => object
                .editorObjectKind === 'baseImage');
            if (!baseImage || baseImages.length !== 1 || baseImages[0] !== baseImage) {
                throw new Error(`Filters transaction "${transactionId}" violated the Base Image invariant.`);
            }
        }
        status() {
            var _a, _b;
            return Object.freeze({
                isPreviewing: this.isPreviewing,
                committedFilterCount: this.committedState.filters.length,
                previewFilterCount: (_b = (_a = this.previewDefinitions) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0,
                configuration: this.configuration,
            });
        }
        emitStatus() {
            if (this.disposed || this.listeners.size === 0)
                return;
            const status = this.status();
            for (const listener of [...this.listeners]) {
                try {
                    listener(status);
                }
                catch (error) {
                    this.host.reportWarning(error, 'A Filters status listener failed.');
                }
            }
        }
        assertImageLoaded(operation) {
            if (!this.host.isImageLoaded()) {
                throw new Error(`[ImageEditor] Cannot ${operation} without a loaded image.`);
            }
        }
        assertActive(operation) {
            if (this.disposed || this.host.isDisposed()) {
                throw new FiltersPluginDisposedError(operation);
            }
        }
    }

    const filtersPluginRef = definePluginRef('plugin:filters', '1.0.0');
    function filtersPlugin(options = {}) {
        let controller = null;
        return definePlugin({
            ref: filtersPluginRef,
            manifest: {
                id: filtersPluginRef.id,
                version: '1.0.0',
                apiVersion: filtersPluginRef.apiVersion,
                engine: '^3.0.0',
                requires: [
                    { token: CORE_STATUS_CAPABILITY, range: '^1.0.0' },
                    { token: CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
                    { token: CORE_PRESENTATION_CAPABILITY, range: '^1.0.0' },
                    { token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                    { token: CANVAS_READ_CAPABILITY, range: '^1.0.0' },
                    { token: BASE_IMAGE_READ_CAPABILITY, range: '^1.0.0' },
                    { token: IMAGE_RESOURCE_POLICY_CAPABILITY, range: '^1.0.0' },
                    { token: RENDER_REQUEST_CAPABILITY, range: '^1.0.0' },
                    { token: RASTER_MUTATION_CAPABILITY, range: '^1.0.0' },
                    { token: SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' },
                    { token: DOCUMENT_MUTATION_CAPABILITY, range: '^1.0.0' },
                    { token: EXPORT_CONTRIBUTION_CAPABILITY, range: '^1.0.0' },
                ],
                permissions: [
                    'fabric:objects',
                    'fabric:canvas-read',
                    'core:raster-mutation',
                    'core:export-contributor',
                ],
            },
            setupMode: 'sync',
            setup(context) {
                const status = context.capabilities.require(CORE_STATUS_CAPABILITY);
                const diagnostics = context.capabilities.require(CORE_DIAGNOSTICS_CAPABILITY);
                const presentation = context.capabilities.require(CORE_PRESENTATION_CAPABILITY);
                const fabricRuntime = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY);
                const canvas = context.capabilities.require(CANVAS_READ_CAPABILITY);
                const baseImage = context.capabilities.require(BASE_IMAGE_READ_CAPABILITY);
                const resourcePolicy = context.capabilities.require(IMAGE_RESOURCE_POLICY_CAPABILITY);
                const render = context.capabilities.require(RENDER_REQUEST_CAPABILITY);
                const raster = context.capabilities.require(RASTER_MUTATION_CAPABILITY);
                const snapshots = context.capabilities.require(SNAPSHOT_REGISTRATION_CAPABILITY);
                const mutations = context.capabilities.require(DOCUMENT_MUTATION_CAPABILITY);
                const exports = context.capabilities.require(EXPORT_CONTRIBUTION_CAPABILITY);
                for (const definition of [
                    {
                        id: 'filters:preview',
                        mode: 'busy',
                        conflictDomains: ['base-image', 'export', 'state'],
                        reentrancy: 'replace',
                    },
                    {
                        id: 'filters:cancel-preview',
                        mode: 'busy',
                        conflictDomains: ['state'],
                        reentrancy: 'replace',
                    },
                    {
                        id: 'filters:commit',
                        mode: 'mutation',
                        conflictDomains: [
                            'document',
                            'base-image',
                            'geometry',
                            'raster',
                            'overlay',
                            'state',
                        ],
                        reentrancy: 'queue',
                    },
                    {
                        id: 'filters:clear',
                        mode: 'mutation',
                        conflictDomains: [
                            'document',
                            'base-image',
                            'geometry',
                            'raster',
                            'overlay',
                            'state',
                        ],
                        reentrancy: 'queue',
                    },
                    {
                        id: 'filters:bake',
                        mode: 'mutation',
                        conflictDomains: [
                            'document',
                            'base-image',
                            'geometry',
                            'raster',
                            'overlay',
                            'state',
                        ],
                        reentrancy: 'queue',
                    },
                    {
                        id: 'filters:configure',
                        mode: 'mutation',
                        conflictDomains: ['state'],
                        reentrancy: 'queue',
                    },
                ]) {
                    context.disposables.add(context.operations.register(definition));
                }
                controller = new FiltersController(Object.freeze({
                    ...status,
                    ...diagnostics,
                    ...presentation,
                    ...fabricRuntime,
                    ...canvas,
                    ...baseImage,
                    ...resourcePolicy,
                    ...render,
                }), Object.freeze({
                    run: (operationId, task) => context.operations.run(operationId, undefined, (args, operationContext) => {
                        return task(operationContext.signal);
                    }),
                }), mutations, raster, options);
                const requireController = () => {
                    if (!controller)
                        throw new Error('Filters Plugin is not installed.');
                    return controller;
                };
                const visibleRasterBake = Object.freeze({
                    hasVisibleState: () => requireController().hasVisibleState(),
                    bakeIntoBase: (parent, bakeOptions) => requireController().bakeIntoBase(parent, bakeOptions),
                });
                context.capabilities.provide(VISIBLE_RASTER_BAKE_CAPABILITY, visibleRasterBake, {
                    version: VISIBLE_RASTER_BAKE_CAPABILITY.version,
                });
                context.disposables.add(snapshots.registerTransientObject(filtersPluginRef.id, (object) => { var _a; return (_a = controller === null || controller === void 0 ? void 0 : controller.ownsTransient(object)) !== null && _a !== void 0 ? _a : false; }));
                context.disposables.add(snapshots.registerSlice({
                    id: filtersPluginRef.id,
                    version: 1,
                    capturePolicy: 'always',
                    capture: () => requireController().captureState(),
                    validate: (value) => requireController().validateState(value),
                    restore: (state, restoreContext) => requireController().restoreState(state, restoreContext),
                    clearState: () => requireController().clearState(),
                }));
                context.disposables.add(exports.register(filtersPluginRef.id, {
                    id: 'filters:committed',
                    order: -100,
                    isEnabled: () => requireController().getState().filters.length > 0,
                    render: ({ canvas: targetCanvas, options: exportOptions }) => requireController().renderExport(targetCanvas, exportOptions),
                }));
                context.disposables.add(context.events.on('geometry:committed', () => controller === null || controller === void 0 ? void 0 : controller.synchronizeAfterCommittedMutation()));
                context.disposables.add(context.events.on('document:committed', (descriptor) => {
                    if (descriptor.operationId.startsWith('filters:'))
                        return;
                    return controller === null || controller === void 0 ? void 0 : controller.synchronizeAfterCommittedMutation();
                }));
                return Object.freeze({
                    get isPreviewing() {
                        return requireController().isPreviewing;
                    },
                    getState: () => requireController().getState(),
                    preview: (definitions) => requireController().preview(definitions),
                    commit: (definitions) => requireController().commit(definitions),
                    cancelPreview: () => requireController().cancelPreview(),
                    clear: () => requireController().clear(),
                    bake: (bakeOptions) => requireController().bake(bakeOptions),
                    configure: (patch) => requireController().configure(patch),
                    getConfiguration: () => requireController().getConfiguration(),
                    subscribe: (listener) => requireController().subscribe(listener),
                });
            },
            onImageCleared() {
                controller === null || controller === void 0 ? void 0 : controller.clearForImage();
            },
            onDispose() {
                controller === null || controller === void 0 ? void 0 : controller.dispose();
                controller = null;
            },
        });
    }

    class CropError extends Error {
        constructor() {
            super(...arguments);
            Object.defineProperty(this, "name", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'CropError'
            });
        }
    }
    class CropSessionError extends CropError {
        constructor() {
            super(...arguments);
            Object.defineProperty(this, "name", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'CropSessionError'
            });
        }
    }
    class CropValidationError extends CropError {
        constructor() {
            super(...arguments);
            Object.defineProperty(this, "name", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'CropValidationError'
            });
        }
    }
    class CropIntegrationError extends CropError {
        constructor() {
            super(...arguments);
            Object.defineProperty(this, "name", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'CropIntegrationError'
            });
        }
    }

    function isRecord$5(value) {
        if (typeof value !== 'object' || value === null || Array.isArray(value))
            return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }
    function assertFinitePositive(value, label) {
        if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
            throw new TypeError(`[ImageEditor] ${label} must be a finite positive number.`);
        }
        return value;
    }
    function normalizeCropAspectRatio(value) {
        if (value === undefined || value === null || value === 'free')
            return null;
        let ratio;
        if (typeof value === 'number') {
            ratio = value;
        }
        else if (typeof value === 'string') {
            const match = /^([0-9]+(?:\.[0-9]+)?):([0-9]+(?:\.[0-9]+)?)$/.exec(value);
            if (!match)
                throw new TypeError('[ImageEditor] Crop aspect ratio string is invalid.');
            ratio = Number(match[1]) / Number(match[2]);
        }
        else if (isRecord$5(value)) {
            const keys = Object.keys(value);
            if (keys.some((key) => key !== 'width' && key !== 'height')) {
                throw new TypeError('[ImageEditor] Crop aspect ratio contains unknown keys.');
            }
            ratio =
                assertFinitePositive(value.width, 'Crop aspect ratio width') /
                    assertFinitePositive(value.height, 'Crop aspect ratio height');
        }
        else {
            throw new TypeError('[ImageEditor] Crop aspect ratio is invalid.');
        }
        if (!Number.isFinite(ratio) || ratio <= 0 || ratio < 1e-6 || ratio > 1e6) {
            throw new TypeError('[ImageEditor] Crop aspect ratio must be finite and positive.');
        }
        return ratio;
    }
    function assertImageBounds(bounds) {
        if (!Number.isSafeInteger(bounds.widthPx) ||
            !Number.isSafeInteger(bounds.heightPx) ||
            bounds.widthPx <= 0 ||
            bounds.heightPx <= 0) {
            throw new TypeError('[ImageEditor] Crop image bounds are invalid.');
        }
    }
    function normalizeCropRect(value, limits) {
        assertImageBounds(limits);
        if (!Number.isSafeInteger(limits.minimumWidthPx) ||
            !Number.isSafeInteger(limits.minimumHeightPx) ||
            limits.minimumWidthPx <= 0 ||
            limits.minimumHeightPx <= 0) {
            throw new TypeError('[ImageEditor] Crop rect minimum dimensions are invalid.');
        }
        if (!isRecord$5(value))
            throw new TypeError('[ImageEditor] Crop rect must be an object.');
        const allowedKeys = new Set(['leftPx', 'topPx', 'widthPx', 'heightPx']);
        if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
            throw new TypeError('[ImageEditor] Crop rect contains unknown keys.');
        }
        const left = value.leftPx;
        const top = value.topPx;
        const width = value.widthPx;
        const height = value.heightPx;
        if (typeof left !== 'number' ||
            typeof top !== 'number' ||
            typeof width !== 'number' ||
            typeof height !== 'number' ||
            !Number.isFinite(left) ||
            !Number.isFinite(top) ||
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            left < 0 ||
            top < 0 ||
            width <= 0 ||
            height <= 0 ||
            left + width > limits.widthPx ||
            top + height > limits.heightPx) {
            throw new TypeError('[ImageEditor] Crop rect must be finite and within image bounds.');
        }
        const leftPx = Math.floor(left);
        const topPx = Math.floor(top);
        const rightPx = Math.min(limits.widthPx, Math.ceil(left + width));
        const bottomPx = Math.min(limits.heightPx, Math.ceil(top + height));
        const widthPx = rightPx - leftPx;
        const heightPx = bottomPx - topPx;
        if (widthPx < limits.minimumWidthPx || heightPx < limits.minimumHeightPx) {
            throw new TypeError('[ImageEditor] Crop rect is smaller than the configured minimum.');
        }
        return Object.freeze({ leftPx, topPx, widthPx, heightPx });
    }
    function fitCropRectToAspectRatio(rect, ratio, bounds) {
        assertImageBounds(bounds);
        const normalizedRatio = normalizeCropAspectRatio(ratio);
        if (normalizedRatio === null)
            return Object.freeze({ ...rect });
        let width = rect.widthPx;
        let height = rect.heightPx;
        if (width / height > normalizedRatio) {
            width = height * normalizedRatio;
        }
        else {
            height = width / normalizedRatio;
        }
        const centerX = rect.leftPx + rect.widthPx / 2;
        const centerY = rect.topPx + rect.heightPx / 2;
        const left = Math.max(0, Math.min(bounds.widthPx - width, centerX - width / 2));
        const top = Math.max(0, Math.min(bounds.heightPx - height, centerY - height / 2));
        return normalizeCropRect({ leftPx: left, topPx: top, widthPx: width, heightPx: height }, { ...bounds, minimumWidthPx: 1, minimumHeightPx: 1 });
    }
    function intersectCropRectangles(left, right) {
        return (left.left < right.left + right.width &&
            left.left + left.width > right.left &&
            left.top < right.top + right.height &&
            left.top + left.height > right.top);
    }

    const defaultOverlayPolicy = Object.freeze({
        preview: 'keep',
        apply: 'keep',
    });
    function isRecord$4(value) {
        if (typeof value !== 'object' || value === null || Array.isArray(value))
            return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }
    function normalizeCropOverlayPolicy(value) {
        if (value === undefined)
            return defaultOverlayPolicy;
        if (!isRecord$4(value))
            throw new CropValidationError('Crop overlay policy must be an object.');
        const allowedKeys = new Set(['preview', 'apply', 'kinds']);
        if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
            throw new CropValidationError('Crop overlay policy contains unknown keys.');
        }
        const preview = value.preview;
        const apply = value.apply;
        if (preview !== 'keep' && preview !== 'hide-participating') {
            throw new CropValidationError('Crop overlay preview policy is invalid.');
        }
        if (apply !== 'keep' && apply !== 'discard' && apply !== 'transform-intersecting') {
            throw new CropValidationError('Crop overlay apply policy is invalid.');
        }
        let kinds;
        if (value.kinds !== undefined) {
            if (!Array.isArray(value.kinds) ||
                value.kinds.length > 64 ||
                value.kinds.some((kind) => typeof kind !== 'string' ||
                    kind.length === 0 ||
                    kind.trim() !== kind ||
                    kind.length > 128)) {
                throw new CropValidationError('Crop overlay kinds are invalid.');
            }
            kinds = Object.freeze([...new Set(value.kinds)]);
        }
        return Object.freeze({ preview, apply, kinds });
    }
    function findCropOverlayCandidates(overlay, cropBounds, policy) {
        if (!overlay)
            return Object.freeze({ allIds: Object.freeze([]), intersectingIds: Object.freeze([]) });
        const objects = overlay.list({
            kinds: policy.kinds,
            includeHidden: true,
            includeLocked: true,
        });
        const allIds = [];
        const intersectingIds = [];
        for (const object of objects) {
            const classification = overlay.classify(object);
            if (!classification)
                continue;
            allIds.push(classification.persistentId);
            if (intersectCropRectangles(cropBounds, object.getBoundingRect())) {
                intersectingIds.push(classification.persistentId);
            }
        }
        return Object.freeze({
            allIds: Object.freeze(allIds),
            intersectingIds: Object.freeze(intersectingIds),
        });
    }
    async function applyCropOverlayPolicy(overlay, canvas, parent, policy, candidates, mutationId) {
        if (!overlay || policy.apply === 'keep')
            return;
        const retained = new Set(candidates.intersectingIds);
        const removeIds = policy.apply === 'discard'
            ? candidates.allIds
            : candidates.allIds.filter((id) => !retained.has(id));
        if (removeIds.length === 0)
            return;
        await overlay.mutate({
            id: `${mutationId}:overlay`,
            operationId: 'crop:apply',
            action: 'delete',
            objectIds: removeIds,
            parent,
            metadata: Object.freeze({ cropPolicy: policy.apply }),
            mutate: () => {
                for (const id of removeIds) {
                    const object = overlay.getByPersistentId(id);
                    if (object)
                        canvas.remove(object);
                }
            },
        });
    }

    function isRecord$3(value) {
        if (typeof value !== 'object' || value === null || Array.isArray(value))
            return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }
    function normalizeCropApplyOptions(value, sourceMimeType) {
        var _a;
        if (value !== undefined && !isRecord$3(value)) {
            throw new CropValidationError('Crop apply options must be an object.');
        }
        const record = (value !== null && value !== void 0 ? value : {});
        const allowedKeys = new Set(['format', 'quality', 'bakeVisibleFilters']);
        if (Object.keys(record).some((key) => !allowedKeys.has(key))) {
            throw new CropValidationError('Crop apply options contain unknown keys.');
        }
        const sourceFormat = sourceMimeType === 'image/jpeg' ? 'jpeg' : sourceMimeType === 'image/webp' ? 'webp' : 'png';
        const format = (_a = record.format) !== null && _a !== void 0 ? _a : sourceFormat;
        if (format !== 'png' && format !== 'jpeg' && format !== 'webp') {
            throw new CropValidationError('Crop output format must be png, jpeg, or webp.');
        }
        const quality = record.quality;
        if (quality !== undefined &&
            (typeof quality !== 'number' || !Number.isFinite(quality) || quality < 0 || quality > 1)) {
            throw new CropValidationError('Crop output quality must be within [0, 1].');
        }
        if (record.bakeVisibleFilters !== undefined && typeof record.bakeVisibleFilters !== 'boolean') {
            throw new CropValidationError('bakeVisibleFilters must be a boolean.');
        }
        return Object.freeze({
            format,
            quality: format === 'png' ? undefined : quality,
            mimeType: format === 'jpeg' ? 'image/jpeg' : `image/${format}`,
            bakeVisibleFilters: record.bakeVisibleFilters !== false,
        });
    }
    function encodedBytes$1(dataUrl, expectedMimeType) {
        const commaIndex = dataUrl.indexOf(',');
        if (commaIndex < 0 || !/;base64$/i.test(dataUrl.slice(0, commaIndex))) {
            throw new CropValidationError('Crop output is not a base64 Data URL.');
        }
        const mimeType = dataUrl.slice(5, dataUrl.indexOf(';'));
        if (mimeType !== expectedMimeType) {
            throw new CropValidationError(`Crop encoder returned ${mimeType || 'an unknown MIME'} instead of ${expectedMimeType}.`);
        }
        const payload = dataUrl.slice(commaIndex + 1);
        const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
        return Math.floor((payload.length * 3) / 4) - padding;
    }
    async function decodeCropImage(fabric, dataUrl, timeoutMs, signal) {
        var _a;
        const controller = new AbortController();
        const abort = () => controller.abort(signal.reason);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted)
            abort();
        const timeout = setTimeout(() => controller.abort(new CropValidationError('Crop decode timed out.')), timeoutMs);
        try {
            return await fabric.FabricImage.fromURL(dataUrl, {
                crossOrigin: 'anonymous',
                signal: controller.signal,
            });
        }
        catch (error) {
            if (controller.signal.aborted)
                throw (_a = controller.signal.reason) !== null && _a !== void 0 ? _a : error;
            throw new CropValidationError('Crop decode failed.');
        }
        finally {
            clearTimeout(timeout);
            signal.removeEventListener('abort', abort);
        }
    }
    function applyCropPresentation(source, target, rect) {
        const matrix = source.calcTransformMatrix();
        const offsetX = rect.leftPx + rect.widthPx / 2 - Number(source.width) / 2;
        const offsetY = rect.topPx + rect.heightPx / 2 - Number(source.height) / 2;
        const centerX = matrix[0] * offsetX + matrix[2] * offsetY + matrix[4];
        const centerY = matrix[1] * offsetX + matrix[3] * offsetY + matrix[5];
        target.set({
            left: centerX,
            top: centerY,
            originX: 'center',
            originY: 'center',
            scaleX: source.scaleX,
            scaleY: source.scaleY,
            angle: source.angle,
            skewX: source.skewX,
            skewY: source.skewY,
            flipX: source.flipX,
            flipY: source.flipY,
            opacity: source.opacity,
            visible: source.visible,
            selectable: false,
            evented: false,
            hasControls: false,
            hoverCursor: source.hoverCursor,
            excludeFromExport: source.excludeFromExport,
            backgroundColor: source.backgroundColor,
        });
        target.setCoords();
    }
    async function renderCropImage(host, source, rect, options, signal) {
        var _a;
        if (signal.aborted)
            throw signal.reason;
        const policy = host.getImageResourcePolicy();
        if (rect.widthPx > policy.maxExportDimension ||
            rect.heightPx > policy.maxExportDimension ||
            rect.widthPx * rect.heightPx > Math.min(policy.maxInputPixels, policy.maxExportPixels)) {
            throw new CropValidationError('Crop dimensions exceed the Core resource policy.');
        }
        const ownerDocument = (_a = source.getElement().ownerDocument) !== null && _a !== void 0 ? _a : globalThis.document;
        if (!ownerDocument)
            throw new CropValidationError('Crop rendering document is unavailable.');
        const surface = ownerDocument.createElement('canvas');
        surface.width = rect.widthPx;
        surface.height = rect.heightPx;
        const context = surface.getContext('2d');
        if (!context)
            throw new CropValidationError('Crop rendering context is unavailable.');
        context.drawImage(source.getElement(), rect.leftPx, rect.topPx, rect.widthPx, rect.heightPx, 0, 0, rect.widthPx, rect.heightPx);
        if (signal.aborted)
            throw signal.reason;
        const dataUrl = surface.toDataURL(options.mimeType, options.format === 'png' ? undefined : options.quality);
        if (encodedBytes$1(dataUrl, options.mimeType) > policy.maxInputBytes) {
            throw new CropValidationError('Crop output exceeds the Core input budget.');
        }
        const image = await decodeCropImage(host.fabric, dataUrl, policy.imageLoadTimeoutMs, signal);
        try {
            if (image.width !== rect.widthPx || image.height !== rect.heightPx) {
                throw new CropValidationError('Crop dimensions changed during decode.');
            }
            applyCropPresentation(source, image, rect);
            return Object.freeze({ image, mimeType: options.mimeType });
        }
        catch (error) {
            image.dispose();
            throw error;
        }
    }

    const EMPTY_CANDIDATES = Object.freeze({
        allIds: Object.freeze([]),
        intersectingIds: Object.freeze([]),
    });
    function positiveSafeInteger(value, fallback, label) {
        if (value === undefined)
            return fallback;
        if (!Number.isSafeInteger(value) || Number(value) <= 0) {
            throw new CropValidationError(`${label} must be a positive safe integer.`);
        }
        return Number(value);
    }
    function nonNegativeSafeInteger(value, fallback, label) {
        if (value === undefined)
            return fallback;
        if (!Number.isSafeInteger(value) || Number(value) < 0) {
            throw new CropValidationError(`${label} must be a non-negative safe integer.`);
        }
        return Number(value);
    }
    function resolveCropConfiguration(options) {
        if (typeof options !== 'object' || options === null || Array.isArray(options)) {
            throw new CropValidationError('Crop Plugin options must be an object.');
        }
        const allowedKeys = new Set(['paddingPx', 'minimumWidthPx', 'minimumHeightPx']);
        if (Object.keys(options).some((key) => !allowedKeys.has(key))) {
            throw new CropValidationError('Crop Plugin options contain unknown keys.');
        }
        return Object.freeze({
            paddingPx: nonNegativeSafeInteger(options.paddingPx, 10, 'Crop paddingPx'),
            minimumWidthPx: positiveSafeInteger(options.minimumWidthPx, 1, 'Crop minimumWidthPx'),
            minimumHeightPx: positiveSafeInteger(options.minimumHeightPx, 1, 'Crop minimumHeightPx'),
        });
    }
    function cloneSessionState$1(state) {
        return Object.freeze({
            ...state,
            rect: Object.freeze({ ...state.rect }),
            overlayPolicy: Object.freeze({
                ...state.overlayPolicy,
                kinds: state.overlayPolicy.kinds
                    ? Object.freeze([...state.overlayPolicy.kinds])
                    : undefined,
            }),
        });
    }
    function isRecord$2(value) {
        if (typeof value !== 'object' || value === null || Array.isArray(value))
            return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }
    class CropController {
        constructor(host, geometry, raster, overlay, visibleRasterBake, visibleRasterBakeStatus, configuration) {
            Object.defineProperty(this, "host", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: host
            });
            Object.defineProperty(this, "geometry", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: geometry
            });
            Object.defineProperty(this, "raster", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: raster
            });
            Object.defineProperty(this, "overlay", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: overlay
            });
            Object.defineProperty(this, "visibleRasterBake", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: visibleRasterBake
            });
            Object.defineProperty(this, "visibleRasterBakeStatus", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: visibleRasterBakeStatus
            });
            Object.defineProperty(this, "configuration", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: configuration
            });
            Object.defineProperty(this, "session", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: null
            });
            Object.defineProperty(this, "listeners", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Set()
            });
            Object.defineProperty(this, "mutationSequence", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
        }
        get isActive() {
            return this.session !== null;
        }
        getSession() {
            this.assertActive('read the Crop session');
            return this.session ? cloneSessionState$1(this.session.state) : null;
        }
        subscribe(listener) {
            this.assertActive('subscribe to Crop status');
            if (typeof listener !== 'function') {
                throw new TypeError('[ImageEditor] Crop status listener must be a function.');
            }
            this.listeners.add(listener);
            return createDisposable(() => {
                this.listeners.delete(listener);
            });
        }
        enter(options = {}) {
            var _a, _b, _c;
            this.assertActive('enter Crop');
            if (this.session)
                throw new CropSessionError('Crop is already active.');
            if (!this.host.isImageLoaded()) {
                throw new CropSessionError('Crop requires a loaded image.');
            }
            if (!isRecord$2(options))
                throw new CropValidationError('Crop enter options must be an object.');
            const allowedKeys = new Set(['rect', 'aspectRatio', 'overlayPolicy']);
            if (Object.keys(options).some((key) => !allowedKeys.has(key))) {
                throw new CropValidationError('Crop enter options contain unknown keys.');
            }
            const baseImage = this.requireBaseImage();
            const widthPx = Number(baseImage.width);
            const heightPx = Number(baseImage.height);
            if (!Number.isSafeInteger(widthPx) ||
                !Number.isSafeInteger(heightPx) ||
                widthPx <= 0 ||
                heightPx <= 0) {
                throw new CropValidationError('Base Image dimensions are invalid for Crop.');
            }
            if (this.configuration.minimumWidthPx > widthPx ||
                this.configuration.minimumHeightPx > heightPx) {
                throw new CropValidationError('Crop minimum dimensions exceed the Base Image.');
            }
            const limits = {
                widthPx,
                heightPx,
                minimumWidthPx: this.configuration.minimumWidthPx,
                minimumHeightPx: this.configuration.minimumHeightPx,
            };
            const padding = Math.min(this.configuration.paddingPx, Math.floor((widthPx - this.configuration.minimumWidthPx) / 2), Math.floor((heightPx - this.configuration.minimumHeightPx) / 2));
            const aspectRatio = normalizeCropAspectRatio(options.aspectRatio);
            let rect = normalizeCropRect((_a = options.rect) !== null && _a !== void 0 ? _a : {
                leftPx: padding,
                topPx: padding,
                widthPx: widthPx - padding * 2,
                heightPx: heightPx - padding * 2,
            }, limits);
            if (aspectRatio !== null) {
                rect = normalizeCropRect(fitCropRectToAspectRatio(rect, aspectRatio, { widthPx, heightPx }), limits);
            }
            const overlayPolicy = normalizeCropOverlayPolicy(options.overlayPolicy);
            const preview = this.createPreview(baseImage, rect);
            const canvas = this.host.requireCanvas('enter Crop');
            canvas.add(preview);
            canvas.bringObjectToFront(preview);
            const state = Object.freeze({
                rect,
                aspectRatio,
                sourceRevision: this.host.getGeometryRevision(),
                sourceWidthPx: widthPx,
                sourceHeightPx: heightPx,
                overlayPolicy,
            });
            this.session = {
                state,
                preview,
                previewVisibility: null,
                candidates: EMPTY_CANDIDATES,
                selectionIds: (_c = (_b = this.overlay) === null || _b === void 0 ? void 0 : _b.getSelection().ids) !== null && _c !== void 0 ? _c : Object.freeze([]),
            };
            this.refreshPreview(this.session);
            this.emitStatus();
        }
        updateRect(value) {
            const session = this.requireSession('update the Crop rect');
            this.assertSourceCurrent(session);
            const limits = this.limits(session);
            let rect = normalizeCropRect(value, limits);
            if (session.state.aspectRatio !== null) {
                rect = normalizeCropRect(fitCropRectToAspectRatio(rect, session.state.aspectRatio, {
                    widthPx: session.state.sourceWidthPx,
                    heightPx: session.state.sourceHeightPx,
                }), limits);
            }
            session.state = Object.freeze({ ...session.state, rect });
            this.refreshPreview(session);
            this.emitStatus();
        }
        setAspectRatio(value) {
            const session = this.requireSession('set the Crop aspect ratio');
            this.assertSourceCurrent(session);
            const aspectRatio = normalizeCropAspectRatio(value);
            let rect = session.state.rect;
            if (aspectRatio !== null) {
                rect = normalizeCropRect(fitCropRectToAspectRatio(rect, aspectRatio, {
                    widthPx: session.state.sourceWidthPx,
                    heightPx: session.state.sourceHeightPx,
                }), this.limits(session));
            }
            session.state = Object.freeze({ ...session.state, rect, aspectRatio });
            this.refreshPreview(session);
            this.emitStatus();
        }
        cancel() {
            this.assertActive('cancel Crop');
            if (!this.session)
                return;
            this.closeSession(true);
        }
        async apply(options) {
            var _a, _b;
            const session = this.requireSession('apply Crop');
            this.assertSourceCurrent(session);
            const normalizedOptions = normalizeCropApplyOptions(options, (_b = (_a = this.host.getImageInfo()) === null || _a === void 0 ? void 0 : _a.mimeType) !== null && _b !== void 0 ? _b : null);
            const rect = session.state.rect;
            const candidates = findCropOverlayCandidates(this.overlay, session.preview.getBoundingRect(), session.state.overlayPolicy);
            const state = session.state;
            const selectionIds = session.selectionIds;
            this.closeSession(true);
            const mutationId = `crop:apply:${++this.mutationSequence}`;
            const resources = { replacement: null, replacedSource: null };
            let committed = false;
            try {
                await this.geometry.run({
                    id: mutationId,
                    kind: 'crop',
                    operationId: 'crop:apply',
                    sourceRect: {
                        left: rect.leftPx,
                        top: rect.topPx,
                        width: rect.widthPx,
                        height: rect.heightPx,
                    },
                    targetSize: { width: rect.widthPx, height: rect.heightPx },
                    metadata: Object.freeze({
                        sourceRevision: state.sourceRevision,
                        overlayPolicy: state.overlayPolicy.apply,
                        bakeVisibleFilters: normalizedOptions.bakeVisibleFilters,
                    }),
                    mutateBase: async ({ transaction, signal }) => {
                        var _a;
                        if (normalizedOptions.bakeVisibleFilters &&
                            this.visibleRasterBakeStatus === 'incompatible') {
                            throw new CropIntegrationError('The installed visible-raster bake provider is incompatible.');
                        }
                        if (normalizedOptions.bakeVisibleFilters &&
                            ((_a = this.visibleRasterBake) === null || _a === void 0 ? void 0 : _a.hasVisibleState())) {
                            await this.visibleRasterBake.bakeIntoBase(transaction);
                        }
                        this.assertSourceDimensions(state);
                        const source = this.requireBaseImage();
                        const rendered = await renderCropImage(this.host, source, rect, normalizedOptions, signal);
                        resources.replacement = rendered.image;
                        resources.replacedSource = source;
                        this.raster.replaceBaseImage(transaction, rendered.image, {
                            baseScale: this.host.getBaseImageScale(),
                            mimeType: rendered.mimeType,
                        });
                        await applyCropOverlayPolicy(this.overlay, this.host.requireCanvas('apply Crop overlay policy'), transaction, state.overlayPolicy, candidates, mutationId);
                        if (this.overlay) {
                            this.overlay.select(selectionIds.filter((id) => { var _a; return ((_a = this.overlay) === null || _a === void 0 ? void 0 : _a.getByPersistentId(id)) !== null; }));
                        }
                        this.validateBaseImage(rendered.image, rect);
                    },
                });
                committed = true;
                if (resources.replacedSource && resources.replacedSource !== this.host.getBaseImage()) {
                    resources.replacedSource.dispose();
                }
            }
            finally {
                if (!committed &&
                    resources.replacement &&
                    this.host.getBaseImage() !== resources.replacement) {
                    resources.replacement.dispose();
                }
            }
        }
        ownsPreview(object) {
            var _a;
            return ((_a = this.session) === null || _a === void 0 ? void 0 : _a.preview) === object;
        }
        closeForImage() {
            if (this.session)
                this.closeSession(false);
        }
        dispose() {
            if (this.disposed)
                return;
            if (this.session)
                this.closeSession(false);
            this.listeners.clear();
            this.disposed = true;
        }
        createPreview(baseImage, rect) {
            const preview = new this.host.fabric.Rect({
                width: rect.widthPx,
                height: rect.heightPx,
                originX: 'center',
                originY: 'center',
                fill: 'rgba(0, 170, 255, 0.08)',
                stroke: '#00aaff',
                strokeWidth: 1,
                strokeDashArray: [6, 4],
                strokeUniform: true,
                selectable: false,
                evented: false,
                hasControls: false,
                excludeFromExport: true,
            });
            this.applyPreviewPresentation(baseImage, preview, rect);
            return preview;
        }
        applyPreviewPresentation(baseImage, preview, rect) {
            const matrix = baseImage.calcTransformMatrix();
            const offsetX = rect.leftPx + rect.widthPx / 2 - Number(baseImage.width) / 2;
            const offsetY = rect.topPx + rect.heightPx / 2 - Number(baseImage.height) / 2;
            preview.set({
                left: matrix[0] * offsetX + matrix[2] * offsetY + matrix[4],
                top: matrix[1] * offsetX + matrix[3] * offsetY + matrix[5],
                width: rect.widthPx,
                height: rect.heightPx,
                scaleX: baseImage.scaleX,
                scaleY: baseImage.scaleY,
                angle: baseImage.angle,
                skewX: baseImage.skewX,
                skewY: baseImage.skewY,
                flipX: baseImage.flipX,
                flipY: baseImage.flipY,
            });
            preview.setCoords();
        }
        refreshPreview(session) {
            var _a;
            const baseImage = this.requireBaseImage();
            this.applyPreviewPresentation(baseImage, session.preview, session.state.rect);
            const canvas = this.host.requireCanvas('refresh Crop preview');
            canvas.bringObjectToFront(session.preview);
            (_a = session.previewVisibility) === null || _a === void 0 ? void 0 : _a.dispose();
            session.previewVisibility = null;
            session.candidates = findCropOverlayCandidates(this.overlay, session.preview.getBoundingRect(), session.state.overlayPolicy);
            if (this.overlay &&
                session.state.overlayPolicy.preview === 'hide-participating' &&
                session.candidates.intersectingIds.length > 0) {
                session.previewVisibility = this.overlay.hideForPreview(session.candidates.intersectingIds);
            }
            this.host.requestRender();
        }
        closeSession(restoreSelection) {
            var _a;
            const session = this.session;
            if (!session)
                return;
            this.session = null;
            (_a = session.previewVisibility) === null || _a === void 0 ? void 0 : _a.dispose();
            const canvas = this.host.getCanvas();
            if (canvas === null || canvas === void 0 ? void 0 : canvas.getObjects().includes(session.preview))
                canvas.remove(session.preview);
            session.preview.dispose();
            if (restoreSelection && this.overlay) {
                try {
                    const liveIds = session.selectionIds.filter((id) => { var _a; return ((_a = this.overlay) === null || _a === void 0 ? void 0 : _a.getByPersistentId(id)) !== null; });
                    this.overlay.select(liveIds);
                }
                catch (error) {
                    this.host.reportWarning(error, 'Crop could not restore the Overlay selection.');
                }
            }
            this.host.requestRender();
            this.emitStatus();
        }
        requireSession(operation) {
            this.assertActive(operation);
            if (!this.session)
                throw new CropSessionError(`Cannot ${operation} without an active Crop.`);
            return this.session;
        }
        requireBaseImage() {
            const baseImage = this.host.getBaseImage();
            if (!baseImage)
                throw new CropSessionError('Crop requires a loaded image.');
            return baseImage;
        }
        assertSourceCurrent(session) {
            if (!this.host.isImageLoaded() ||
                this.host.getGeometryRevision() !== session.state.sourceRevision) {
                throw new CropSessionError('Crop source revision is stale.');
            }
            this.assertSourceDimensions(session.state);
        }
        assertSourceDimensions(state) {
            const baseImage = this.requireBaseImage();
            if (Number(baseImage.width) !== state.sourceWidthPx ||
                Number(baseImage.height) !== state.sourceHeightPx) {
                throw new CropSessionError('Crop source dimensions changed during the session.');
            }
        }
        limits(session) {
            return {
                widthPx: session.state.sourceWidthPx,
                heightPx: session.state.sourceHeightPx,
                minimumWidthPx: this.configuration.minimumWidthPx,
                minimumHeightPx: this.configuration.minimumHeightPx,
            };
        }
        validateBaseImage(image, rect) {
            const canvas = this.host.requireCanvas('validate Crop');
            const baseImages = canvas
                .getObjects()
                .filter((object) => object
                .editorObjectKind === 'baseImage');
            if (this.host.getBaseImage() !== image ||
                baseImages.length !== 1 ||
                baseImages[0] !== image ||
                canvas.getObjects()[0] !== image ||
                image.width !== rect.widthPx ||
                image.height !== rect.heightPx ||
                image.selectable !== false ||
                image.evented !== false) {
                throw new CropValidationError('Crop violated the Base Image invariant.');
            }
        }
        status() {
            return Object.freeze({
                isActive: this.isActive,
                session: this.session ? cloneSessionState$1(this.session.state) : null,
            });
        }
        emitStatus() {
            if (this.disposed || this.listeners.size === 0)
                return;
            const status = this.status();
            for (const listener of [...this.listeners]) {
                try {
                    listener(status);
                }
                catch (error) {
                    this.host.reportWarning(error, 'A Crop status listener failed.');
                }
            }
        }
        assertActive(operation) {
            if (this.disposed || this.host.isDisposed()) {
                throw new CropSessionError(`Cannot ${operation} after Crop disposal.`);
            }
        }
    }

    const CROP_TOOL_ID = 'plugin:crop';
    const cropPreviewDomains = ['base-image', 'overlay', 'selection', 'state'];
    const cropMutationDomains = [
        'document',
        'base-image',
        'geometry',
        'raster',
        'overlay',
        'selection',
        'state',
    ];
    const cropPluginRef = definePluginRef('plugin:crop', '1.0.0');
    function cropPlugin(options = {}) {
        const configuration = resolveCropConfiguration(options);
        let controller = null;
        return definePlugin({
            ref: cropPluginRef,
            manifest: {
                id: cropPluginRef.id,
                version: '1.0.0',
                apiVersion: cropPluginRef.apiVersion,
                engine: '^3.0.0',
                requires: [
                    { token: CORE_STATUS_CAPABILITY, range: '^1.0.0' },
                    { token: CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
                    { token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                    { token: CANVAS_READ_CAPABILITY, range: '^1.0.0' },
                    { token: BASE_IMAGE_READ_CAPABILITY, range: '^1.0.0' },
                    { token: IMAGE_RESOURCE_POLICY_CAPABILITY, range: '^1.0.0' },
                    { token: RENDER_REQUEST_CAPABILITY, range: '^1.0.0' },
                    { token: RASTER_MUTATION_CAPABILITY, range: '^1.0.0' },
                    { token: SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' },
                    { token: GEOMETRY_MUTATION_CAPABILITY, range: '^1.0.0' },
                ],
                optional: [
                    { token: OVERLAY_CAPABILITY, range: '^1.0.0' },
                    { token: VISIBLE_RASTER_BAKE_CAPABILITY, range: '^1.0.0' },
                ],
                permissions: [
                    'fabric:objects',
                    'fabric:canvas-read',
                    'core:raster-mutation',
                    'core:geometry-participant',
                ],
            },
            setupMode: 'sync',
            setup(context) {
                const status = context.capabilities.require(CORE_STATUS_CAPABILITY);
                const diagnostics = context.capabilities.require(CORE_DIAGNOSTICS_CAPABILITY);
                const fabricRuntime = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY);
                const canvas = context.capabilities.require(CANVAS_READ_CAPABILITY);
                const baseImage = context.capabilities.require(BASE_IMAGE_READ_CAPABILITY);
                const resourcePolicy = context.capabilities.require(IMAGE_RESOURCE_POLICY_CAPABILITY);
                const render = context.capabilities.require(RENDER_REQUEST_CAPABILITY);
                const raster = context.capabilities.require(RASTER_MUTATION_CAPABILITY);
                const snapshots = context.capabilities.require(SNAPSHOT_REGISTRATION_CAPABILITY);
                const geometry = context.capabilities.require(GEOMETRY_MUTATION_CAPABILITY);
                const overlay = context.capabilities.optional(OVERLAY_CAPABILITY);
                const visibleRasterBake = context.capabilities.optional(VISIBLE_RASTER_BAKE_CAPABILITY);
                controller = new CropController(Object.freeze({
                    ...status,
                    ...diagnostics,
                    ...fabricRuntime,
                    ...canvas,
                    ...baseImage,
                    ...resourcePolicy,
                    ...render,
                }), geometry, raster, overlay, visibleRasterBake, context.capabilities.getOptionalStatus(VISIBLE_RASTER_BAKE_CAPABILITY), configuration);
                const requireController = () => {
                    if (!controller)
                        throw new Error('Crop Plugin is not installed.');
                    return controller;
                };
                for (const operationId of [
                    'crop:enter',
                    'crop:update-rect',
                    'crop:set-aspect-ratio',
                    'crop:cancel',
                ]) {
                    context.disposables.add(context.operations.register({
                        id: operationId,
                        mode: 'busy',
                        conflictDomains: cropPreviewDomains,
                        reentrancy: 'queue',
                    }));
                }
                context.disposables.add(context.operations.register({
                    id: 'crop:apply',
                    mode: 'mutation',
                    conflictDomains: cropMutationDomains,
                    reentrancy: 'queue',
                }));
                context.disposables.add(context.tools.register({
                    id: CROP_TOOL_ID,
                    enter: () => undefined,
                    exit: () => {
                        if (controller === null || controller === void 0 ? void 0 : controller.isActive)
                            controller.cancel();
                    },
                    canRunOperation: (operationId) => operationId.startsWith('crop:') ||
                        operationId === 'mosaic:enter' ||
                        operationId === 'core:load-image' ||
                        operationId === 'core:commit-load-image' ||
                        operationId === 'core:load-state' ||
                        operationId === 'core:export',
                }));
                context.disposables.add(snapshots.registerTransientObject(cropPluginRef.id, (object) => { var _a; return (_a = controller === null || controller === void 0 ? void 0 : controller.ownsPreview(object)) !== null && _a !== void 0 ? _a : false; }));
                const runPreviewOperation = (operationId, value, task) => context.operations.run(operationId, value, (args) => task(requireController(), args));
                return Object.freeze({
                    get isActive() {
                        return requireController().isActive;
                    },
                    enter: (enterOptions) => runPreviewOperation('crop:enter', enterOptions !== null && enterOptions !== void 0 ? enterOptions : {}, async (crop, value) => {
                        if (crop.isActive) {
                            crop.enter(value);
                            return;
                        }
                        await context.tools.enter(CROP_TOOL_ID);
                        try {
                            crop.enter(value);
                        }
                        catch (error) {
                            await context.tools.exit('operation');
                            throw error;
                        }
                    }),
                    updateRect: (rect) => runPreviewOperation('crop:update-rect', rect, (crop, value) => crop.updateRect(value)),
                    setAspectRatio: (ratio) => runPreviewOperation('crop:set-aspect-ratio', ratio, (crop, value) => crop.setAspectRatio(value)),
                    apply: async (applyOptions) => {
                        try {
                            await requireController().apply(applyOptions);
                        }
                        finally {
                            if (context.tools.getActiveToolId() === CROP_TOOL_ID) {
                                await context.tools.exit('operation');
                            }
                        }
                    },
                    cancel: () => runPreviewOperation('crop:cancel', undefined, async (crop) => {
                        crop.cancel();
                        if (context.tools.getActiveToolId() === CROP_TOOL_ID) {
                            await context.tools.exit('requested');
                        }
                    }),
                    getSession: () => requireController().getSession(),
                    subscribe: (listener) => requireController().subscribe(listener),
                });
            },
            onImageCleared(context) {
                if (context.tools.getActiveToolId() === CROP_TOOL_ID) {
                    return context.tools.exit('operation');
                }
                controller === null || controller === void 0 ? void 0 : controller.closeForImage();
                return undefined;
            },
            onDispose() {
                controller === null || controller === void 0 ? void 0 : controller.dispose();
                controller = null;
            },
        });
    }

    function isInsideCircle(x, y, centerX, centerY, radiusSquared) {
        const deltaX = x - centerX;
        const deltaY = y - centerY;
        return deltaX * deltaX + deltaY * deltaY <= radiusSquared;
    }
    function pixelOffset(width, x, y) {
        return (y * width + x) * 4;
    }
    function getCircularDirtyRectangle(options) {
        const { widthPx, heightPx, centerXPx, centerYPx, radiusPx } = options;
        if (!Number.isSafeInteger(widthPx) ||
            !Number.isSafeInteger(heightPx) ||
            widthPx <= 0 ||
            heightPx <= 0 ||
            !Number.isFinite(centerXPx) ||
            !Number.isFinite(centerYPx) ||
            !Number.isFinite(radiusPx) ||
            radiusPx <= 0) {
            return null;
        }
        const leftPx = Math.max(0, Math.floor(centerXPx - radiusPx));
        const rightPx = Math.min(widthPx - 1, Math.ceil(centerXPx + radiusPx));
        const topPx = Math.max(0, Math.floor(centerYPx - radiusPx));
        const bottomPx = Math.min(heightPx - 1, Math.ceil(centerYPx + radiusPx));
        if (leftPx > rightPx || topPx > bottomPx)
            return null;
        return Object.freeze({
            leftPx,
            topPx,
            widthPx: rightPx - leftPx + 1,
            heightPx: bottomPx - topPx + 1,
        });
    }
    function mergeDirtyRectangles(current, next) {
        if (!next)
            return current ? Object.freeze({ ...current }) : null;
        if (!current)
            return Object.freeze({ ...next });
        const leftPx = Math.min(current.leftPx, next.leftPx);
        const topPx = Math.min(current.topPx, next.topPx);
        const rightPx = Math.max(current.leftPx + current.widthPx, next.leftPx + next.widthPx);
        const bottomPx = Math.max(current.topPx + current.heightPx, next.topPx + next.heightPx);
        return Object.freeze({
            leftPx,
            topPx,
            widthPx: rightPx - leftPx,
            heightPx: bottomPx - topPx,
        });
    }
    function interpolateMosaicPoints(start, end, radiusPx) {
        const deltaX = end.xPx - start.xPx;
        const deltaY = end.yPx - start.yPx;
        const distance = Math.hypot(deltaX, deltaY);
        const spacing = Math.max(1, radiusPx / 2);
        const steps = Math.max(1, Math.ceil(distance / spacing));
        return Object.freeze(Array.from(Array.from({ length: steps }).keys(), (index) => {
            const progress = (index + 1) / steps;
            return Object.freeze({
                xPx: start.xPx + deltaX * progress,
                yPx: start.yPx + deltaY * progress,
            });
        }));
    }
    function applyCircularMosaic(imageData, point) {
        var _a, _b, _c, _d;
        const dirty = getCircularDirtyRectangle({
            widthPx: imageData.width,
            heightPx: imageData.height,
            centerXPx: point.xPx,
            centerYPx: point.yPx,
            radiusPx: point.radiusPx,
        });
        if (!dirty)
            return null;
        const blockSize = Math.max(1, Math.floor(point.blockSizePx));
        const rightPx = dirty.leftPx + dirty.widthPx - 1;
        const bottomPx = dirty.topPx + dirty.heightPx - 1;
        const radiusSquared = point.radiusPx * point.radiusPx;
        let changed = false;
        for (let blockTop = dirty.topPx; blockTop <= bottomPx; blockTop += blockSize) {
            for (let blockLeft = dirty.leftPx; blockLeft <= rightPx; blockLeft += blockSize) {
                const blockRight = Math.min(rightPx, blockLeft + blockSize - 1);
                const blockBottom = Math.min(bottomPx, blockTop + blockSize - 1);
                let sampleOffset = -1;
                for (let y = blockTop; y <= blockBottom && sampleOffset < 0; y += 1) {
                    for (let x = blockLeft; x <= blockRight; x += 1) {
                        if (!isInsideCircle(x, y, point.xPx, point.yPx, radiusSquared)) {
                            continue;
                        }
                        sampleOffset = pixelOffset(imageData.width, x, y);
                        break;
                    }
                }
                if (sampleOffset < 0)
                    continue;
                const red = (_a = imageData.data[sampleOffset]) !== null && _a !== void 0 ? _a : 0;
                const green = (_b = imageData.data[sampleOffset + 1]) !== null && _b !== void 0 ? _b : 0;
                const blue = (_c = imageData.data[sampleOffset + 2]) !== null && _c !== void 0 ? _c : 0;
                const alpha = (_d = imageData.data[sampleOffset + 3]) !== null && _d !== void 0 ? _d : 0;
                for (let y = blockTop; y <= blockBottom; y += 1) {
                    for (let x = blockLeft; x <= blockRight; x += 1) {
                        if (!isInsideCircle(x, y, point.xPx, point.yPx, radiusSquared)) {
                            continue;
                        }
                        const offset = pixelOffset(imageData.width, x, y);
                        imageData.data[offset] = red;
                        imageData.data[offset + 1] = green;
                        imageData.data[offset + 2] = blue;
                        imageData.data[offset + 3] = alpha;
                        changed = true;
                    }
                }
            }
        }
        return changed ? dirty : null;
    }

    class MosaicError extends Error {
        constructor() {
            super(...arguments);
            Object.defineProperty(this, "name", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'MosaicError'
            });
        }
    }
    class MosaicSessionError extends MosaicError {
        constructor() {
            super(...arguments);
            Object.defineProperty(this, "name", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'MosaicSessionError'
            });
        }
    }
    class MosaicValidationError extends MosaicError {
        constructor() {
            super(...arguments);
            Object.defineProperty(this, "name", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'MosaicValidationError'
            });
        }
    }
    class MosaicIntegrationError extends MosaicError {
        constructor() {
            super(...arguments);
            Object.defineProperty(this, "name", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'MosaicIntegrationError'
            });
        }
    }

    function writeMosaicDirtyRegion(context, imageData, dirty) {
        context.putImageData(imageData, 0, 0, dirty.leftPx, dirty.topPx, dirty.widthPx, dirty.heightPx);
    }
    function copyMosaicImagePresentation(source, target, transient) {
        target.set({
            left: source.left,
            top: source.top,
            originX: source.originX,
            originY: source.originY,
            scaleX: source.scaleX,
            scaleY: source.scaleY,
            angle: source.angle,
            skewX: source.skewX,
            skewY: source.skewY,
            flipX: source.flipX,
            flipY: source.flipY,
            opacity: source.opacity,
            visible: source.visible,
            selectable: transient ? false : source.selectable,
            evented: transient ? false : source.evented,
            hasControls: transient ? false : source.hasControls,
            hoverCursor: source.hoverCursor,
            excludeFromExport: transient ? true : source.excludeFromExport,
            backgroundColor: source.backgroundColor,
            objectCaching: transient ? false : source.objectCaching,
        });
        target.setCoords();
    }
    function createMosaicRasterCache(source) {
        var _a;
        const widthPx = Number(source.width);
        const heightPx = Number(source.height);
        if (!Number.isSafeInteger(widthPx) ||
            !Number.isSafeInteger(heightPx) ||
            widthPx <= 0 ||
            heightPx <= 0) {
            throw new MosaicValidationError('Mosaic source dimensions are invalid.');
        }
        const element = source.getElement();
        const ownerDocument = (_a = element.ownerDocument) !== null && _a !== void 0 ? _a : globalThis.document;
        if (!ownerDocument) {
            throw new MosaicValidationError('Mosaic rendering document is unavailable.');
        }
        const surface = ownerDocument.createElement('canvas');
        surface.width = widthPx;
        surface.height = heightPx;
        const context = surface.getContext('2d');
        if (!context)
            throw new MosaicValidationError('Mosaic rendering context is unavailable.');
        context.drawImage(element, 0, 0, widthPx, heightPx);
        let imageData;
        try {
            imageData = context.getImageData(0, 0, widthPx, heightPx);
        }
        catch {
            throw new MosaicValidationError('Mosaic source pixels could not be read.');
        }
        return Object.freeze({ surface, context, imageData, widthPx, heightPx });
    }
    function createMosaicPreviewImage(fabric, source, cache) {
        const preview = new fabric.FabricImage(cache.surface, {
            selectable: false,
            evented: false,
            hasControls: false,
            excludeFromExport: true,
            objectCaching: false,
        });
        copyMosaicImagePresentation(source, preview, true);
        return preview;
    }
    function disposeMosaicRasterCache(cache) {
        if (!cache)
            return;
        cache.surface.width = 0;
        cache.surface.height = 0;
    }

    function isRecord$1(value) {
        if (typeof value !== 'object' || value === null || Array.isArray(value))
            return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }
    function normalizeMosaicCommitOptions(value, configuration, sourceMimeType) {
        var _a, _b;
        if (value !== undefined && !isRecord$1(value)) {
            throw new MosaicValidationError('Mosaic commit options must be an object.');
        }
        const record = (value !== null && value !== void 0 ? value : {});
        const allowedKeys = new Set(['format', 'quality', 'bakeVisibleFilters']);
        if (Object.keys(record).some((key) => !allowedKeys.has(key))) {
            throw new MosaicValidationError('Mosaic commit options contain unknown keys.');
        }
        const requestedFormat = (_a = record.format) !== null && _a !== void 0 ? _a : configuration.format;
        if (requestedFormat !== 'source' &&
            requestedFormat !== 'png' &&
            requestedFormat !== 'jpeg' &&
            requestedFormat !== 'webp') {
            throw new MosaicValidationError('Mosaic output format is invalid.');
        }
        const sourceFormat = sourceMimeType === 'image/jpeg' ? 'jpeg' : sourceMimeType === 'image/webp' ? 'webp' : 'png';
        const format = requestedFormat === 'source' ? sourceFormat : requestedFormat;
        const quality = (_b = record.quality) !== null && _b !== void 0 ? _b : configuration.quality;
        if (typeof quality !== 'number' || !Number.isFinite(quality) || quality < 0 || quality > 1) {
            throw new MosaicValidationError('Mosaic output quality must be within [0, 1].');
        }
        if (record.bakeVisibleFilters !== undefined && typeof record.bakeVisibleFilters !== 'boolean') {
            throw new MosaicValidationError('bakeVisibleFilters must be a boolean.');
        }
        return Object.freeze({
            format,
            quality: format === 'png' ? undefined : quality,
            mimeType: format === 'jpeg' ? 'image/jpeg' : `image/${format}`,
            bakeVisibleFilters: record.bakeVisibleFilters !== false,
        });
    }
    function encodedBytes(dataUrl, expectedMimeType) {
        const commaIndex = dataUrl.indexOf(',');
        if (commaIndex < 0 || !/;base64$/i.test(dataUrl.slice(0, commaIndex))) {
            throw new MosaicValidationError('Mosaic output is not a base64 Data URL.');
        }
        const mimeType = dataUrl.slice(5, dataUrl.indexOf(';'));
        if (mimeType !== expectedMimeType) {
            throw new MosaicValidationError(`Mosaic encoder returned ${mimeType || 'an unknown MIME'} instead of ${expectedMimeType}.`);
        }
        const payload = dataUrl.slice(commaIndex + 1);
        const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
        return Math.floor((payload.length * 3) / 4) - padding;
    }
    async function decodeMosaicImage(fabric, dataUrl, timeoutMs, signal) {
        var _a;
        const controller = new AbortController();
        const abort = () => controller.abort(signal.reason);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted)
            abort();
        const timeout = setTimeout(() => controller.abort(new MosaicValidationError('Mosaic decode timed out.')), timeoutMs);
        try {
            return await fabric.FabricImage.fromURL(dataUrl, {
                crossOrigin: 'anonymous',
                signal: controller.signal,
            });
        }
        catch (error) {
            if (controller.signal.aborted)
                throw (_a = controller.signal.reason) !== null && _a !== void 0 ? _a : error;
            throw new MosaicValidationError('Mosaic decode failed.');
        }
        finally {
            clearTimeout(timeout);
            signal.removeEventListener('abort', abort);
        }
    }
    async function renderMosaicImage(host, source, cache, options, signal) {
        const policy = host.getImageResourcePolicy();
        if (cache.widthPx > policy.maxExportDimension ||
            cache.heightPx > policy.maxExportDimension ||
            cache.widthPx * cache.heightPx > Math.min(policy.maxInputPixels, policy.maxExportPixels)) {
            throw new MosaicValidationError('Mosaic dimensions exceed the Core resource policy.');
        }
        cache.context.putImageData(cache.imageData, 0, 0);
        if (signal.aborted)
            throw signal.reason;
        const dataUrl = cache.surface.toDataURL(options.mimeType, options.quality);
        if (encodedBytes(dataUrl, options.mimeType) > policy.maxInputBytes) {
            throw new MosaicValidationError('Mosaic output exceeds the Core input budget.');
        }
        const image = await decodeMosaicImage(host.fabric, dataUrl, policy.imageLoadTimeoutMs, signal);
        try {
            if (image.width !== cache.widthPx || image.height !== cache.heightPx) {
                throw new MosaicValidationError('Mosaic dimensions changed during decode.');
            }
            copyMosaicImagePresentation(source, image, false);
            image.set({ selectable: false, evented: false, hasControls: false });
            image.setCoords();
            return Object.freeze({ image, mimeType: options.mimeType });
        }
        catch (error) {
            image.dispose();
            throw error;
        }
    }

    const defaultConfiguration$2 = Object.freeze({
        brushSizePx: 24,
        pixelBlockSizePx: 8,
        format: 'source',
        quality: 0.92,
        maxPointCount: 4096,
    });
    function isRecord(value) {
        if (typeof value !== 'object' || value === null || Array.isArray(value))
            return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }
    function normalizeConfiguration(current, patch) {
        var _a, _b, _c, _d, _e;
        if (!isRecord(patch)) {
            throw new MosaicValidationError('Mosaic configuration patch must be an object.');
        }
        const allowedKeys = new Set([
            'brushSizePx',
            'pixelBlockSizePx',
            'format',
            'quality',
            'maxPointCount',
        ]);
        if (Object.keys(patch).some((key) => !allowedKeys.has(key))) {
            throw new MosaicValidationError('Mosaic configuration contains unknown keys.');
        }
        const brushSizePx = (_a = patch.brushSizePx) !== null && _a !== void 0 ? _a : current.brushSizePx;
        const pixelBlockSizePx = (_b = patch.pixelBlockSizePx) !== null && _b !== void 0 ? _b : current.pixelBlockSizePx;
        const format = (_c = patch.format) !== null && _c !== void 0 ? _c : current.format;
        const quality = (_d = patch.quality) !== null && _d !== void 0 ? _d : current.quality;
        const maxPointCount = (_e = patch.maxPointCount) !== null && _e !== void 0 ? _e : current.maxPointCount;
        if (typeof brushSizePx !== 'number' ||
            !Number.isFinite(brushSizePx) ||
            brushSizePx < 1 ||
            brushSizePx > 4096) {
            throw new MosaicValidationError('Mosaic brushSizePx must be within [1, 4096].');
        }
        if (typeof pixelBlockSizePx !== 'number' ||
            !Number.isSafeInteger(pixelBlockSizePx) ||
            pixelBlockSizePx < 1 ||
            pixelBlockSizePx > 1024) {
            throw new MosaicValidationError('Mosaic pixelBlockSizePx must be within [1, 1024].');
        }
        if (format !== 'source' && format !== 'png' && format !== 'jpeg' && format !== 'webp') {
            throw new MosaicValidationError('Mosaic format is invalid.');
        }
        if (typeof quality !== 'number' || !Number.isFinite(quality) || quality < 0 || quality > 1) {
            throw new MosaicValidationError('Mosaic quality must be within [0, 1].');
        }
        if (typeof maxPointCount !== 'number' ||
            !Number.isSafeInteger(maxPointCount) ||
            maxPointCount < 1 ||
            maxPointCount > 100000) {
            throw new MosaicValidationError('Mosaic maxPointCount must be within [1, 100000].');
        }
        return Object.freeze({
            brushSizePx,
            pixelBlockSizePx,
            format,
            quality,
            maxPointCount,
        });
    }
    function resolveMosaicConfiguration(options) {
        return normalizeConfiguration(defaultConfiguration$2, options);
    }
    function cloneDirtyRectangle(rectangle) {
        return rectangle ? Object.freeze({ ...rectangle }) : null;
    }
    function cloneSessionState(state) {
        return Object.freeze({
            ...state,
            dirtyRectangle: cloneDirtyRectangle(state.dirtyRectangle),
            configuration: Object.freeze({ ...state.configuration }),
        });
    }
    function replayStroke(cache, stroke, configuration) {
        let dirty = null;
        let previous = null;
        for (const point of stroke) {
            const points = previous
                ? interpolateMosaicPoints(previous, point, configuration.brushSizePx / 2)
                : [point];
            for (const interpolated of points) {
                dirty = mergeDirtyRectangles(dirty, applyCircularMosaic(cache.imageData, {
                    ...interpolated,
                    radiusPx: configuration.brushSizePx / 2,
                    blockSizePx: configuration.pixelBlockSizePx,
                }));
            }
            previous = point;
        }
        return dirty;
    }
    class MosaicController {
        constructor(host, geometry, raster, visibleRasterBake, visibleRasterBakeStatus, configuration) {
            Object.defineProperty(this, "host", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: host
            });
            Object.defineProperty(this, "geometry", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: geometry
            });
            Object.defineProperty(this, "raster", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: raster
            });
            Object.defineProperty(this, "visibleRasterBake", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: visibleRasterBake
            });
            Object.defineProperty(this, "visibleRasterBakeStatus", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: visibleRasterBakeStatus
            });
            Object.defineProperty(this, "configuration", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: void 0
            });
            Object.defineProperty(this, "session", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: null
            });
            Object.defineProperty(this, "listeners", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Set()
            });
            Object.defineProperty(this, "mutationSequence", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
            this.configuration = configuration;
        }
        get isActive() {
            return this.session !== null;
        }
        getConfiguration() {
            this.assertActive('read Mosaic configuration');
            return this.configuration;
        }
        configure(patch) {
            this.assertActive('configure Mosaic');
            this.configuration = normalizeConfiguration(this.configuration, patch);
            this.emitStatus();
        }
        getSession() {
            this.assertActive('read the Mosaic session');
            return this.session ? cloneSessionState(this.session.state) : null;
        }
        subscribe(listener) {
            this.assertActive('subscribe to Mosaic status');
            if (typeof listener !== 'function') {
                throw new TypeError('[ImageEditor] Mosaic status listener must be a function.');
            }
            this.listeners.add(listener);
            return createDisposable(() => {
                this.listeners.delete(listener);
            });
        }
        enter(options = {}) {
            this.assertActive('enter Mosaic');
            if (this.session)
                throw new MosaicSessionError('Mosaic is already active.');
            if (!this.host.isImageLoaded()) {
                throw new MosaicSessionError('Mosaic requires a loaded image.');
            }
            if (!isRecord(options)) {
                throw new MosaicValidationError('Mosaic enter options must be an object.');
            }
            if (Object.keys(options).some((key) => key !== 'configuration')) {
                throw new MosaicValidationError('Mosaic enter options contain unknown keys.');
            }
            const configuration = options.configuration
                ? normalizeConfiguration(this.configuration, options.configuration)
                : this.configuration;
            const source = this.requireBaseImage();
            const cache = createMosaicRasterCache(source);
            this.assertCachePolicy(cache);
            const preview = createMosaicPreviewImage(this.host.fabric, source, cache);
            const canvas = this.host.requireCanvas('enter Mosaic');
            canvas.add(preview);
            const sourceIndex = canvas.getObjects().indexOf(source);
            canvas.moveObjectTo(preview, Math.max(0, sourceIndex + 1));
            const state = Object.freeze({
                sourceRevision: this.host.getGeometryRevision(),
                sourceWidthPx: cache.widthPx,
                sourceHeightPx: cache.heightPx,
                strokeCount: 0,
                pointCount: 0,
                isStrokeActive: false,
                dirtyRectangle: null,
                configuration,
            });
            this.session = {
                state,
                cache,
                preview,
                strokes: [],
                activeStrokeIndex: null,
            };
            this.host.requestRender();
            this.emitStatus();
        }
        beginStroke(value) {
            const session = this.requireSession('begin a Mosaic stroke');
            this.assertSourceCurrent(session);
            if (session.activeStrokeIndex !== null) {
                throw new MosaicSessionError('A Mosaic stroke is already active.');
            }
            const point = this.normalizePoint(value, session);
            this.assertPointBudget(session);
            session.strokes.push([point]);
            session.activeStrokeIndex = session.strokes.length - 1;
            this.applyPreviewPoints(session, [point]);
            this.updateSessionState(session, true);
        }
        appendStroke(value) {
            const session = this.requireSession('append a Mosaic stroke');
            this.assertSourceCurrent(session);
            const strokeIndex = session.activeStrokeIndex;
            if (strokeIndex === null) {
                throw new MosaicSessionError('Mosaic appendStroke requires an active stroke.');
            }
            const stroke = session.strokes[strokeIndex];
            const point = this.normalizePoint(value, session);
            this.assertPointBudget(session);
            const previous = stroke[stroke.length - 1];
            stroke.push(point);
            this.applyPreviewPoints(session, interpolateMosaicPoints(previous, point, session.state.configuration.brushSizePx / 2));
            this.updateSessionState(session, true);
        }
        endStroke() {
            const session = this.requireSession('end a Mosaic stroke');
            if (session.activeStrokeIndex === null) {
                throw new MosaicSessionError('Mosaic endStroke requires an active stroke.');
            }
            session.activeStrokeIndex = null;
            this.updateSessionState(session, false);
        }
        cancel() {
            this.assertActive('cancel Mosaic');
            if (this.session)
                this.closeSession();
        }
        async commit(options) {
            var _a, _b;
            const session = this.requireSession('commit Mosaic');
            this.assertSourceCurrent(session);
            if (session.activeStrokeIndex !== null) {
                throw new MosaicSessionError('End the active Mosaic stroke before commit.');
            }
            const normalizedOptions = normalizeMosaicCommitOptions(options, session.state.configuration, (_b = (_a = this.host.getImageInfo()) === null || _a === void 0 ? void 0 : _a.mimeType) !== null && _b !== void 0 ? _b : null);
            const strokes = Object.freeze(session.strokes.map((stroke) => Object.freeze(stroke.map((point) => Object.freeze({ ...point })))));
            const state = session.state;
            this.closeSession();
            if (state.pointCount === 0)
                return;
            const mutationId = `mosaic:commit:${++this.mutationSequence}`;
            const resources = { cache: null, replacement: null, replacedSource: null };
            let committed = false;
            try {
                await this.geometry.run({
                    id: mutationId,
                    kind: 'raster-replace',
                    operationId: 'mosaic:commit',
                    targetSize: { width: state.sourceWidthPx, height: state.sourceHeightPx },
                    metadata: Object.freeze({
                        sourceRevision: state.sourceRevision,
                        strokeCount: state.strokeCount,
                        pointCount: state.pointCount,
                        dirtyRectangle: state.dirtyRectangle,
                        bakeVisibleFilters: normalizedOptions.bakeVisibleFilters,
                    }),
                    mutateBase: async ({ transaction, signal }) => {
                        var _a;
                        if (normalizedOptions.bakeVisibleFilters &&
                            this.visibleRasterBakeStatus === 'incompatible') {
                            throw new MosaicIntegrationError('The installed visible-raster bake provider is incompatible.');
                        }
                        if (normalizedOptions.bakeVisibleFilters &&
                            ((_a = this.visibleRasterBake) === null || _a === void 0 ? void 0 : _a.hasVisibleState())) {
                            await this.visibleRasterBake.bakeIntoBase(transaction);
                        }
                        this.assertSourceDimensions(state);
                        const source = this.requireBaseImage();
                        const cache = createMosaicRasterCache(source);
                        resources.cache = cache;
                        this.assertCachePolicy(cache);
                        for (const stroke of strokes) {
                            replayStroke(cache, stroke, state.configuration);
                        }
                        const rendered = await renderMosaicImage(this.host, source, cache, normalizedOptions, signal);
                        resources.replacement = rendered.image;
                        resources.replacedSource = source;
                        this.raster.replaceBaseImage(transaction, rendered.image, {
                            baseScale: this.host.getBaseImageScale(),
                            mimeType: rendered.mimeType,
                        });
                        this.validateBaseImage(rendered.image, state);
                    },
                });
                committed = true;
                if (resources.replacedSource && resources.replacedSource !== this.host.getBaseImage()) {
                    resources.replacedSource.dispose();
                }
            }
            finally {
                disposeMosaicRasterCache(resources.cache);
                if (!committed &&
                    resources.replacement &&
                    this.host.getBaseImage() !== resources.replacement) {
                    resources.replacement.dispose();
                }
            }
        }
        ownsPreview(object) {
            var _a;
            return ((_a = this.session) === null || _a === void 0 ? void 0 : _a.preview) === object;
        }
        closeForImage() {
            if (this.session)
                this.closeSession();
        }
        dispose() {
            if (this.disposed)
                return;
            if (this.session)
                this.closeSession();
            this.listeners.clear();
            this.disposed = true;
        }
        applyPreviewPoints(session, points) {
            let dirty = null;
            for (const point of points) {
                dirty = mergeDirtyRectangles(dirty, applyCircularMosaic(session.cache.imageData, {
                    ...point,
                    radiusPx: session.state.configuration.brushSizePx / 2,
                    blockSizePx: session.state.configuration.pixelBlockSizePx,
                }));
            }
            if (!dirty)
                return;
            writeMosaicDirtyRegion(session.cache.context, session.cache.imageData, dirty);
            session.preview.dirty = true;
            session.state = Object.freeze({
                ...session.state,
                dirtyRectangle: mergeDirtyRectangles(session.state.dirtyRectangle, dirty),
            });
            this.host.requestRender();
        }
        updateSessionState(session, isStrokeActive) {
            const pointCount = session.strokes.reduce((count, stroke) => count + stroke.length, 0);
            session.state = Object.freeze({
                ...session.state,
                strokeCount: session.strokes.length,
                pointCount,
                isStrokeActive,
            });
            this.emitStatus();
        }
        normalizePoint(value, session) {
            if (!isRecord(value))
                throw new MosaicValidationError('Mosaic point must be an object.');
            if (Object.keys(value).some((key) => key !== 'xPx' && key !== 'yPx')) {
                throw new MosaicValidationError('Mosaic point contains unknown keys.');
            }
            const xPx = value.xPx;
            const yPx = value.yPx;
            if (typeof xPx !== 'number' ||
                typeof yPx !== 'number' ||
                !Number.isFinite(xPx) ||
                !Number.isFinite(yPx) ||
                xPx < 0 ||
                yPx < 0 ||
                xPx >= session.state.sourceWidthPx ||
                yPx >= session.state.sourceHeightPx) {
                throw new MosaicValidationError('Mosaic point must be finite and within natural image bounds.');
            }
            return Object.freeze({ xPx, yPx });
        }
        assertPointBudget(session) {
            const pointCount = session.strokes.reduce((count, stroke) => count + stroke.length, 0);
            if (pointCount >= session.state.configuration.maxPointCount) {
                throw new MosaicValidationError('Mosaic point count exceeds maxPointCount.');
            }
        }
        closeSession() {
            const session = this.session;
            if (!session)
                return;
            this.session = null;
            const canvas = this.host.getCanvas();
            if (canvas === null || canvas === void 0 ? void 0 : canvas.getObjects().includes(session.preview))
                canvas.remove(session.preview);
            session.preview.dispose();
            disposeMosaicRasterCache(session.cache);
            this.host.requestRender();
            this.emitStatus();
        }
        requireSession(operation) {
            this.assertActive(operation);
            if (!this.session) {
                throw new MosaicSessionError(`Cannot ${operation} without an active Mosaic session.`);
            }
            return this.session;
        }
        requireBaseImage() {
            const baseImage = this.host.getBaseImage();
            if (!baseImage)
                throw new MosaicSessionError('Mosaic requires a loaded image.');
            return baseImage;
        }
        assertSourceCurrent(session) {
            if (!this.host.isImageLoaded() ||
                this.host.getGeometryRevision() !== session.state.sourceRevision) {
                throw new MosaicSessionError('Mosaic source revision is stale.');
            }
            this.assertSourceDimensions(session.state);
        }
        assertSourceDimensions(state) {
            const baseImage = this.requireBaseImage();
            if (Number(baseImage.width) !== state.sourceWidthPx ||
                Number(baseImage.height) !== state.sourceHeightPx) {
                throw new MosaicSessionError('Mosaic source dimensions changed during the session.');
            }
        }
        assertCachePolicy(cache) {
            const policy = this.host.getImageResourcePolicy();
            if (cache.widthPx > policy.maxExportDimension ||
                cache.heightPx > policy.maxExportDimension ||
                cache.widthPx * cache.heightPx > Math.min(policy.maxInputPixels, policy.maxExportPixels)) {
                disposeMosaicRasterCache(cache);
                throw new MosaicValidationError('Mosaic dimensions exceed the Core resource policy.');
            }
        }
        validateBaseImage(image, state) {
            const canvas = this.host.requireCanvas('validate Mosaic');
            const baseImages = canvas
                .getObjects()
                .filter((object) => object
                .editorObjectKind === 'baseImage');
            if (this.host.getBaseImage() !== image ||
                baseImages.length !== 1 ||
                baseImages[0] !== image ||
                canvas.getObjects()[0] !== image ||
                image.width !== state.sourceWidthPx ||
                image.height !== state.sourceHeightPx ||
                image.selectable !== false ||
                image.evented !== false) {
                throw new MosaicValidationError('Mosaic violated the Base Image invariant.');
            }
        }
        status() {
            return Object.freeze({
                isActive: this.isActive,
                session: this.session ? cloneSessionState(this.session.state) : null,
            });
        }
        emitStatus() {
            if (this.disposed || this.listeners.size === 0)
                return;
            const status = this.status();
            for (const listener of [...this.listeners]) {
                try {
                    listener(status);
                }
                catch (error) {
                    this.host.reportWarning(error, 'A Mosaic status listener failed.');
                }
            }
        }
        assertActive(operation) {
            if (this.disposed || this.host.isDisposed()) {
                throw new MosaicSessionError(`Cannot ${operation} after Mosaic disposal.`);
            }
        }
    }

    const MOSAIC_TOOL_ID = 'plugin:mosaic';
    const mosaicPreviewDomains = ['base-image', 'overlay', 'selection', 'state'];
    const mosaicMutationDomains = [
        'document',
        'base-image',
        'geometry',
        'raster',
        'overlay',
        'selection',
        'state',
    ];
    const mosaicPluginRef = definePluginRef('plugin:mosaic', '1.0.0');
    function mosaicPlugin(options = {}) {
        const configuration = resolveMosaicConfiguration(options);
        let controller = null;
        return definePlugin({
            ref: mosaicPluginRef,
            manifest: {
                id: mosaicPluginRef.id,
                version: '1.0.0',
                apiVersion: mosaicPluginRef.apiVersion,
                engine: '^3.0.0',
                requires: [
                    { token: CORE_STATUS_CAPABILITY, range: '^1.0.0' },
                    { token: CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
                    { token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                    { token: CANVAS_READ_CAPABILITY, range: '^1.0.0' },
                    { token: BASE_IMAGE_READ_CAPABILITY, range: '^1.0.0' },
                    { token: IMAGE_RESOURCE_POLICY_CAPABILITY, range: '^1.0.0' },
                    { token: RENDER_REQUEST_CAPABILITY, range: '^1.0.0' },
                    { token: RASTER_MUTATION_CAPABILITY, range: '^1.0.0' },
                    { token: SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' },
                    { token: GEOMETRY_MUTATION_CAPABILITY, range: '^1.0.0' },
                ],
                optional: [{ token: VISIBLE_RASTER_BAKE_CAPABILITY, range: '^1.0.0' }],
                permissions: [
                    'fabric:objects',
                    'fabric:canvas-read',
                    'core:raster-mutation',
                    'core:geometry-participant',
                ],
            },
            setupMode: 'sync',
            setup(context) {
                const status = context.capabilities.require(CORE_STATUS_CAPABILITY);
                const diagnostics = context.capabilities.require(CORE_DIAGNOSTICS_CAPABILITY);
                const fabricRuntime = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY);
                const canvas = context.capabilities.require(CANVAS_READ_CAPABILITY);
                const baseImage = context.capabilities.require(BASE_IMAGE_READ_CAPABILITY);
                const resourcePolicy = context.capabilities.require(IMAGE_RESOURCE_POLICY_CAPABILITY);
                const render = context.capabilities.require(RENDER_REQUEST_CAPABILITY);
                const raster = context.capabilities.require(RASTER_MUTATION_CAPABILITY);
                const snapshots = context.capabilities.require(SNAPSHOT_REGISTRATION_CAPABILITY);
                const geometry = context.capabilities.require(GEOMETRY_MUTATION_CAPABILITY);
                const visibleRasterBake = context.capabilities.optional(VISIBLE_RASTER_BAKE_CAPABILITY);
                controller = new MosaicController(Object.freeze({
                    ...status,
                    ...diagnostics,
                    ...fabricRuntime,
                    ...canvas,
                    ...baseImage,
                    ...resourcePolicy,
                    ...render,
                }), geometry, raster, visibleRasterBake, context.capabilities.getOptionalStatus(VISIBLE_RASTER_BAKE_CAPABILITY), configuration);
                const requireController = () => {
                    if (!controller)
                        throw new Error('Mosaic Plugin is not installed.');
                    return controller;
                };
                for (const operationId of [
                    'mosaic:enter',
                    'mosaic:begin-stroke',
                    'mosaic:append-stroke',
                    'mosaic:end-stroke',
                    'mosaic:cancel',
                    'mosaic:configure',
                ]) {
                    context.disposables.add(context.operations.register({
                        id: operationId,
                        mode: 'busy',
                        conflictDomains: mosaicPreviewDomains,
                        reentrancy: 'queue',
                    }));
                }
                context.disposables.add(context.operations.register({
                    id: 'mosaic:commit',
                    mode: 'mutation',
                    conflictDomains: mosaicMutationDomains,
                    reentrancy: 'queue',
                }));
                context.disposables.add(context.tools.register({
                    id: MOSAIC_TOOL_ID,
                    enter: () => undefined,
                    exit: () => {
                        if (controller === null || controller === void 0 ? void 0 : controller.isActive)
                            controller.cancel();
                    },
                    canRunOperation: (operationId) => operationId.startsWith('mosaic:') ||
                        operationId === 'crop:enter' ||
                        operationId === 'core:load-image' ||
                        operationId === 'core:commit-load-image' ||
                        operationId === 'core:load-state' ||
                        operationId === 'core:export',
                }));
                context.disposables.add(snapshots.registerTransientObject(mosaicPluginRef.id, (object) => { var _a; return (_a = controller === null || controller === void 0 ? void 0 : controller.ownsPreview(object)) !== null && _a !== void 0 ? _a : false; }));
                const runPreviewOperation = (operationId, value, task) => context.operations.run(operationId, value, (args) => task(requireController(), args));
                return Object.freeze({
                    get isActive() {
                        return requireController().isActive;
                    },
                    enter: (enterOptions) => runPreviewOperation('mosaic:enter', enterOptions !== null && enterOptions !== void 0 ? enterOptions : {}, async (mosaic, value) => {
                        if (mosaic.isActive) {
                            mosaic.enter(value);
                            return;
                        }
                        await context.tools.enter(MOSAIC_TOOL_ID);
                        try {
                            mosaic.enter(value);
                        }
                        catch (error) {
                            await context.tools.exit('operation');
                            throw error;
                        }
                    }),
                    beginStroke: (point) => runPreviewOperation('mosaic:begin-stroke', point, (mosaic, value) => mosaic.beginStroke(value)),
                    appendStroke: (point) => runPreviewOperation('mosaic:append-stroke', point, (mosaic, value) => mosaic.appendStroke(value)),
                    endStroke: () => runPreviewOperation('mosaic:end-stroke', undefined, (mosaic) => mosaic.endStroke()),
                    commit: async (commitOptions) => {
                        try {
                            await requireController().commit(commitOptions);
                        }
                        finally {
                            if (context.tools.getActiveToolId() === MOSAIC_TOOL_ID) {
                                await context.tools.exit('operation');
                            }
                        }
                    },
                    cancel: () => runPreviewOperation('mosaic:cancel', undefined, async (mosaic) => {
                        mosaic.cancel();
                        if (context.tools.getActiveToolId() === MOSAIC_TOOL_ID) {
                            await context.tools.exit('requested');
                        }
                    }),
                    configure: (patch) => runPreviewOperation('mosaic:configure', patch, (mosaic, value) => mosaic.configure(value)),
                    getConfiguration: () => requireController().getConfiguration(),
                    getSession: () => requireController().getSession(),
                    subscribe: (listener) => requireController().subscribe(listener),
                });
            },
            onImageCleared(context) {
                if (context.tools.getActiveToolId() === MOSAIC_TOOL_ID) {
                    return context.tools.exit('operation');
                }
                controller === null || controller === void 0 ? void 0 : controller.closeForImage();
                return undefined;
            },
            onDispose() {
                controller === null || controller === void 0 ? void 0 : controller.dispose();
                controller = null;
            },
        });
    }

    const TEXT_ANNOTATION_KIND = 'annotation:text';
    const TEXT_PLUGIN_ID = 'annotation:text';
    const MAX_TEXT_LENGTH = 20000;
    const MAX_FONT_FIELD_LENGTH = 256;
    const MAX_TEXT_OBJECT_BYTES = 256 * 1024;
    const MAX_TEXT_WIDTH = 100000;
    const MAX_COORDINATE$1 = 10000000;
    function isPlainRecord$3(value) {
        if (typeof value !== 'object' || value === null || Array.isArray(value))
            return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }
    function validateText(value, label = 'Text') {
        if (typeof value !== 'string' || value.length > MAX_TEXT_LENGTH) {
            throw new AnnotationValidationError(`${label} must be a string of at most ${MAX_TEXT_LENGTH} characters.`);
        }
        return value;
    }
    function validateFontField(value, label) {
        if (typeof value !== 'string' ||
            value.length === 0 ||
            value.trim() !== value ||
            value.length > MAX_FONT_FIELD_LENGTH ||
            [...value].some((character) => character.charCodeAt(0) < 32)) {
            throw new AnnotationValidationError(`${label} is invalid.`);
        }
        return value;
    }
    function validateFontWeight(value) {
        if ((typeof value === 'string' &&
            value.length > 0 &&
            value.length <= 32 &&
            value.trim() === value) ||
            (typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 1000)) {
            return value;
        }
        throw new AnnotationValidationError('Text font weight is invalid.');
    }
    function validateFiniteRange(value, label, minimum, maximum) {
        if (typeof value !== 'number' ||
            !Number.isFinite(value) ||
            value < minimum ||
            value > maximum) {
            throw new AnnotationValidationError(`${label} must be from ${minimum} to ${maximum}.`);
        }
        return value;
    }
    function validateBoolean(value, label) {
        if (typeof value !== 'boolean')
            throw new AnnotationValidationError(`${label} must be boolean.`);
        return value;
    }
    function validateAlignment(value) {
        if (value === 'left' || value === 'center' || value === 'right' || value === 'justify') {
            return value;
        }
        throw new AnnotationValidationError('Text alignment is invalid.');
    }
    function validateFallbacks(value) {
        if (!Array.isArray(value) || value.length > 8) {
            throw new AnnotationValidationError('Text font fallbacks are invalid.');
        }
        return Object.freeze([
            ...new Set(value.map((entry) => validateFontField(entry, 'Text font fallback'))),
        ]);
    }
    const defaultConfiguration$1 = Object.freeze({
        defaultText: 'Text',
        fontSize: 24,
        fontFamily: 'Arial',
        fontFallbacks: Object.freeze(['sans-serif']),
        fontWeight: 'normal',
        fill: '#111111',
        backgroundColor: '',
        textAlign: 'left',
        width: 220,
        opacity: 1,
        selectable: true,
        evented: true,
        editable: true,
        bindToImageTransform: false,
        reflectionBehavior: 'preserve-readable',
        namePrefix: 'Text',
    });
    function resolveTextConfiguration(value = {}, base = defaultConfiguration$1) {
        if (!isPlainRecord$3(value)) {
            throw new AnnotationValidationError('Text configuration must be a plain object.');
        }
        const allowed = new Set(Object.keys(defaultConfiguration$1));
        if (Object.keys(value).some((key) => !allowed.has(key))) {
            throw new AnnotationValidationError('Text configuration contains unknown keys.');
        }
        const merged = { ...base, ...value };
        if (merged.reflectionBehavior !== 'preserve-readable' &&
            merged.reflectionBehavior !== 'mirror') {
            throw new AnnotationValidationError('Text reflection behavior is invalid.');
        }
        return Object.freeze({
            defaultText: validateText(merged.defaultText, 'Default Text'),
            fontSize: validateFiniteRange(merged.fontSize, 'Text font size', 1, 512),
            fontFamily: validateFontField(merged.fontFamily, 'Text font family'),
            fontFallbacks: validateFallbacks(merged.fontFallbacks),
            fontWeight: validateFontWeight(merged.fontWeight),
            fill: validateFontField(merged.fill, 'Text fill'),
            backgroundColor: merged.backgroundColor === ''
                ? ''
                : validateFontField(merged.backgroundColor, 'Text background color'),
            textAlign: validateAlignment(merged.textAlign),
            width: validateFiniteRange(merged.width, 'Text width', 1, MAX_TEXT_WIDTH),
            opacity: validateFiniteRange(merged.opacity, 'Text opacity', 0, 1),
            selectable: validateBoolean(merged.selectable, 'Text selectable'),
            evented: validateBoolean(merged.evented, 'Text evented'),
            editable: validateBoolean(merged.editable, 'Text editable'),
            bindToImageTransform: validateBoolean(merged.bindToImageTransform, 'Text transform binding'),
            reflectionBehavior: merged.reflectionBehavior,
            namePrefix: validateFontField(merged.namePrefix, 'Text name prefix'),
        });
    }
    function resolvedFontFamily(primary, fallbacks) {
        return [primary, ...fallbacks].join(', ');
    }
    function normalizeFeatureUpdate$1(value) {
        if (!isPlainRecord$3(value)) {
            throw new AnnotationValidationError('Text update must be a plain object.');
        }
        const allowed = new Set([
            'text',
            'fontSize',
            'fontFamily',
            'fontWeight',
            'fill',
            'backgroundColor',
            'textAlign',
            'width',
            'opacity',
        ]);
        if (Object.keys(value).some((key) => !allowed.has(key))) {
            throw new AnnotationValidationError('Text update contains unknown keys.');
        }
        return Object.freeze({
            ...(value.text !== undefined ? { text: validateText(value.text) } : {}),
            ...(value.fontSize !== undefined
                ? { fontSize: validateFiniteRange(value.fontSize, 'Text font size', 1, 512) }
                : {}),
            ...(value.fontFamily !== undefined
                ? { fontFamily: validateFontField(value.fontFamily, 'Text font family') }
                : {}),
            ...(value.fontWeight !== undefined
                ? { fontWeight: validateFontWeight(value.fontWeight) }
                : {}),
            ...(value.fill !== undefined ? { fill: validateFontField(value.fill, 'Text fill') } : {}),
            ...(value.backgroundColor !== undefined
                ? {
                    backgroundColor: value.backgroundColor === ''
                        ? ''
                        : validateFontField(value.backgroundColor, 'Text background color'),
                }
                : {}),
            ...(value.textAlign !== undefined ? { textAlign: validateAlignment(value.textAlign) } : {}),
            ...(value.width !== undefined
                ? { width: validateFiniteRange(value.width, 'Text width', 1, MAX_TEXT_WIDTH) }
                : {}),
            ...(value.opacity !== undefined
                ? { opacity: validateFiniteRange(value.opacity, 'Text opacity', 0, 1) }
                : {}),
        });
    }
    function sharedUpdate$1(value) {
        return Object.freeze({
            ...(value.name !== undefined ? { name: value.name } : {}),
            ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
            ...(value.hidden !== undefined ? { hidden: value.hidden } : {}),
            ...(value.locked !== undefined ? { locked: value.locked } : {}),
        });
    }
    function featureUpdate(value) {
        var _a;
        const fontFamily = value.fontFamily !== undefined || value.fontFallbacks !== undefined
            ? resolvedFontFamily((_a = value.fontFamily) !== null && _a !== void 0 ? _a : 'Arial', value.fontFallbacks ? validateFallbacks(value.fontFallbacks) : [])
            : undefined;
        return normalizeFeatureUpdate$1({
            ...(value.text !== undefined ? { text: value.text } : {}),
            ...(value.fontSize !== undefined ? { fontSize: value.fontSize } : {}),
            ...(fontFamily !== undefined ? { fontFamily } : {}),
            ...(value.fontWeight !== undefined ? { fontWeight: value.fontWeight } : {}),
            ...(value.fill !== undefined ? { fill: value.fill } : {}),
            ...(value.backgroundColor !== undefined ? { backgroundColor: value.backgroundColor } : {}),
            ...(value.textAlign !== undefined ? { textAlign: value.textAlign } : {}),
            ...(value.width !== undefined ? { width: value.width } : {}),
            ...(value.opacity !== undefined ? { opacity: value.opacity } : {}),
        });
    }
    function isSerializedText(value) {
        var _a;
        if (!isPlainRecord$3(value))
            return false;
        try {
            const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
            const type = String((_a = value.type) !== null && _a !== void 0 ? _a : '').toLowerCase();
            return (bytes <= MAX_TEXT_OBJECT_BYTES &&
                type === 'textbox' &&
                typeof value.text === 'string' &&
                value.text.length <= MAX_TEXT_LENGTH &&
                Number.isFinite(value.left) &&
                Number.isFinite(value.top) &&
                Number.isFinite(value.width) &&
                Number.isFinite(value.fontSize));
        }
        catch {
            return false;
        }
    }
    function isTextStateData(value) {
        if (!isPlainRecord$3(value) || value.version !== 1)
            return false;
        try {
            validateText(value.text);
            validateFiniteRange(value.fontSize, 'Text font size ratio', 1e-7, 100);
            validateFiniteRange(value.width, 'Text width ratio', 1e-7, 100);
            validateFontField(value.fontFamily, 'Text font family');
            validateFontWeight(value.fontWeight);
            validateFontField(value.fill, 'Text fill');
            if (value.backgroundColor !== '') {
                validateFontField(value.backgroundColor, 'Text background color');
            }
            validateAlignment(value.textAlign);
            validateFiniteRange(value.lineHeight, 'Text line height', 0.1, 10);
            validateFiniteRange(value.opacity, 'Text opacity', 0, 1);
            return Object.keys(value).every((key) => [
                'version',
                'text',
                'fontSize',
                'width',
                'fontFamily',
                'fontWeight',
                'fill',
                'backgroundColor',
                'textAlign',
                'lineHeight',
                'opacity',
            ].includes(key));
        }
        catch {
            return false;
        }
    }
    class TextAnnotationController {
        constructor(host, annotations, authoring, options) {
            Object.defineProperty(this, "host", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: host
            });
            Object.defineProperty(this, "annotations", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: annotations
            });
            Object.defineProperty(this, "authoring", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: authoring
            });
            Object.defineProperty(this, "configuration", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: void 0
            });
            Object.defineProperty(this, "session", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: null
            });
            Object.defineProperty(this, "listeners", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Set()
            });
            Object.defineProperty(this, "previewSequence", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "nameSequence", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
            this.configuration = resolveTextConfiguration(options);
        }
        featureDefinition() {
            const definition = {
                kind: TEXT_ANNOTATION_KIND,
                ownerPluginId: TEXT_PLUGIN_ID,
                classify: (object) => object instanceof this.host.fabric.Textbox,
                codec: {
                    type: 'annotation:textbox',
                    version: '1.0.0',
                    serialize: (object) => object.toObject(),
                    validate: isSerializedText,
                    deserialize: async (value, context) => {
                        if (!isSerializedText(value)) {
                            throw new AnnotationValidationError('Serialized Text Annotation data is malformed.');
                        }
                        const objects = await context.fabric.util.enlivenObjects([value]);
                        const object = objects[0];
                        if (!(object instanceof context.fabric.Textbox)) {
                            throw new AnnotationValidationError('Serialized Text Annotation did not restore a Textbox.');
                        }
                        return object;
                    },
                },
                stateCodec: {
                    type: 'annotation:text',
                    version: '1.0.0',
                    serialize: (object, context) => {
                        const text = object;
                        return Object.freeze({
                            geometry: captureOverlayStateBounds(text, context),
                            data: Object.freeze({
                                version: 1,
                                text: text.text,
                                fontSize: context.toImageNormalizedScalar(text.fontSize),
                                width: context.toImageNormalizedScalar(text.width),
                                fontFamily: text.fontFamily,
                                fontWeight: text.fontWeight,
                                fill: typeof text.fill === 'string' ? text.fill : '#111111',
                                backgroundColor: typeof text.backgroundColor === 'string'
                                    ? text.backgroundColor
                                    : '',
                                textAlign: validateAlignment(text.textAlign),
                                lineHeight: text.lineHeight,
                                opacity: text.opacity,
                            }),
                        });
                    },
                    validate: (value) => isOverlayStateBoundsGeometry(value.geometry) && isTextStateData(value.data),
                    deserialize: (value, context) => {
                        if (!isOverlayStateBoundsGeometry(value.geometry) ||
                            !isTextStateData(value.data)) {
                            throw new AnnotationValidationError('Serialized Text Annotation State data is malformed.');
                        }
                        const data = value.data;
                        const object = new this.host.fabric.Textbox(data.text, {
                            left: 0,
                            top: 0,
                            width: context.toCanvasScalar(data.width),
                            fontSize: context.toCanvasScalar(data.fontSize),
                            fontFamily: data.fontFamily,
                            fontWeight: data.fontWeight,
                            fill: data.fill,
                            backgroundColor: data.backgroundColor,
                            textAlign: data.textAlign,
                            lineHeight: data.lineHeight,
                            opacity: data.opacity,
                            originX: 'left',
                            originY: 'top',
                        });
                        restoreOverlayStateBounds(object, value.geometry, context, this.host.fabric);
                        return object;
                    },
                },
                normalizeUpdate: normalizeFeatureUpdate$1,
                hasUpdate: (object, patch) => Object.entries(patch).some(([key, value]) => !Object.is(Reflect.get(object, key), value)),
                applyUpdate: (object, patch) => {
                    object.set(patch);
                    object.setCoords();
                },
                bindToImageTransform: () => this.configuration.bindToImageTransform,
                preserveReadable: () => this.configuration.reflectionBehavior === 'preserve-readable',
            };
            return Object.freeze(definition);
        }
        async create(options = {}) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
            this.assertActive('create Text');
            this.assertImageLoaded();
            if (!isPlainRecord$3(options)) {
                throw new AnnotationValidationError('Text creation options must be a plain object.');
            }
            const creation = options;
            const text = validateText((_a = creation.text) !== null && _a !== void 0 ? _a : this.configuration.defaultText);
            const left = validateFiniteRange((_b = creation.left) !== null && _b !== void 0 ? _b : 10, 'Text left', -MAX_COORDINATE$1, MAX_COORDINATE$1);
            const top = validateFiniteRange((_c = creation.top) !== null && _c !== void 0 ? _c : 10, 'Text top', -MAX_COORDINATE$1, MAX_COORDINATE$1);
            const width = validateFiniteRange((_d = creation.width) !== null && _d !== void 0 ? _d : this.configuration.width, 'Text width', 1, MAX_TEXT_WIDTH);
            const fontSize = validateFiniteRange((_e = creation.fontSize) !== null && _e !== void 0 ? _e : this.configuration.fontSize, 'Text font size', 1, 512);
            const primaryFont = validateFontField((_f = creation.fontFamily) !== null && _f !== void 0 ? _f : this.configuration.fontFamily, 'Text font family');
            const fallbacks = creation.fontFallbacks
                ? validateFallbacks(creation.fontFallbacks)
                : this.configuration.fontFallbacks;
            const object = new this.host.fabric.Textbox(text, {
                left,
                top,
                width,
                fontSize,
                fontFamily: resolvedFontFamily(primaryFont, fallbacks),
                fontWeight: validateFontWeight((_g = creation.fontWeight) !== null && _g !== void 0 ? _g : this.configuration.fontWeight),
                fill: (_h = creation.fill) !== null && _h !== void 0 ? _h : this.configuration.fill,
                backgroundColor: (_j = creation.backgroundColor) !== null && _j !== void 0 ? _j : this.configuration.backgroundColor,
                textAlign: validateAlignment((_k = creation.textAlign) !== null && _k !== void 0 ? _k : this.configuration.textAlign),
                opacity: validateFiniteRange((_l = creation.opacity) !== null && _l !== void 0 ? _l : this.configuration.opacity, 'Text opacity', 0, 1),
                angle: validateFiniteRange((_m = creation.angle) !== null && _m !== void 0 ? _m : 0, 'Text angle', -36e4, 360000),
                selectable: (_o = creation.selectable) !== null && _o !== void 0 ? _o : this.configuration.selectable,
                evented: (_p = creation.evented) !== null && _p !== void 0 ? _p : this.configuration.evented,
                editable: (_q = creation.editable) !== null && _q !== void 0 ? _q : this.configuration.editable,
                originX: 'left',
                originY: 'top',
            });
            return this.authoring.create({
                kind: TEXT_ANNOTATION_KIND,
                object,
                name: (_r = creation.name) !== null && _r !== void 0 ? _r : `${this.configuration.namePrefix} ${++this.nameSequence}`,
                metadata: creation.metadata,
                hidden: creation.hidden,
                locked: creation.locked,
                select: creation.select,
                operationId: 'annotation-text:create',
            });
        }
        async beginEditing(id) {
            var _a;
            this.assertActive('begin Text editing');
            this.assertImageLoaded();
            if (this.session) {
                throw new AnnotationValidationError('A Text editing session is already active.');
            }
            const descriptor = this.annotations.get(id);
            const source = this.authoring.getObject(id, TEXT_ANNOTATION_KIND);
            if (!descriptor || !source) {
                throw new AnnotationValidationError(`Text Annotation "${id}" was not found.`);
            }
            if (descriptor.locked) {
                throw new AnnotationValidationError('Locked Text cannot enter editing.');
            }
            const preview = (await source.clone());
            preview.set({ visible: true, selectable: true, evented: true, editable: true });
            const previewId = `annotation-text:edit:${++this.previewSequence}`;
            const visibility = this.authoring.hideForPreview([id]);
            try {
                this.authoring.addPreview({
                    id: previewId,
                    ownerKind: TEXT_ANNOTATION_KIND,
                    object: preview,
                    interactive: true,
                    select: false,
                });
            }
            catch (error) {
                visibility.dispose();
                preview.dispose();
                throw error;
            }
            this.session = Object.freeze({ annotationId: id, previewId, preview, visibility });
            (_a = preview.enterEditing) === null || _a === void 0 ? void 0 : _a.call(preview);
            this.emitStatus();
        }
        async commitEditing() {
            var _a;
            this.assertActive('commit Text editing');
            const session = this.session;
            if (!session)
                return;
            const patch = normalizeFeatureUpdate$1({
                text: String((_a = session.preview.text) !== null && _a !== void 0 ? _a : ''),
                fontSize: session.preview.fontSize,
                fontFamily: session.preview.fontFamily,
                fontWeight: session.preview.fontWeight,
                fill: session.preview.fill,
                backgroundColor: session.preview.backgroundColor,
                textAlign: session.preview.textAlign,
                width: session.preview.width,
                opacity: session.preview.opacity,
            });
            this.closeSession();
            await this.authoring.updateFeature({
                id: session.annotationId,
                kind: TEXT_ANNOTATION_KIND,
                patch,
                operationId: 'annotation-text:commit-edit',
            });
        }
        cancelEditing() {
            this.assertActive('cancel Text editing');
            if (!this.session)
                return;
            this.closeSession();
        }
        update(id, patch) {
            var _a;
            this.assertActive('update Text');
            if (!isPlainRecord$3(patch)) {
                return Promise.reject(new AnnotationValidationError('Text update must be an object.'));
            }
            if (((_a = this.session) === null || _a === void 0 ? void 0 : _a.annotationId) === id) {
                return Promise.reject(new AnnotationValidationError('Commit or cancel Text editing before updating it.'));
            }
            return this.authoring.updateFeature({
                id,
                kind: TEXT_ANNOTATION_KIND,
                patch: featureUpdate(patch),
                shared: sharedUpdate$1(patch),
                operationId: 'annotation-text:update',
            });
        }
        configure(patch) {
            this.assertActive('configure Text');
            this.configuration = resolveTextConfiguration(patch, this.configuration);
            this.emitStatus();
        }
        getConfiguration() {
            this.assertActive('read Text configuration');
            return Object.freeze({
                ...this.configuration,
                fontFallbacks: Object.freeze([...this.configuration.fontFallbacks]),
            });
        }
        getEditingSession() {
            var _a;
            this.assertActive('read Text editing state');
            return this.session
                ? Object.freeze({
                    annotationId: this.session.annotationId,
                    text: String((_a = this.session.preview.text) !== null && _a !== void 0 ? _a : ''),
                })
                : null;
        }
        subscribe(listener) {
            this.assertActive('subscribe to Text status');
            if (typeof listener !== 'function') {
                throw new AnnotationValidationError('Text status listener must be a function.');
            }
            this.listeners.add(listener);
            return createDisposable(() => {
                this.listeners.delete(listener);
            });
        }
        closeForImage() {
            if (this.session)
                this.closeSession();
        }
        dispose() {
            if (this.disposed)
                return;
            if (this.session)
                this.closeSession();
            this.listeners.clear();
            this.disposed = true;
        }
        closeSession() {
            var _a, _b;
            const session = this.session;
            if (!session)
                return;
            this.session = null;
            (_b = (_a = session.preview).exitEditing) === null || _b === void 0 ? void 0 : _b.call(_a);
            this.authoring.removePreview([session.previewId]);
            session.visibility.dispose();
            this.emitStatus();
        }
        emitStatus() {
            if (this.disposed || this.listeners.size === 0)
                return;
            const status = Object.freeze({
                configuration: this.getConfiguration(),
                editing: this.getEditingSession(),
            });
            for (const listener of [...this.listeners]) {
                try {
                    listener(status);
                }
                catch (error) {
                    this.host.reportWarning(error, 'A Text Annotation status listener failed.');
                }
            }
        }
        assertImageLoaded() {
            if (!this.host.isImageLoaded()) {
                throw new AnnotationValidationError('Text Annotation requires a loaded image.');
            }
        }
        assertActive(operation) {
            if (this.disposed) {
                throw new AnnotationValidationError(`Cannot ${operation} after disposal.`);
            }
        }
    }

    const TEXT_TOOL_ID = 'annotation:text';
    const textAnnotationPluginRef = definePluginRef('annotation:text', '1.0.0');
    function textAnnotationPlugin(options = {}) {
        const initialConfiguration = resolveTextConfiguration(options);
        let controller = null;
        return definePlugin({
            ref: textAnnotationPluginRef,
            manifest: {
                id: textAnnotationPluginRef.id,
                version: '1.0.0',
                apiVersion: textAnnotationPluginRef.apiVersion,
                engine: '^3.0.0',
                requiresPlugins: [annotationFoundationRef],
                requires: [
                    { token: ANNOTATION_CAPABILITY, range: '^1.0.0' },
                    { token: ANNOTATION_AUTHORING_CAPABILITY, range: '^1.0.0' },
                    { token: CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
                    { token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                    { token: BASE_IMAGE_INFO_CAPABILITY, range: '^1.0.0' },
                ],
                permissions: ['fabric:objects'],
            },
            setupMode: 'sync',
            setup(context) {
                const annotations = context.capabilities.require(ANNOTATION_CAPABILITY);
                const authoring = context.capabilities.require(ANNOTATION_AUTHORING_CAPABILITY);
                const diagnostics = context.capabilities.require(CORE_DIAGNOSTICS_CAPABILITY);
                const fabric = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY);
                const image = context.capabilities.require(BASE_IMAGE_INFO_CAPABILITY);
                controller = new TextAnnotationController(Object.freeze({ ...diagnostics, ...fabric, ...image }), annotations, authoring, initialConfiguration);
                context.disposables.add(authoring.registerFeature(controller.featureDefinition()));
                for (const operationId of [
                    'annotation-text:create',
                    'annotation-text:update',
                    'annotation-text:commit-edit',
                ]) {
                    context.disposables.add(context.operations.register({
                        id: operationId,
                        mode: 'mutation',
                        conflictDomains: ['document', 'overlay', 'selection', 'state'],
                        reentrancy: 'reject',
                    }));
                }
                for (const operationId of [
                    'annotation-text:begin-edit',
                    'annotation-text:cancel-edit',
                    'annotation-text:configure',
                ]) {
                    context.disposables.add(context.operations.register({
                        id: operationId,
                        mode: 'busy',
                        conflictDomains: ['overlay', 'selection', 'state'],
                        reentrancy: 'queue',
                    }));
                }
                context.disposables.add(context.tools.register({
                    id: TEXT_TOOL_ID,
                    enter: () => undefined,
                    exit: () => controller === null || controller === void 0 ? void 0 : controller.cancelEditing(),
                    canRunOperation: (operationId) => operationId.startsWith('annotation-text:') ||
                        operationId.startsWith('annotation:') ||
                        operationId.endsWith(':enter') ||
                        operationId === 'crop:enter' ||
                        operationId === 'mosaic:enter' ||
                        operationId === 'core:load-image' ||
                        operationId === 'core:commit-load-image' ||
                        operationId === 'core:load-state' ||
                        operationId === 'core:export',
                }));
                const requireController = () => {
                    if (!controller)
                        throw new Error('Text Annotation Plugin is not installed.');
                    return controller;
                };
                const api = {
                    create: (createOptions) => requireController().create(createOptions),
                    beginEditing: (id) => context.operations.run('annotation-text:begin-edit', id, async (value) => {
                        await context.tools.enter(TEXT_TOOL_ID);
                        try {
                            await requireController().beginEditing(value);
                        }
                        catch (error) {
                            await context.tools.exit('operation');
                            throw error;
                        }
                    }),
                    commitEditing: async () => {
                        try {
                            await requireController().commitEditing();
                        }
                        finally {
                            if (context.tools.getActiveToolId() === TEXT_TOOL_ID) {
                                await context.tools.exit('operation');
                            }
                        }
                    },
                    cancelEditing: () => context.operations.run('annotation-text:cancel-edit', undefined, async () => {
                        requireController().cancelEditing();
                        if (context.tools.getActiveToolId() === TEXT_TOOL_ID) {
                            await context.tools.exit('requested');
                        }
                    }),
                    update: (id, patch) => requireController().update(id, patch),
                    configure: (patch) => context.operations.run('annotation-text:configure', patch, (value) => requireController().configure(value)),
                    getConfiguration: () => requireController().getConfiguration(),
                    getEditingSession: () => requireController().getEditingSession(),
                    subscribe: (listener) => requireController().subscribe(listener),
                };
                return Object.freeze(api);
            },
            onImageCleared(context) {
                if (context.tools.getActiveToolId() === TEXT_TOOL_ID) {
                    return context.tools.exit('operation');
                }
                controller === null || controller === void 0 ? void 0 : controller.closeForImage();
                return undefined;
            },
            onDispose() {
                controller === null || controller === void 0 ? void 0 : controller.dispose();
                controller = null;
            },
        });
    }

    const SHAPE_ANNOTATION_KIND = 'annotation:shape';
    const SHAPE_PLUGIN_ID = 'annotation:shape';
    const MAX_COORDINATE = 10000000;
    const MAX_SHAPE_OBJECT_BYTES = 256 * 1024;
    const MIN_GEOMETRY_SIZE = 0.5;
    function isPlainRecord$2(value) {
        if (typeof value !== 'object' || value === null || Array.isArray(value))
            return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }
    function finiteRange$1(value, label, minimum, maximum) {
        if (typeof value !== 'number' ||
            !Number.isFinite(value) ||
            value < minimum ||
            value > maximum) {
            throw new AnnotationValidationError(`${label} must be from ${minimum} to ${maximum}.`);
        }
        return value;
    }
    function booleanValue$1(value, label) {
        if (typeof value !== 'boolean')
            throw new AnnotationValidationError(`${label} must be boolean.`);
        return value;
    }
    function styleString$1(value, label, allowEmpty = false) {
        if (typeof value !== 'string' ||
            (!allowEmpty && value.length === 0) ||
            value.length > 128 ||
            [...value].some((character) => character.charCodeAt(0) < 32)) {
            throw new AnnotationValidationError(`${label} is invalid.`);
        }
        return value;
    }
    function dashArray(value) {
        if (value === null)
            return null;
        if (!Array.isArray(value) ||
            value.length > 16 ||
            value.some((entry) => typeof entry !== 'number' || !Number.isFinite(entry) || entry < 0 || entry > 1000)) {
            throw new AnnotationValidationError('Shape stroke dash array is invalid.');
        }
        return Object.freeze([...value]);
    }
    function shapeKind(value) {
        if (value === 'rect' || value === 'line' || value === 'arrow')
            return value;
        throw new AnnotationValidationError('Shape kind is invalid.');
    }
    function point(value, label) {
        if (!isPlainRecord$2(value))
            throw new AnnotationValidationError(`${label} is invalid.`);
        return Object.freeze({
            x: finiteRange$1(value.x, `${label} x`, -MAX_COORDINATE, MAX_COORDINATE),
            y: finiteRange$1(value.y, `${label} y`, -MAX_COORDINATE, MAX_COORDINATE),
        });
    }
    function normalizeShapeGeometry(value) {
        if (!isPlainRecord$2(value)) {
            throw new AnnotationValidationError('Shape geometry must be a plain object.');
        }
        const kind = shapeKind(value.kind);
        if (kind === 'rect') {
            const geometry = Object.freeze({
                kind,
                left: finiteRange$1(value.left, 'Shape left', -MAX_COORDINATE, MAX_COORDINATE),
                top: finiteRange$1(value.top, 'Shape top', -MAX_COORDINATE, MAX_COORDINATE),
                width: finiteRange$1(value.width, 'Shape width', MIN_GEOMETRY_SIZE, MAX_COORDINATE),
                height: finiteRange$1(value.height, 'Shape height', MIN_GEOMETRY_SIZE, MAX_COORDINATE),
            });
            return geometry;
        }
        const start = point(value.start, 'Shape start point');
        const end = point(value.end, 'Shape end point');
        if (Math.hypot(end.x - start.x, end.y - start.y) < MIN_GEOMETRY_SIZE) {
            throw new AnnotationValidationError('Shape line and arrow endpoints must be distinct.');
        }
        const geometry = Object.freeze({ kind, start, end });
        return geometry;
    }
    const defaultConfiguration = Object.freeze({
        stroke: '#111111',
        strokeWidth: 3,
        fill: 'rgba(0,0,0,0)',
        opacity: 1,
        strokeDashArray: null,
        arrowHeadLength: 16,
        selectable: true,
        evented: true,
        bindToImageTransform: false,
        namePrefix: 'Shape',
    });
    function resolveShapeConfiguration(value = {}, base = defaultConfiguration) {
        if (!isPlainRecord$2(value)) {
            throw new AnnotationValidationError('Shape configuration must be a plain object.');
        }
        const allowed = new Set(Object.keys(defaultConfiguration));
        if (Object.keys(value).some((key) => !allowed.has(key))) {
            throw new AnnotationValidationError('Shape configuration contains unknown keys.');
        }
        const merged = { ...base, ...value };
        return Object.freeze({
            stroke: styleString$1(merged.stroke, 'Shape stroke'),
            strokeWidth: finiteRange$1(merged.strokeWidth, 'Shape stroke width', 0.1, 1000),
            fill: styleString$1(merged.fill, 'Shape fill', true),
            opacity: finiteRange$1(merged.opacity, 'Shape opacity', 0, 1),
            strokeDashArray: dashArray(merged.strokeDashArray),
            arrowHeadLength: finiteRange$1(merged.arrowHeadLength, 'Arrow head length', 1, 1000),
            selectable: booleanValue$1(merged.selectable, 'Shape selectable'),
            evented: booleanValue$1(merged.evented, 'Shape evented'),
            bindToImageTransform: booleanValue$1(merged.bindToImageTransform, 'Shape transform binding'),
            namePrefix: styleString$1(merged.namePrefix, 'Shape name prefix'),
        });
    }
    function normalizeFeatureUpdate(value) {
        if (!isPlainRecord$2(value)) {
            throw new AnnotationValidationError('Shape update must be a plain object.');
        }
        const allowed = new Set(['stroke', 'strokeWidth', 'fill', 'opacity', 'strokeDashArray']);
        if (Object.keys(value).some((key) => !allowed.has(key))) {
            throw new AnnotationValidationError('Shape update contains unknown keys.');
        }
        return Object.freeze({
            ...(value.stroke !== undefined
                ? { stroke: styleString$1(value.stroke, 'Shape stroke') }
                : {}),
            ...(value.strokeWidth !== undefined
                ? {
                    strokeWidth: finiteRange$1(value.strokeWidth, 'Shape stroke width', 0.1, 1000),
                }
                : {}),
            ...(value.fill !== undefined ? { fill: styleString$1(value.fill, 'Shape fill', true) } : {}),
            ...(value.opacity !== undefined
                ? { opacity: finiteRange$1(value.opacity, 'Shape opacity', 0, 1) }
                : {}),
            ...(value.strokeDashArray !== undefined
                ? { strokeDashArray: dashArray(value.strokeDashArray) }
                : {}),
        });
    }
    function sharedUpdate(value) {
        return Object.freeze({
            ...(value.name !== undefined ? { name: value.name } : {}),
            ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
            ...(value.hidden !== undefined ? { hidden: value.hidden } : {}),
            ...(value.locked !== undefined ? { locked: value.locked } : {}),
        });
    }
    function buildArrowPath(geometry, headLength) {
        const angle = Math.atan2(geometry.end.y - geometry.start.y, geometry.end.x - geometry.start.x);
        const wing = Math.PI / 7;
        const first = {
            x: geometry.end.x - headLength * Math.cos(angle - wing),
            y: geometry.end.y - headLength * Math.sin(angle - wing),
        };
        const second = {
            x: geometry.end.x - headLength * Math.cos(angle + wing),
            y: geometry.end.y - headLength * Math.sin(angle + wing),
        };
        return `M ${geometry.start.x} ${geometry.start.y} L ${geometry.end.x} ${geometry.end.y} M ${geometry.end.x} ${geometry.end.y} L ${first.x} ${first.y} M ${geometry.end.x} ${geometry.end.y} L ${second.x} ${second.y}`;
    }
    function isStatePoint$1(value) {
        return (isPlainRecord$2(value) &&
            typeof value.x === 'number' &&
            Number.isFinite(value.x) &&
            typeof value.y === 'number' &&
            Number.isFinite(value.y));
    }
    function isShapeStateGeometry(value) {
        if (!isPlainRecord$2(value))
            return false;
        if (value.kind === 'rect')
            return isOverlayStateBoundsGeometry(value.bounds);
        return ((value.kind === 'line' || value.kind === 'arrow') &&
            isStatePoint$1(value.start) &&
            isStatePoint$1(value.end));
    }
    function isShapeStateData(value) {
        if (!isPlainRecord$2(value) || value.version !== 1)
            return false;
        try {
            styleString$1(value.stroke, 'Shape stroke');
            finiteRange$1(value.strokeWidth, 'Shape stroke width ratio', 1e-7, 100);
            styleString$1(value.fill, 'Shape fill', true);
            finiteRange$1(value.opacity, 'Shape opacity', 0, 1);
            dashArray(value.strokeDashArray);
            finiteRange$1(value.arrowHeadLength, 'Arrow head ratio', 1e-7, 100);
            return Object.keys(value).every((key) => [
                'version',
                'stroke',
                'strokeWidth',
                'fill',
                'opacity',
                'strokeDashArray',
                'arrowHeadLength',
            ].includes(key));
        }
        catch {
            return false;
        }
    }
    function isSerializedShape(value) {
        var _a;
        if (!isPlainRecord$2(value) || value.version !== 1 || !isPlainRecord$2(value.object))
            return false;
        try {
            const geometry = normalizeShapeGeometry(value.geometry);
            const bytes = new TextEncoder().encode(JSON.stringify(value.object)).byteLength;
            const type = String((_a = value.object.type) !== null && _a !== void 0 ? _a : '').toLowerCase();
            return (bytes <= MAX_SHAPE_OBJECT_BYTES &&
                geometry.kind === value.shapeKind &&
                ((geometry.kind === 'rect' && type === 'rect') ||
                    (geometry.kind === 'line' && type === 'line') ||
                    (geometry.kind === 'arrow' && type === 'path')));
        }
        catch {
            return false;
        }
    }
    class ShapeAnnotationController {
        constructor(host, authoring, options) {
            Object.defineProperty(this, "host", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: host
            });
            Object.defineProperty(this, "authoring", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: authoring
            });
            Object.defineProperty(this, "configuration", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: void 0
            });
            Object.defineProperty(this, "session", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: null
            });
            Object.defineProperty(this, "nameSequence", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "previewSequence", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
            this.configuration = resolveShapeConfiguration(options);
        }
        featureDefinition() {
            const definition = {
                kind: SHAPE_ANNOTATION_KIND,
                ownerPluginId: SHAPE_PLUGIN_ID,
                classify: (object) => {
                    const shape = object;
                    return ((shape.editorShapeKind === 'rect' && object instanceof this.host.fabric.Rect) ||
                        (shape.editorShapeKind === 'line' && object instanceof this.host.fabric.Line) ||
                        (shape.editorShapeKind === 'arrow' && object instanceof this.host.fabric.Path));
                },
                codec: {
                    type: 'annotation:shape-object',
                    version: '1.0.0',
                    serialize: (object) => {
                        const shape = object;
                        return Object.freeze({
                            version: 1,
                            shapeKind: shape.editorShapeKind,
                            geometry: shape.editorShapeGeometry,
                            object: object.toObject(),
                        });
                    },
                    validate: isSerializedShape,
                    deserialize: async (value, context) => {
                        if (!isSerializedShape(value)) {
                            throw new AnnotationValidationError('Serialized Shape data is malformed.');
                        }
                        const objects = await context.fabric.util.enlivenObjects([value.object]);
                        const object = objects[0];
                        if (!object) {
                            throw new AnnotationValidationError('Fabric did not restore a Shape.');
                        }
                        object.editorShapeKind = value.shapeKind;
                        object.editorShapeGeometry = normalizeShapeGeometry(value.geometry);
                        return object;
                    },
                },
                stateCodec: {
                    type: 'annotation:shape',
                    version: '1.0.0',
                    serialize: (object, context) => {
                        const shape = object;
                        const geometry = normalizeShapeGeometry(shape.editorShapeGeometry);
                        const stateGeometry = geometry.kind === 'rect'
                            ? Object.freeze({
                                kind: 'rect',
                                bounds: captureOverlayStateBounds(object, context),
                            })
                            : Object.freeze({
                                kind: geometry.kind,
                                start: Object.freeze(context.toImageNormalized(objectPointToCanvas(object, geometry.start))),
                                end: Object.freeze(context.toImageNormalized(objectPointToCanvas(object, geometry.end))),
                            });
                        const strokeDashArray = Array.isArray(object.strokeDashArray)
                            ? Object.freeze(object.strokeDashArray.map((entry) => context.toImageNormalizedScalar(entry)))
                            : null;
                        return Object.freeze({
                            geometry: stateGeometry,
                            data: Object.freeze({
                                version: 1,
                                stroke: typeof object.stroke === 'string' ? object.stroke : '#111111',
                                strokeWidth: context.toImageNormalizedScalar(Number(object.strokeWidth) || 0.1),
                                fill: typeof object.fill === 'string' ? object.fill : '',
                                opacity: Number.isFinite(object.opacity) ? object.opacity : 1,
                                strokeDashArray,
                                arrowHeadLength: context.toImageNormalizedScalar(this.configuration.arrowHeadLength),
                            }),
                        });
                    },
                    validate: (value) => isShapeStateGeometry(value.geometry) && isShapeStateData(value.data),
                    deserialize: (value, context) => {
                        if (!isShapeStateGeometry(value.geometry) || !isShapeStateData(value.data)) {
                            throw new AnnotationValidationError('Serialized Shape Annotation State data is malformed.');
                        }
                        const data = value.data;
                        const common = {
                            stroke: data.stroke,
                            strokeWidth: context.toCanvasScalar(data.strokeWidth),
                            fill: data.fill,
                            opacity: data.opacity,
                            strokeDashArray: data.strokeDashArray
                                ? data.strokeDashArray.map((entry) => context.toCanvasScalar(entry))
                                : null,
                            arrowHeadLength: context.toCanvasScalar(data.arrowHeadLength),
                        };
                        if (value.geometry.kind === 'rect') {
                            const geometry = {
                                kind: 'rect',
                                left: 0,
                                top: 0,
                                width: 1,
                                height: 1,
                            };
                            const object = this.createObject(geometry, { geometry, ...common });
                            restoreOverlayStateBounds(object, value.geometry.bounds, context, this.host.fabric);
                            return object;
                        }
                        const geometry = {
                            kind: value.geometry.kind,
                            start: context.toCanvasPoint(value.geometry.start),
                            end: context.toCanvasPoint(value.geometry.end),
                        };
                        return this.createObject(geometry, { geometry, ...common });
                    },
                },
                normalizeUpdate: normalizeFeatureUpdate,
                hasUpdate: (object, patch) => Object.entries(patch).some(([key, value]) => {
                    const current = Reflect.get(object, key);
                    return Array.isArray(value)
                        ? JSON.stringify(current) !== JSON.stringify(value)
                        : !Object.is(current, value);
                }),
                applyUpdate: (object, patch) => {
                    object.set({
                        ...patch,
                        ...(patch.strokeDashArray
                            ? { strokeDashArray: [...patch.strokeDashArray] }
                            : {}),
                    });
                    object.setCoords();
                },
                bindToImageTransform: () => this.configuration.bindToImageTransform,
            };
            return Object.freeze(definition);
        }
        enter(options) {
            this.assertActive('enter Shape');
            this.assertImageLoaded();
            if (this.session)
                throw new AnnotationValidationError('A Shape session is already active.');
            if (!isPlainRecord$2(options)) {
                throw new AnnotationValidationError('Shape session options must be a plain object.');
            }
            shapeKind(options.kind);
            this.resolveStyle(options);
            this.session = { options: Object.freeze({ ...options }), geometry: null, previewId: null };
        }
        updatePreview(geometryInput) {
            const session = this.requireSession('update Shape preview');
            const geometry = normalizeShapeGeometry(geometryInput);
            if (geometry.kind !== session.options.kind) {
                throw new AnnotationValidationError('Shape preview kind does not match the session.');
            }
            const preview = this.createObject(geometry, session.options);
            const previewId = `annotation-shape:preview:${++this.previewSequence}`;
            this.authoring.replacePreview(session.previewId ? [session.previewId] : [], {
                id: previewId,
                ownerKind: SHAPE_ANNOTATION_KIND,
                object: preview,
            });
            session.geometry = geometry;
            session.previewId = previewId;
        }
        async commit() {
            const session = this.requireSession('commit Shape');
            if (!session.geometry) {
                throw new AnnotationValidationError('Shape commit requires preview geometry.');
            }
            const definition = {
                ...session.options,
                geometry: session.geometry,
            };
            this.closeSession();
            return this.createDefinition(definition, 'annotation-shape:commit');
        }
        cancel() {
            this.assertActive('cancel Shape');
            if (this.session)
                this.closeSession();
        }
        create(definition) {
            return this.createDefinition(definition, 'annotation-shape:create');
        }
        createDefinition(definition, operationId) {
            var _a;
            this.assertActive('create Shape');
            this.assertImageLoaded();
            if (!isPlainRecord$2(definition)) {
                return Promise.reject(new AnnotationValidationError('Shape definition must be a plain object.'));
            }
            const geometry = normalizeShapeGeometry(definition.geometry);
            const object = this.createObject(geometry, definition);
            return this.authoring.create({
                kind: SHAPE_ANNOTATION_KIND,
                object,
                name: (_a = definition.name) !== null && _a !== void 0 ? _a : `${this.configuration.namePrefix} ${++this.nameSequence}`,
                metadata: definition.metadata,
                hidden: definition.hidden,
                locked: definition.locked,
                select: definition.select,
                operationId,
            });
        }
        update(id, patch) {
            this.assertActive('update Shape');
            if (!isPlainRecord$2(patch)) {
                return Promise.reject(new AnnotationValidationError('Shape update must be an object.'));
            }
            const featurePatch = normalizeFeatureUpdate({
                ...(patch.stroke !== undefined ? { stroke: patch.stroke } : {}),
                ...(patch.strokeWidth !== undefined ? { strokeWidth: patch.strokeWidth } : {}),
                ...(patch.fill !== undefined ? { fill: patch.fill } : {}),
                ...(patch.opacity !== undefined ? { opacity: patch.opacity } : {}),
                ...(patch.strokeDashArray !== undefined
                    ? { strokeDashArray: patch.strokeDashArray }
                    : {}),
            });
            return this.authoring.updateFeature({
                id,
                kind: SHAPE_ANNOTATION_KIND,
                patch: featurePatch,
                shared: sharedUpdate(patch),
                operationId: 'annotation-shape:update',
            });
        }
        configure(patch) {
            this.assertActive('configure Shape');
            this.configuration = resolveShapeConfiguration(patch, this.configuration);
        }
        getConfiguration() {
            this.assertActive('read Shape configuration');
            return Object.freeze({
                ...this.configuration,
                strokeDashArray: this.configuration.strokeDashArray
                    ? Object.freeze([...this.configuration.strokeDashArray])
                    : null,
            });
        }
        getSession() {
            this.assertActive('read Shape session');
            return this.session
                ? Object.freeze({
                    kind: this.session.options.kind,
                    geometry: this.session.geometry,
                })
                : null;
        }
        closeForImage() {
            if (this.session)
                this.closeSession();
        }
        dispose() {
            if (this.disposed)
                return;
            if (this.session)
                this.closeSession();
            this.disposed = true;
        }
        createObject(geometry, style) {
            const resolved = this.resolveStyle(style);
            const common = {
                stroke: resolved.stroke,
                strokeWidth: resolved.strokeWidth,
                fill: resolved.fill,
                opacity: resolved.opacity,
                strokeDashArray: resolved.strokeDashArray ? [...resolved.strokeDashArray] : undefined,
                selectable: resolved.selectable,
                evented: resolved.evented,
                strokeLineCap: 'round',
                strokeLineJoin: 'round',
                objectCaching: false,
            };
            let object;
            if (geometry.kind === 'rect') {
                object = new this.host.fabric.Rect({
                    ...common,
                    left: geometry.left,
                    top: geometry.top,
                    width: geometry.width,
                    height: geometry.height,
                    originX: 'left',
                    originY: 'top',
                });
            }
            else if (geometry.kind === 'line') {
                object = new this.host.fabric.Line([geometry.start.x, geometry.start.y, geometry.end.x, geometry.end.y], common);
            }
            else {
                object = new this.host.fabric.Path(buildArrowPath(geometry, resolved.arrowHeadLength), common);
            }
            object.editorShapeKind = geometry.kind;
            object.editorShapeGeometry = geometry;
            return object;
        }
        resolveStyle(value) {
            var _a, _b, _c, _d, _e, _f, _g;
            return resolveShapeConfiguration({
                stroke: (_a = value.stroke) !== null && _a !== void 0 ? _a : this.configuration.stroke,
                strokeWidth: (_b = value.strokeWidth) !== null && _b !== void 0 ? _b : this.configuration.strokeWidth,
                fill: (_c = value.fill) !== null && _c !== void 0 ? _c : this.configuration.fill,
                opacity: (_d = value.opacity) !== null && _d !== void 0 ? _d : this.configuration.opacity,
                strokeDashArray: value.strokeDashArray === undefined
                    ? this.configuration.strokeDashArray
                    : value.strokeDashArray,
                arrowHeadLength: (_e = value.arrowHeadLength) !== null && _e !== void 0 ? _e : this.configuration.arrowHeadLength,
                selectable: (_f = value.selectable) !== null && _f !== void 0 ? _f : this.configuration.selectable,
                evented: (_g = value.evented) !== null && _g !== void 0 ? _g : this.configuration.evented,
                bindToImageTransform: this.configuration.bindToImageTransform,
                namePrefix: this.configuration.namePrefix,
            });
        }
        closeSession() {
            const session = this.session;
            if (!session)
                return;
            this.session = null;
            if (session.previewId)
                this.authoring.removePreview([session.previewId]);
        }
        requireSession(operation) {
            this.assertActive(operation);
            if (!this.session) {
                throw new AnnotationValidationError(`Cannot ${operation} without a Shape session.`);
            }
            return this.session;
        }
        assertImageLoaded() {
            if (!this.host.isImageLoaded()) {
                throw new AnnotationValidationError('Shape Annotation requires a loaded image.');
            }
        }
        assertActive(operation) {
            if (this.disposed) {
                throw new AnnotationValidationError(`Cannot ${operation} after disposal.`);
            }
        }
    }

    const SHAPE_TOOL_ID = 'annotation:shape';
    const shapeAnnotationPluginRef = definePluginRef('annotation:shape', '1.0.0');
    function shapeAnnotationPlugin(options = {}) {
        const initialConfiguration = resolveShapeConfiguration(options);
        let controller = null;
        return definePlugin({
            ref: shapeAnnotationPluginRef,
            manifest: {
                id: shapeAnnotationPluginRef.id,
                version: '1.0.0',
                apiVersion: shapeAnnotationPluginRef.apiVersion,
                engine: '^3.0.0',
                requiresPlugins: [annotationFoundationRef],
                requires: [
                    { token: ANNOTATION_AUTHORING_CAPABILITY, range: '^1.0.0' },
                    { token: CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
                    { token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                    { token: BASE_IMAGE_INFO_CAPABILITY, range: '^1.0.0' },
                ],
                permissions: ['fabric:objects'],
            },
            setupMode: 'sync',
            setup(context) {
                const authoring = context.capabilities.require(ANNOTATION_AUTHORING_CAPABILITY);
                const diagnostics = context.capabilities.require(CORE_DIAGNOSTICS_CAPABILITY);
                const fabric = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY);
                const image = context.capabilities.require(BASE_IMAGE_INFO_CAPABILITY);
                controller = new ShapeAnnotationController(Object.freeze({ ...diagnostics, ...fabric, ...image }), authoring, initialConfiguration);
                context.disposables.add(authoring.registerFeature(controller.featureDefinition()));
                for (const operationId of [
                    'annotation-shape:create',
                    'annotation-shape:update',
                    'annotation-shape:commit',
                ]) {
                    context.disposables.add(context.operations.register({
                        id: operationId,
                        mode: 'mutation',
                        conflictDomains: ['document', 'overlay', 'selection', 'state'],
                        reentrancy: 'reject',
                    }));
                }
                for (const operationId of [
                    'annotation-shape:enter',
                    'annotation-shape:update-preview',
                    'annotation-shape:cancel',
                    'annotation-shape:configure',
                ]) {
                    context.disposables.add(context.operations.register({
                        id: operationId,
                        mode: 'busy',
                        conflictDomains: ['overlay', 'selection', 'state'],
                        reentrancy: 'queue',
                    }));
                }
                context.disposables.add(context.tools.register({
                    id: SHAPE_TOOL_ID,
                    enter: () => undefined,
                    exit: () => controller === null || controller === void 0 ? void 0 : controller.cancel(),
                    canRunOperation: (operationId) => operationId.startsWith('annotation-shape:') ||
                        operationId.startsWith('annotation:') ||
                        operationId.endsWith(':enter') ||
                        operationId === 'crop:enter' ||
                        operationId === 'mosaic:enter' ||
                        operationId === 'core:load-image' ||
                        operationId === 'core:commit-load-image' ||
                        operationId === 'core:load-state' ||
                        operationId === 'core:export',
                }));
                const requireController = () => {
                    if (!controller)
                        throw new Error('Shape Annotation Plugin is not installed.');
                    return controller;
                };
                const api = {
                    enter: (enterOptions) => context.operations.run('annotation-shape:enter', enterOptions, async (value) => {
                        await context.tools.enter(SHAPE_TOOL_ID);
                        try {
                            requireController().enter(value);
                        }
                        catch (error) {
                            await context.tools.exit('operation');
                            throw error;
                        }
                    }),
                    updatePreview: (geometry) => context.operations.run('annotation-shape:update-preview', geometry, (value) => requireController().updatePreview(value)),
                    commit: async () => {
                        try {
                            return await requireController().commit();
                        }
                        finally {
                            if (context.tools.getActiveToolId() === SHAPE_TOOL_ID) {
                                await context.tools.exit('operation');
                            }
                        }
                    },
                    cancel: () => context.operations.run('annotation-shape:cancel', undefined, async () => {
                        requireController().cancel();
                        if (context.tools.getActiveToolId() === SHAPE_TOOL_ID) {
                            await context.tools.exit('requested');
                        }
                    }),
                    create: async (definition) => requireController().create(definition),
                    update: async (id, patch) => requireController().update(id, patch),
                    configure: (patch) => context.operations.run('annotation-shape:configure', patch, (value) => requireController().configure(value)),
                    getConfiguration: () => requireController().getConfiguration(),
                    getSession: () => requireController().getSession(),
                };
                return Object.freeze(api);
            },
            onImageCleared(context) {
                if (context.tools.getActiveToolId() === SHAPE_TOOL_ID) {
                    return context.tools.exit('operation');
                }
                controller === null || controller === void 0 ? void 0 : controller.closeForImage();
                return undefined;
            },
            onDispose() {
                controller === null || controller === void 0 ? void 0 : controller.dispose();
                controller = null;
            },
        });
    }

    const MAX_DRAW_COORDINATE = 10000000;
    function normalizeDrawPoint(value) {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            throw new TypeError('Draw point must be an object.');
        }
        const point = value;
        if (typeof point.x !== 'number' ||
            typeof point.y !== 'number' ||
            !Number.isFinite(point.x) ||
            !Number.isFinite(point.y) ||
            Math.abs(point.x) > MAX_DRAW_COORDINATE ||
            Math.abs(point.y) > MAX_DRAW_COORDINATE) {
            throw new TypeError('Draw point coordinates must be finite and bounded.');
        }
        return Object.freeze({ x: point.x, y: point.y });
    }
    function appendInterpolatedPoints(target, point, spacing, maximumCount) {
        const previous = target[target.length - 1];
        if (!previous) {
            target.push(point);
            return;
        }
        const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
        if (distance === 0)
            return;
        const steps = Math.max(1, Math.ceil(distance / spacing));
        if (target.length + steps > maximumCount) {
            throw new RangeError(`Draw stroke exceeds the ${maximumCount}-point limit.`);
        }
        for (let index = 1; index <= steps; index += 1) {
            const ratio = index / steps;
            target.push(Object.freeze({
                x: previous.x + (point.x - previous.x) * ratio,
                y: previous.y + (point.y - previous.y) * ratio,
            }));
        }
    }
    function buildCurvedDrawPath(points) {
        const first = points[0];
        if (!first)
            return '';
        if (points.length === 1)
            return `M ${first.x} ${first.y} L ${first.x} ${first.y}`;
        if (points.length === 2) {
            const second = points[1];
            return `M ${first.x} ${first.y} L ${second.x} ${second.y}`;
        }
        const commands = [`M ${first.x} ${first.y}`];
        for (let index = 1; index < points.length - 1; index += 1) {
            const control = points[index];
            const next = points[index + 1];
            const midpoint = { x: (control.x + next.x) / 2, y: (control.y + next.y) / 2 };
            commands.push(`Q ${control.x} ${control.y} ${midpoint.x} ${midpoint.y}`);
        }
        const penultimate = points[points.length - 2];
        const last = points[points.length - 1];
        commands.push(`Q ${penultimate.x} ${penultimate.y} ${last.x} ${last.y}`);
        return commands.join(' ');
    }
    function transformPathPoint(object, point) {
        var _a;
        const offset = (_a = object.pathOffset) !== null && _a !== void 0 ? _a : { x: 0, y: 0 };
        const localX = point.x - (Number(offset.x) || 0);
        const localY = point.y - (Number(offset.y) || 0);
        const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = object.calcTransformMatrix();
        return {
            x: a * localX + c * localY + e,
            y: b * localX + d * localY + f,
        };
    }
    function distanceToSegment(point, start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const lengthSquared = dx * dx + dy * dy;
        if (lengthSquared === 0)
            return Math.hypot(point.x - start.x, point.y - start.y);
        const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
        return Math.hypot(point.x - (start.x + ratio * dx), point.y - (start.y + ratio * dy));
    }
    function drawPathIntersects(object, eraserPoints, eraserRadius) {
        var _a;
        const points = object.editorDrawPoints;
        if (!points || points.length < 2 || eraserPoints.length === 0)
            return false;
        const bounds = object.getBoundingRect();
        const scale = (_a = object.getObjectScaling) === null || _a === void 0 ? void 0 : _a.call(object);
        const strokeRadius = ((Number(object.strokeWidth) || 0) *
            Math.max(Math.abs(Number(scale === null || scale === void 0 ? void 0 : scale.x) || Number(object.scaleX) || 1), Math.abs(Number(scale === null || scale === void 0 ? void 0 : scale.y) || Number(object.scaleY) || 1))) /
            2;
        const hitRadius = eraserRadius + strokeRadius;
        if (!eraserPoints.some((point) => point.x >= bounds.left - hitRadius &&
            point.x <= bounds.left + bounds.width + hitRadius &&
            point.y >= bounds.top - hitRadius &&
            point.y <= bounds.top + bounds.height + hitRadius)) {
            return false;
        }
        const transformed = points.map((point) => transformPathPoint(object, point));
        for (const eraserPoint of eraserPoints) {
            for (let index = 1; index < transformed.length; index += 1) {
                if (distanceToSegment(eraserPoint, transformed[index - 1], transformed[index]) <=
                    hitRadius) {
                    return true;
                }
            }
        }
        return false;
    }

    const DRAW_ANNOTATION_KIND = 'annotation:draw';
    const DRAW_PLUGIN_ID = 'annotation:draw';
    const MAX_DRAW_OBJECT_BYTES = 512 * 1024;
    function isPlainRecord$1(value) {
        if (typeof value !== 'object' || value === null || Array.isArray(value))
            return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }
    function finiteRange(value, label, minimum, maximum) {
        if (typeof value !== 'number' ||
            !Number.isFinite(value) ||
            value < minimum ||
            value > maximum) {
            throw new AnnotationValidationError(`${label} must be from ${minimum} to ${maximum}.`);
        }
        return value;
    }
    function integerRange(value, label, minimum, maximum) {
        if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
            throw new AnnotationValidationError(`${label} must be an integer from ${minimum} to ${maximum}.`);
        }
        return Number(value);
    }
    function booleanValue(value, label) {
        if (typeof value !== 'boolean')
            throw new AnnotationValidationError(`${label} must be boolean.`);
        return value;
    }
    function styleString(value, label, allowEmpty = false) {
        if (typeof value !== 'string' ||
            (!allowEmpty && value.length === 0) ||
            value.length > 128 ||
            [...value].some((character) => character.charCodeAt(0) < 32)) {
            throw new AnnotationValidationError(`${label} is invalid.`);
        }
        return value;
    }
    function lineCap(value) {
        if (value === 'butt' || value === 'round' || value === 'square')
            return value;
        throw new AnnotationValidationError('Draw line cap is invalid.');
    }
    function lineJoin(value) {
        if (value === 'bevel' || value === 'round' || value === 'miter')
            return value;
        throw new AnnotationValidationError('Draw line join is invalid.');
    }
    function subMode(value) {
        if (value === 'brush' || value === 'erase')
            return value;
        throw new AnnotationValidationError('Draw sub-mode is invalid.');
    }
    const defaultBrush = Object.freeze({
        color: '#111111',
        width: 8,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
        selectable: true,
        evented: true,
        bindToImageTransform: false,
        interpolationSpacing: 2,
        maxPointCount: 8192,
        namePrefix: 'Draw',
    });
    const defaultEraser = Object.freeze({
        radius: 12,
        previewStroke: '#ffffff',
        previewStrokeWidth: 1,
        previewFill: 'rgba(0,0,0,0.15)',
        interpolationSpacing: 4,
        maxPointCount: 8192,
    });
    function resolveBrushConfiguration(value = {}, base = defaultBrush) {
        if (!isPlainRecord$1(value)) {
            throw new AnnotationValidationError('Draw brush configuration must be a plain object.');
        }
        const allowed = new Set(Object.keys(defaultBrush));
        if (Object.keys(value).some((key) => !allowed.has(key))) {
            throw new AnnotationValidationError('Draw brush configuration contains unknown keys.');
        }
        const merged = { ...base, ...value };
        return Object.freeze({
            color: styleString(merged.color, 'Draw color'),
            width: finiteRange(merged.width, 'Draw width', 0.1, 1000),
            opacity: finiteRange(merged.opacity, 'Draw opacity', 0, 1),
            lineCap: lineCap(merged.lineCap),
            lineJoin: lineJoin(merged.lineJoin),
            selectable: booleanValue(merged.selectable, 'Draw selectable'),
            evented: booleanValue(merged.evented, 'Draw evented'),
            bindToImageTransform: booleanValue(merged.bindToImageTransform, 'Draw transform binding'),
            interpolationSpacing: finiteRange(merged.interpolationSpacing, 'Draw interpolation spacing', 0.25, 1000),
            maxPointCount: integerRange(merged.maxPointCount, 'Draw point count limit', 2, 65536),
            namePrefix: styleString(merged.namePrefix, 'Draw name prefix'),
        });
    }
    function resolveEraserConfiguration(value = {}, base = defaultEraser) {
        if (!isPlainRecord$1(value)) {
            throw new AnnotationValidationError('Eraser configuration must be a plain object.');
        }
        const allowed = new Set(Object.keys(defaultEraser));
        if (Object.keys(value).some((key) => !allowed.has(key))) {
            throw new AnnotationValidationError('Eraser configuration contains unknown keys.');
        }
        const merged = { ...base, ...value };
        return Object.freeze({
            radius: finiteRange(merged.radius, 'Eraser radius', 0.5, 2000),
            previewStroke: styleString(merged.previewStroke, 'Eraser preview stroke'),
            previewStrokeWidth: finiteRange(merged.previewStrokeWidth, 'Eraser preview stroke width', 0, 100),
            previewFill: styleString(merged.previewFill, 'Eraser preview fill', true),
            interpolationSpacing: finiteRange(merged.interpolationSpacing, 'Eraser interpolation spacing', 0.25, 2000),
            maxPointCount: integerRange(merged.maxPointCount, 'Eraser point count limit', 2, 65536),
        });
    }
    function normalizePoints(value, maximumCount) {
        if (!Array.isArray(value) || value.length < 2 || value.length > maximumCount) {
            throw new AnnotationValidationError('Draw path point data is invalid.');
        }
        try {
            return Object.freeze(value.map(normalizeDrawPoint));
        }
        catch {
            throw new AnnotationValidationError('Draw path contains an invalid point.');
        }
    }
    function isSerializedDraw(value) {
        var _a;
        if (!isPlainRecord$1(value) || value.version !== 1 || !isPlainRecord$1(value.object))
            return false;
        try {
            const points = normalizePoints(value.points, 65536);
            const bytes = new TextEncoder().encode(JSON.stringify(value.object)).byteLength;
            return (points.length >= 2 &&
                bytes <= MAX_DRAW_OBJECT_BYTES &&
                String((_a = value.object.type) !== null && _a !== void 0 ? _a : '').toLowerCase() === 'path');
        }
        catch {
            return false;
        }
    }
    function isStatePoint(value) {
        return (isPlainRecord$1(value) &&
            typeof value.x === 'number' &&
            Number.isFinite(value.x) &&
            typeof value.y === 'number' &&
            Number.isFinite(value.y));
    }
    function isDrawStateGeometry(value) {
        return (isPlainRecord$1(value) &&
            value.type === 'path' &&
            Array.isArray(value.points) &&
            value.points.length >= 2 &&
            value.points.length <= 65536 &&
            value.points.every(isStatePoint));
    }
    function isDrawStateData(value) {
        if (!isPlainRecord$1(value) || value.version !== 1)
            return false;
        try {
            styleString(value.color, 'Draw color');
            finiteRange(value.width, 'Draw width ratio', 1e-7, 100);
            finiteRange(value.opacity, 'Draw opacity', 0, 1);
            lineCap(value.lineCap);
            lineJoin(value.lineJoin);
            return Object.keys(value).every((key) => ['version', 'color', 'width', 'opacity', 'lineCap', 'lineJoin'].includes(key));
        }
        catch {
            return false;
        }
    }
    class DrawAnnotationController {
        constructor(host, authoring, options) {
            Object.defineProperty(this, "host", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: host
            });
            Object.defineProperty(this, "authoring", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: authoring
            });
            Object.defineProperty(this, "brush", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: void 0
            });
            Object.defineProperty(this, "eraser", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: void 0
            });
            Object.defineProperty(this, "session", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: null
            });
            Object.defineProperty(this, "previewSequence", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "nameSequence", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
            if (!isPlainRecord$1(options)) {
                throw new AnnotationValidationError('Draw options must be a plain object.');
            }
            if (Object.keys(options).some((key) => key !== 'brush' && key !== 'eraser')) {
                throw new AnnotationValidationError('Draw options contain unknown keys.');
            }
            this.brush = resolveBrushConfiguration(options.brush);
            this.eraser = resolveEraserConfiguration(options.eraser);
        }
        featureDefinition() {
            const definition = {
                kind: DRAW_ANNOTATION_KIND,
                ownerPluginId: DRAW_PLUGIN_ID,
                classify: (object) => object instanceof this.host.fabric.Path &&
                    Array.isArray(object.editorDrawPoints),
                codec: {
                    type: 'annotation:draw-path',
                    version: '1.0.0',
                    serialize: (object) => {
                        const draw = object;
                        return Object.freeze({
                            version: 1,
                            points: draw.editorDrawPoints,
                            object: object.toObject(),
                        });
                    },
                    validate: isSerializedDraw,
                    deserialize: async (value, context) => {
                        if (!isSerializedDraw(value)) {
                            throw new AnnotationValidationError('Serialized Draw data is malformed.');
                        }
                        const objects = await context.fabric.util.enlivenObjects([value.object]);
                        const object = objects[0];
                        if (!(object instanceof context.fabric.Path)) {
                            throw new AnnotationValidationError('Fabric did not restore a Draw path.');
                        }
                        object.editorDrawPoints = normalizePoints(value.points, this.brush.maxPointCount);
                        return object;
                    },
                },
                stateCodec: {
                    type: 'annotation:draw',
                    version: '1.0.0',
                    serialize: (object, context) => {
                        var _a, _b;
                        const draw = object;
                        const points = normalizePoints(draw.editorDrawPoints, 65536).map((point) => Object.freeze(context.toImageNormalized(objectPointToCanvas(object, point))));
                        return Object.freeze({
                            geometry: Object.freeze({
                                type: 'path',
                                points: Object.freeze(points),
                            }),
                            data: Object.freeze({
                                version: 1,
                                color: typeof object.stroke === 'string' ? object.stroke : '#111111',
                                width: context.toImageNormalizedScalar(Number(object.strokeWidth) || 0.1),
                                opacity: Number.isFinite(object.opacity) ? object.opacity : 1,
                                lineCap: (_a = object.strokeLineCap) !== null && _a !== void 0 ? _a : 'round',
                                lineJoin: (_b = object.strokeLineJoin) !== null && _b !== void 0 ? _b : 'round',
                            }),
                        });
                    },
                    validate: (value) => isDrawStateGeometry(value.geometry) && isDrawStateData(value.data),
                    deserialize: (value, context) => {
                        if (!isDrawStateGeometry(value.geometry) || !isDrawStateData(value.data)) {
                            throw new AnnotationValidationError('Serialized Draw Annotation State data is malformed.');
                        }
                        const points = Object.freeze(value.geometry.points.map((point) => Object.freeze(context.toCanvasPoint(point))));
                        const object = new this.host.fabric.Path(buildCurvedDrawPath(points), {
                            fill: '',
                            stroke: value.data.color,
                            strokeWidth: context.toCanvasScalar(value.data.width),
                            opacity: value.data.opacity,
                            strokeLineCap: value.data.lineCap,
                            strokeLineJoin: value.data.lineJoin,
                            objectCaching: false,
                        });
                        object.editorDrawPoints = points;
                        return object;
                    },
                },
                bindToImageTransform: () => this.brush.bindToImageTransform,
            };
            return Object.freeze(definition);
        }
        enter(options = {}) {
            var _a;
            this.assertActive('enter Draw');
            this.assertImageLoaded();
            if (this.session)
                throw new AnnotationValidationError('A Draw session is already active.');
            if (!isPlainRecord$1(options)) {
                throw new AnnotationValidationError('Draw enter options must be a plain object.');
            }
            if (Object.keys(options).some((key) => key !== 'subMode')) {
                throw new AnnotationValidationError('Draw enter options contain unknown keys.');
            }
            this.session = {
                subMode: subMode((_a = options.subMode) !== null && _a !== void 0 ? _a : 'brush'),
                points: [],
                previewId: null,
            };
        }
        setSubMode(mode) {
            const session = this.requireSession('set Draw sub-mode');
            const normalized = subMode(mode);
            if (session.subMode === normalized)
                return;
            this.clearStroke(session);
            session.subMode = normalized;
        }
        beginStroke(value) {
            const session = this.requireSession('begin Draw stroke');
            if (session.points.length > 0) {
                throw new AnnotationValidationError('A Draw stroke is already active.');
            }
            let point;
            try {
                point = normalizeDrawPoint(value);
            }
            catch {
                throw new AnnotationValidationError('Draw point coordinates must be finite and bounded.');
            }
            session.points = [point];
            this.refreshPreview(session);
        }
        appendStroke(value) {
            const session = this.requireActiveStroke('append Draw stroke');
            let point;
            try {
                point = normalizeDrawPoint(value);
            }
            catch {
                throw new AnnotationValidationError('Draw point coordinates must be finite and bounded.');
            }
            const configuration = session.subMode === 'brush' ? this.brush : this.eraser;
            try {
                appendInterpolatedPoints(session.points, point, configuration.interpolationSpacing, configuration.maxPointCount);
            }
            catch (error) {
                throw new AnnotationValidationError(error instanceof Error ? error.message : 'Draw point limit was exceeded.');
            }
            this.refreshPreview(session);
        }
        async endStroke() {
            const session = this.requireActiveStroke('end Draw stroke');
            const points = Object.freeze([...session.points]);
            const mode = session.subMode;
            this.clearStroke(session);
            if (!this.isMeaningfulStroke(points))
                return null;
            if (mode === 'erase') {
                const ids = this.intersectedDrawIds(points);
                if (ids.length === 0)
                    return null;
                await this.authoring.removeFeatures({
                    ids,
                    kind: DRAW_ANNOTATION_KIND,
                    operationId: 'annotation-draw:commit-erase',
                });
                return null;
            }
            const object = this.createPath(points);
            return this.authoring.create({
                kind: DRAW_ANNOTATION_KIND,
                object,
                name: `${this.brush.namePrefix} ${++this.nameSequence}`,
                operationId: 'annotation-draw:commit-stroke',
            });
        }
        cancelStroke() {
            const session = this.requireSession('cancel Draw stroke');
            this.clearStroke(session);
        }
        exit() {
            this.assertActive('exit Draw');
            if (!this.session)
                return;
            this.clearStroke(this.session);
            this.session = null;
        }
        configureBrush(patch) {
            var _a;
            this.assertActive('configure Draw brush');
            if ((_a = this.session) === null || _a === void 0 ? void 0 : _a.points.length) {
                throw new AnnotationValidationError('Cancel the active Draw stroke before configuring it.');
            }
            this.brush = resolveBrushConfiguration(patch, this.brush);
        }
        configureEraser(patch) {
            var _a;
            this.assertActive('configure Eraser');
            if ((_a = this.session) === null || _a === void 0 ? void 0 : _a.points.length) {
                throw new AnnotationValidationError('Cancel the active Eraser stroke before configuring it.');
            }
            this.eraser = resolveEraserConfiguration(patch, this.eraser);
        }
        getConfiguration() {
            this.assertActive('read Draw configuration');
            return Object.freeze({ brush: this.brush, eraser: this.eraser });
        }
        getSession() {
            this.assertActive('read Draw session');
            return this.session
                ? Object.freeze({
                    subMode: this.session.subMode,
                    isStrokeActive: this.session.points.length > 0,
                    pointCount: this.session.points.length,
                })
                : null;
        }
        closeForImage() {
            if (this.session)
                this.exit();
        }
        dispose() {
            if (this.disposed)
                return;
            if (this.session)
                this.exit();
            this.disposed = true;
        }
        createPath(points) {
            const object = new this.host.fabric.Path(buildCurvedDrawPath(points), {
                fill: '',
                stroke: this.brush.color,
                strokeWidth: this.brush.width,
                opacity: this.brush.opacity,
                strokeLineCap: this.brush.lineCap,
                strokeLineJoin: this.brush.lineJoin,
                selectable: this.brush.selectable,
                evented: this.brush.evented,
                objectCaching: false,
            });
            object.editorDrawPoints = Object.freeze([...points]);
            return object;
        }
        refreshPreview(session) {
            let preview;
            if (session.subMode === 'brush') {
                preview = this.createPath(session.points);
            }
            else {
                const point = session.points[session.points.length - 1];
                preview = new this.host.fabric.Circle({
                    left: point.x,
                    top: point.y,
                    radius: this.eraser.radius,
                    originX: 'center',
                    originY: 'center',
                    fill: this.eraser.previewFill,
                    stroke: this.eraser.previewStroke,
                    strokeWidth: this.eraser.previewStrokeWidth,
                    objectCaching: false,
                });
            }
            const previewId = `annotation-draw:preview:${++this.previewSequence}`;
            this.authoring.replacePreview(session.previewId ? [session.previewId] : [], {
                id: previewId,
                ownerKind: DRAW_ANNOTATION_KIND,
                object: preview,
            });
            session.previewId = previewId;
        }
        intersectedDrawIds(points) {
            const ids = [];
            for (const object of this.authoring.listObjects(DRAW_ANNOTATION_KIND)) {
                const draw = object;
                if (draw.editorOverlayHidden || draw.editorOverlayLocked)
                    continue;
                if (drawPathIntersects(draw, points, this.eraser.radius)) {
                    const id = Reflect.get(draw, 'editorOverlayId');
                    if (typeof id === 'string')
                        ids.push(id);
                }
            }
            return Object.freeze(ids);
        }
        isMeaningfulStroke(points) {
            if (points.length < 2)
                return false;
            const first = points[0];
            return points.some((point) => Math.hypot(point.x - first.x, point.y - first.y) >= 0.5);
        }
        clearStroke(session) {
            if (session.previewId)
                this.authoring.removePreview([session.previewId]);
            session.previewId = null;
            session.points = [];
        }
        requireSession(operation) {
            this.assertActive(operation);
            if (!this.session) {
                throw new AnnotationValidationError(`Cannot ${operation} without a Draw session.`);
            }
            return this.session;
        }
        requireActiveStroke(operation) {
            const session = this.requireSession(operation);
            if (session.points.length === 0) {
                throw new AnnotationValidationError(`Cannot ${operation} without an active stroke.`);
            }
            return session;
        }
        assertImageLoaded() {
            if (!this.host.isImageLoaded()) {
                throw new AnnotationValidationError('Draw Annotation requires a loaded image.');
            }
        }
        assertActive(operation) {
            if (this.disposed) {
                throw new AnnotationValidationError(`Cannot ${operation} after disposal.`);
            }
        }
    }

    const DRAW_TOOL_ID = 'annotation:draw';
    const drawAnnotationPluginRef = definePluginRef('annotation:draw', '1.0.0');
    function drawAnnotationPlugin(options = {}) {
        const initialOptions = Object.freeze({
            brush: resolveBrushConfiguration(options.brush),
            eraser: resolveEraserConfiguration(options.eraser),
        });
        let controller = null;
        return definePlugin({
            ref: drawAnnotationPluginRef,
            manifest: {
                id: drawAnnotationPluginRef.id,
                version: '1.0.0',
                apiVersion: drawAnnotationPluginRef.apiVersion,
                engine: '^3.0.0',
                requiresPlugins: [annotationFoundationRef],
                requires: [
                    { token: ANNOTATION_AUTHORING_CAPABILITY, range: '^1.0.0' },
                    { token: CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
                    { token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                    { token: BASE_IMAGE_INFO_CAPABILITY, range: '^1.0.0' },
                ],
                permissions: ['fabric:objects'],
            },
            setupMode: 'sync',
            setup(context) {
                const authoring = context.capabilities.require(ANNOTATION_AUTHORING_CAPABILITY);
                const diagnostics = context.capabilities.require(CORE_DIAGNOSTICS_CAPABILITY);
                const fabric = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY);
                const image = context.capabilities.require(BASE_IMAGE_INFO_CAPABILITY);
                controller = new DrawAnnotationController(Object.freeze({ ...diagnostics, ...fabric, ...image }), authoring, initialOptions);
                context.disposables.add(authoring.registerFeature(controller.featureDefinition()));
                for (const operationId of [
                    'annotation-draw:commit-stroke',
                    'annotation-draw:commit-erase',
                ]) {
                    context.disposables.add(context.operations.register({
                        id: operationId,
                        mode: 'mutation',
                        conflictDomains: ['document', 'overlay', 'selection', 'state'],
                        reentrancy: 'reject',
                    }));
                }
                for (const operationId of [
                    'annotation-draw:enter',
                    'annotation-draw:set-sub-mode',
                    'annotation-draw:begin-stroke',
                    'annotation-draw:append-stroke',
                    'annotation-draw:cancel-stroke',
                    'annotation-draw:exit',
                    'annotation-draw:configure-brush',
                    'annotation-draw:configure-eraser',
                ]) {
                    context.disposables.add(context.operations.register({
                        id: operationId,
                        mode: 'busy',
                        conflictDomains: ['overlay', 'selection', 'state'],
                        reentrancy: 'queue',
                    }));
                }
                context.disposables.add(context.tools.register({
                    id: DRAW_TOOL_ID,
                    enter: () => undefined,
                    exit: () => controller === null || controller === void 0 ? void 0 : controller.exit(),
                    canRunOperation: (operationId) => operationId.startsWith('annotation-draw:') ||
                        operationId.startsWith('annotation:') ||
                        operationId.endsWith(':enter') ||
                        operationId === 'crop:enter' ||
                        operationId === 'mosaic:enter' ||
                        operationId === 'core:load-image' ||
                        operationId === 'core:commit-load-image' ||
                        operationId === 'core:load-state' ||
                        operationId === 'core:export',
                }));
                const requireController = () => {
                    if (!controller)
                        throw new Error('Draw Annotation Plugin is not installed.');
                    return controller;
                };
                const api = {
                    enter: (enterOptions = {}) => context.operations.run('annotation-draw:enter', enterOptions, async (value) => {
                        await context.tools.enter(DRAW_TOOL_ID);
                        try {
                            requireController().enter(value);
                        }
                        catch (error) {
                            await context.tools.exit('operation');
                            throw error;
                        }
                    }),
                    setSubMode: (mode) => context.operations.run('annotation-draw:set-sub-mode', mode, (value) => requireController().setSubMode(value)),
                    beginStroke: (point) => context.operations.run('annotation-draw:begin-stroke', point, (value) => requireController().beginStroke(value)),
                    appendStroke: (point) => context.operations.run('annotation-draw:append-stroke', point, (value) => requireController().appendStroke(value)),
                    endStroke: () => requireController().endStroke(),
                    cancelStroke: () => context.operations.run('annotation-draw:cancel-stroke', undefined, () => requireController().cancelStroke()),
                    exit: () => context.operations.run('annotation-draw:exit', undefined, async () => {
                        requireController().exit();
                        if (context.tools.getActiveToolId() === DRAW_TOOL_ID) {
                            await context.tools.exit('requested');
                        }
                    }),
                    configureBrush: (patch) => context.operations.run('annotation-draw:configure-brush', patch, (value) => requireController().configureBrush(value)),
                    configureEraser: (patch) => context.operations.run('annotation-draw:configure-eraser', patch, (value) => requireController().configureEraser(value)),
                    getConfiguration: () => requireController().getConfiguration(),
                    getSession: () => requireController().getSession(),
                };
                return Object.freeze(api);
            },
            onImageCleared(context) {
                if (context.tools.getActiveToolId() === DRAW_TOOL_ID) {
                    return context.tools.exit('operation');
                }
                controller === null || controller === void 0 ? void 0 : controller.closeForImage();
                return undefined;
            },
            onDispose() {
                controller === null || controller === void 0 ? void 0 : controller.dispose();
                controller = null;
            },
        });
    }

    class OverlayStateValidationError extends TypeError {
        constructor(issues) {
            const first = issues[0];
            super(`[ImageEditor] Overlay State is invalid${first ? ` at ${first.path}: ${first.message}` : '.'}`);
            Object.defineProperty(this, "code", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'OVERLAY_STATE_INVALID'
            });
            Object.defineProperty(this, "issues", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: void 0
            });
            this.name = 'OverlayStateValidationError';
            this.issues = Object.freeze([...issues]);
        }
    }
    class OverlayStateImageMissingError extends Error {
        constructor() {
            super('[ImageEditor] Overlay State requires a loaded Base Image.');
            Object.defineProperty(this, "code", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'OVERLAY_STATE_IMAGE_MISSING'
            });
            this.name = 'OverlayStateImageMissingError';
        }
    }
    class OverlayStateCodecError extends Error {
        constructor(kind, message = 'has no compatible State Codec') {
            super(`[ImageEditor] Overlay kind "${kind}" ${message}.`);
            Object.defineProperty(this, "code", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'OVERLAY_STATE_CODEC_UNAVAILABLE'
            });
            this.name = 'OverlayStateCodecError';
        }
    }
    class OverlayStateIdConflictError extends Error {
        constructor(id) {
            super(`[ImageEditor] Overlay State ID "${id}" already exists.`);
            Object.defineProperty(this, "code", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'OVERLAY_STATE_ID_CONFLICT'
            });
            this.name = 'OverlayStateIdConflictError';
        }
    }
    class OverlayStatePluginDisposedError extends Error {
        constructor(operation) {
            super(`[ImageEditor] Cannot ${operation} after Overlay State Plugin disposal.`);
            Object.defineProperty(this, "code", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'OVERLAY_STATE_PLUGIN_DISPOSED'
            });
            this.name = 'OverlayStatePluginDisposedError';
        }
    }

    function createOverlayStateContext(baseImagePort) {
        const baseImage = baseImagePort.getBaseImage();
        const imageInfo = baseImagePort.getImageInfo();
        if (!baseImage ||
            !imageInfo ||
            !Number.isSafeInteger(imageInfo.naturalWidth) ||
            imageInfo.naturalWidth <= 0 ||
            !Number.isSafeInteger(imageInfo.naturalHeight) ||
            imageInfo.naturalHeight <= 0) {
            throw new OverlayStateImageMissingError();
        }
        const matrixValue = baseImage.calcTransformMatrix();
        if (!isFiniteAffineMatrix(matrixValue)) {
            throw new TypeError('[ImageEditor] Base Image transform is invalid.');
        }
        const matrix = matrixValue;
        const inverse = invertAffine(matrix);
        const naturalWidth = imageInfo.naturalWidth;
        const naturalHeight = imageInfo.naturalHeight;
        const image = Object.freeze({
            naturalWidth,
            naturalHeight,
            mimeType: imageInfo.mimeType,
        });
        const canvasScale = Math.sqrt(Math.abs(affineDeterminant(matrix)));
        const scalarReference = Math.min(naturalWidth, naturalHeight) * canvasScale;
        if (!Number.isFinite(scalarReference) || scalarReference <= 0) {
            throw new TypeError('[ImageEditor] Base Image transform is singular.');
        }
        const codec = Object.freeze({
            image,
            toImageNormalized(point) {
                const local = applyAffineToPoint(inverse, point);
                return Object.freeze({
                    x: (local.x + naturalWidth / 2) / naturalWidth,
                    y: (local.y + naturalHeight / 2) / naturalHeight,
                });
            },
            toCanvasPoint(point) {
                return applyAffineToPoint(matrix, {
                    x: point.x * naturalWidth - naturalWidth / 2,
                    y: point.y * naturalHeight - naturalHeight / 2,
                });
            },
            toImageNormalizedScalar(value) {
                if (!Number.isFinite(value)) {
                    throw new TypeError('[ImageEditor] Overlay State scalar must be finite.');
                }
                return value / scalarReference;
            },
            toCanvasScalar(value) {
                if (!Number.isFinite(value)) {
                    throw new TypeError('[ImageEditor] Overlay State scalar must be finite.');
                }
                return value * scalarReference;
            },
        });
        return Object.freeze({ codec, image });
    }

    const OVERLAY_STATE_SCHEMA = 'image-editor.overlay-state';
    const OVERLAY_STATE_WIRE_VERSION = 1;
    const OVERLAY_STATE_COORDINATE_SPACE = 'image-normalized';

    const DEFAULT_OVERLAY_STATE_LIMITS = Object.freeze({
        maxPayloadBytes: 5000000,
        maxDepth: 32,
        maxArrayLength: 100000,
        maxOverlays: 500,
        maxMetadataKeys: 256,
        maxMetadataDepth: 8,
        maxStringLength: 10000,
        maxIdentifierLength: 128,
        maxCodecPayloadBytes: 1000000,
        maxCoordinates: 200000,
        maxCoordinateMagnitude: 1000000,
        maxDrawPoints: 100000,
        maxPathCommands: 100000,
    });
    const PERSISTENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
    const SEMVER_PATTERN$1 = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
    const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
    const ROOT_KEYS = new Set([
        'schema',
        'version',
        'coordinateSpace',
        'image',
        'overlays',
        'metadata',
    ]);
    const IMAGE_KEYS = new Set(['naturalWidth', 'naturalHeight', 'mimeType', 'sourceId', 'checksum']);
    const ITEM_KEYS = new Set([
        'id',
        'kind',
        'codec',
        'geometry',
        'layer',
        'hidden',
        'locked',
        'metadata',
        'data',
    ]);
    const CODEC_KEYS = new Set(['type', 'version']);
    const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const MAX_ISSUES = 100;
    function utf8Bytes(value) {
        let bytes = 0;
        for (let index = 0; index < value.length; index += 1) {
            const code = value.charCodeAt(index);
            if (code < 0x80)
                bytes += 1;
            else if (code < 0x800)
                bytes += 2;
            else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
                const next = value.charCodeAt(index + 1);
                if (next >= 0xdc00 && next <= 0xdfff) {
                    bytes += 4;
                    index += 1;
                }
                else
                    bytes += 3;
            }
            else
                bytes += 3;
        }
        return bytes;
    }
    function addIssue(issues, code, path, message) {
        if (issues.length >= MAX_ISSUES)
            return;
        issues.push(Object.freeze({ code, path, message }));
    }
    function accountBytes(context, amount, path) {
        context.estimatedBytes += amount;
        if (context.estimatedBytes <= context.limits.maxPayloadBytes)
            return true;
        if (!context.payloadLimitReported) {
            context.payloadLimitReported = true;
            addIssue(context.issues, 'payload.tooLarge', path, `Payload exceeds ${context.limits.maxPayloadBytes} bytes.`);
        }
        return false;
    }
    function isPlainRecord(value) {
        if (typeof value !== 'object' || value === null || Array.isArray(value))
            return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }
    function cloneJsonValue(value, path, depth, context) {
        if (depth > context.limits.maxDepth) {
            addIssue(context.issues, 'value.tooDeep', path, `Value exceeds depth ${context.limits.maxDepth}.`);
            return { ok: false };
        }
        if (value === null) {
            return { ok: accountBytes(context, 4, path), value: null };
        }
        if (typeof value === 'boolean') {
            return { ok: accountBytes(context, value ? 4 : 5, path), value };
        }
        if (typeof value === 'number') {
            if (!Number.isFinite(value)) {
                addIssue(context.issues, 'number.nonFinite', path, 'Numbers must be finite.');
                return { ok: false };
            }
            return { ok: accountBytes(context, String(value).length, path), value };
        }
        if (typeof value === 'string') {
            if (value.length > context.limits.maxStringLength) {
                addIssue(context.issues, 'string.tooLong', path, `String exceeds ${context.limits.maxStringLength} characters.`);
                return { ok: false };
            }
            return { ok: accountBytes(context, utf8Bytes(value) + 2, path), value };
        }
        if (typeof value !== 'object') {
            addIssue(context.issues, 'value.unsupported', path, 'Value must be JSON-compatible.');
            return { ok: false };
        }
        if (context.active.has(value)) {
            addIssue(context.issues, 'value.cycle', path, 'Cyclic values are not supported.');
            return { ok: false };
        }
        if (Object.getOwnPropertySymbols(value).length > 0) {
            addIssue(context.issues, 'value.symbolKey', path, 'Symbol keys are not supported.');
            return { ok: false };
        }
        context.active.add(value);
        try {
            if (Array.isArray(value)) {
                if (value.length > context.limits.maxArrayLength) {
                    addIssue(context.issues, 'array.tooLong', path, `Array exceeds ${context.limits.maxArrayLength} entries.`);
                    return { ok: false };
                }
                const keys = Object.keys(value);
                if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) {
                    addIssue(context.issues, 'array.invalidShape', path, 'Arrays must be dense and must not have named properties.');
                    return { ok: false };
                }
                const output = [];
                let ok = accountBytes(context, 2, path);
                for (let index = 0; index < value.length && !context.payloadLimitReported; index += 1) {
                    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
                    if (!descriptor || !('value' in descriptor)) {
                        addIssue(context.issues, 'value.accessor', `${path}[${index}]`, 'Accessor properties are not supported.');
                        ok = false;
                        continue;
                    }
                    const cloned = cloneJsonValue(descriptor.value, `${path}[${index}]`, depth + 1, context);
                    ok = cloned.ok && ok;
                    output.push(cloned.value);
                }
                return ok ? { ok: true, value: Object.freeze(output) } : { ok: false };
            }
            if (!isPlainRecord(value)) {
                addIssue(context.issues, 'object.invalidPrototype', path, 'Objects must use a plain or null prototype.');
                return { ok: false };
            }
            const keys = Object.keys(value).sort();
            if (keys.length > context.limits.maxArrayLength) {
                addIssue(context.issues, 'object.tooLarge', path, `Object exceeds ${context.limits.maxArrayLength} keys.`);
                return { ok: false };
            }
            if (Object.getOwnPropertyNames(value).length !== keys.length) {
                addIssue(context.issues, 'object.nonEnumerable', path, 'Non-enumerable properties are not supported.');
                return { ok: false };
            }
            const output = {};
            let ok = accountBytes(context, 2, path);
            for (const key of keys) {
                const childPath = `${path}.${key}`;
                if (DANGEROUS_KEYS.has(key)) {
                    addIssue(context.issues, 'object.dangerousKey', childPath, 'Key is not allowed.');
                    ok = false;
                    continue;
                }
                if (key.length > context.limits.maxStringLength) {
                    addIssue(context.issues, 'object.keyTooLong', childPath, 'Object key is too long.');
                    ok = false;
                    continue;
                }
                const descriptor = Object.getOwnPropertyDescriptor(value, key);
                if (!descriptor || !('value' in descriptor)) {
                    addIssue(context.issues, 'value.accessor', childPath, 'Accessor properties are not supported.');
                    ok = false;
                    continue;
                }
                accountBytes(context, utf8Bytes(key) + 3, childPath);
                const cloned = cloneJsonValue(descriptor.value, childPath, depth + 1, context);
                ok = cloned.ok && ok;
                if (cloned.ok)
                    output[key] = cloned.value;
            }
            return ok ? { ok: true, value: Object.freeze(output) } : { ok: false };
        }
        finally {
            context.active.delete(value);
        }
    }
    function resolvedPositiveInteger(value, fallback, key) {
        if (value === undefined)
            return fallback;
        if (!Number.isSafeInteger(value) || value <= 0) {
            throw new TypeError(`[ImageEditor] Overlay State limit "${key}" must be a positive integer.`);
        }
        return value;
    }
    function resolveOverlayStateLimits(base = {}, override = {}) {
        const merged = { ...base, ...override };
        const entries = Object.entries(DEFAULT_OVERLAY_STATE_LIMITS).map(([key, fallback]) => [
            key,
            resolvedPositiveInteger(merged[key], fallback, key),
        ]);
        return Object.freeze(Object.fromEntries(entries));
    }
    function hasOnlyKeys(value, allowed, path, issues) {
        const unknown = Object.keys(value).filter((key) => !allowed.has(key));
        for (const key of unknown) {
            addIssue(issues, 'object.unknownKey', `${path}.${key}`, 'Unknown field.');
        }
        return unknown.length === 0;
    }
    function validIdentifier(value, path, limits, issues, persistent = false) {
        if (typeof value !== 'string' ||
            value.length === 0 ||
            value.length > limits.maxIdentifierLength ||
            !(persistent ? PERSISTENT_ID_PATTERN.test(value) : isRuntimeIdentifier(value))) {
            addIssue(issues, 'identifier.invalid', path, 'Identifier is invalid.');
            return false;
        }
        return true;
    }
    function validateMetadata(value, path, limits, issues) {
        if (!isPlainRecord(value)) {
            addIssue(issues, 'metadata.invalid', path, 'Metadata must be an object.');
            return false;
        }
        let keys = 0;
        const visit = (entry, entryPath, depth) => {
            if (depth > limits.maxMetadataDepth) {
                addIssue(issues, 'metadata.tooDeep', entryPath, `Metadata exceeds depth ${limits.maxMetadataDepth}.`);
                return;
            }
            if (Array.isArray(entry)) {
                for (let index = 0; index < entry.length; index += 1) {
                    visit(entry[index], `${entryPath}[${index}]`, depth + 1);
                }
                return;
            }
            if (!isPlainRecord(entry))
                return;
            for (const [key, child] of Object.entries(entry)) {
                keys += 1;
                if (keys > limits.maxMetadataKeys) {
                    addIssue(issues, 'metadata.tooManyKeys', entryPath, `Metadata exceeds ${limits.maxMetadataKeys} keys.`);
                    return;
                }
                visit(child, `${entryPath}.${key}`, depth + 1);
            }
        };
        visit(value, path, 0);
        return true;
    }
    function jsonBytes(value) {
        return utf8Bytes(JSON.stringify(value));
    }
    function inspectCodecValue(value, path, limits, issues) {
        let coordinates = 0;
        const visit = (entry, entryPath, key) => {
            if (typeof entry === 'number') {
                coordinates += 1;
                if (Math.abs(entry) > limits.maxCoordinateMagnitude) {
                    addIssue(issues, 'coordinate.outOfRange', entryPath, `Coordinate magnitude exceeds ${limits.maxCoordinateMagnitude}.`);
                }
                return;
            }
            if (Array.isArray(entry)) {
                if (key === 'points' && entry.length > limits.maxDrawPoints) {
                    addIssue(issues, 'draw.tooManyPoints', entryPath, `Point count exceeds ${limits.maxDrawPoints}.`);
                }
                if ((key === 'commands' || key === 'path') && entry.length > limits.maxPathCommands) {
                    addIssue(issues, 'path.tooManyCommands', entryPath, `Path command count exceeds ${limits.maxPathCommands}.`);
                }
                entry.forEach((child, index) => visit(child, `${entryPath}[${index}]`, null));
                return;
            }
            if (!isPlainRecord(entry))
                return;
            for (const [childKey, child] of Object.entries(entry)) {
                visit(child, `${entryPath}.${childKey}`, childKey);
            }
        };
        visit(value, path, null);
        if (coordinates > limits.maxCoordinates) {
            addIssue(issues, 'coordinate.tooMany', path, `Coordinate count exceeds ${limits.maxCoordinates}.`);
        }
    }
    function validateImage(value, limits, issues) {
        if (!isPlainRecord(value)) {
            addIssue(issues, 'image.invalid', '$.image', 'Image reference must be an object.');
            return false;
        }
        hasOnlyKeys(value, IMAGE_KEYS, '$.image', issues);
        for (const key of ['naturalWidth', 'naturalHeight']) {
            const dimension = value[key];
            if (!Number.isSafeInteger(dimension) || Number(dimension) <= 0) {
                addIssue(issues, 'image.dimensionInvalid', `$.image.${key}`, 'Image dimensions must be positive safe integers.');
            }
        }
        if (value.mimeType !== undefined && !MIME_TYPES.has(String(value.mimeType))) {
            addIssue(issues, 'image.mimeTypeInvalid', '$.image.mimeType', 'MIME type is invalid.');
        }
        for (const key of ['sourceId', 'checksum']) {
            const entry = value[key];
            if (entry !== undefined &&
                (typeof entry !== 'string' ||
                    entry.length === 0 ||
                    entry.length > limits.maxStringLength)) {
                addIssue(issues, 'image.referenceInvalid', `$.image.${key}`, 'Image reference is invalid.');
            }
        }
        return true;
    }
    function validateItem(value, index, limits, issues) {
        const path = `$.overlays[${index}]`;
        if (!isPlainRecord(value)) {
            addIssue(issues, 'overlay.invalid', path, 'Overlay item must be an object.');
            return false;
        }
        hasOnlyKeys(value, ITEM_KEYS, path, issues);
        validIdentifier(value.id, `${path}.id`, limits, issues, true);
        validIdentifier(value.kind, `${path}.kind`, limits, issues);
        if (!isPlainRecord(value.codec)) {
            addIssue(issues, 'codec.invalid', `${path}.codec`, 'Codec reference must be an object.');
        }
        else {
            hasOnlyKeys(value.codec, CODEC_KEYS, `${path}.codec`, issues);
            validIdentifier(value.codec.type, `${path}.codec.type`, limits, issues);
            if (typeof value.codec.version !== 'string' ||
                value.codec.version.length > limits.maxIdentifierLength ||
                !SEMVER_PATTERN$1.test(value.codec.version)) {
                addIssue(issues, 'codec.versionInvalid', `${path}.codec.version`, 'Codec version must be valid semantic versioning.');
            }
        }
        if (!Object.prototype.hasOwnProperty.call(value, 'geometry')) {
            addIssue(issues, 'overlay.geometryMissing', `${path}.geometry`, 'Geometry is required.');
        }
        if (!Object.prototype.hasOwnProperty.call(value, 'data')) {
            addIssue(issues, 'overlay.dataMissing', `${path}.data`, 'Codec data is required.');
        }
        if (!Number.isSafeInteger(value.layer) || Number(value.layer) < 0) {
            addIssue(issues, 'overlay.layerInvalid', `${path}.layer`, 'Layer must be a non-negative integer.');
        }
        if (typeof value.hidden !== 'boolean') {
            addIssue(issues, 'overlay.hiddenInvalid', `${path}.hidden`, 'Hidden must be boolean.');
        }
        if (typeof value.locked !== 'boolean') {
            addIssue(issues, 'overlay.lockedInvalid', `${path}.locked`, 'Locked must be boolean.');
        }
        if (value.metadata !== undefined) {
            validateMetadata(value.metadata, `${path}.metadata`, limits, issues);
        }
        const codecPayload = Object.freeze({
            geometry: value.geometry,
            data: value.data,
            ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
        });
        if (jsonBytes(codecPayload) > limits.maxCodecPayloadBytes) {
            addIssue(issues, 'codec.payloadTooLarge', path, `Codec payload exceeds ${limits.maxCodecPayloadBytes} bytes.`);
        }
        inspectCodecValue(codecPayload, path, limits, issues);
        return true;
    }
    function validateOverlayStateDocument(payload, limits) {
        const issues = [];
        const cloneContext = {
            limits,
            issues,
            active: new WeakSet(),
            estimatedBytes: 0,
            payloadLimitReported: false,
        };
        const cloned = cloneJsonValue(payload, '$', 0, cloneContext);
        if (!cloned.ok || !isPlainRecord(cloned.value)) {
            if (cloned.ok)
                addIssue(issues, 'document.invalid', '$', 'Document must be an object.');
            return Object.freeze({ valid: false, errors: Object.freeze(issues) });
        }
        const document = cloned.value;
        if (jsonBytes(document) > limits.maxPayloadBytes) {
            addIssue(issues, 'payload.tooLarge', '$', `Payload exceeds ${limits.maxPayloadBytes} bytes.`);
        }
        hasOnlyKeys(document, ROOT_KEYS, '$', issues);
        if (document.schema !== OVERLAY_STATE_SCHEMA) {
            addIssue(issues, 'document.schemaUnsupported', '$.schema', 'Schema is unsupported.');
        }
        if (document.version !== OVERLAY_STATE_WIRE_VERSION) {
            addIssue(issues, 'document.versionUnsupported', '$.version', 'Wire version is unsupported.');
        }
        if (document.coordinateSpace !== OVERLAY_STATE_COORDINATE_SPACE) {
            addIssue(issues, 'document.coordinateSpaceUnsupported', '$.coordinateSpace', 'Coordinate space is unsupported.');
        }
        validateImage(document.image, limits, issues);
        if (!Array.isArray(document.overlays)) {
            addIssue(issues, 'document.overlaysInvalid', '$.overlays', 'Overlays must be an array.');
        }
        else if (document.overlays.length > limits.maxOverlays) {
            addIssue(issues, 'document.tooManyOverlays', '$.overlays', `Overlay count exceeds ${limits.maxOverlays}.`);
        }
        else {
            document.overlays.forEach((item, index) => validateItem(item, index, limits, issues));
            const ids = new Set();
            const layers = new Set();
            document.overlays.forEach((item, index) => {
                if (!isPlainRecord(item))
                    return;
                if (typeof item.id === 'string') {
                    if (ids.has(item.id)) {
                        addIssue(issues, 'overlay.duplicateId', `$.overlays[${index}].id`, 'Persistent IDs must be unique.');
                    }
                    ids.add(item.id);
                }
                if (Number.isSafeInteger(item.layer)) {
                    if (layers.has(Number(item.layer))) {
                        addIssue(issues, 'overlay.duplicateLayer', `$.overlays[${index}].layer`, 'Layer values must be unique.');
                    }
                    layers.add(Number(item.layer));
                }
            });
        }
        if (document.metadata !== undefined) {
            validateMetadata(document.metadata, '$.metadata', limits, issues);
        }
        if (issues.length > 0) {
            return Object.freeze({ valid: false, errors: Object.freeze(issues) });
        }
        return Object.freeze({
            valid: true,
            document: document,
            errors: Object.freeze([]),
        });
    }

    const IMPORT_OPERATION_ID = 'overlay-state:import';
    const MAX_PERSISTENT_ID_LENGTH = 128;
    const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
    function invalidResult(issues) {
        return Object.freeze({ valid: false, errors: Object.freeze([...issues]) });
    }
    function immutableIdMap(entries) {
        return Object.freeze(Object.fromEntries(entries));
    }
    function stateValue(document, index) {
        const item = document.overlays[index];
        return Object.freeze({
            geometry: item.geometry,
            data: item.data,
            ...(item.metadata !== undefined ? { metadata: item.metadata } : {}),
        });
    }
    function nextAvailableId(id, reserved) {
        for (let sequence = 1; sequence <= Number.MAX_SAFE_INTEGER; sequence += 1) {
            const suffix = `:copy-${sequence}`;
            const prefixLength = MAX_PERSISTENT_ID_LENGTH - suffix.length;
            const candidate = `${id.slice(0, Math.max(1, prefixLength))}${suffix}`;
            if (!reserved.has(candidate))
                return candidate;
        }
        throw new OverlayStateIdConflictError(id);
    }
    function isCodecValue(value) {
        return (typeof value === 'object' &&
            value !== null &&
            Object.prototype.hasOwnProperty.call(value, 'geometry') &&
            Object.prototype.hasOwnProperty.call(value, 'data'));
    }
    function resolveStateKind(overlay, kind) {
        const adapter = overlay.getStateKind(kind);
        const codec = adapter === null || adapter === void 0 ? void 0 : adapter.stateCodec;
        if ((adapter === null || adapter === void 0 ? void 0 : adapter.persistence.mode) !== 'persistent' ||
            !codec ||
            typeof codec.type !== 'string' ||
            !isRuntimeIdentifier(codec.type) ||
            typeof codec.version !== 'string' ||
            !SEMVER_PATTERN.test(codec.version) ||
            typeof codec.serialize !== 'function' ||
            typeof codec.validate !== 'function' ||
            typeof codec.deserialize !== 'function') {
            return null;
        }
        return Object.freeze({ adapter, codec });
    }
    function codecAccepts(codec, value) {
        if (!isCodecValue(value))
            return false;
        try {
            return codec.validate(value);
        }
        catch {
            return false;
        }
    }
    class OverlayStateController {
        constructor(overlay, baseImage, canvas, configuredLimits) {
            Object.defineProperty(this, "overlay", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: overlay
            });
            Object.defineProperty(this, "baseImage", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: baseImage
            });
            Object.defineProperty(this, "canvas", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: canvas
            });
            Object.defineProperty(this, "configuredLimits", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: configuredLimits
            });
            Object.defineProperty(this, "sequence", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
        }
        validate(payload, options = {}) {
            var _a;
            this.assertActive('validate Overlay State');
            const limits = resolveOverlayStateLimits(this.configuredLimits, options.limits);
            const structural = validateOverlayStateDocument(payload, limits);
            if (!structural.valid || !structural.document)
                return structural;
            const issues = this.validateCodecs(structural.document, (_a = options.missingKindPolicy) !== null && _a !== void 0 ? _a : 'error');
            return issues.length > 0
                ? invalidResult(issues)
                : Object.freeze({
                    valid: true,
                    document: structural.document,
                    errors: Object.freeze([]),
                });
        }
        migrate(payload, options = {}) {
            this.assertActive('migrate Overlay State');
            const limits = resolveOverlayStateLimits(this.configuredLimits, options.limits);
            const result = validateOverlayStateDocument(payload, limits);
            if (!result.valid || !result.document)
                throw new OverlayStateValidationError(result.errors);
            return result.document;
        }
        exportState(options = {}) {
            var _a, _b;
            this.assertActive('export Overlay State');
            const context = createOverlayStateContext(this.baseImage);
            const includeHidden = (_a = options.includeHidden) !== null && _a !== void 0 ? _a : true;
            const missingKindPolicy = (_b = options.missingKindPolicy) !== null && _b !== void 0 ? _b : 'error';
            const kinds = options.kinds ? new Set(options.kinds) : null;
            const objects = this.overlay.list({ includeHidden: true, includeLocked: true });
            const overlays = [];
            objects.forEach((object, layer) => {
                const classification = this.overlay.classify(object);
                if (!classification)
                    return;
                const adapter = this.overlay.getStateKind(classification.kind);
                if ((adapter === null || adapter === void 0 ? void 0 : adapter.persistence.mode) === 'transient')
                    return;
                if (kinds && !kinds.has(classification.kind))
                    return;
                if (!includeHidden && classification.hidden)
                    return;
                const resolved = resolveStateKind(this.overlay, classification.kind);
                if (!resolved) {
                    if (missingKindPolicy === 'skip')
                        return;
                    throw new OverlayStateCodecError(classification.kind);
                }
                const value = resolved.codec.serialize(object, context.codec);
                if (!codecAccepts(resolved.codec, value)) {
                    throw new OverlayStateCodecError(classification.kind, `produced invalid State Codec data for "${classification.persistentId}"`);
                }
                overlays.push({
                    id: classification.persistentId,
                    kind: classification.kind,
                    codec: Object.freeze({
                        type: resolved.codec.type,
                        version: resolved.codec.version,
                    }),
                    geometry: value.geometry,
                    layer,
                    hidden: classification.hidden,
                    locked: classification.locked,
                    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
                    data: value.data,
                });
            });
            const rawDocument = {
                schema: OVERLAY_STATE_SCHEMA,
                version: OVERLAY_STATE_WIRE_VERSION,
                coordinateSpace: OVERLAY_STATE_COORDINATE_SPACE,
                image: {
                    naturalWidth: context.image.naturalWidth,
                    naturalHeight: context.image.naturalHeight,
                    ...(context.image.mimeType ? { mimeType: context.image.mimeType } : {}),
                },
                overlays,
                ...(options.metadata !== undefined ? { metadata: options.metadata } : {}),
            };
            const result = this.validate(rawDocument, { missingKindPolicy: 'error' });
            if (!result.valid || !result.document)
                throw new OverlayStateValidationError(result.errors);
            return result.document;
        }
        async importState(payload, options = {}) {
            var _a, _b, _c, _d, _e, _f;
            this.assertActive('import Overlay State');
            const mode = (_a = options.mode) !== null && _a !== void 0 ? _a : 'replace';
            const idConflict = (_b = options.idConflict) !== null && _b !== void 0 ? _b : 'error';
            const missingKindPolicy = (_c = options.missingKindPolicy) !== null && _c !== void 0 ? _c : 'error';
            const validated = this.validate(payload, {
                missingKindPolicy,
                limits: options.limits,
            });
            if (!validated.valid || !validated.document) {
                throw new OverlayStateValidationError(validated.errors);
            }
            const document = validated.document;
            const context = createOverlayStateContext(this.baseImage);
            const existingObjects = this.overlay.list({ includeHidden: true, includeLocked: true });
            const persistentIds = [];
            const persistentObjects = [];
            const allIds = new Set();
            for (const object of existingObjects) {
                const classification = this.overlay.classify(object);
                if (!classification)
                    continue;
                allIds.add(classification.persistentId);
                if (((_d = this.overlay.getStateKind(classification.kind)) === null || _d === void 0 ? void 0 : _d.persistence.mode) === 'persistent') {
                    persistentIds.push(classification.persistentId);
                    persistentObjects.push(object);
                }
            }
            const removeIds = mode === 'replace' ? Object.freeze(persistentIds) : Object.freeze([]);
            const removeObjects = mode === 'replace' ? Object.freeze(persistentObjects) : Object.freeze([]);
            const reserved = new Set(allIds);
            if (mode === 'replace') {
                for (const id of removeIds)
                    reserved.delete(id);
            }
            const idMapEntries = [];
            const additions = [];
            let skipped = 0;
            const ordered = document.overlays
                .map((item, index) => ({ item, index }))
                .sort((left, right) => left.item.layer - right.item.layer);
            for (const { item, index } of ordered) {
                const resolved = resolveStateKind(this.overlay, item.kind);
                if (!resolved ||
                    resolved.codec.type !== item.codec.type ||
                    resolved.codec.version !== item.codec.version) {
                    if (missingKindPolicy === 'skip') {
                        skipped += 1;
                        continue;
                    }
                    throw new OverlayStateCodecError(item.kind);
                }
                let persistentId = item.id;
                if (reserved.has(persistentId)) {
                    if (idConflict === 'error')
                        throw new OverlayStateIdConflictError(persistentId);
                    const regenerated = nextAvailableId(persistentId, reserved);
                    idMapEntries.push(Object.freeze([persistentId, regenerated]));
                    persistentId = regenerated;
                }
                reserved.add(persistentId);
                const value = stateValue(document, index);
                const object = await resolved.codec.deserialize(value, context.codec);
                if (!object || typeof object !== 'object' || object.canvas) {
                    throw new OverlayStateCodecError(item.kind, 'restored an incompatible object');
                }
                const marked = object;
                marked.editorOverlayKind = item.kind;
                marked.editorOverlayId = persistentId;
                marked.editorOverlayHidden = item.hidden;
                marked.editorOverlayLocked = item.locked;
                (_f = (_e = resolved.adapter).setPersistentId) === null || _f === void 0 ? void 0 : _f.call(_e, object, persistentId);
                if (!resolved.adapter.classify(object)) {
                    throw new OverlayStateCodecError(item.kind, 'restored an incompatible object');
                }
                if (resolved.adapter.setHidden)
                    resolved.adapter.setHidden(object, item.hidden);
                else
                    object.set({ visible: !item.hidden });
                if (resolved.adapter.setLocked)
                    resolved.adapter.setLocked(object, item.locked);
                else
                    object.set({ selectable: !item.locked, evented: !item.locked });
                additions.push(Object.freeze({ kind: item.kind, persistentId, object }));
            }
            const additionObjects = Object.freeze(additions.map((entry) => entry.object));
            if (new Set(additionObjects).size !== additionObjects.length) {
                throw new OverlayStateCodecError('multiple', 'restored duplicate object identities');
            }
            if (removeIds.length > 0 || additions.length > 0) {
                await this.overlay.mutate({
                    id: `overlay-state:import-${++this.sequence}`,
                    operationId: IMPORT_OPERATION_ID,
                    action: 'delete',
                    objectIds: removeIds,
                    mutate: () => {
                        const canvas = this.canvas.requireCanvas('import Overlay State');
                        canvas.discardActiveObject();
                        for (const object of removeObjects)
                            canvas.remove(object);
                        for (const object of additionObjects)
                            canvas.add(object);
                    },
                    affectedObjects: () => additionObjects,
                    validate: () => {
                        for (const addition of additions) {
                            if (this.overlay.getByPersistentId(addition.persistentId) !==
                                addition.object) {
                                throw new OverlayStateCodecError(addition.kind, `did not restore "${addition.persistentId}"`);
                            }
                        }
                    },
                    metadata: Object.freeze({ mode, imported: additions.length, skipped }),
                });
            }
            return Object.freeze({
                mode,
                imported: additions.length,
                skipped,
                idMap: immutableIdMap(idMapEntries),
            });
        }
        dispose() {
            this.disposed = true;
        }
        validateCodecs(document, missingKindPolicy) {
            const issues = [];
            document.overlays.forEach((item, index) => {
                const resolved = resolveStateKind(this.overlay, item.kind);
                if (!resolved ||
                    resolved.codec.type !== item.codec.type ||
                    resolved.codec.version !== item.codec.version) {
                    if (missingKindPolicy === 'error') {
                        issues.push(Object.freeze({
                            code: 'codec.unavailable',
                            path: `$.overlays[${index}].codec`,
                            message: `No compatible State Codec is installed for "${item.kind}".`,
                        }));
                    }
                    return;
                }
                if (!codecAccepts(resolved.codec, stateValue(document, index))) {
                    issues.push(Object.freeze({
                        code: 'codec.payloadInvalid',
                        path: `$.overlays[${index}]`,
                        message: `State Codec payload for "${item.kind}" is invalid.`,
                    }));
                }
            });
            return Object.freeze(issues);
        }
        assertActive(operation) {
            if (this.disposed)
                throw new OverlayStatePluginDisposedError(operation);
        }
    }

    const overlayStatePluginRef = definePluginRef('plugin:overlay-state', '1.0.0');
    function overlayStatePlugin(options = {}) {
        const limits = resolveOverlayStateLimits(options.limits);
        let controller = null;
        return definePlugin({
            ref: overlayStatePluginRef,
            manifest: {
                id: overlayStatePluginRef.id,
                version: '1.0.0',
                apiVersion: overlayStatePluginRef.apiVersion,
                engine: '^3.0.0',
                requires: [
                    { token: OVERLAY_CAPABILITY, range: '^1.0.0' },
                    { token: BASE_IMAGE_READ_CAPABILITY, range: '^1.0.0' },
                    { token: CANVAS_READ_CAPABILITY, range: '^1.0.0' },
                ],
                permissions: ['fabric:canvas-read'],
            },
            setupMode: 'sync',
            setup(context) {
                const overlay = context.capabilities.require(OVERLAY_CAPABILITY);
                const baseImage = context.capabilities.require(BASE_IMAGE_READ_CAPABILITY);
                const canvas = context.capabilities.require(CANVAS_READ_CAPABILITY);
                context.operations.register({
                    id: 'overlay-state:import',
                    mode: 'mutation',
                    conflictDomains: ['document', 'overlay', 'selection', 'state'],
                    reentrancy: 'queue',
                });
                controller = new OverlayStateController(overlay, baseImage, canvas, limits);
                return controller;
            },
            onDispose() {
                controller === null || controller === void 0 ? void 0 : controller.dispose();
                controller = null;
            },
        });
    }

    class DomControlsConfigurationError extends Error {
        constructor() {
            super(...arguments);
            Object.defineProperty(this, "name", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 'DomControlsConfigurationError'
            });
        }
    }
    function isObject(value) {
        return typeof value === 'object' && value !== null;
    }
    function isEventTarget(value) {
        return (isObject(value) &&
            typeof value.addEventListener === 'function' &&
            typeof value.removeEventListener === 'function');
    }
    function isElement(value) {
        return (isObject(value) &&
            value.nodeType === 1 &&
            isObject(value.ownerDocument) &&
            isEventTarget(value));
    }
    function resolveElement(ownerDocument, target, label) {
        let element = target;
        if (typeof target === 'string') {
            try {
                element = ownerDocument.querySelector(target);
            }
            catch (error) {
                throw new DomControlsConfigurationError(`${label} uses an invalid selector "${target}": ${String(error)}`);
            }
            if (!element) {
                throw new DomControlsConfigurationError(`${label} selector "${target}" did not match an element.`);
            }
        }
        if (!isElement(element)) {
            throw new DomControlsConfigurationError(`${label} must resolve to a DOM element.`);
        }
        if (element.ownerDocument !== ownerDocument) {
            throw new DomControlsConfigurationError(`${label} belongs to a different document than ownerDocument.`);
        }
        return element;
    }
    function resolveButton(ownerDocument, target, label) {
        const element = resolveElement(ownerDocument, target, label);
        if (!('disabled' in element) || typeof element.disabled !== 'boolean') {
            throw new DomControlsConfigurationError(`${label} must resolve to a button control.`);
        }
        return element;
    }
    function resolveInput(ownerDocument, target, label) {
        const element = resolveElement(ownerDocument, target, label);
        if (!('value' in element) || !('checked' in element)) {
            throw new DomControlsConfigurationError(`${label} must resolve to an input control.`);
        }
        return element;
    }
    function resolveApi(binding, label) {
        if (!binding)
            return null;
        if (typeof binding.resolve !== 'function') {
            throw new DomControlsConfigurationError(`${label}.plugin.resolve must be a function.`);
        }
        const api = binding.resolve();
        if (!isObject(api)) {
            throw new DomControlsConfigurationError(`${label}.plugin did not resolve a Plugin API.`);
        }
        return api;
    }
    function disposeRegistration(registration) {
        const result = typeof registration === 'function' ? registration() : registration.dispose();
        if (result instanceof Promise)
            void result.catch(() => undefined);
    }
    function readNumericInput(input, label) {
        const value = input.valueAsNumber;
        const parsed = Number.isFinite(value) ? value : Number(input.value);
        if (!Number.isFinite(parsed)) {
            throw new DomControlsConfigurationError(`${label} must contain a finite number.`);
        }
        return parsed;
    }
    function isEditableNode(value, ownerDocument) {
        let current = value;
        while (isElement(current) && current.ownerDocument === ownerDocument) {
            const tagName = String(current.tagName).toLowerCase();
            if (tagName === 'input' ||
                tagName === 'textarea' ||
                tagName === 'select' ||
                current.isContentEditable === true ||
                current.getAttribute('contenteditable') === 'true' ||
                current.getAttribute('contenteditable') === '') {
                return true;
            }
            current = current.parentElement;
        }
        return false;
    }
    class DomControlsController {
        constructor(options, diagnostics) {
            Object.defineProperty(this, "diagnostics", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: diagnostics
            });
            Object.defineProperty(this, "options", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: void 0
            });
            Object.defineProperty(this, "apis", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: null
            });
            Object.defineProperty(this, "removers", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: []
            });
            Object.defineProperty(this, "subscriptions", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: []
            });
            Object.defineProperty(this, "buttons", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: []
            });
            Object.defineProperty(this, "synchronizers", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: []
            });
            Object.defineProperty(this, "occupiedBindings", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: new Map()
            });
            Object.defineProperty(this, "bound", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
            Object.defineProperty(this, "disposed", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: false
            });
            Object.defineProperty(this, "pendingActions", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            this.options = options;
        }
        bind() {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
            if (this.disposed) {
                throw new DomControlsConfigurationError('DOM Controls cannot bind after disposal.');
            }
            if (this.bound) {
                throw new DomControlsConfigurationError('DOM Controls are already bound.');
            }
            const options = this.requireOptions();
            const configured = options.transform ||
                options.history ||
                options.masks ||
                options.filters ||
                options.crop ||
                options.mosaic ||
                options.annotations ||
                options.text ||
                options.shape ||
                options.draw ||
                options.keyboard;
            if (configured && !options.ownerDocument) {
                throw new DomControlsConfigurationError('ownerDocument is required when DOM controls are configured.');
            }
            try {
                this.apis = Object.freeze({
                    transform: resolveApi((_a = options.transform) === null || _a === void 0 ? void 0 : _a.plugin, 'transform'),
                    history: resolveApi((_b = options.history) === null || _b === void 0 ? void 0 : _b.plugin, 'history'),
                    masks: resolveApi((_c = options.masks) === null || _c === void 0 ? void 0 : _c.plugin, 'masks'),
                    filters: resolveApi((_d = options.filters) === null || _d === void 0 ? void 0 : _d.plugin, 'filters'),
                    crop: resolveApi((_e = options.crop) === null || _e === void 0 ? void 0 : _e.plugin, 'crop'),
                    mosaic: resolveApi((_f = options.mosaic) === null || _f === void 0 ? void 0 : _f.plugin, 'mosaic'),
                    annotations: resolveApi((_g = options.annotations) === null || _g === void 0 ? void 0 : _g.plugin, 'annotations'),
                    text: resolveApi((_h = options.text) === null || _h === void 0 ? void 0 : _h.plugin, 'text'),
                    shape: resolveApi((_j = options.shape) === null || _j === void 0 ? void 0 : _j.plugin, 'shape'),
                    draw: resolveApi((_k = options.draw) === null || _k === void 0 ? void 0 : _k.plugin, 'draw'),
                    overlays: resolveApi((_l = options.keyboard) === null || _l === void 0 ? void 0 : _l.overlays, 'keyboard.overlays'),
                });
                if (options.ownerDocument)
                    this.bindConfiguredControls(options.ownerDocument, options);
                this.bound = true;
                this.refresh();
            }
            catch (error) {
                this.releaseBindings();
                this.apis = null;
                throw error;
            }
        }
        refresh() {
            if (this.disposed) {
                throw new DomControlsConfigurationError('DOM Controls cannot refresh after disposal.');
            }
            if (!this.bound) {
                throw new DomControlsConfigurationError('DOM Controls cannot refresh before editor initialization.');
            }
            for (const synchronize of this.synchronizers)
                synchronize();
            for (const button of this.buttons) {
                button.element.disabled = this.pendingActions > 0 || !button.available();
            }
        }
        refreshFromRuntime() {
            if (!this.bound || this.disposed)
                return;
            try {
                this.refresh();
            }
            catch (error) {
                this.reportActionError('dom-controls:refresh', error);
            }
        }
        getStatus() {
            return Object.freeze({
                isBound: this.bound,
                isBusy: this.pendingActions > 0,
                isDisposed: this.disposed,
                bindingCount: this.removers.length + this.subscriptions.length,
            });
        }
        dispose() {
            if (this.disposed)
                return;
            this.disposed = true;
            this.releaseBindings();
            this.apis = null;
            this.options = null;
            this.bound = false;
        }
        bindConfiguredControls(ownerDocument, options) {
            this.bindTransform(ownerDocument, options);
            this.bindHistory(ownerDocument, options);
            this.bindMasks(ownerDocument, options);
            this.bindFilters(ownerDocument, options);
            this.bindCrop(ownerDocument, options);
            this.bindMosaic(ownerDocument, options);
            this.bindAnnotations(ownerDocument, options);
            this.bindText(ownerDocument, options);
            this.bindShape(ownerDocument, options);
            this.bindDraw(ownerDocument, options);
            this.bindKeyboard(ownerDocument, options);
        }
        bindTransform(ownerDocument, options) {
            const controls = options.transform;
            const api = this.requireApis().transform;
            if (!controls || !api)
                return;
            if (controls.scaleInput) {
                const input = resolveInput(ownerDocument, controls.scaleInput, 'transform.scaleInput');
                this.listen(input, 'change', () => {
                    const scale = readNumericInput(input, 'transform.scaleInput');
                    this.runAction('transform:scale', () => api.scale(scale));
                });
                this.synchronizers.push(() => {
                    input.value = String(api.getState().scale);
                });
            }
            this.button(ownerDocument, controls.zoomInButton, 'transform.zoomInButton', () => api.zoomIn());
            this.button(ownerDocument, controls.zoomOutButton, 'transform.zoomOutButton', () => api.zoomOut());
            this.button(ownerDocument, controls.rotateLeftButton, 'transform.rotateLeftButton', () => api.rotate(-90));
            this.button(ownerDocument, controls.rotateRightButton, 'transform.rotateRightButton', () => api.rotate(90));
            this.button(ownerDocument, controls.flipHorizontalButton, 'transform.flipHorizontalButton', () => api.flipHorizontal());
            this.button(ownerDocument, controls.flipVerticalButton, 'transform.flipVerticalButton', () => api.flipVertical());
            this.button(ownerDocument, controls.resetButton, 'transform.resetButton', () => api.resetImageTransform());
            this.render(ownerDocument, controls.status, 'transform.status', () => api.getState());
        }
        bindHistory(ownerDocument, options) {
            const controls = options.history;
            const api = this.requireApis().history;
            if (!controls || !api)
                return;
            if (controls.enabledInput) {
                const input = resolveInput(ownerDocument, controls.enabledInput, 'history.enabledInput');
                this.listen(input, 'change', () => {
                    this.runAction('history:toggle', () => input.checked
                        ? api.enable({ baseline: 'current' })
                        : api.disable({ clear: false }));
                });
                this.synchronizers.push(() => {
                    input.checked = api.getState().isEnabled;
                    input.disabled = this.pendingActions > 0;
                });
            }
            this.button(ownerDocument, controls.undoButton, 'history.undoButton', () => api.undo(), () => api.canUndo());
            this.button(ownerDocument, controls.redoButton, 'history.redoButton', () => api.redo(), () => api.canRedo());
            this.button(ownerDocument, controls.clearButton, 'history.clearButton', () => api.clear(), () => api.length > 0);
            this.render(ownerDocument, controls.status, 'history.status', () => api.getState());
            this.subscribe(api.onChange(() => this.refreshFromRuntime()));
        }
        bindMasks(ownerDocument, options) {
            const controls = options.masks;
            const api = this.requireApis().masks;
            if (!controls || !api)
                return;
            this.button(ownerDocument, controls.removeSelectedButton, 'masks.removeSelectedButton', () => api.removeSelected(), () => api.getAll().length > 0);
            this.button(ownerDocument, controls.removeAllButton, 'masks.removeAllButton', () => api.removeAll(), () => api.getAll().length > 0);
            this.render(ownerDocument, controls.list, 'masks.list', () => api.getAll());
        }
        bindFilters(ownerDocument, options) {
            const controls = options.filters;
            const api = this.requireApis().filters;
            if (!controls || !api)
                return;
            let status = Object.freeze({
                isPreviewing: api.isPreviewing,
                committedFilterCount: api.getState().filters.length,
                previewFilterCount: 0,
                configuration: api.getConfiguration(),
            });
            this.button(ownerDocument, controls.commitButton, 'filters.commitButton', () => api.commit(), () => api.isPreviewing);
            this.button(ownerDocument, controls.cancelButton, 'filters.cancelButton', () => api.cancelPreview(), () => api.isPreviewing);
            this.button(ownerDocument, controls.clearButton, 'filters.clearButton', () => api.clear(), () => api.getState().filters.length > 0);
            this.render(ownerDocument, controls.status, 'filters.status', () => status);
            this.subscribe(api.subscribe((nextStatus) => {
                status = nextStatus;
                this.refreshFromRuntime();
            }));
        }
        bindCrop(ownerDocument, options) {
            const controls = options.crop;
            const api = this.requireApis().crop;
            if (!controls || !api)
                return;
            this.button(ownerDocument, controls.enterButton, 'crop.enterButton', () => api.enter(controls.enterOptions), () => !api.isActive);
            this.button(ownerDocument, controls.applyButton, 'crop.applyButton', () => api.apply(), () => api.isActive);
            this.button(ownerDocument, controls.cancelButton, 'crop.cancelButton', () => api.cancel(), () => api.isActive);
            this.render(ownerDocument, controls.status, 'crop.status', () => Object.freeze({ isActive: api.isActive, session: api.getSession() }));
            this.subscribe(api.subscribe(() => this.refreshFromRuntime()));
        }
        bindMosaic(ownerDocument, options) {
            const controls = options.mosaic;
            const api = this.requireApis().mosaic;
            if (!controls || !api)
                return;
            this.button(ownerDocument, controls.enterButton, 'mosaic.enterButton', () => api.enter(controls.enterOptions), () => !api.isActive);
            this.button(ownerDocument, controls.commitButton, 'mosaic.commitButton', () => api.commit(), () => api.isActive);
            this.button(ownerDocument, controls.cancelButton, 'mosaic.cancelButton', () => api.cancel(), () => api.isActive);
            this.render(ownerDocument, controls.status, 'mosaic.status', () => Object.freeze({ isActive: api.isActive, session: api.getSession() }));
            this.subscribe(api.subscribe(() => this.refreshFromRuntime()));
        }
        bindAnnotations(ownerDocument, options) {
            const controls = options.annotations;
            const api = this.requireApis().annotations;
            if (!controls || !api)
                return;
            const status = () => {
                const annotations = api.list({ includeHidden: true, includeLocked: true });
                return Object.freeze({
                    annotations,
                    selectionIds: Object.freeze(annotations.filter((entry) => entry.selected).map((entry) => entry.id)),
                });
            };
            this.button(ownerDocument, controls.clearSelectionButton, 'annotations.clearSelectionButton', () => api.clearSelection(), () => status().selectionIds.length > 0);
            this.button(ownerDocument, controls.removeSelectionButton, 'annotations.removeSelectionButton', async () => {
                const selected = status().annotations.filter((entry) => entry.selected && !entry.locked);
                for (const entry of selected)
                    await api.remove(entry.id);
            }, () => status().annotations.some((entry) => entry.selected && !entry.locked));
            this.button(ownerDocument, controls.removeAllButton, 'annotations.removeAllButton', () => api.removeAll(), () => status().annotations.length > 0);
            this.render(ownerDocument, controls.list, 'annotations.list', () => status().annotations);
            this.render(ownerDocument, controls.status, 'annotations.status', status);
            this.subscribe(api.subscribe(() => this.refreshFromRuntime()));
        }
        bindText(ownerDocument, options) {
            const controls = options.text;
            const api = this.requireApis().text;
            if (!controls || !api)
                return;
            this.button(ownerDocument, controls.createButton, 'text.createButton', () => api.create(controls.createOptions));
            this.button(ownerDocument, controls.commitButton, 'text.commitButton', () => api.commitEditing(), () => api.getEditingSession() !== null);
            this.button(ownerDocument, controls.cancelButton, 'text.cancelButton', () => api.cancelEditing(), () => api.getEditingSession() !== null);
            this.render(ownerDocument, controls.status, 'text.status', () => Object.freeze({ editing: api.getEditingSession() }));
            this.subscribe(api.subscribe(() => this.refreshFromRuntime()));
        }
        bindShape(ownerDocument, options) {
            const controls = options.shape;
            const api = this.requireApis().shape;
            if (!controls || !api)
                return;
            if (controls.enterButton && !controls.enterOptions) {
                throw new DomControlsConfigurationError('shape.enterOptions is required when shape.enterButton is configured.');
            }
            this.button(ownerDocument, controls.enterButton, 'shape.enterButton', () => api.enter(controls.enterOptions), () => api.getSession() === null);
            this.button(ownerDocument, controls.commitButton, 'shape.commitButton', () => api.commit(), () => { var _a; return ((_a = api.getSession()) === null || _a === void 0 ? void 0 : _a.geometry) !== null && api.getSession() !== null; });
            this.button(ownerDocument, controls.cancelButton, 'shape.cancelButton', () => api.cancel(), () => api.getSession() !== null);
            this.render(ownerDocument, controls.status, 'shape.status', () => api.getSession());
        }
        bindDraw(ownerDocument, options) {
            const controls = options.draw;
            const api = this.requireApis().draw;
            if (!controls || !api)
                return;
            this.button(ownerDocument, controls.enterButton, 'draw.enterButton', () => api.enter(controls.enterOptions), () => api.getSession() === null);
            this.button(ownerDocument, controls.cancelStrokeButton, 'draw.cancelStrokeButton', () => api.cancelStroke(), () => { var _a; return ((_a = api.getSession()) === null || _a === void 0 ? void 0 : _a.isStrokeActive) === true; });
            this.button(ownerDocument, controls.exitButton, 'draw.exitButton', () => api.exit(), () => api.getSession() !== null);
            this.render(ownerDocument, controls.status, 'draw.status', () => api.getSession());
        }
        bindKeyboard(ownerDocument, options) {
            const keyboard = options.keyboard;
            if (!keyboard)
                return;
            const target = this.resolveKeyboardTarget(ownerDocument, keyboard.target);
            this.listen(target, 'keydown', (event) => {
                const keyboardEvent = event;
                if (keyboard.allowInEditable !== true &&
                    isEditableNode(keyboardEvent.target, ownerDocument)) {
                    return;
                }
                const action = this.keyboardAction(keyboardEvent, options);
                if (!action)
                    return;
                keyboardEvent.preventDefault();
                this.runAction(action.name, action.run);
            });
        }
        keyboardAction(event, options) {
            var _a, _b, _c, _d, _e, _f, _g;
            const keyboard = options.keyboard;
            const apis = this.requireApis();
            const modifier = event.ctrlKey || event.metaKey;
            const key = event.key.toLowerCase();
            if (keyboard.historyActions !== false && modifier && !event.altKey) {
                if ((key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey)) {
                    if (!((_a = apis.history) === null || _a === void 0 ? void 0 : _a.canRedo()))
                        return null;
                    return Object.freeze({ name: 'history:redo', run: () => apis.history.redo() });
                }
                if (key === 'z' && !event.shiftKey) {
                    if (!((_b = apis.history) === null || _b === void 0 ? void 0 : _b.canUndo()))
                        return null;
                    return Object.freeze({ name: 'history:undo', run: () => apis.history.undo() });
                }
            }
            if (keyboard.cancelActiveSession !== false &&
                event.key === 'Escape' &&
                !modifier &&
                !event.altKey) {
                const cancellers = [];
                if ((_c = apis.text) === null || _c === void 0 ? void 0 : _c.getEditingSession())
                    cancellers.push(() => apis.text.cancelEditing());
                if ((_d = apis.shape) === null || _d === void 0 ? void 0 : _d.getSession())
                    cancellers.push(() => apis.shape.cancel());
                if ((_e = apis.draw) === null || _e === void 0 ? void 0 : _e.getSession())
                    cancellers.push(() => apis.draw.exit());
                if ((_f = apis.crop) === null || _f === void 0 ? void 0 : _f.isActive)
                    cancellers.push(() => apis.crop.cancel());
                if ((_g = apis.mosaic) === null || _g === void 0 ? void 0 : _g.isActive)
                    cancellers.push(() => apis.mosaic.cancel());
                if (cancellers.length === 0)
                    return null;
                return Object.freeze({
                    name: 'dom-controls:cancel-active-session',
                    run: () => Promise.all(cancellers.map((cancel) => cancel())),
                });
            }
            if (keyboard.removeSelection !== false &&
                (event.key === 'Delete' || event.key === 'Backspace') &&
                !modifier &&
                !event.altKey &&
                !event.shiftKey) {
                const overlays = apis.overlays;
                if (!overlays)
                    return null;
                const ids = overlays.getSelection().ids.filter((id) => {
                    var _a;
                    const object = overlays.getByPersistentId(id);
                    return object ? ((_a = overlays.classify(object)) === null || _a === void 0 ? void 0 : _a.locked) === false : false;
                });
                if (ids.length === 0)
                    return null;
                return Object.freeze({
                    name: 'overlay:remove-selection',
                    run: () => overlays.remove(ids),
                });
            }
            return null;
        }
        resolveKeyboardTarget(ownerDocument, target) {
            if (target === undefined || target === ownerDocument)
                return ownerDocument;
            if (typeof target === 'string' || isElement(target)) {
                return resolveElement(ownerDocument, target, 'keyboard.target');
            }
            if (!isEventTarget(target) || (isObject(target) && target.nodeType !== 9)) {
                throw new DomControlsConfigurationError('keyboard.target must be ownerDocument, an element, or a selector.');
            }
            throw new DomControlsConfigurationError('keyboard.target belongs to a different document than ownerDocument.');
        }
        button(ownerDocument, target, label, action, available = () => true) {
            if (!target)
                return;
            const element = resolveButton(ownerDocument, target, label);
            this.buttons.push({ element, available });
            this.listen(element, 'click', () => this.runAction(label, action));
        }
        render(ownerDocument, adapter, label, read) {
            if (!adapter)
                return;
            if (typeof adapter.render !== 'function') {
                throw new DomControlsConfigurationError(`${label}.render must be a function.`);
            }
            const target = resolveElement(ownerDocument, adapter.target, `${label}.target`);
            this.synchronizers.push(() => adapter.render(target, read()));
        }
        listen(target, eventName, listener) {
            var _a;
            const events = (_a = this.occupiedBindings.get(target)) !== null && _a !== void 0 ? _a : new Set();
            if (events.has(eventName)) {
                throw new DomControlsConfigurationError(`The same target cannot bind the "${eventName}" event more than once.`);
            }
            events.add(eventName);
            this.occupiedBindings.set(target, events);
            target.addEventListener(eventName, listener);
            this.removers.push(() => target.removeEventListener(eventName, listener));
        }
        subscribe(registration) {
            this.subscriptions.push(registration);
        }
        runAction(action, run) {
            if (this.disposed || !this.bound)
                return;
            this.pendingActions += 1;
            this.refreshFromRuntime();
            void Promise.resolve()
                .then(run)
                .catch((error) => this.reportActionError(action, error))
                .finally(() => {
                this.pendingActions = Math.max(0, this.pendingActions - 1);
                this.refreshFromRuntime();
            });
        }
        reportActionError(action, error) {
            var _a;
            const event = Object.freeze({ action, error });
            const listener = (_a = this.options) === null || _a === void 0 ? void 0 : _a.onActionError;
            if (listener) {
                try {
                    listener(event);
                }
                catch (listenerError) {
                    this.diagnostics.reportWarning(listenerError, `DOM Controls error listener failed while handling "${action}".`);
                }
            }
            this.diagnostics.reportError(error, `DOM Controls action "${action}" failed.`);
        }
        releaseBindings() {
            for (let index = this.subscriptions.length - 1; index >= 0; index -= 1) {
                try {
                    disposeRegistration(this.subscriptions[index]);
                }
                catch (error) {
                    this.diagnostics.reportWarning(error, 'DOM Controls subscription cleanup failed.');
                }
            }
            for (let index = this.removers.length - 1; index >= 0; index -= 1) {
                try {
                    this.removers[index]();
                }
                catch (error) {
                    this.diagnostics.reportWarning(error, 'DOM Controls listener cleanup failed.');
                }
            }
            this.subscriptions.length = 0;
            this.removers.length = 0;
            this.buttons.length = 0;
            this.synchronizers.length = 0;
            this.occupiedBindings.clear();
        }
        requireOptions() {
            if (!this.options) {
                throw new DomControlsConfigurationError('DOM Controls options are unavailable.');
            }
            return this.options;
        }
        requireApis() {
            if (!this.apis) {
                throw new DomControlsConfigurationError('DOM Controls Plugin APIs are unavailable.');
            }
            return this.apis;
        }
    }

    const domControlsPluginRef = definePluginRef('plugin:dom-controls', '1.0.0');
    function collectPluginDependencies(options) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        const bindings = [
            (_a = options.transform) === null || _a === void 0 ? void 0 : _a.plugin,
            (_b = options.history) === null || _b === void 0 ? void 0 : _b.plugin,
            (_c = options.masks) === null || _c === void 0 ? void 0 : _c.plugin,
            (_d = options.filters) === null || _d === void 0 ? void 0 : _d.plugin,
            (_e = options.crop) === null || _e === void 0 ? void 0 : _e.plugin,
            (_f = options.mosaic) === null || _f === void 0 ? void 0 : _f.plugin,
            (_g = options.annotations) === null || _g === void 0 ? void 0 : _g.plugin,
            (_h = options.text) === null || _h === void 0 ? void 0 : _h.plugin,
            (_j = options.shape) === null || _j === void 0 ? void 0 : _j.plugin,
            (_k = options.draw) === null || _k === void 0 ? void 0 : _k.plugin,
            (_l = options.keyboard) === null || _l === void 0 ? void 0 : _l.overlays,
        ];
        const dependencies = new Map();
        for (const binding of bindings) {
            if (!binding)
                continue;
            if (!binding.ref || typeof binding.resolve !== 'function') {
                throw new DomControlsConfigurationError('Each configured DOM section requires a PluginRef and API resolver.');
            }
            const existing = dependencies.get(binding.ref.id);
            if (existing && existing !== binding.ref) {
                throw new DomControlsConfigurationError(`DOM Controls received conflicting PluginRef objects for "${binding.ref.id}".`);
            }
            dependencies.set(binding.ref.id, binding.ref);
        }
        return Object.freeze([...dependencies.values()]);
    }
    function domControlsPlugin(options = {}) {
        const requiresPlugins = collectPluginDependencies(options);
        let configuredOptions = options;
        let controller = null;
        return definePlugin({
            ref: domControlsPluginRef,
            manifest: {
                id: domControlsPluginRef.id,
                version: '1.0.0',
                apiVersion: domControlsPluginRef.apiVersion,
                engine: '^3.0.0',
                requiresPlugins,
                requires: [{ token: CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' }],
            },
            setupMode: 'sync',
            setup(context) {
                if (!configuredOptions) {
                    throw new DomControlsConfigurationError('DOM Controls options are unavailable.');
                }
                controller = new DomControlsController(configuredOptions, context.capabilities.require(CORE_DIAGNOSTICS_CAPABILITY));
                configuredOptions = null;
                context.disposables.add(controller);
                for (const operationId of ['dom-controls:bind', 'dom-controls:refresh']) {
                    context.disposables.add(context.operations.register({
                        id: operationId,
                        mode: 'busy',
                        conflictDomains: ['state'],
                        reentrancy: 'queue',
                    }));
                }
                for (const eventName of [
                    'document:committed',
                    'geometry:committed',
                    'image:loaded',
                    'image:cleared',
                    'state:loaded',
                ]) {
                    context.disposables.add(context.events.on(eventName, () => controller === null || controller === void 0 ? void 0 : controller.refreshFromRuntime()));
                }
                const requireController = () => {
                    if (!controller) {
                        throw new DomControlsConfigurationError('DOM Controls are not installed.');
                    }
                    return controller;
                };
                return Object.freeze({
                    refresh: () => requireController().refresh(),
                    getStatus: () => requireController().getStatus(),
                });
            },
            onInit() {
                controller === null || controller === void 0 ? void 0 : controller.bind();
            },
            onDispose() {
                controller === null || controller === void 0 ? void 0 : controller.dispose();
                configuredOptions = null;
            },
        });
    }

    function createDomBinding(editor, ref) {
        return Object.freeze({
            ref,
            resolve: () => editor.requirePlugin(ref),
        });
    }
    function createDomPlugin(factory, bindings) {
        if (!factory)
            return null;
        const plugin = factory(bindings);
        if (!plugin || plugin.ref.id !== 'plugin:dom-controls' || plugin.ref.apiVersion !== '1.0.0') {
            throw new TypeError('domControls must create the public DOM Controls Plugin with API version 1.0.0.');
        }
        return plugin;
    }

    function createFullPreset(fabric, options = {}) {
        const editor = new ImageEditorCore(fabric, options.core);
        const definitions = {
            transform: transformPlugin(options.transform),
            history: historyPlugin(options.history),
            overlays: overlayFoundationPlugin(),
            masks: maskPlugin(options.masks),
            filters: filtersPlugin(options.filters),
            crop: cropPlugin(options.crop),
            mosaic: mosaicPlugin(options.mosaic),
            annotations: annotationFoundationPlugin(options.annotations),
            text: textAnnotationPlugin(options.text),
            shape: shapeAnnotationPlugin(options.shape),
            draw: drawAnnotationPlugin(options.draw),
            overlayState: overlayStatePlugin(options.overlayState),
        };
        const bindings = Object.freeze({
            transform: createDomBinding(editor, transformPluginRef),
            history: createDomBinding(editor, historyPluginRef),
            overlays: createDomBinding(editor, overlayFoundationRef),
            masks: createDomBinding(editor, maskPluginRef),
            filters: createDomBinding(editor, filtersPluginRef),
            crop: createDomBinding(editor, cropPluginRef),
            mosaic: createDomBinding(editor, mosaicPluginRef),
            annotations: createDomBinding(editor, annotationFoundationRef),
            text: createDomBinding(editor, textAnnotationPluginRef),
            shape: createDomBinding(editor, shapeAnnotationPluginRef),
            draw: createDomBinding(editor, drawAnnotationPluginRef),
            overlayState: createDomBinding(editor, overlayStatePluginRef),
        });
        const domDefinition = createDomPlugin(options.domControls, bindings);
        if (domDefinition) {
            const apis = editor.install(composePlugins({ ...definitions, domControls: domDefinition }));
            return Object.freeze({ editor, ...apis });
        }
        const apis = editor.install(composePlugins(definitions));
        return Object.freeze({ editor, ...apis, domControls: null });
    }

    exports.ANNOTATION_AUTHORING_CAPABILITY = ANNOTATION_AUTHORING_CAPABILITY;
    exports.ANNOTATION_CAPABILITY = ANNOTATION_CAPABILITY;
    exports.AnnotationError = AnnotationError;
    exports.AnnotationNotFoundError = AnnotationNotFoundError;
    exports.AnnotationValidationError = AnnotationValidationError;
    exports.BASE_IMAGE_INFO_CAPABILITY = BASE_IMAGE_INFO_CAPABILITY;
    exports.BASE_IMAGE_READ_CAPABILITY = BASE_IMAGE_READ_CAPABILITY;
    exports.CANVAS_READ_CAPABILITY = CANVAS_READ_CAPABILITY;
    exports.CANVAS_RESIZE_CAPABILITY = CANVAS_RESIZE_CAPABILITY;
    exports.CORE_API_VERSION = CORE_API_VERSION;
    exports.CORE_DIAGNOSTICS_CAPABILITY = CORE_DIAGNOSTICS_CAPABILITY;
    exports.CORE_PRESENTATION_CAPABILITY = CORE_PRESENTATION_CAPABILITY;
    exports.CORE_STATUS_CAPABILITY = CORE_STATUS_CAPABILITY;
    exports.CapabilityConflictError = CapabilityConflictError;
    exports.CapabilityMissingError = CapabilityMissingError;
    exports.CapabilityVersionError = CapabilityVersionError;
    exports.CropError = CropError;
    exports.CropIntegrationError = CropIntegrationError;
    exports.CropSessionError = CropSessionError;
    exports.CropValidationError = CropValidationError;
    exports.DEFAULT_OVERLAY_STATE_LIMITS = DEFAULT_OVERLAY_STATE_LIMITS;
    exports.DOCUMENT_MUTATION_CAPABILITY = DOCUMENT_MUTATION_CAPABILITY;
    exports.DomControlsConfigurationError = DomControlsConfigurationError;
    exports.EXPORT_CONTRIBUTION_CAPABILITY = EXPORT_CONTRIBUTION_CAPABILITY;
    exports.FABRIC_RUNTIME_CAPABILITY = FABRIC_RUNTIME_CAPABILITY;
    exports.FilterBakeValidationError = FilterBakeValidationError;
    exports.FilterDefinitionError = FilterDefinitionError;
    exports.FilterImplementationError = FilterImplementationError;
    exports.FiltersPluginDisposedError = FiltersPluginDisposedError;
    exports.FiltersPreviewMissingError = FiltersPreviewMissingError;
    exports.GEOMETRY_MUTATION_CAPABILITY = GEOMETRY_MUTATION_CAPABILITY;
    exports.HISTORY_CAPABILITY = HISTORY_CAPABILITY;
    exports.IMAGE_RESOURCE_POLICY_CAPABILITY = IMAGE_RESOURCE_POLICY_CAPABILITY;
    exports.ImageEditorCore = ImageEditorCore;
    exports.MAX_SUPPORTED_FILTER_COUNT = MAX_SUPPORTED_FILTER_COUNT;
    exports.MEMENTO_HISTORY_CAPABILITY = MEMENTO_HISTORY_CAPABILITY;
    exports.MosaicError = MosaicError;
    exports.MosaicIntegrationError = MosaicIntegrationError;
    exports.MosaicSessionError = MosaicSessionError;
    exports.MosaicValidationError = MosaicValidationError;
    exports.OVERLAY_CAPABILITY = OVERLAY_CAPABILITY;
    exports.OVERLAY_REGISTRATION_CAPABILITY = OVERLAY_REGISTRATION_CAPABILITY;
    exports.OVERLAY_STATE_COORDINATE_SPACE = OVERLAY_STATE_COORDINATE_SPACE;
    exports.OVERLAY_STATE_SCHEMA = OVERLAY_STATE_SCHEMA;
    exports.OVERLAY_STATE_WIRE_VERSION = OVERLAY_STATE_WIRE_VERSION;
    exports.OverlayRecoverableObjectError = OverlayRecoverableObjectError;
    exports.OverlayStateCodecError = OverlayStateCodecError;
    exports.OverlayStateIdConflictError = OverlayStateIdConflictError;
    exports.OverlayStateImageMissingError = OverlayStateImageMissingError;
    exports.OverlayStatePluginDisposedError = OverlayStatePluginDisposedError;
    exports.OverlayStateValidationError = OverlayStateValidationError;
    exports.PluginApiVersionError = PluginApiVersionError;
    exports.PluginBatchInstallError = PluginBatchInstallError;
    exports.PluginDefinitionConflictError = PluginDefinitionConflictError;
    exports.PluginDependencyCycleError = PluginDependencyCycleError;
    exports.PluginDependencyError = PluginDependencyError;
    exports.PluginEngineVersionError = PluginEngineVersionError;
    exports.PluginError = PluginError;
    exports.PluginIdentityConflictError = PluginIdentityConflictError;
    exports.PluginManifestError = PluginManifestError;
    exports.PluginNotInstalledError = PluginNotInstalledError;
    exports.PluginPermissionError = PluginPermissionError;
    exports.PluginSetupError = PluginSetupError;
    exports.RASTER_MUTATION_CAPABILITY = RASTER_MUTATION_CAPABILITY;
    exports.RENDER_REQUEST_CAPABILITY = RENDER_REQUEST_CAPABILITY;
    exports.SNAPSHOT_REGISTRATION_CAPABILITY = SNAPSHOT_REGISTRATION_CAPABILITY;
    exports.SUPPORTED_FILTER_TYPES = SUPPORTED_FILTER_TYPES;
    exports.VISIBLE_RASTER_BAKE_CAPABILITY = VISIBLE_RASTER_BAKE_CAPABILITY;
    exports.annotationFoundationPlugin = annotationFoundationPlugin;
    exports.annotationFoundationRef = annotationFoundationRef;
    exports.areFilterDefinitionsEqual = areFilterDefinitionsEqual;
    exports.captureOverlayStateBounds = captureOverlayStateBounds;
    exports.composePlugins = composePlugins;
    exports.createCapabilityToken = createCapabilityToken;
    exports.createDisposable = createDisposable;
    exports.createFullPreset = createFullPreset;
    exports.cropPlugin = cropPlugin;
    exports.cropPluginRef = cropPluginRef;
    exports.definePlugin = definePlugin;
    exports.definePluginRef = definePluginRef;
    exports.disposeInReverseSync = disposeInReverseSync;
    exports.domControlsPlugin = domControlsPlugin;
    exports.domControlsPluginRef = domControlsPluginRef;
    exports.drawAnnotationPlugin = drawAnnotationPlugin;
    exports.drawAnnotationPluginRef = drawAnnotationPluginRef;
    exports.filtersPlugin = filtersPlugin;
    exports.filtersPluginRef = filtersPluginRef;
    exports.historyPlugin = historyPlugin;
    exports.historyPluginRef = historyPluginRef;
    exports.isOverlayStateBoundsGeometry = isOverlayStateBoundsGeometry;
    exports.isRuntimeIdentifier = isRuntimeIdentifier;
    exports.isValidSemVer = isValidSemVer;
    exports.maskPlugin = maskPlugin;
    exports.maskPluginRef = maskPluginRef;
    exports.mosaicPlugin = mosaicPlugin;
    exports.mosaicPluginRef = mosaicPluginRef;
    exports.normalizeFilterDefinitions = normalizeFilterDefinitions;
    exports.objectPointToCanvas = objectPointToCanvas;
    exports.overlayFoundationPlugin = overlayFoundationPlugin;
    exports.overlayFoundationRef = overlayFoundationRef;
    exports.overlayStatePlugin = overlayStatePlugin;
    exports.overlayStatePluginRef = overlayStatePluginRef;
    exports.restoreOverlayStateBounds = restoreOverlayStateBounds;
    exports.shapeAnnotationPlugin = shapeAnnotationPlugin;
    exports.shapeAnnotationPluginRef = shapeAnnotationPluginRef;
    exports.textAnnotationPlugin = textAnnotationPlugin;
    exports.textAnnotationPluginRef = textAnnotationPluginRef;
    exports.transformPlugin = transformPlugin;
    exports.transformPluginRef = transformPluginRef;
    exports.validatePluginManifest = validatePluginManifest;

}));
//# sourceMappingURL=image-editor.full.umd.js.map
