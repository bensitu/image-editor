'use strict';

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
const MAX_CAPABILITY_ID_LENGTH = 128;
const CAPABILITY_ID_PATTERN = /^[A-Za-z0-9@][A-Za-z0-9@._:/-]*$/u;
const prohibitedCapabilitySegments = new Set(['__proto__', 'constructor', 'prototype']);
function createCapabilityToken(id, version) {
    if (typeof id !== 'string' ||
        id.length === 0 ||
        id.length > MAX_CAPABILITY_ID_LENGTH ||
        id.trim() !== id ||
        !CAPABILITY_ID_PATTERN.test(id) ||
        id.split(/[.:/]/u).some((segment) => prohibitedCapabilitySegments.has(segment))) {
        throw new InvalidPluginDefinitionError(`CapabilityToken id must be a safe, trimmed identifier no longer than ${MAX_CAPABILITY_ID_LENGTH} characters.`);
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

const MAX_PLUGIN_ID_LENGTH = 128;
const PROHIBITED_PROPERTY_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const PLUGIN_ID_PATTERN = /^[A-Za-z0-9@][A-Za-z0-9@._:/-]*$/u;
function assertPluginIdentifier(pluginId, fieldName = 'Plugin id') {
    if (typeof pluginId !== 'string' ||
        pluginId.length === 0 ||
        pluginId.length > MAX_PLUGIN_ID_LENGTH ||
        pluginId.trim() !== pluginId ||
        !PLUGIN_ID_PATTERN.test(pluginId)) {
        throw new InvalidPluginDefinitionError(`${fieldName} must be a safe, trimmed identifier no longer than ${MAX_PLUGIN_ID_LENGTH} characters.`, typeof pluginId === 'string' ? pluginId : undefined);
    }
    const segments = pluginId.split(/[.:/]/u);
    if (segments.some((segment) => PROHIBITED_PROPERTY_KEYS.has(segment))) {
        throw new InvalidPluginDefinitionError(`${fieldName} contains a prohibited property key.`, pluginId);
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

exports.CORE_API_VERSION = CORE_API_VERSION;
exports.CapabilityConflictError = CapabilityConflictError;
exports.CapabilityMissingError = CapabilityMissingError;
exports.CapabilityVersionError = CapabilityVersionError;
exports.InvalidCapabilityVersionError = InvalidCapabilityVersionError;
exports.InvalidPluginDefinitionError = InvalidPluginDefinitionError;
exports.OperationConflictError = OperationConflictError;
exports.OperationRegistrationError = OperationRegistrationError;
exports.PluginAggregateError = PluginAggregateError;
exports.PluginAlreadyInstalledError = PluginAlreadyInstalledError;
exports.PluginApiVersionError = PluginApiVersionError;
exports.PluginBatchInstallError = PluginBatchInstallError;
exports.PluginCapabilityError = PluginCapabilityError;
exports.PluginDefinitionConflictError = PluginDefinitionConflictError;
exports.PluginDependencyCycleError = PluginDependencyCycleError;
exports.PluginDependencyError = PluginDependencyError;
exports.PluginEngineVersionError = PluginEngineVersionError;
exports.PluginError = PluginError;
exports.PluginIdentityConflictError = PluginIdentityConflictError;
exports.PluginKernelDisposedError = PluginKernelDisposedError;
exports.PluginKernelStateError = PluginKernelStateError;
exports.PluginLifecycleError = PluginLifecycleError;
exports.PluginManifestError = PluginManifestError;
exports.PluginNotInstalledError = PluginNotInstalledError;
exports.PluginPermissionError = PluginPermissionError;
exports.PluginSetupError = PluginSetupError;
exports.PluginVersionMismatchError = PluginVersionMismatchError;
exports.ToolRegistrationError = ToolRegistrationError;
exports.ToolTransitionError = ToolTransitionError;
exports.assertCapabilityRequirement = assertCapabilityRequirement;
exports.createCapabilityToken = createCapabilityToken;
exports.definePluginRef = definePluginRef;
exports.isCapabilityToken = isCapabilityToken;
exports.isPluginPermission = isPluginPermission;
exports.isPluginRef = isPluginRef;
exports.isValidSemVer = isValidSemVer;
exports.satisfiesSemVer = satisfiesSemVer;
exports.validatePluginManifest = validatePluginManifest;
//# sourceMappingURL=plugin-manifest-Cap1WbD8.cjs.map
