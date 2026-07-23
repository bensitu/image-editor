'use strict';

var pluginIdentifier = require('./plugin-identifier-DPwx4Gkd.cjs');

const numericIdentifier = '(?:0|[1-9]\\d*)';
const prereleaseIdentifier = `(?:${numericIdentifier}|\\d*[A-Za-z-][0-9A-Za-z-]*)`;
const semVerPattern = new RegExp(`^(${numericIdentifier})\\.(${numericIdentifier})\\.(${numericIdentifier})(?:-(${prereleaseIdentifier}(?:\\.${prereleaseIdentifier})*))?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`, 'u');
const partialVersionPattern = new RegExp(`^(${numericIdentifier})(?:\\.(${numericIdentifier}|[xX*]))?(?:\\.(${numericIdentifier}|[xX*]))?$`, 'u');
const comparatorPattern = /^(<=|>=|<|>|=|~|\^)?(.+)$/u;
const MAX_SEMVER_INPUT_LENGTH = 256;
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
    return (version.length <= MAX_SEMVER_INPUT_LENGTH &&
        version.trim() === version &&
        semVerPattern.test(version));
}
function isValidSemVerRange(range) {
    return range.length <= MAX_SEMVER_INPUT_LENGTH && normalizeRange(range) !== null;
}
function satisfiesSemVer(version, range) {
    if (version.length > MAX_SEMVER_INPUT_LENGTH ||
        range.length > MAX_SEMVER_INPUT_LENGTH ||
        version.trim() !== version) {
        return false;
    }
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
    if (!pluginIdentifier.isRuntimeIdentifier(id)) {
        throw new pluginIdentifier.InvalidPluginDefinitionError('CapabilityToken id must use namespace:kebab-case and be at most 128 characters.');
    }
    if (!isValidSemVer(version)) {
        throw new pluginIdentifier.InvalidCapabilityVersionError(id, version, 'version');
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
        throw new pluginIdentifier.InvalidCapabilityVersionError('unknown', (_a = requirement === null || requirement === void 0 ? void 0 : requirement.range) !== null && _a !== void 0 ? _a : '', 'range');
    }
    if (!isValidSemVerRange(requirement.range)) {
        throw new pluginIdentifier.InvalidCapabilityVersionError(token.id, requirement.range, 'range');
    }
}

const pluginRefBrand = Symbol('ImageEditorPluginRef');
function definePluginRef(id, apiVersion) {
    pluginIdentifier.assertPluginIdentifier(id, 'PluginRef id');
    if (apiVersion.length > 64 || !isValidSemVer(apiVersion)) {
        throw new pluginIdentifier.InvalidPluginDefinitionError(`PluginRef "${id}" has invalid API SemVer "${apiVersion}".`, id);
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
        throw new pluginIdentifier.PluginManifestError(`${fieldName} must be an array containing at most ${maximum} entries.`);
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
            throw new pluginIdentifier.PluginManifestError(`Plugin "${pluginId}" has an invalid capability requirement in ${fieldName}.`, { pluginId, cause });
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
            throw new pluginIdentifier.PluginManifestError(`Plugin "${pluginId}" requiresPlugins entries must use definePluginRef().`, { pluginId });
        }
        if (dependency.id === pluginId) {
            throw new pluginIdentifier.PluginManifestError(`Plugin "${pluginId}" cannot depend on itself.`, {
                pluginId,
            });
        }
        if (dependencyIds.has(dependency.id)) {
            throw new pluginIdentifier.PluginManifestError(`Plugin "${pluginId}" declares dependency "${dependency.id}" more than once.`, { pluginId });
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
            throw new pluginIdentifier.PluginManifestError(`Plugin "${pluginId}" declares unsupported permission "${String(permission)}".`, { pluginId });
        }
        const typedPermission = permission;
        if (permissionSet.has(typedPermission)) {
            throw new pluginIdentifier.PluginManifestError(`Plugin "${pluginId}" declares permission "${typedPermission}" more than once.`, { pluginId });
        }
        permissionSet.add(typedPermission);
        return typedPermission;
    });
    return Object.freeze(validated);
}
function validatePluginManifest(ref, manifest) {
    if (typeof manifest !== 'object' || manifest === null) {
        throw new pluginIdentifier.PluginManifestError(`Plugin "${ref.id}" must define a manifest.`, {
            pluginId: ref.id,
        });
    }
    const manifestId = pluginIdentifier.assertPluginIdentifier(manifest.id, 'Plugin manifest id');
    if (manifestId !== ref.id)
        throw new pluginIdentifier.PluginIdentityConflictError(ref.id, manifestId);
    if (typeof manifest.version !== 'string' ||
        manifest.version.length > MAX_VERSION_LENGTH ||
        !isValidSemVer(manifest.version)) {
        throw new pluginIdentifier.PluginManifestError(`Plugin "${ref.id}" has invalid implementation SemVer "${String(manifest.version)}".`, { pluginId: ref.id });
    }
    if (typeof manifest.apiVersion !== 'string' ||
        manifest.apiVersion.length > MAX_VERSION_LENGTH ||
        !isValidSemVer(manifest.apiVersion)) {
        throw new pluginIdentifier.PluginManifestError(`Plugin "${ref.id}" has invalid API SemVer "${String(manifest.apiVersion)}".`, { pluginId: ref.id });
    }
    if (manifest.apiVersion !== ref.apiVersion) {
        throw new pluginIdentifier.PluginApiVersionError(ref.id, ref.apiVersion, manifest.apiVersion);
    }
    if (typeof manifest.engine !== 'string' ||
        manifest.engine.length > MAX_VERSION_LENGTH ||
        !isValidSemVerRange(manifest.engine)) {
        throw new pluginIdentifier.InvalidPluginDefinitionError(`Plugin "${ref.id}" has invalid engine SemVer range "${String(manifest.engine)}".`, ref.id);
    }
    if (!satisfiesSemVer(CORE_API_VERSION, manifest.engine)) {
        throw new pluginIdentifier.PluginEngineVersionError(ref.id, manifest.engine, CORE_API_VERSION);
    }
    const requiresPlugins = freezePluginDependencies(ref.id, manifest.requiresPlugins);
    const requires = freezeRequirements(ref.id, manifest.requires, 'Plugin manifest requires');
    const optional = freezeRequirements(ref.id, manifest.optional, 'Plugin manifest optional');
    const capabilityIds = new Set();
    for (const requirement of [...(requires !== null && requires !== void 0 ? requires : []), ...(optional !== null && optional !== void 0 ? optional : [])]) {
        if (capabilityIds.has(requirement.token.id)) {
            throw new pluginIdentifier.PluginManifestError(`Plugin "${ref.id}" declares capability "${requirement.token.id}" more than once.`, { pluginId: ref.id });
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
exports.assertCapabilityRequirement = assertCapabilityRequirement;
exports.createCapabilityToken = createCapabilityToken;
exports.definePluginRef = definePluginRef;
exports.isCapabilityToken = isCapabilityToken;
exports.isPluginPermission = isPluginPermission;
exports.isPluginRef = isPluginRef;
exports.isValidSemVer = isValidSemVer;
exports.satisfiesSemVer = satisfiesSemVer;
exports.validatePluginManifest = validatePluginManifest;
//# sourceMappingURL=plugin-manifest-DNqSyjh2.cjs.map
