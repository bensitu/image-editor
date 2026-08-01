(function(global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ?  factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory((global.ImageEditor = global.ImageEditor || {})));
})(this, function(exports) {
Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
//#region dist/esm/plugin-kernel/errors.js
	function createPluginErrorOptions(pluginId, cause) {
		return {
			...pluginId ? { pluginId } : {},
			...cause === void 0 ? {} : { cause }
		};
	}
	function derivePluginErrorName(code) {
		return `${code.replace("PLUGIN_DEPENDENCY_MISSING", "PLUGIN_DEPENDENCY").replace("PLUGIN_BATCH_INSTALL_FAILED", "PLUGIN_BATCH_INSTALL").replace("PLUGIN_PERMISSION_REQUIRED", "PLUGIN_PERMISSION").replace(/_ERROR$/u, "").toLowerCase().replace(/(?:^|_)[a-z]/gu, (match) => match.slice(-1).toUpperCase())}Error`;
	}
	var PluginError = class PluginError extends Error {
		constructor(code, message, options = {}) {
			super(message);
			this.name = new.target === PluginError ? "PluginError" : derivePluginErrorName(code);
			this.code = code;
			this.pluginId = options.pluginId;
			this.cause = options.cause;
		}
	};
	var PluginManifestError = class extends PluginError {
		constructor(message, options = {}) {
			super("PLUGIN_MANIFEST_ERROR", `[ImageEditor] ${message}`, options);
		}
	};
	var PluginIdentityConflictError = class extends PluginManifestError {
		constructor(referenceId, manifestId) {
			super(`Plugin reference "${referenceId}" does not match manifest identity "${manifestId}".`, { pluginId: referenceId });
			Object.defineProperty(this, "name", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: "PluginIdentityConflictError"
			});
			this.referenceId = referenceId;
			this.manifestId = manifestId;
		}
	};
	var PluginEngineVersionError = class extends PluginManifestError {
		constructor(pluginId, engineRange, coreApiVersion) {
			super(`Plugin "${pluginId}" requires engine range "${engineRange}", which does not include Core API "${coreApiVersion}".`, { pluginId });
			Object.defineProperty(this, "name", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: "PluginEngineVersionError"
			});
			this.engineRange = engineRange;
			this.coreApiVersion = coreApiVersion;
		}
	};
	var PluginApiVersionError = class extends PluginManifestError {
		constructor(pluginId, referenceApiVersion, manifestApiVersion) {
			super(`Plugin "${pluginId}" reference API version "${referenceApiVersion}" does not match manifest API version "${manifestApiVersion}".`, { pluginId });
			Object.defineProperty(this, "name", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: "PluginApiVersionError"
			});
			this.referenceApiVersion = referenceApiVersion;
			this.manifestApiVersion = manifestApiVersion;
		}
	};
	var PluginAggregateError = class extends PluginError {
		constructor(message, errors, options = {}) {
			var _a;
			super("PLUGIN_AGGREGATE_ERROR", message, {
				...options,
				cause: (_a = options.cause) !== null && _a !== void 0 ? _a : errors[0]
			});
			this.errors = Object.freeze([...errors]);
		}
	};
	var PluginAlreadyInstalledError = class extends PluginError {
		constructor(pluginId) {
			super("PLUGIN_ALREADY_INSTALLED", `[ImageEditor] Plugin "${pluginId}" is already installed. Direct duplicate installation is not allowed.`, { pluginId });
		}
	};
	var PluginDefinitionAlreadyBoundError = class extends PluginError {
		constructor(pluginId, boundHostState) {
			super("PLUGIN_DEFINITION_ALREADY_BOUND", `[ImageEditor] Plugin Definition "${pluginId}" is already bound to another Host in state "${boundHostState}". Dispose that Host before reusing the same Definition object.`, { pluginId });
			this.boundHostState = boundHostState;
		}
	};
	var PluginNotInstalledError = class extends PluginError {
		constructor(pluginId) {
			super("PLUGIN_NOT_INSTALLED", `[ImageEditor] Plugin "${pluginId}" is not installed.`, { pluginId });
		}
	};
	var PluginDependencyError = class extends PluginError {
		constructor(details) {
			const packageHint = details.packageHint ? ` Package hint: ${details.packageHint}.` : "";
			const available = details.availablePluginIds.length > 0 ? details.availablePluginIds.join(", ") : "none";
			super("PLUGIN_DEPENDENCY_MISSING", `[ImageEditor] Plugin "${details.consumerPluginId}" requires Plugin "${details.dependencyId}" API "${details.requiredApiVersion}", but it is not available. Available Plugins: ${available}.${packageHint} ${details.planHint}`, { pluginId: details.consumerPluginId });
			this.consumerPluginId = details.consumerPluginId;
			this.dependencyId = details.dependencyId;
			this.requiredApiVersion = details.requiredApiVersion;
			this.availablePluginIds = Object.freeze([...details.availablePluginIds]);
			this.packageHint = details.packageHint;
			this.planHint = details.planHint;
		}
	};
	var PluginDependencyCycleError = class extends PluginError {
		constructor(cycle) {
			super("PLUGIN_DEPENDENCY_CYCLE", `[ImageEditor] Plugin dependency cycle detected: ${cycle.join(" -> ")}.`, createPluginErrorOptions(cycle[0]));
			this.cycle = Object.freeze([...cycle]);
		}
	};
	var PluginDefinitionConflictError = class extends PluginError {
		constructor(pluginId) {
			super("PLUGIN_DEFINITION_CONFLICT", `[ImageEditor] Plugin "${pluginId}" has conflicting immutable installation definitions.`, { pluginId });
		}
	};
	var PluginBatchInstallError = class extends PluginError {
		constructor(cause, cleanupErrors = []) {
			super("PLUGIN_BATCH_INSTALL_FAILED", "[ImageEditor] Plugin batch installation failed and was rolled back.", { cause });
			this.cleanupErrors = Object.freeze([...cleanupErrors]);
		}
	};
	var PluginPermissionError = class extends PluginError {
		constructor(pluginId, permission, capabilityId, operation = "access a privileged Capability") {
			super("PLUGIN_PERMISSION_REQUIRED", `[ImageEditor] Plugin "${pluginId}" must declare permission "${permission}" to ${operation} "${capabilityId}".`, { pluginId });
			this.permission = permission;
			this.capabilityId = capabilityId;
			this.operation = operation;
		}
	};
	var CapabilityMissingError = class extends PluginError {
		constructor(details) {
			const available = details.availableProviders.length > 0 ? details.availableProviders.join(", ") : "none";
			super("CAPABILITY_MISSING", `[ImageEditor] Plugin "${details.consumerPluginId}" requires Capability "${details.capabilityId}" range "${details.requestedRange}", but no provider is available. Available providers: ${available}. Include a declared provider in the Plugin Plan.`, { pluginId: details.consumerPluginId });
			this.consumerPluginId = details.consumerPluginId;
			this.capabilityId = details.capabilityId;
			this.requestedRange = details.requestedRange;
			this.availableProviders = Object.freeze([...details.availableProviders]);
		}
	};
	var CapabilityVersionError = class extends PluginError {
		constructor(details, code = "CAPABILITY_VERSION_ERROR", message) {
			var _a, _b;
			const provider = details.providerPluginId ? ` from provider "${details.providerPluginId}"` : "";
			const consumer = details.consumerPluginId ? ` for Plugin "${details.consumerPluginId}"` : "";
			super(code, message !== null && message !== void 0 ? message : `[ImageEditor] Capability "${details.capabilityId}" version "${(_a = details.actualVersion) !== null && _a !== void 0 ? _a : "unavailable"}"${provider} does not satisfy "${details.expectedRange}"${consumer}.`, createPluginErrorOptions((_b = details.consumerPluginId) !== null && _b !== void 0 ? _b : details.providerPluginId, details.cause));
			this.capabilityId = details.capabilityId;
			this.expectedRange = details.expectedRange;
			this.actualVersion = details.actualVersion;
			this.providerPluginId = details.providerPluginId;
			this.consumerPluginId = details.consumerPluginId;
		}
	};
	var PluginCapabilityError = class extends PluginError {
		constructor(details) {
			var _a, _b;
			const installed = (_a = details.installedVersion) !== null && _a !== void 0 ? _a : "not installed";
			const provider = (_b = details.providerPluginId) !== null && _b !== void 0 ? _b : "none";
			super("PLUGIN_CAPABILITY_ERROR", `[ImageEditor] Plugin "${details.consumerPluginId}" requires capability "${details.capabilityId}" range "${details.requestedRange}", but installed version is "${installed}" from provider "${provider}" (${details.reason}).`, {
				pluginId: details.consumerPluginId,
				cause: details.cause
			});
			this.consumerPluginId = details.consumerPluginId;
			this.capabilityId = details.capabilityId;
			this.requestedRange = details.requestedRange;
			this.installedVersion = details.installedVersion;
			this.providerPluginId = details.providerPluginId;
			this.reason = details.reason;
		}
	};
	var CapabilityConflictError = class extends PluginError {
		constructor(capabilityId, installedProviderPluginId, conflictingProviderPluginId) {
			super("CAPABILITY_CONFLICT", `[ImageEditor] Capability "${capabilityId}" is already provided by "${installedProviderPluginId}" and cannot also be provided by "${conflictingProviderPluginId}".`, { pluginId: conflictingProviderPluginId });
			this.capabilityId = capabilityId;
			this.installedProviderPluginId = installedProviderPluginId;
			this.conflictingProviderPluginId = conflictingProviderPluginId;
		}
	};
	var PluginLifecycleError = class extends PluginError {
		constructor(pluginId, phase, cause, cleanupErrors = []) {
			super("PLUGIN_LIFECYCLE_ERROR", `[ImageEditor] Plugin "${pluginId}" failed during lifecycle phase "${phase}".`, {
				pluginId,
				cause
			});
			this.phase = phase;
			this.cleanupErrors = Object.freeze([...cleanupErrors]);
		}
	};
	var PluginSetupError = class extends PluginError {
		constructor(pluginId, cause, cleanupErrors = []) {
			super("PLUGIN_SETUP_ERROR", `[ImageEditor] Plugin "${pluginId}" setup failed and its installation was rolled back.`, {
				pluginId,
				cause
			});
			this.cleanupErrors = Object.freeze([...cleanupErrors]);
		}
	};
	var InvalidPluginDefinitionError = class extends PluginManifestError {
		constructor(message, pluginId, cause) {
			super(message, createPluginErrorOptions(pluginId, cause));
			Object.defineProperty(this, "name", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: "InvalidPluginDefinitionError"
			});
		}
	};
	var InvalidCapabilityVersionError = class extends CapabilityVersionError {
		constructor(capabilityId, value, valueKind) {
			super({
				capabilityId,
				expectedRange: `valid SemVer ${valueKind}`,
				actualVersion: value
			}, "INVALID_CAPABILITY_VERSION", `[ImageEditor] Capability "${capabilityId}" has invalid SemVer ${valueKind} "${value}".`);
			this.value = value;
			this.valueKind = valueKind;
		}
	};
	var OperationRegistrationError = class extends PluginError {
		constructor(message, pluginId) {
			super("OPERATION_REGISTRATION_ERROR", `[ImageEditor] ${message}`, createPluginErrorOptions(pluginId));
		}
	};
	var OperationConflictError = class extends PluginError {
		constructor(message, pluginId) {
			super("OPERATION_CONFLICT", `[ImageEditor] ${message}`, createPluginErrorOptions(pluginId));
		}
	};
	var ToolRegistrationError = class extends PluginError {
		constructor(message, pluginId) {
			super("TOOL_REGISTRATION_ERROR", `[ImageEditor] ${message}`, createPluginErrorOptions(pluginId));
		}
	};
	var ToolTransitionError = class extends PluginError {
		constructor(toolId, message, pluginId, cause) {
			super("TOOL_TRANSITION_ERROR", `[ImageEditor] Tool "${toolId}" ${message}.`, createPluginErrorOptions(pluginId, cause));
			this.toolId = toolId;
		}
	};
	var PluginKernelDisposedError = class extends PluginError {
		constructor(operation) {
			super("PLUGIN_KERNEL_DISPOSED", `[ImageEditor] Cannot ${operation} after the Plugin Kernel has been disposed.`);
		}
	};
	var PluginKernelStateError = class extends PluginError {
		constructor(operation, state) {
			super("PLUGIN_KERNEL_STATE_ERROR", `[ImageEditor] Cannot ${operation} while the Plugin Kernel is in state "${state}".`);
		}
	};

//#endregion
//#region dist/esm/plugin-kernel/plugin-identifier.js
	const RUNTIME_IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/u;
	function isDangerousStateKey(key) {
		return key === "__proto__" || key === "constructor" || key === "prototype";
	}
	function isRuntimeIdentifier(value) {
		return typeof value === "string" && value.length < 129 && RUNTIME_IDENTIFIER_PATTERN.test(value) && !value.split(":").some(isDangerousStateKey);
	}
	function assertPluginIdentifier(pluginId, fieldName = "Plugin id") {
		if (!isRuntimeIdentifier(pluginId)) throw new InvalidPluginDefinitionError(`${fieldName} must use namespace:kebab-case and be at most 128 characters.`, typeof pluginId === "string" ? pluginId : void 0);
		return pluginId;
	}

//#endregion
//#region dist/esm/plugin-kernel/semver.js
	const numericIdentifier = "(?:0|[1-9]\\d*)";
	const prereleaseIdentifier = `(?:${numericIdentifier}|\\d*[A-Za-z-][0-9A-Za-z-]*)`;
	const semVerPattern = new RegExp(`^(${numericIdentifier})\\.(${numericIdentifier})\\.(${numericIdentifier})(?:-(${prereleaseIdentifier}(?:\\.${prereleaseIdentifier})*))?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`, "u");
	const partialVersionPattern = new RegExp(`^(${numericIdentifier})(?:\\.(${numericIdentifier}|[xX*]))?(?:\\.(${numericIdentifier}|[xX*]))?$`, "u");
	const comparatorPattern = /^(<=|>=|<|>|=|~|\^)?(.+)$/u;
	const MAX_SEMVER_INPUT_LENGTH = 256;
	function parseRangeVersion(value) {
		const exact = semVerPattern.exec(value);
		if (exact) return {
			major: Number(exact[1]),
			minor: Number(exact[2]),
			patch: Number(exact[3]),
			exact: value
		};
		const partial = partialVersionPattern.exec(value);
		if (!partial) return null;
		const minor = partial[2];
		const patch = partial[3];
		return {
			major: Number(partial[1]),
			minor: minor === void 0 || /[xX*]/u.test(minor) ? null : Number(minor),
			patch: patch === void 0 || /[xX*]/u.test(patch) ? null : Number(patch),
			exact: null
		};
	}
	function lowerBound(version) {
		var _a, _b;
		return `${version.major}.${(_a = version.minor) !== null && _a !== void 0 ? _a : 0}.${(_b = version.patch) !== null && _b !== void 0 ? _b : 0}`;
	}
	function exclusiveUpperBound(version) {
		return version.minor === null ? `${version.major + 1}.0.0` : `${version.major}.${version.minor + 1}.0`;
	}
	function caretUpperBound(version) {
		if (version.major > 0 || version.minor === null) return `${version.major + 1}.0.0`;
		if (version.minor > 0 || version.patch === null) return `0.${version.minor + 1}.0`;
		return `0.0.${version.patch + 1}`;
	}
	function normalizeComparator(token) {
		var _a, _b;
		if (/^[xX*]$/u.test(token)) return [">=0.0.0"];
		const match = comparatorPattern.exec(token);
		if (!match) return null;
		const operator = (_a = match[1]) !== null && _a !== void 0 ? _a : "";
		const version = parseRangeVersion(match[2]);
		if (!version) return null;
		const lower = (_b = version.exact) !== null && _b !== void 0 ? _b : lowerBound(version);
		if (operator === "^") return [`>=${lower}`, `<${caretUpperBound(version)}`];
		if (operator === "~") return [`>=${lower}`, `<${exclusiveUpperBound(version)}`];
		if (version.exact !== null) return [`${operator}${version.exact}`];
		const upper = exclusiveUpperBound(version);
		if (operator === ">") return [`>=${upper}`];
		if (operator === "<=") return [`<${upper}`];
		if (operator === "<") return [`<${lower}`];
		if (operator === ">=") return [`>=${lower}`];
		return [`>=${lower}`, `<${upper}`];
	}
	function normalizeComparatorSet(value) {
		const hyphen = /^(\S+)\s+-\s+(\S+)$/u.exec(value);
		if (hyphen) {
			const lower = parseRangeVersion(hyphen[1]);
			const upper = parseRangeVersion(hyphen[2]);
			if (!lower || !upper) return null;
			return `>=${lowerBound(lower)} ${upper.exact === null ? `<${exclusiveUpperBound(upper)}` : `<=${upper.exact}`}`;
		}
		const normalized = [];
		for (const token of value.split(/\s+/u).filter(Boolean)) {
			const comparators = normalizeComparator(token);
			if (!comparators) return null;
			normalized.push(...comparators);
		}
		return normalized.length === 0 ? null : normalized.join(" ");
	}
	function normalizeRange(range) {
		if (range.length === 0 || range.trim() !== range) return null;
		const sets = range.replace(/([><=~^]+)\s+/gu, "$1").split("||").map((entry) => entry.trim());
		if (sets.some((entry) => entry.length === 0)) return null;
		const normalized = sets.map(normalizeComparatorSet);
		return normalized.some((entry) => entry === null) ? null : normalized.join(" || ");
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
			if (comparison !== 0) return comparison;
		}
		const leftPrerelease = (_b = (_a = left[4]) === null || _a === void 0 ? void 0 : _a.split(".")) !== null && _b !== void 0 ? _b : [];
		const rightPrerelease = (_d = (_c = right[4]) === null || _c === void 0 ? void 0 : _c.split(".")) !== null && _d !== void 0 ? _d : [];
		if (leftPrerelease.length === 0 || rightPrerelease.length === 0) return leftPrerelease.length === rightPrerelease.length ? 0 : leftPrerelease.length === 0 ? 1 : -1;
		for (let index = 0; index < Math.max(leftPrerelease.length, rightPrerelease.length); index += 1) {
			const leftIdentifier = leftPrerelease[index];
			const rightIdentifier = rightPrerelease[index];
			if (leftIdentifier === void 0 || rightIdentifier === void 0) return leftIdentifier === rightIdentifier ? 0 : leftIdentifier === void 0 ? -1 : 1;
			if (leftIdentifier === rightIdentifier) continue;
			const leftIsNumeric = /^\d+$/u.test(leftIdentifier);
			const rightIsNumeric = /^\d+$/u.test(rightIdentifier);
			if (leftIsNumeric && rightIsNumeric) return compareNumeric(leftIdentifier, rightIdentifier);
			if (leftIsNumeric !== rightIsNumeric) return leftIsNumeric ? -1 : 1;
			return leftIdentifier < rightIdentifier ? -1 : 1;
		}
		return 0;
	}
	function satisfiesComparator(version, comparator) {
		var _a;
		const match = /^(<=|>=|<|>|=)?(.+)$/u.exec(comparator);
		const target = match && semVerPattern.exec(match[2]);
		if (!match || !target) return false;
		const comparison = compareSemVer(version, target);
		switch ((_a = match[1]) !== null && _a !== void 0 ? _a : "=") {
			case "<": return comparison < 0;
			case "<=": return comparison <= 0;
			case ">": return comparison > 0;
			case ">=": return comparison >= 0;
			default: return comparison === 0;
		}
	}
	function isValidSemVer(version) {
		return version.length <= MAX_SEMVER_INPUT_LENGTH && version.trim() === version && semVerPattern.test(version);
	}
	function isValidSemVerRange(range) {
		return range.length <= MAX_SEMVER_INPUT_LENGTH && normalizeRange(range) !== null;
	}
	function satisfiesSemVer(version, range) {
		if (version.length > MAX_SEMVER_INPUT_LENGTH || range.length > MAX_SEMVER_INPUT_LENGTH || version.trim() !== version) return false;
		const parsedVersion = semVerPattern.exec(version);
		const normalized = normalizeRange(range);
		if (!parsedVersion || !normalized) return false;
		const prereleaseTuple = parsedVersion[4] ? `${parsedVersion[1]}.${parsedVersion[2]}.${parsedVersion[3]}` : null;
		return normalized.split(" || ").some((comparatorSet) => {
			if (!comparatorSet.split(" ").every((comparator) => satisfiesComparator(parsedVersion, comparator))) return false;
			if (prereleaseTuple === null) return true;
			return new RegExp(`(?:^|[<>=])${prereleaseTuple.replace(/\./gu, "\\.")}-[0-9A-Za-z-]`, "u").test(comparatorSet);
		});
	}

//#endregion
//#region dist/esm/plugin-kernel/capability-token.js
	const capabilityTokenBrand = Symbol("ImageEditorCapabilityToken");
	function createCapabilityToken(id, version) {
		if (!isRuntimeIdentifier(id)) throw new InvalidPluginDefinitionError("CapabilityToken id must use namespace:kebab-case and be at most 128 characters.");
		if (!isValidSemVer(version)) throw new InvalidCapabilityVersionError(id, version, "version");
		return Object.freeze({
			id,
			version,
			[capabilityTokenBrand]: true
		});
	}
	function isCapabilityToken(value) {
		if (typeof value !== "object" || value === null) return false;
		return value[capabilityTokenBrand] === true;
	}
	function assertCapabilityRequirement(requirement) {
		var _a;
		const token = requirement === null || requirement === void 0 ? void 0 : requirement.token;
		if (!isCapabilityToken(token)) throw new InvalidCapabilityVersionError("unknown", (_a = requirement === null || requirement === void 0 ? void 0 : requirement.range) !== null && _a !== void 0 ? _a : "", "range");
		if (!isValidSemVerRange(requirement.range)) throw new InvalidCapabilityVersionError(token.id, requirement.range, "range");
	}

//#endregion
//#region dist/esm/plugin-kernel/reporting.js
	function reportErrorSafely(errorSink, error) {
		if (!errorSink) return;
		try {
			errorSink(error);
		} catch {}
	}
	function reportWarningSafely(warningSink, errorSink, warning) {
		if (!warningSink) return;
		try {
			warningSink(warning);
		} catch (error) {
			reportErrorSafely(errorSink, error);
		}
	}

//#endregion
//#region dist/esm/plugin-kernel/disposable.js
	function isPromiseLike(value) {
		return (typeof value === "object" || typeof value === "function") && value !== null && typeof value.then === "function";
	}
	function observePromise(promise, onRejected) {
		Promise.resolve(promise).catch(onRejected);
	}
	function disposeInReverseSync(disposables, options = {}) {
		var _a;
		const errors = [];
		for (let index = disposables.length - 1; index >= 0; index -= 1) try {
			const result = (_a = disposables[index]) === null || _a === void 0 ? void 0 : _a.dispose();
			if (isPromiseLike(result)) {
				const error = /* @__PURE__ */ new Error(`Synchronous cleanup item ${index} returned a Promise. Use the asynchronous disposal path.`);
				errors.push(error);
				Promise.resolve(result).catch((cleanupError) => {
					reportWarningSafely(options.warningSink, options.errorSink, {
						code: "PLUGIN_CLEANUP_FAILED",
						message: `Asynchronous cleanup item ${index} failed after synchronous disposal returned.`,
						...options.pluginId ? { pluginId: options.pluginId } : {},
						cause: cleanupError,
						details: { cleanupIndex: index }
					});
				});
			}
		} catch (error) {
			errors.push(error);
			reportWarningSafely(options.warningSink, options.errorSink, {
				code: "PLUGIN_CLEANUP_FAILED",
				message: `Plugin cleanup item ${index} failed; remaining cleanup continued.`,
				...options.pluginId ? { pluginId: options.pluginId } : {},
				cause: error,
				details: { cleanupIndex: index }
			});
		}
		return Object.freeze(errors);
	}
	function createDisposable(cleanup) {
		let state = "active";
		let pending = null;
		return { dispose() {
			if (state === "disposed") return void 0;
			if (state === "disposing") return pending !== null && pending !== void 0 ? pending : void 0;
			state = "disposing";
			let resolvePending = () => void 0;
			let rejectPending = () => void 0;
			pending = new Promise((resolve, reject) => {
				resolvePending = resolve;
				rejectPending = reject;
			}).finally(() => {
				state = "disposed";
			});
			pending.catch(() => void 0);
			try {
				const result = cleanup();
				if (isPromiseLike(result)) {
					Promise.resolve(result).then(resolvePending, rejectPending);
					return pending;
				}
				state = "disposed";
				resolvePending();
				return;
			} catch (error) {
				state = "disposed";
				rejectPending(error);
				throw error;
			}
		} };
	}
	function createNoopDisposable() {
		return createDisposable(() => void 0);
	}
	async function disposeInReverse(disposables, options = {}) {
		var _a;
		const errors = [];
		for (let index = disposables.length - 1; index >= 0; index -= 1) try {
			await ((_a = disposables[index]) === null || _a === void 0 ? void 0 : _a.dispose());
		} catch (error) {
			errors.push(error);
			reportWarningSafely(options.warningSink, options.errorSink, {
				code: "PLUGIN_CLEANUP_FAILED",
				message: `Plugin cleanup item ${index} failed; remaining cleanup continued.`,
				...options.pluginId ? { pluginId: options.pluginId } : {},
				cause: error,
				details: { cleanupIndex: index }
			});
		}
		return errors;
	}

//#endregion
//#region dist/esm/plugin-kernel/plugin-ref.js
	const pluginRefBrand = Symbol("ImageEditorPluginRef");
	function definePluginRef(id, apiVersion) {
		assertPluginIdentifier(id, "PluginRef id");
		if (apiVersion.length > 64 || !isValidSemVer(apiVersion)) throw new InvalidPluginDefinitionError(`PluginRef "${id}" has invalid API SemVer "${apiVersion}".`, id);
		return Object.freeze({
			id,
			apiVersion,
			[pluginRefBrand]: true
		});
	}
	function isPluginRef(value) {
		if (typeof value !== "object" || value === null) return false;
		return value[pluginRefBrand] === true;
	}

//#endregion
//#region dist/esm/plugin-kernel/plugin-manifest.js
	const CORE_API_VERSION = "3.0.0";
	const MAX_VERSION_LENGTH = 64;
	const MAX_PLUGIN_DEPENDENCIES = 64;
	const MAX_CAPABILITY_REQUIREMENTS = 64;
	const MAX_PLUGIN_PERMISSIONS = 16;
	const supportedPermissions = /* @__PURE__ */ new Set([
		"fabric:objects",
		"fabric:canvas-read",
		"fabric:custom-class",
		"fabric:global-mutation",
		"core:raster-mutation",
		"core:geometry-participant",
		"core:export-contributor"
	]);
	function isPluginPermission(value) {
		return typeof value === "string" && supportedPermissions.has(value);
	}
	function assertArrayLimit(value, fieldName, maximum) {
		if (value === void 0) return [];
		if (!Array.isArray(value) || value.length > maximum) throw new PluginManifestError(`${fieldName} must be an array containing at most ${maximum} entries.`);
		return value;
	}
	function freezeRequirements(pluginId, value, fieldName) {
		if (value === void 0) return void 0;
		const requirements = assertArrayLimit(value, fieldName, MAX_CAPABILITY_REQUIREMENTS);
		return Object.freeze(requirements.map((requirement) => {
			try {
				assertCapabilityRequirement(requirement);
			} catch (cause) {
				throw new PluginManifestError(`Plugin "${pluginId}" has an invalid capability requirement in ${fieldName}.`, {
					pluginId,
					cause
				});
			}
			return Object.freeze({
				token: requirement.token,
				range: requirement.range
			});
		}));
	}
	function freezePluginDependencies(pluginId, value) {
		if (value === void 0) return void 0;
		const dependencies = assertArrayLimit(value, "Plugin manifest requiresPlugins", MAX_PLUGIN_DEPENDENCIES);
		const dependencyIds = /* @__PURE__ */ new Set();
		const validated = dependencies.map((dependency) => {
			if (!isPluginRef(dependency)) throw new PluginManifestError(`Plugin "${pluginId}" requiresPlugins entries must use definePluginRef().`, { pluginId });
			if (dependency.id === pluginId) throw new PluginManifestError(`Plugin "${pluginId}" cannot depend on itself.`, { pluginId });
			if (dependencyIds.has(dependency.id)) throw new PluginManifestError(`Plugin "${pluginId}" declares dependency "${dependency.id}" more than once.`, { pluginId });
			dependencyIds.add(dependency.id);
			return dependency;
		});
		return Object.freeze(validated);
	}
	function freezePermissions(pluginId, value) {
		if (value === void 0) return void 0;
		const permissions = assertArrayLimit(value, "Plugin manifest permissions", MAX_PLUGIN_PERMISSIONS);
		const permissionSet = /* @__PURE__ */ new Set();
		const validated = permissions.map((permission) => {
			if (typeof permission !== "string" || !isPluginPermission(permission)) throw new PluginManifestError(`Plugin "${pluginId}" declares unsupported permission "${String(permission)}".`, { pluginId });
			const typedPermission = permission;
			if (permissionSet.has(typedPermission)) throw new PluginManifestError(`Plugin "${pluginId}" declares permission "${typedPermission}" more than once.`, { pluginId });
			permissionSet.add(typedPermission);
			return typedPermission;
		});
		return Object.freeze(validated);
	}
	function validatePluginManifest(ref, manifest) {
		if (typeof manifest !== "object" || manifest === null) throw new PluginManifestError(`Plugin "${ref.id}" must define a manifest.`, { pluginId: ref.id });
		const manifestId = assertPluginIdentifier(manifest.id, "Plugin manifest id");
		if (manifestId !== ref.id) throw new PluginIdentityConflictError(ref.id, manifestId);
		if (typeof manifest.version !== "string" || manifest.version.length > MAX_VERSION_LENGTH || !isValidSemVer(manifest.version)) throw new PluginManifestError(`Plugin "${ref.id}" has invalid implementation SemVer "${String(manifest.version)}".`, { pluginId: ref.id });
		if (typeof manifest.apiVersion !== "string" || manifest.apiVersion.length > MAX_VERSION_LENGTH || !isValidSemVer(manifest.apiVersion)) throw new PluginManifestError(`Plugin "${ref.id}" has invalid API SemVer "${String(manifest.apiVersion)}".`, { pluginId: ref.id });
		if (manifest.apiVersion !== ref.apiVersion) throw new PluginApiVersionError(ref.id, ref.apiVersion, manifest.apiVersion);
		if (typeof manifest.engine !== "string" || manifest.engine.length > MAX_VERSION_LENGTH || !isValidSemVerRange(manifest.engine)) throw new InvalidPluginDefinitionError(`Plugin "${ref.id}" has invalid engine SemVer range "${String(manifest.engine)}".`, ref.id);
		if (!satisfiesSemVer("3.0.0", manifest.engine)) throw new PluginEngineVersionError(ref.id, manifest.engine, CORE_API_VERSION);
		const requiresPlugins = freezePluginDependencies(ref.id, manifest.requiresPlugins);
		const requires = freezeRequirements(ref.id, manifest.requires, "Plugin manifest requires");
		const optional = freezeRequirements(ref.id, manifest.optional, "Plugin manifest optional");
		const capabilityIds = /* @__PURE__ */ new Set();
		for (const requirement of [...requires !== null && requires !== void 0 ? requires : [], ...optional !== null && optional !== void 0 ? optional : []]) {
			if (capabilityIds.has(requirement.token.id)) throw new PluginManifestError(`Plugin "${ref.id}" declares capability "${requirement.token.id}" more than once.`, { pluginId: ref.id });
			capabilityIds.add(requirement.token.id);
		}
		const permissions = freezePermissions(ref.id, manifest.permissions);
		return Object.freeze({
			id: manifestId,
			version: manifest.version,
			apiVersion: manifest.apiVersion,
			engine: manifest.engine,
			...requiresPlugins ? { requiresPlugins } : {},
			...requires ? { requires } : {},
			...optional ? { optional } : {},
			...permissions ? { permissions } : {}
		});
	}

//#endregion
//#region dist/esm/plugin-kernel/capability-registry.js
	function validateProvider(token, implementation, providerPluginId, providerVersion, requiredPermission) {
		var _a, _b;
		if (!isCapabilityToken(token) || !isValidSemVer(token.version)) throw new InvalidCapabilityVersionError((_a = token === null || token === void 0 ? void 0 : token.id) !== null && _a !== void 0 ? _a : "unknown", (_b = token === null || token === void 0 ? void 0 : token.version) !== null && _b !== void 0 ? _b : "", "version");
		if (!isRuntimeIdentifier(providerPluginId)) throw new InvalidPluginDefinitionError(`Invalid Capability provider Runtime ID for "${token.id}".`, providerPluginId);
		if (!isValidSemVer(providerVersion)) throw new InvalidCapabilityVersionError(token.id, providerVersion, "version");
		if (providerVersion !== token.version) throw new CapabilityVersionError({
			capabilityId: token.id,
			expectedRange: token.version,
			actualVersion: providerVersion,
			providerPluginId
		});
		if (requiredPermission !== void 0 && !isPluginPermission(requiredPermission)) throw new InvalidPluginDefinitionError(`Capability "${token.id}" requires an unsupported Plugin permission.`, providerPluginId);
		if (implementation === null || implementation === void 0) throw new PluginCapabilityError({
			consumerPluginId: providerPluginId,
			capabilityId: token.id,
			requestedRange: token.version,
			installedVersion: token.version,
			providerPluginId,
			reason: "incomplete"
		});
	}
	var CapabilityRegistry = class {
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
				value: /* @__PURE__ */ new Map()
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
		provideHost(token, implementation, providerPluginId = "core:host", requiredPermission) {
			if (!isCapabilityToken(token)) throw new InvalidPluginDefinitionError("Host capability must use createCapabilityToken().");
			return this.provide(token, implementation, providerPluginId, requiredPermission);
		}
		providePending(token, implementation, providerPluginId, transactionId, providerVersion = token.version, requiredPermission) {
			this.assertActive("provide a capability");
			validateProvider(token, implementation, providerPluginId, providerVersion, requiredPermission);
			const existing = this.providers.get(token.id);
			if (existing) {
				if (existing.providerPluginId === providerPluginId && existing.transactionId === transactionId && existing.version === providerVersion && existing.requiredPermission === requiredPermission && Object.is(existing.implementation, implementation)) {
					const noop = createNoopDisposable();
					return {
						commit: () => {
							existing.complete = true;
						},
						dispose: () => noop.dispose()
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
				complete: false
			};
			this.providers.set(token.id, record);
			const disposable = createDisposable(() => {
				if (this.providers.get(token.id) === record) this.providers.delete(token.id);
			});
			return {
				commit: () => {
					if (this.providers.get(token.id) === record) record.complete = true;
				},
				dispose: () => disposable.dispose()
			};
		}
		require(requirement, consumerPluginId) {
			return this.resolve(requirement, consumerPluginId, false);
		}
		optional(requirement, consumerPluginId) {
			return this.resolve(requirement, consumerPluginId, true);
		}
		requireDefinition(requirement, consumerPluginId, visibleTransactions) {
			return this.resolve(requirement, consumerPluginId, false, visibleTransactions);
		}
		optionalDefinition(requirement, consumerPluginId, visibleTransactions) {
			return this.resolve(requirement, consumerPluginId, true, visibleTransactions);
		}
		getProviderInfo(tokenOrId) {
			this.assertActive("inspect a capability provider");
			const id = typeof tokenOrId === "string" ? tokenOrId : tokenOrId.id;
			if (!isRuntimeIdentifier(id)) throw new InvalidPluginDefinitionError("Invalid Capability Runtime ID.");
			const record = this.providers.get(id);
			if (!record) return null;
			return Object.freeze({
				capabilityId: record.token.id,
				version: record.version,
				providerPluginId: record.providerPluginId,
				requiredPermission: record.requiredPermission,
				complete: record.complete
			});
		}
		has(tokenOrId) {
			return this.getProviderInfo(tokenOrId) !== null;
		}
		getRequiredPermission(capabilityId, visibleTransactions) {
			this.assertActive("inspect a Capability permission");
			if (!isRuntimeIdentifier(capabilityId)) throw new InvalidPluginDefinitionError("Invalid Capability Runtime ID.");
			const record = this.providers.get(capabilityId);
			if (!record) return void 0;
			if (!record.complete && !(visibleTransactions === null || visibleTransactions === void 0 ? void 0 : visibleTransactions.has(record.transactionId))) return void 0;
			return record.requiredPermission;
		}
		dispose() {
			if (this.disposed) return;
			this.providers.clear();
			this.disposed = true;
		}
		resolve(requirement, consumerPluginId, optional, visibleTransactions) {
			var _a, _b, _c;
			this.assertActive("resolve a capability");
			if (!isRuntimeIdentifier(consumerPluginId)) throw new InvalidPluginDefinitionError("Invalid Capability consumer Runtime ID.", consumerPluginId);
			try {
				assertCapabilityRequirement(requirement);
			} catch (error) {
				throw new PluginCapabilityError({
					consumerPluginId,
					capabilityId: (_b = (_a = requirement === null || requirement === void 0 ? void 0 : requirement.token) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : "unknown",
					requestedRange: (_c = requirement === null || requirement === void 0 ? void 0 : requirement.range) !== null && _c !== void 0 ? _c : "",
					reason: "invalid-range",
					cause: error
				});
			}
			const record = this.providers.get(requirement.token.id);
			if (!record) {
				if (optional) return null;
				throw new CapabilityMissingError({
					consumerPluginId,
					capabilityId: requirement.token.id,
					requestedRange: requirement.range,
					availableProviders: this.describeProviders()
				});
			}
			if (!record.complete && !(visibleTransactions === null || visibleTransactions === void 0 ? void 0 : visibleTransactions.has(record.transactionId))) {
				if (optional) return null;
				throw new PluginCapabilityError({
					consumerPluginId,
					capabilityId: requirement.token.id,
					requestedRange: requirement.range,
					installedVersion: record.version,
					providerPluginId: record.providerPluginId,
					reason: "incomplete"
				});
			}
			if (!satisfiesSemVer(record.version, requirement.range)) {
				if (!optional) throw new CapabilityVersionError({
					capabilityId: requirement.token.id,
					expectedRange: requirement.range,
					actualVersion: record.version,
					providerPluginId: record.providerPluginId,
					consumerPluginId
				});
				reportWarningSafely(this.options.warningSink, this.options.errorSink, {
					code: "OPTIONAL_CAPABILITY_INCOMPATIBLE",
					message: `Optional integration "${requirement.token.id}" was disabled for plugin "${consumerPluginId}" because installed version "${record.version}" does not satisfy "${requirement.range}".`,
					pluginId: consumerPluginId,
					details: {
						capabilityId: requirement.token.id,
						requestedRange: requirement.range,
						installedVersion: record.version,
						providerPluginId: record.providerPluginId,
						optionalIntegrationDisabled: true
					}
				});
				return null;
			}
			return record.implementation;
		}
		describeProviders() {
			return Object.freeze([...this.providers.values()].filter((record) => record.complete).map((record) => `${record.token.id}@${record.version} (${record.providerPluginId})`).sort());
		}
		assertActive(operation) {
			if (this.disposed) throw new PluginKernelDisposedError(operation);
		}
	};

//#endregion
//#region dist/esm/plugin-kernel/committed-event-bus.js
	const DEFAULT_COMMITTED_EVENT_LISTENER_TIMEOUT_MS = 5e3;
	const DISPOSED_LISTENER_OUTCOME = Symbol("disposed-listener-outcome");
	const eventBusDisposalStates = /* @__PURE__ */ new WeakMap();
	function getDisposalState(owner) {
		const state = eventBusDisposalStates.get(owner);
		if (!state) throw new Error("Committed event bus disposal state is unavailable.");
		return state;
	}
	var CommittedEventBus = class {
		constructor(options = {}) {
			var _a;
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
				value: /* @__PURE__ */ new Map()
			});
			Object.defineProperty(this, "emissionTails", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: /* @__PURE__ */ new Map()
			});
			Object.defineProperty(this, "listenerTimeoutMs", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "disposed", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: false
			});
			const timeout = (_a = options.listenerTimeoutMs) !== null && _a !== void 0 ? _a : DEFAULT_COMMITTED_EVENT_LISTENER_TIMEOUT_MS;
			if (!Number.isSafeInteger(timeout) || timeout <= 0) throw new InvalidPluginDefinitionError("Committed event listener timeout must be a positive safe integer.");
			this.listenerTimeoutMs = timeout;
			eventBusDisposalStates.set(this, {
				controller: new AbortController(),
				activeTimeouts: /* @__PURE__ */ new Set()
			});
		}
		on(eventName, listener) {
			this.assertActive("register a committed event listener");
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
				if (!current) return;
				const index = current.indexOf(erasedListener);
				if (index >= 0) current.splice(index, 1);
				if (current.length === 0) this.listeners.delete(eventName);
			});
		}
		async emitCommitted(eventName, payload) {
			var _a;
			this.assertActive("emit a committed event");
			this.assertEventName(eventName);
			const emission = ((_a = this.emissionTails.get(eventName)) !== null && _a !== void 0 ? _a : Promise.resolve()).then(() => this.dispatch(eventName, payload));
			this.emissionTails.set(eventName, emission);
			try {
				await emission;
			} finally {
				if (this.emissionTails.get(eventName) === emission) this.emissionTails.delete(eventName);
			}
		}
		async dispatch(eventName, payload) {
			var _a;
			if (this.disposed) return;
			const snapshot = [...(_a = this.listeners.get(eventName)) !== null && _a !== void 0 ? _a : []];
			for (let index = 0; index < snapshot.length; index += 1) {
				if (this.disposed) return;
				const listener = snapshot[index];
				if (listener) await this.invokeListener(eventName, index, listener, payload);
			}
		}
		async invokeListener(eventName, listenerIndex, listener, payload) {
			const disposalState = getDisposalState(this);
			const settlement = Promise.resolve().then(() => listener(payload)).then(() => Object.freeze({ status: "fulfilled" }), (error) => Object.freeze({
				status: "rejected",
				error
			}));
			let timeoutHandle;
			const timeout = new Promise((resolve) => {
				timeoutHandle = setTimeout(() => {
					if (timeoutHandle !== void 0) disposalState.activeTimeouts.delete(timeoutHandle);
					resolve(null);
				}, this.listenerTimeoutMs);
				disposalState.activeTimeouts.add(timeoutHandle);
			});
			const disposalSignal = disposalState.controller.signal;
			let removeDisposalListener = () => void 0;
			const disposal = new Promise((resolve) => {
				const abort = () => {
					if (timeoutHandle !== void 0) {
						clearTimeout(timeoutHandle);
						disposalState.activeTimeouts.delete(timeoutHandle);
					}
					resolve(DISPOSED_LISTENER_OUTCOME);
				};
				removeDisposalListener = () => disposalSignal.removeEventListener("abort", abort);
				disposalSignal.addEventListener("abort", abort, { once: true });
				if (disposalSignal.aborted) abort();
			});
			let outcome;
			try {
				outcome = await Promise.race([
					settlement,
					timeout,
					disposal
				]);
			} finally {
				removeDisposalListener();
				if (timeoutHandle !== void 0) {
					clearTimeout(timeoutHandle);
					disposalState.activeTimeouts.delete(timeoutHandle);
				}
			}
			if (outcome === DISPOSED_LISTENER_OUTCOME) return;
			if (outcome === null) {
				reportWarningSafely(this.options.warningSink, this.options.errorSink, {
					code: "COMMITTED_EVENT_LISTENER_TIMEOUT",
					message: `Committed event listener ${listenerIndex} for "${eventName}" exceeded ${this.listenerTimeoutMs} ms; remaining listeners continued.`,
					details: {
						eventName,
						listenerIndex,
						timeoutMs: this.listenerTimeoutMs
					}
				});
				observePromise(settlement.then((lateOutcome) => {
					if (this.disposed || lateOutcome.status !== "rejected") return;
					reportWarningSafely(this.options.warningSink, this.options.errorSink, {
						code: "COMMITTED_EVENT_LISTENER_LATE_FAILURE",
						message: `Timed-out committed event listener ${listenerIndex} for "${eventName}" later rejected.`,
						cause: lateOutcome.error,
						details: {
							eventName,
							listenerIndex,
							timeoutMs: this.listenerTimeoutMs
						}
					});
				}), (error) => {
					if (this.disposed) return;
					reportWarningSafely(this.options.warningSink, this.options.errorSink, {
						code: "COMMITTED_EVENT_LATE_OBSERVER_FAILURE",
						message: `Late listener observation for "${eventName}" failed.`,
						cause: error
					});
				});
				return;
			}
			if (outcome.status === "rejected") reportWarningSafely(this.options.warningSink, this.options.errorSink, {
				code: "COMMITTED_EVENT_LISTENER_FAILED",
				message: `Committed event listener ${listenerIndex} for "${eventName}" failed; remaining listeners continued.`,
				cause: outcome.error,
				details: {
					eventName,
					listenerIndex
				}
			});
		}
		listenerCount(eventName) {
			var _a, _b;
			this.assertActive("inspect committed event listeners");
			if (eventName) {
				this.assertEventName(eventName);
				return (_b = (_a = this.listeners.get(eventName)) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
			}
			let count = 0;
			for (const listeners of this.listeners.values()) count += listeners.length;
			return count;
		}
		dispose() {
			if (this.disposed) return;
			this.disposed = true;
			this.listeners.clear();
			this.emissionTails.clear();
			const disposalState = getDisposalState(this);
			for (const timeout of disposalState.activeTimeouts) clearTimeout(timeout);
			disposalState.activeTimeouts.clear();
			disposalState.controller.abort();
		}
		assertActive(operation) {
			if (this.disposed) throw new PluginKernelDisposedError(operation);
		}
		assertEventName(eventName) {
			if (!isRuntimeIdentifier(eventName)) throw new InvalidPluginDefinitionError("Invalid committed event Runtime ID.");
		}
	};

//#endregion
//#region dist/esm/plugin-kernel/thrown-error.js
	function normalizeThrownError(cause, message) {
		try {
			if (cause instanceof Error) return cause;
		} catch {}
		const error = new Error(message);
		Object.defineProperty(error, "cause", {
			configurable: true,
			value: cause
		});
		return error;
	}

//#endregion
//#region dist/esm/plugin-kernel/operation-registry.js
	const OPERATION_MODES = [
		"read",
		"busy",
		"animation",
		"mutation"
	];
	const REENTRANCY_POLICIES = [
		"reject",
		"queue",
		"replace",
		"coalesce"
	];
	const CONFLICT_DOMAINS = [
		"document",
		"base-image",
		"geometry",
		"raster",
		"overlay",
		"selection",
		"tool",
		"export",
		"state",
		"image-decode"
	];
	function abortError(message) {
		return new DOMException(message, "AbortError");
	}
	function abortReason(signal, fallback) {
		var _a;
		return (_a = signal.reason) !== null && _a !== void 0 ? _a : abortError(fallback);
	}
	function domainsOverlap(first, second) {
		return first.some((domain) => second.includes(domain));
	}
	function definitionsConflict(first, second) {
		if (first.mode === "read" && second.mode === "read") return false;
		return domainsOverlap(first.conflictDomains, second.conflictDomains);
	}
	var OperationRegistry = class {
		constructor() {
			Object.defineProperty(this, "operations", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: /* @__PURE__ */ new Map()
			});
			Object.defineProperty(this, "activeOperations", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: /* @__PURE__ */ new Set()
			});
			Object.defineProperty(this, "executingRequests", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: /* @__PURE__ */ new Set()
			});
			Object.defineProperty(this, "idleWaiters", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: /* @__PURE__ */ new Set()
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
			this.assertActive("register an operation");
			this.validateDefinition(definition, ownerPluginId);
			const existing = this.operations.get(definition.id);
			if (existing) throw new OperationRegistrationError(`Operation "${definition.id}" is already registered by "${existing.ownerPluginId}".`, ownerPluginId);
			const record = {
				definition: Object.freeze({
					...definition,
					conflictDomains: Object.freeze([...definition.conflictDomains]),
					allowedDuringTool: definition.allowedDuringTool ? Object.freeze([...definition.allowedDuringTool]) : void 0
				}),
				ownerPluginId
			};
			this.operations.set(definition.id, record);
			return createDisposable(() => {
				if (this.operations.get(definition.id) !== record) return;
				const reason = abortError(`Operation "${definition.id}" was unregistered.`);
				for (const active of [...this.activeOperations]) if (active.record === record) this.retireActive(active, reason);
				this.rejectPending((request) => request.record === record, reason);
				this.operations.delete(definition.id);
				this.drainPending();
			});
		}
		begin(operationId, ownerPluginId) {
			this.assertActive("begin an operation");
			if (this.suspendedReason !== null) throw this.suspendedReason;
			const record = this.requireOwned(operationId, ownerPluginId);
			const conflicts = this.findConflicts(record, void 0);
			if (conflicts.length > 0) throw this.conflictError(record, conflicts[0].record, ownerPluginId);
			const active = this.createActive(record, void 0, null);
			this.activeOperations.add(active);
			return active.token;
		}
		run(operationId, ownerPluginId, args, task, options = {}) {
			var _a;
			this.assertActive("run an operation");
			if (this.suspendedReason !== null) return Promise.reject(this.suspendedReason);
			const record = this.requireOwned(operationId, ownerPluginId);
			this.validateParent(options.parent);
			if ((_a = options.signal) === null || _a === void 0 ? void 0 : _a.aborted) return Promise.reject(abortReason(options.signal, `Operation "${operationId}" was aborted.`));
			const existingPending = this.findCoalesciblePending(record, options.parent);
			if (record.definition.reentrancy === "coalesce" && existingPending) {
				const coalesce = record.definition.coalesce;
				if (!coalesce) return Promise.reject(new OperationRegistrationError(`Operation "${operationId}" has no coalesce function.`, ownerPluginId));
				existingPending.args = coalesce(existingPending.args, args);
				return this.addWaiter(existingPending, options.signal);
			}
			const request = {
				record,
				args,
				task,
				options,
				waiters: [],
				active: null,
				state: "pending",
				removeExternalAbortListener: null
			};
			const result = this.addWaiter(request, options.signal);
			this.attachExternalAbort(request);
			this.schedule(request);
			return result;
		}
		beginForHost(operationId) {
			this.assertActive("begin an operation");
			const registered = this.requireRegistered(operationId, "core:host");
			return this.begin(operationId, registered.ownerPluginId);
		}
		runForHost(operationId, args, task, options = {}) {
			const registered = this.requireRegistered(operationId, "core:host");
			return this.run(operationId, registered.ownerPluginId, args, task, options);
		}
		has(operationId) {
			this.assertActive("inspect an operation");
			return this.operations.has(operationId);
		}
		get(operationId) {
			var _a, _b;
			this.assertActive("inspect an operation");
			return (_b = (_a = this.operations.get(operationId)) === null || _a === void 0 ? void 0 : _a.definition) !== null && _b !== void 0 ? _b : null;
		}
		isActive(operationId) {
			this.assertActive("inspect operation state");
			if (!operationId) return this.activeOperations.size > 0;
			return [...this.activeOperations].some((active) => active.record.definition.id === operationId);
		}
		waitForIdle() {
			if (this.isIdle()) return Promise.resolve();
			return new Promise((resolve) => this.idleWaiters.add(resolve));
		}
		hasInFlightOperations() {
			return !this.isIdle();
		}
		async abortAll(reason = abortError("All Plugin Kernel operations were aborted.")) {
			this.assertActive("abort operations");
			this.rejectPending(() => true, reason);
			for (const active of [...this.activeOperations]) if (active.request) this.abortActive(active, reason);
			else this.retireActive(active, reason);
			await Promise.allSettled([...this.executingRequests]);
			this.resolveIdleWaiters();
		}
		suspend(reason) {
			this.assertActive("suspend operations");
			const suspendedReason = normalizeThrownError(reason, "[ImageEditor] Plugin Kernel operations were suspended with a non-Error reason.");
			this.suspendedReason = suspendedReason;
			return this.abortAll(suspendedReason);
		}
		dispose() {
			if (this.disposed) return;
			const reason = abortError("Operation Registry was disposed.");
			this.rejectPending(() => true, reason);
			for (const active of [...this.activeOperations]) this.retireActive(active, reason);
			this.operations.clear();
			this.suspendedReason = null;
			this.disposed = true;
			this.resolveIdleWaiters();
		}
		schedule(request) {
			var _a, _b;
			if (request.state !== "pending") return;
			const conflicts = this.findConflicts(request.record, request.options.parent);
			const sameOperationActive = conflicts.filter((active) => active.record.definition.id === request.record.definition.id);
			const policy = request.record.definition.reentrancy;
			if (policy === "replace" && sameOperationActive.length > 0) {
				const reason = abortError(`Operation "${request.record.definition.id}" was replaced by a newer request.`);
				for (const active of sameOperationActive) this.retireActive(active, reason);
				this.rejectPending((pending) => pending.record === request.record, reason);
			} else if (conflicts.length > 0 && policy === "reject") {
				this.rejectRequest(request, this.conflictError(request.record, conflicts[0].record, request.record.ownerPluginId));
				(_a = request.removeExternalAbortListener) === null || _a === void 0 || _a.call(request);
				request.removeExternalAbortListener = null;
				request.state = "settled";
				this.resolveIdleWaiters();
				return;
			} else if (conflicts.length > 0 && policy === "replace") {
				this.rejectRequest(request, this.conflictError(request.record, conflicts[0].record, request.record.ownerPluginId));
				(_b = request.removeExternalAbortListener) === null || _b === void 0 || _b.call(request);
				request.removeExternalAbortListener = null;
				request.state = "settled";
				this.resolveIdleWaiters();
				return;
			}
			if (this.findConflicts(request.record, request.options.parent).length === 0) this.startRequest(request);
			else this.pendingRequests.push(request);
		}
		startRequest(request) {
			if (request.state !== "pending") return;
			const active = this.createActive(request.record, request.options.parent, request);
			request.active = active;
			request.state = "active";
			this.activeOperations.add(active);
			const context = Object.freeze({
				signal: active.controller.signal,
				token: active.token,
				topLevel: active.token.topLevel,
				ownsHistory: active.token.ownsHistory
			});
			let output;
			try {
				output = request.task(request.args, context);
			} catch (error) {
				output = Promise.reject(error);
			}
			const tracked = Promise.resolve(output).then((value) => ({
				status: "fulfilled",
				value
			}), (error) => ({
				status: "rejected",
				error
			})).then((outcome) => {
				this.finishRequest(request);
				if (outcome.status === "rejected") this.rejectRequest(request, outcome.error);
				else if (active.controller.signal.aborted) this.rejectRequest(request, abortReason(active.controller.signal, `Operation "${active.token.id}" was aborted.`));
				else this.resolveRequest(request, outcome.value);
			}).finally(() => {
				this.executingRequests.delete(tracked);
				this.resolveIdleWaiters();
			});
			this.executingRequests.add(tracked);
			tracked.catch(() => void 0);
		}
		finishRequest(request) {
			var _a;
			const active = request.active;
			if (active) {
				this.activeOperations.delete(active);
				active.deactivate();
			}
			(_a = request.removeExternalAbortListener) === null || _a === void 0 || _a.call(request);
			request.removeExternalAbortListener = null;
			request.state = "settled";
			this.drainPending();
			this.resolveIdleWaiters();
		}
		drainPending() {
			if (this.disposed) return;
			let started = true;
			while (started) {
				started = false;
				for (let index = 0; index < this.pendingRequests.length; index += 1) {
					const request = this.pendingRequests[index];
					if (this.findConflicts(request.record, request.options.parent).length > 0) continue;
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
			const entry = {
				record,
				controller,
				token: Object.freeze({
					id: record.definition.id,
					ownerPluginId: record.ownerPluginId,
					parentId: (_a = parent === null || parent === void 0 ? void 0 : parent.id) !== null && _a !== void 0 ? _a : null,
					topLevel: parent === void 0,
					ownsHistory: parent === void 0,
					signal: controller.signal,
					get active() {
						return active;
					},
					dispose: () => {
						const entry = activeReference.current;
						if (!active || !entry) return;
						this.retireActive(entry, abortError(`Operation "${record.definition.id}" was cancelled.`));
						this.drainPending();
						this.resolveIdleWaiters();
					}
				}),
				deactivate: () => {
					active = false;
				},
				request
			};
			activeReference.current = entry;
			return entry;
		}
		retireActive(active, reason) {
			if (!active.token.active) return;
			this.activeOperations.delete(active);
			active.deactivate();
			active.controller.abort(reason);
			if (active.request && active.request.state === "active") active.request.state = "retired";
		}
		abortActive(active, reason) {
			if (!active.token.active || active.controller.signal.aborted) return;
			active.controller.abort(reason);
		}
		findConflicts(record, parent) {
			return [...this.activeOperations].filter((active) => {
				if (parent && active.token === parent) return false;
				return definitionsConflict(record.definition, active.record.definition);
			});
		}
		findCoalesciblePending(record, parent) {
			return this.pendingRequests.find((request) => request.record === record && request.options.parent === parent);
		}
		addWaiter(request, signal) {
			return new Promise((resolve, reject) => {
				const waiter = {
					resolve,
					reject,
					removeAbortListener: null,
					settled: false
				};
				request.waiters.push(waiter);
				if (!signal) return;
				const abort = () => {
					var _a, _b;
					if (waiter.settled) return;
					if (request.state === "active" && request.active && request.waiters.length === 1) {
						(_a = waiter.removeAbortListener) === null || _a === void 0 || _a.call(waiter);
						waiter.removeAbortListener = null;
						this.abortActive(request.active, abortReason(signal, `Operation "${request.record.definition.id}" was aborted.`));
						return;
					}
					waiter.settled = true;
					(_b = waiter.removeAbortListener) === null || _b === void 0 || _b.call(waiter);
					waiter.removeAbortListener = null;
					const index = request.waiters.indexOf(waiter);
					if (index >= 0) request.waiters.splice(index, 1);
					reject(abortReason(signal, `Operation "${request.record.definition.id}" was aborted.`));
					if (request.waiters.length === 0) this.abortRequestWithoutWaiters(request, signal);
				};
				signal.addEventListener("abort", abort, { once: true });
				waiter.removeAbortListener = () => signal.removeEventListener("abort", abort);
				if (signal.aborted) abort();
			});
		}
		abortRequestWithoutWaiters(request, signal) {
			var _a;
			const reason = abortReason(signal, `Operation "${request.record.definition.id}" was aborted.`);
			if (request.state === "pending") {
				this.pendingRequests = this.pendingRequests.filter((entry) => entry !== request);
				(_a = request.removeExternalAbortListener) === null || _a === void 0 || _a.call(request);
				request.removeExternalAbortListener = null;
				request.state = "settled";
			} else if (request.active) this.abortActive(request.active, reason);
			this.drainPending();
			this.resolveIdleWaiters();
		}
		attachExternalAbort(request) {
			var _a;
			const signals = [.../* @__PURE__ */ new Set([(_a = request.options.parent) === null || _a === void 0 ? void 0 : _a.signal])].filter((signal) => signal !== void 0);
			if (signals.length === 0) return;
			const abort = () => {
				var _a;
				const signal = signals.find((candidate) => candidate.aborted);
				const reason = signal ? abortReason(signal, `Operation "${request.record.definition.id}" was aborted.`) : abortError(`Operation "${request.record.definition.id}" was aborted.`);
				if (request.state === "pending") {
					this.pendingRequests = this.pendingRequests.filter((entry) => entry !== request);
					this.rejectRequest(request, reason);
					(_a = request.removeExternalAbortListener) === null || _a === void 0 || _a.call(request);
					request.removeExternalAbortListener = null;
					request.state = "settled";
				} else if (request.active) this.abortActive(request.active, reason);
				this.drainPending();
				this.resolveIdleWaiters();
			};
			for (const signal of signals) signal.addEventListener("abort", abort, { once: true });
			request.removeExternalAbortListener = () => {
				for (const signal of signals) signal.removeEventListener("abort", abort);
			};
			if (signals.some((signal) => signal.aborted)) abort();
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
				(_a = request.removeExternalAbortListener) === null || _a === void 0 || _a.call(request);
				request.state = "settled";
			}
			this.pendingRequests = retained;
			this.resolveIdleWaiters();
		}
		resolveRequest(request, value) {
			var _a;
			for (const waiter of request.waiters) {
				if (waiter.settled) continue;
				waiter.settled = true;
				(_a = waiter.removeAbortListener) === null || _a === void 0 || _a.call(waiter);
				waiter.removeAbortListener = null;
				waiter.resolve(value);
			}
			request.waiters.length = 0;
		}
		rejectRequest(request, error) {
			var _a;
			for (const waiter of request.waiters) {
				if (waiter.settled) continue;
				waiter.settled = true;
				(_a = waiter.removeAbortListener) === null || _a === void 0 || _a.call(waiter);
				waiter.removeAbortListener = null;
				waiter.reject(error);
			}
			request.waiters.length = 0;
		}
		requireRegistered(operationId, ownerPluginId) {
			this.assertActive("access an operation");
			const registered = this.operations.get(operationId);
			if (!registered) throw new OperationConflictError(`Operation "${operationId}" is not registered.`, ownerPluginId);
			return registered;
		}
		requireOwned(operationId, ownerPluginId) {
			const registered = this.requireRegistered(operationId, ownerPluginId);
			if (registered.ownerPluginId !== ownerPluginId) throw new OperationConflictError(`Operation "${operationId}" belongs to "${registered.ownerPluginId}", not "${ownerPluginId}".`, ownerPluginId);
			return registered;
		}
		validateParent(parent) {
			if (!parent) return;
			if (!parent.active || parent.signal.aborted || ![...this.activeOperations].some((active) => active.token === parent)) throw new OperationConflictError(`Parent operation "${parent.id}" is not active.`, parent.ownerPluginId);
		}
		validateDefinition(definition, ownerPluginId) {
			if (!isRuntimeIdentifier(ownerPluginId)) throw new OperationRegistrationError("Invalid Operation owner Runtime ID.", ownerPluginId);
			if (!isRuntimeIdentifier(definition.id)) throw new OperationRegistrationError("Invalid Operation Runtime ID.", ownerPluginId);
			if (!OPERATION_MODES.includes(definition.mode)) throw new OperationRegistrationError(`Operation "${definition.id}" has invalid mode "${definition.mode}".`, ownerPluginId);
			if (!REENTRANCY_POLICIES.includes(definition.reentrancy)) throw new OperationRegistrationError(`Operation "${definition.id}" has invalid reentrancy policy.`, ownerPluginId);
			if (!Array.isArray(definition.conflictDomains) || definition.conflictDomains.length === 0 || definition.conflictDomains.some((domain) => !CONFLICT_DOMAINS.includes(domain)) || new Set(definition.conflictDomains).size !== definition.conflictDomains.length) throw new OperationRegistrationError(`Operation "${definition.id}" has invalid conflict domains.`, ownerPluginId);
			if (definition.reentrancy === "coalesce" && typeof definition.coalesce !== "function") throw new OperationRegistrationError(`Operation "${definition.id}" must define coalesce().`, ownerPluginId);
			if (definition.allowedDuringTool !== void 0 && (!Array.isArray(definition.allowedDuringTool) || definition.allowedDuringTool.some((toolId) => !isRuntimeIdentifier(toolId)) || new Set(definition.allowedDuringTool).size !== definition.allowedDuringTool.length)) throw new OperationRegistrationError(`Operation "${definition.id}" has invalid allowed Tool ids.`, ownerPluginId);
		}
		conflictError(requested, active, ownerPluginId) {
			return new OperationConflictError(`Operation "${requested.definition.id}" conflicts with active operation "${active.definition.id}" in domain(s) ${requested.definition.conflictDomains.filter((domain) => active.definition.conflictDomains.includes(domain)).join(", ")}.`, ownerPluginId);
		}
		isIdle() {
			return this.activeOperations.size === 0 && this.pendingRequests.length === 0 && this.executingRequests.size === 0;
		}
		resolveIdleWaiters() {
			if (!this.isIdle()) return;
			for (const resolve of this.idleWaiters) resolve();
			this.idleWaiters.clear();
		}
		assertActive(operation) {
			if (this.disposed) throw new PluginKernelDisposedError(operation);
		}
	};

//#endregion
//#region dist/esm/plugin-kernel/plugin-definition-lease.js
	const definitionAliases = /* @__PURE__ */ new WeakMap();
	const definitionLeases = /* @__PURE__ */ new WeakMap();
	function resolvePluginDefinitionIdentity(definition) {
		let current = definition;
		const visited = /* @__PURE__ */ new Set();
		while (definitionAliases.has(current) && !visited.has(current)) {
			visited.add(current);
			current = definitionAliases.get(current);
		}
		return current;
	}
	function aliasPluginDefinitionIdentity(snapshot, source) {
		definitionAliases.set(snapshot, resolvePluginDefinitionIdentity(source));
		return snapshot;
	}
	function markCanonicalPluginDefinition(definition, source = definition) {
		return aliasPluginDefinitionIdentity(definition, source);
	}
	function isCanonicalPluginDefinition(definition) {
		return (typeof definition === "object" || typeof definition === "function") && definition !== null && definitionAliases.has(definition);
	}
	function acquirePluginDefinitionLease(definition, host, pluginId) {
		const identity = resolvePluginDefinitionIdentity(definition);
		const boundHost = definitionLeases.get(identity);
		if (boundHost && boundHost !== host) throw new PluginDefinitionAlreadyBoundError(pluginId, boundHost.state);
		definitionLeases.set(identity, host);
		return identity;
	}
	function releasePluginDefinitionLease(definition, host) {
		const identity = resolvePluginDefinitionIdentity(definition);
		if (definitionLeases.get(identity) === host) definitionLeases.delete(identity);
	}

//#endregion
//#region dist/esm/plugin-kernel/official-plugin-package-hints.js
	const OFFICIAL_PLUGIN_PACKAGE_HINTS = Object.freeze([
		Object.freeze({
			pluginId: "foundation:overlay",
			packageName: "@bensitu/image-editor/plugins/overlay"
		}),
		Object.freeze({
			pluginId: "foundation:annotation",
			packageName: "@bensitu/image-editor/plugins/annotation"
		}),
		Object.freeze({
			pluginId: "plugin:transform",
			packageName: "@bensitu/image-editor/plugins/transform"
		}),
		Object.freeze({
			pluginId: "plugin:mask",
			packageName: "@bensitu/image-editor/plugins/mask"
		}),
		Object.freeze({
			pluginId: "plugin:history",
			packageName: "@bensitu/image-editor/plugins/history"
		}),
		Object.freeze({
			pluginId: "plugin:filters",
			packageName: "@bensitu/image-editor/plugins/filters"
		}),
		Object.freeze({
			pluginId: "plugin:crop",
			packageName: "@bensitu/image-editor/plugins/crop"
		}),
		Object.freeze({
			pluginId: "plugin:mosaic",
			packageName: "@bensitu/image-editor/plugins/mosaic"
		}),
		Object.freeze({
			pluginId: "annotation:text",
			packageName: "@bensitu/image-editor/plugins/annotation-text"
		}),
		Object.freeze({
			pluginId: "annotation:shape",
			packageName: "@bensitu/image-editor/plugins/annotation-shape"
		}),
		Object.freeze({
			pluginId: "annotation:draw",
			packageName: "@bensitu/image-editor/plugins/annotation-draw"
		}),
		Object.freeze({
			pluginId: "plugin:overlay-state",
			packageName: "@bensitu/image-editor/plugins/overlay-state"
		}),
		Object.freeze({
			pluginId: "plugin:dom-controls",
			packageName: "@bensitu/image-editor/plugins/dom-controls"
		})
	]);
	const packageHintsByPluginId = new Map(OFFICIAL_PLUGIN_PACKAGE_HINTS.map(({ pluginId, packageName }) => [pluginId, packageName]));
	function getOfficialPluginPackageHint(pluginId) {
		return packageHintsByPluginId.get(pluginId);
	}

//#endregion
//#region dist/esm/plugin-kernel/plugin-state-store.js
	function assertStateKey(key) {
		if (key.trim().length === 0 || key.trim() !== key) throw new InvalidPluginDefinitionError("Plugin state keys must be non-empty trimmed strings.");
	}
	var PluginStateStore = class {
		constructor() {
			Object.defineProperty(this, "stateByPlugin", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: /* @__PURE__ */ new Map()
			});
			Object.defineProperty(this, "activePluginIds", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: /* @__PURE__ */ new Set()
			});
			Object.defineProperty(this, "disposed", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: false
			});
		}
		createScoped(pluginId, registerCleanup, registerFinalizer, isScopeActive) {
			this.assertActive("create plugin state");
			assertPluginIdentifier(pluginId, "Plugin state owner id");
			if (this.activePluginIds.has(pluginId)) throw new InvalidPluginDefinitionError(`Plugin state scope "${pluginId}" is already active.`, pluginId);
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
			} catch (error) {
				this.activePluginIds.delete(pluginId);
				throw error;
			}
			const assertScopedActive = () => {
				this.assertActive("access plugin state");
				if (!active || !isScopeActive()) throw new PluginKernelDisposedError(`access state for plugin "${pluginId}"`);
			};
			const activate = () => {
				assertScopedActive();
				if (!cleanupRegistered) {
					registerCleanup(cleanup);
					cleanupRegistered = true;
				}
				let namespace = this.stateByPlugin.get(pluginId);
				if (!namespace) {
					namespace = /* @__PURE__ */ new Map();
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
					(_a = this.stateByPlugin.get(pluginId)) === null || _a === void 0 || _a.clear();
				}
			});
		}
		hasPluginState(pluginId) {
			this.assertActive("inspect plugin state");
			return this.stateByPlugin.has(pluginId);
		}
		dispose() {
			if (this.disposed) return;
			this.stateByPlugin.clear();
			this.activePluginIds.clear();
			this.disposed = true;
		}
		assertActive(operation) {
			if (this.disposed) throw new PluginKernelDisposedError(operation);
		}
	};

//#endregion
//#region dist/esm/plugin-kernel/registration-scope.js
	var RegistrationScope = class {
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
				value: "open"
			});
			assertPluginIdentifier(pluginId, "RegistrationScope Plugin id");
			this.transactionId = Symbol(`plugin-install:${pluginId}`);
		}
		get active() {
			return this.state !== "disposed";
		}
		assertOpen(operation = "register installation resources") {
			if (this.state !== "open") throw new PluginKernelStateError(operation, `registration-scope:${this.state}`);
		}
		add(disposable) {
			this.assertOpen();
			this.entries.push({
				disposable,
				rollbackOnly: false
			});
			return disposable;
		}
		addRollback(disposable) {
			this.assertOpen();
			this.entries.push({
				disposable,
				rollbackOnly: true
			});
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
			this.assertOpen("commit plugin installation");
			for (const entry of this.entries) if (!entry.rollbackOnly && "commit" in entry.disposable) entry.disposable.commit();
			for (let index = this.entries.length - 1; index >= 0; index -= 1) if ((_a = this.entries[index]) === null || _a === void 0 ? void 0 : _a.rollbackOnly) this.entries.splice(index, 1);
			this.state = "committed";
		}
		async rollback() {
			if (this.state === "disposed") return [];
			const errors = [...await disposeInReverse(this.entries.map((entry) => entry.disposable), {
				pluginId: this.pluginId,
				...this.options
			}), ...await disposeInReverse(this.finalizers, {
				pluginId: this.pluginId,
				...this.options
			})];
			this.entries.length = 0;
			this.finalizers.length = 0;
			this.state = "disposed";
			return errors;
		}
		rollbackSync() {
			if (this.state === "disposed") return Object.freeze([]);
			const errors = [...disposeInReverseSync(this.entries.map((entry) => entry.disposable), {
				pluginId: this.pluginId,
				...this.options
			}), ...disposeInReverseSync(this.finalizers, {
				pluginId: this.pluginId,
				...this.options
			})];
			this.entries.length = 0;
			this.finalizers.length = 0;
			this.state = "disposed";
			return Object.freeze(errors);
		}
		async dispose() {
			if (this.state === "disposed") return;
			const errors = [...await disposeInReverse(this.entries.map((entry) => entry.disposable), {
				pluginId: this.pluginId,
				...this.options
			}), ...await disposeInReverse(this.finalizers, {
				pluginId: this.pluginId,
				...this.options
			})];
			this.entries.length = 0;
			this.finalizers.length = 0;
			this.state = "disposed";
			if (errors.length > 0) throw new PluginAggregateError(`[ImageEditor] Plugin "${this.pluginId}" cleanup failed.`, errors, { pluginId: this.pluginId });
		}
		disposeSync() {
			if (this.state === "disposed") return;
			const errors = this.rollbackSync();
			if (errors.length > 0) throw new PluginAggregateError(`[ImageEditor] Plugin "${this.pluginId}" synchronous cleanup failed.`, errors, { pluginId: this.pluginId });
		}
	};

//#endregion
//#region dist/esm/plugin-kernel/tool-coordinator.js
	var ToolCoordinator = class {
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
				value: /* @__PURE__ */ new Map()
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
			Object.defineProperty(this, "transitionCompletion", {
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
			this.assertActive("register a tool");
			if (!isRuntimeIdentifier(ownerPluginId)) throw new ToolRegistrationError("Invalid Tool owner Runtime ID.", ownerPluginId);
			if (!isRuntimeIdentifier(definition.id)) throw new ToolRegistrationError("Invalid Tool Runtime ID.", ownerPluginId);
			const existing = this.tools.get(definition.id);
			if (existing) throw new ToolRegistrationError(`Tool "${definition.id}" is already registered by "${existing.ownerPluginId}".`, ownerPluginId);
			const record = {
				definition,
				ownerPluginId,
				context: Object.freeze({
					toolId: definition.id,
					ownerPluginId
				})
			};
			this.tools.set(definition.id, record);
			return createDisposable(() => this.disposeRegistration(record));
		}
		disposeSync() {
			if (this.disposed) return;
			let exitError = null;
			try {
				const current = this.active;
				this.active = null;
				if (current) {
					const result = current.definition.exit("host-dispose", current.context);
					if (isPromiseLike(result)) {
						Promise.resolve(result).catch((error) => {
							reportErrorSafely(this.options.errorSink, error);
						});
						throw new ToolTransitionError(current.definition.id, "returned a Promise during synchronous host disposal", current.ownerPluginId);
					}
				}
			} catch (error) {
				exitError = normalizeThrownError(error, "[ImageEditor] Tool disposal failed with a non-Error value.");
			} finally {
				this.active = null;
				this.tools.clear();
				this.disposed = true;
			}
			if (exitError) throw exitError;
		}
		async enter(toolId, requesterPluginId) {
			this.assertActive("enter a tool");
			const next = this.tools.get(toolId);
			if (!next) throw new ToolTransitionError(toolId, "is not registered", requesterPluginId);
			if (requesterPluginId && requesterPluginId !== next.ownerPluginId) throw new ToolTransitionError(toolId, `belongs to "${next.ownerPluginId}", not "${requesterPluginId}"`, requesterPluginId);
			if (this.active === next) return;
			await this.runTransition(toolId, async () => {
				if (this.active) await this.exitCurrent("switch");
				try {
					await next.definition.enter(next.context);
					this.active = next;
				} catch (error) {
					this.active = null;
					const transitionError = new ToolTransitionError(toolId, "failed to enter", next.ownerPluginId, error);
					reportErrorSafely(this.options.errorSink, transitionError);
					throw transitionError;
				}
			});
		}
		async exit(reason = "requested") {
			this.assertActive("exit a tool");
			if (!this.active) return;
			await this.runTransition(this.active.definition.id, () => this.exitCurrent(reason));
		}
		getActiveToolId() {
			var _a, _b;
			this.assertActive("inspect active tool state");
			return (_b = (_a = this.active) === null || _a === void 0 ? void 0 : _a.definition.id) !== null && _b !== void 0 ? _b : null;
		}
		canRunOperation(operationId) {
			var _a;
			this.assertActive("check tool operation policy");
			if (!((_a = this.active) === null || _a === void 0 ? void 0 : _a.definition.canRunOperation)) return true;
			try {
				return this.active.definition.canRunOperation(operationId);
			} catch (error) {
				const transitionError = new ToolTransitionError(this.active.definition.id, `operation policy failed for "${operationId}"`, this.active.ownerPluginId, error);
				reportErrorSafely(this.options.errorSink, transitionError);
				return false;
			}
		}
		async dispose() {
			if (this.disposed) return;
			let exitError = null;
			try {
				await this.waitForTransition();
				if (this.active) await this.exitCurrent("host-dispose");
			} catch (error) {
				exitError = normalizeThrownError(error, "[ImageEditor] Tool disposal failed with a non-Error value.");
			} finally {
				this.active = null;
				this.tools.clear();
				this.disposed = true;
			}
			if (exitError) throw exitError;
		}
		async exitCurrent(reason) {
			const current = this.active;
			if (!current) return;
			this.active = null;
			try {
				await current.definition.exit(reason, current.context);
			} catch (error) {
				const transitionError = new ToolTransitionError(current.definition.id, `failed to exit for reason "${reason}"`, current.ownerPluginId, error);
				reportErrorSafely(this.options.errorSink, transitionError);
				throw transitionError;
			}
		}
		async runTransition(toolId, task) {
			if (this.transitioning) throw new ToolTransitionError(toolId, "cannot transition while another transition is active");
			this.transitioning = true;
			let completeTransition = () => void 0;
			this.transitionCompletion = new Promise((resolve) => {
				completeTransition = resolve;
			});
			try {
				await task();
			} finally {
				completeTransition();
				this.transitionCompletion = null;
				this.transitioning = false;
			}
		}
		async disposeRegistration(record) {
			await this.waitForTransition();
			try {
				if (this.active === record) await this.runTransition(record.definition.id, () => this.exitCurrent("plugin-dispose"));
			} finally {
				if (this.tools.get(record.definition.id) === record) this.tools.delete(record.definition.id);
			}
		}
		async waitForTransition() {
			while (this.transitionCompletion) await this.transitionCompletion;
		}
		assertActive(operation) {
			if (this.disposed) throw new PluginKernelDisposedError(operation);
		}
	};

//#endregion
//#region dist/esm/plugin-kernel/plugin-manager.js
	function createPluginCleanupTraversal(installationOrder, installed, toolCoordinator, operationRegistry, eventBus, capabilityRegistry, stateStore) {
		const records = [...installationOrder].reverse().map((pluginId) => installed.get(pluginId)).filter((record) => record !== void 0);
		const kernelTargets = Object.freeze([
			{
				disposable: toolCoordinator,
				disposeSync: () => toolCoordinator.disposeSync()
			},
			{
				disposable: operationRegistry,
				disposeSync: () => {
					operationRegistry.dispose();
				}
			},
			{
				disposable: eventBus,
				disposeSync: () => {
					eventBus.dispose();
				}
			},
			{
				disposable: capabilityRegistry,
				disposeSync: () => {
					capabilityRegistry.dispose();
				}
			},
			{
				disposable: stateStore,
				disposeSync: () => {
					stateStore.dispose();
				}
			}
		]);
		return Object.freeze({
			records: Object.freeze(records),
			kernelTargets
		});
	}
	function recordPluginCleanupError(errors, errorSink, error) {
		errors.push(error);
		reportErrorSafely(errorSink, error);
	}
	function releasePluginCleanupRecord(record, owner) {
		releasePluginDefinitionLease(record.plugin, owner);
	}
	function clearInstalledPluginRecords(installed, installationOrder) {
		installed.clear();
		installationOrder.length = 0;
	}
	function isPluginApi(value) {
		return typeof value === "object" && value !== null || typeof value === "function";
	}
	function sameArray(left, right, equal) {
		if (left === void 0 || right === void 0) return left === right;
		return left.length === right.length && left.every((leftValue, index) => equal(leftValue, right[index]));
	}
	function sameInstallationDefinition(left, right) {
		return left.ref === right.ref && left.manifest.id === right.manifest.id && left.manifest.version === right.manifest.version && left.manifest.apiVersion === right.manifest.apiVersion && left.manifest.engine === right.manifest.engine && sameArray(left.manifest.requiresPlugins, right.manifest.requiresPlugins, (leftRef, rightRef) => leftRef === rightRef) && sameArray(left.manifest.requires, right.manifest.requires, (leftRequirement, rightRequirement) => leftRequirement.token === rightRequirement.token && leftRequirement.range === rightRequirement.range) && sameArray(left.manifest.optional, right.manifest.optional, (leftRequirement, rightRequirement) => leftRequirement.token === rightRequirement.token && leftRequirement.range === rightRequirement.range) && sameArray(left.manifest.permissions, right.manifest.permissions, (leftPermission, rightPermission) => leftPermission === rightPermission) && left.setupMode === right.setupMode && left.setup === right.setup && left.onInit === right.onInit && left.onImageLoaded === right.onImageLoaded && left.onImageCleared === right.onImageCleared && left.onDispose === right.onDispose;
	}
	var PluginManager = class {
		constructor(options = {}) {
			var _a;
			Object.defineProperty(this, "options", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: options
			});
			Object.defineProperty(this, "capabilityRegistry", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "operationRegistry", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: new OperationRegistry()
			});
			Object.defineProperty(this, "toolCoordinator", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "eventBus", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
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
				value: /* @__PURE__ */ new Map()
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
				value: "created"
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
			this.toolCoordinator = new ToolCoordinator(options.errorSink ? { errorSink: options.errorSink } : {});
			this.eventBus = new CommittedEventBus(options);
			for (const provider of (_a = options.hostCapabilities) !== null && _a !== void 0 ? _a : []) this.capabilityRegistry.provideHost(provider.token, provider.implementation, provider.providerId, provider.requiredPermission);
		}
		get state() {
			return this.hostState;
		}
		install(plugin) {
			return Promise.reject(new PluginKernelStateError("install an asynchronous Plugin", this.hostState));
		}
		installSync(plugin) {
			return this.installSyncForHost(plugin).api;
		}
		installSyncForHost(plugin) {
			this.assertCanInstall();
			if (this.topLevelInstallActive) throw new PluginKernelStateError("start a concurrent plugin installation", this.hostState);
			this.topLevelInstallActive = true;
			try {
				const outcome = this.performInstallSync(plugin);
				return Object.freeze({
					api: outcome.api,
					installedPlugin: outcome.installedPlugin
				});
			} finally {
				this.topLevelInstallActive = false;
			}
		}
		installBatchSync(plugins) {
			this.assertCanInstall();
			if (this.topLevelInstallActive) throw new PluginKernelStateError("start a concurrent plugin installation", this.hostState);
			this.topLevelInstallActive = true;
			try {
				const prepared = this.prepareBatch(plugins);
				const visibleTransactions = /* @__PURE__ */ new Set();
				const pendingRecords = [];
				try {
					for (const entry of prepared.ordered) {
						const record = this.performPendingInstallSync(entry.plugin, visibleTransactions);
						pendingRecords.push(record);
						prepared.apisByPluginId.set(entry.plugin.ref.id, record.api);
					}
					for (const record of pendingRecords) record.scope.commit();
					for (const record of pendingRecords) {
						const pluginId = record.plugin.ref.id;
						this.installed.set(pluginId, record);
						this.installationOrder.push(pluginId);
					}
				} catch (cause) {
					const cleanupErrors = [...cause instanceof PluginSetupError ? cause.cleanupErrors : [], ...this.rollbackPendingBatchSync(pendingRecords)];
					throw new PluginBatchInstallError(cause, cleanupErrors);
				}
				return Object.freeze({
					apisByPluginId: prepared.apisByPluginId,
					installedPlugins: Object.freeze(pendingRecords.map((record) => record.plugin))
				});
			} finally {
				this.topLevelInstallActive = false;
			}
		}
		get(ref) {
			this.assertUsable("query a plugin");
			const record = this.installed.get(ref.id);
			if (!record || record.refObject !== ref) return null;
			return record.api;
		}
		require(ref) {
			const api = this.get(ref);
			if (api === null) throw new PluginNotInstalledError(ref.id);
			return api;
		}
		getById(pluginId) {
			var _a, _b;
			this.assertUsable("query a plugin by id");
			return (_b = (_a = this.installed.get(pluginId)) === null || _a === void 0 ? void 0 : _a.api) !== null && _b !== void 0 ? _b : null;
		}
		has(refOrId) {
			this.assertUsable("inspect installed plugins");
			if (typeof refOrId === "string") return this.installed.has(refOrId);
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
			return this.operationRegistry.register(definition, "core:host");
		}
		beginOperationForHost(operationId) {
			if (!this.canRunOperation(operationId)) throw new PluginKernelStateError(`run operation "${operationId}" while the active tool rejects it`, this.hostState);
			return this.operationRegistry.beginForHost(operationId);
		}
		runOperationForHost(operationId, args, task, options = {}) {
			if (!this.canRunOperation(operationId)) return Promise.reject(new PluginKernelStateError(`run operation "${operationId}" while the active tool rejects it`, this.hostState));
			return this.operationRegistry.runForHost(operationId, args, task, options);
		}
		waitForOperations() {
			return this.operationRegistry.waitForIdle();
		}
		hasRunningOperations() {
			return this.operationRegistry.hasInFlightOperations();
		}
		abortOperationsForHost(reason) {
			return this.operationRegistry.abortAll(reason);
		}
		suspendOperationsForHost(reason) {
			return this.operationRegistry.suspend(reason);
		}
		exitActiveToolForHost() {
			return this.toolCoordinator.exit("host-dispose");
		}
		emitCommitted(eventName, payload) {
			return this.eventBus.emitCommitted(eventName, payload);
		}
		async initialize() {
			var _a;
			this.assertUsable("initialize the Plugin Kernel");
			if (this.hostState !== "created" || this.topLevelInstallActive) throw new PluginKernelStateError("initialize the Plugin Kernel", this.hostState);
			this.hostState = "initializing";
			try {
				for (const pluginId of this.installationOrder) {
					const record = this.installed.get(pluginId);
					if (!(record === null || record === void 0 ? void 0 : record.plugin.onInit)) continue;
					try {
						await record.plugin.onInit(record.lifecycleContext);
					} catch (error) {
						throw new PluginLifecycleError(pluginId, "init", error);
					}
				}
				this.hostState = "initialized";
			} catch (error) {
				this.hostState = "disposing";
				const cleanupErrors = await this.cleanupAll();
				this.hostState = "disposed";
				const lifecycleError = error instanceof PluginLifecycleError ? error : new PluginLifecycleError("plugin-kernel", "init", error);
				throw new PluginLifecycleError((_a = lifecycleError.pluginId) !== null && _a !== void 0 ? _a : "plugin-kernel", "init", lifecycleError.cause, cleanupErrors);
			}
		}
		initializeSync() {
			var _a;
			this.assertUsable("initialize the Plugin Kernel");
			if (this.hostState !== "created" || this.topLevelInstallActive) throw new PluginKernelStateError("initialize the Plugin Kernel", this.hostState);
			this.hostState = "initializing";
			try {
				for (const pluginId of this.installationOrder) {
					const record = this.installed.get(pluginId);
					if (!(record === null || record === void 0 ? void 0 : record.plugin.onInit)) continue;
					const result = record.plugin.onInit(record.lifecycleContext);
					if (isPromiseLike(result)) throw new PluginLifecycleError(pluginId, "init", /* @__PURE__ */ new Error("Synchronous plugin onInit returned a Promise."));
				}
				this.hostState = "initialized";
			} catch (error) {
				this.hostState = "disposing";
				const cleanupErrors = this.cleanupAllSync();
				this.hostState = "disposed";
				const lifecycleError = error instanceof PluginLifecycleError ? error : new PluginLifecycleError("plugin-kernel", "init", error);
				throw new PluginLifecycleError((_a = lifecycleError.pluginId) !== null && _a !== void 0 ? _a : "plugin-kernel", "init", lifecycleError.cause, cleanupErrors);
			}
		}
		async notifyImageLoaded(image) {
			this.assertLifecycleReady("notify plugins that an image loaded");
			for (const pluginId of this.installationOrder) {
				const record = this.installed.get(pluginId);
				if (!(record === null || record === void 0 ? void 0 : record.plugin.onImageLoaded)) continue;
				try {
					await record.plugin.onImageLoaded(image, record.lifecycleContext);
				} catch (error) {
					throw new PluginLifecycleError(pluginId, "image-loaded", error);
				}
			}
		}
		async notifyImageCleared() {
			this.assertLifecycleReady("notify plugins that an image cleared");
			for (const pluginId of this.installationOrder) {
				const record = this.installed.get(pluginId);
				if (!(record === null || record === void 0 ? void 0 : record.plugin.onImageCleared)) continue;
				try {
					await record.plugin.onImageCleared(record.lifecycleContext);
				} catch (error) {
					throw new PluginLifecycleError(pluginId, "image-cleared", error);
				}
			}
		}
		dispose() {
			var _a;
			if (this.hostState === "disposed") return Promise.resolve();
			if (this.hostState === "disposing") return (_a = this.disposePromise) !== null && _a !== void 0 ? _a : Promise.resolve();
			if (this.hostState === "initializing") return Promise.reject(new PluginKernelStateError("dispose the Plugin Kernel", this.hostState));
			this.hostState = "disposing";
			this.disposePromise = this.performDispose();
			return this.disposePromise;
		}
		disposeSync() {
			if (this.hostState === "disposed") return;
			if (this.hostState === "disposing" || this.hostState === "initializing") throw new PluginKernelStateError("dispose the Plugin Kernel synchronously", this.hostState);
			if (this.operationRegistry.hasInFlightOperations()) throw new PluginKernelStateError("dispose the Plugin Kernel synchronously while operations are running", this.hostState);
			this.hostState = "disposing";
			const errors = this.cleanupAllSync();
			this.hostState = "disposed";
			if (errors.length > 0) throw new PluginAggregateError("[ImageEditor] Plugin Kernel synchronous disposal completed with cleanup errors.", errors);
		}
		prepareBatch(inputs) {
			var _a;
			if (!Array.isArray(inputs) || inputs.length === 0) throw new InvalidPluginDefinitionError("Plugin batch must contain at least one Plugin.");
			const candidatesById = /* @__PURE__ */ new Map();
			const normalizedInputs = /* @__PURE__ */ new WeakMap();
			const apisByPluginId = /* @__PURE__ */ new Map();
			for (const input of inputs) {
				const cacheKey = (typeof input === "object" || typeof input === "function") && input !== null ? input : null;
				let plugin = cacheKey ? normalizedInputs.get(cacheKey) : void 0;
				if (!plugin) {
					plugin = this.normalizePluginDefinition(input);
					if (cacheKey) normalizedInputs.set(cacheKey, plugin);
				}
				const pluginId = plugin.ref.id;
				const existing = this.installed.get(pluginId);
				if (existing) {
					if (!sameInstallationDefinition(existing.plugin, plugin)) throw new PluginDefinitionConflictError(pluginId);
					apisByPluginId.set(pluginId, existing.api);
					continue;
				}
				const duplicate = candidatesById.get(pluginId);
				if (duplicate) {
					if (!sameInstallationDefinition(duplicate.plugin, plugin)) throw new PluginDefinitionConflictError(pluginId);
					continue;
				}
				candidatesById.set(pluginId, { plugin });
			}
			const candidates = [...candidatesById.values()];
			const dependencies = /* @__PURE__ */ new Map();
			for (const candidate of candidates) {
				const pluginDependencies = /* @__PURE__ */ new Set();
				for (const dependency of (_a = candidate.plugin.manifest.requiresPlugins) !== null && _a !== void 0 ? _a : []) {
					const installedDependency = this.installed.get(dependency.id);
					if ((installedDependency === null || installedDependency === void 0 ? void 0 : installedDependency.refObject) === dependency) continue;
					const batchDependency = candidatesById.get(dependency.id);
					if ((batchDependency === null || batchDependency === void 0 ? void 0 : batchDependency.plugin.ref) === dependency) {
						pluginDependencies.add(dependency.id);
						continue;
					}
					throw this.createDependencyError(candidate.plugin.ref.id, dependency, [...this.installed.keys(), ...candidatesById.keys()]);
				}
				dependencies.set(candidate.plugin.ref.id, pluginDependencies);
			}
			const remaining = new Set(candidatesById.keys());
			const ordered = [];
			while (remaining.size > 0) {
				const next = candidates.find((candidate) => {
					var _a;
					return remaining.has(candidate.plugin.ref.id) && [...(_a = dependencies.get(candidate.plugin.ref.id)) !== null && _a !== void 0 ? _a : []].every((dependencyId) => !remaining.has(dependencyId));
				});
				if (!next) throw new PluginDependencyCycleError(this.findDependencyCycle(remaining, dependencies));
				remaining.delete(next.plugin.ref.id);
				ordered.push(next);
			}
			return {
				ordered: Object.freeze(ordered),
				apisByPluginId
			};
		}
		findDependencyCycle(remaining, dependencies) {
			const visited = /* @__PURE__ */ new Set();
			const visiting = /* @__PURE__ */ new Set();
			const stack = [];
			const visit = (pluginId) => {
				var _a;
				if (visiting.has(pluginId)) {
					const start = stack.indexOf(pluginId);
					return Object.freeze([...stack.slice(start), pluginId]);
				}
				if (visited.has(pluginId)) return null;
				visiting.add(pluginId);
				stack.push(pluginId);
				for (const dependencyId of (_a = dependencies.get(pluginId)) !== null && _a !== void 0 ? _a : []) {
					if (!remaining.has(dependencyId)) continue;
					const cycle = visit(dependencyId);
					if (cycle) return cycle;
				}
				stack.pop();
				visiting.delete(pluginId);
				visited.add(pluginId);
				return null;
			};
			for (const pluginId of remaining) {
				const cycle = visit(pluginId);
				if (cycle) return cycle;
			}
			return Object.freeze([...remaining, remaining.values().next().value]);
		}
		performPendingInstallSync(plugin, visibleTransactions) {
			if (plugin.setupMode !== "sync") throw new InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" must declare setupMode "sync" for install().`, plugin.ref.id);
			const { required, optional } = this.resolveCapabilities(plugin, visibleTransactions);
			acquirePluginDefinitionLease(plugin, this, plugin.ref.id);
			const scope = new RegistrationScope(plugin.ref.id, this.options);
			visibleTransactions.add(scope.transactionId);
			try {
				const contexts = this.createContexts(plugin.ref, scope, required, optional);
				const api = plugin.setup(contexts.setup);
				if (isPromiseLike(api)) throw new InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" returned a Promise from synchronous setup.`, plugin.ref.id);
				if (!isPluginApi(api)) throw new InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" setup must return a non-null object or function API.`, plugin.ref.id);
				return {
					plugin,
					refObject: plugin.ref,
					api,
					scope,
					lifecycleContext: contexts.lifecycle
				};
			} catch (error) {
				visibleTransactions.delete(scope.transactionId);
				const cleanupErrors = scope.rollbackSync();
				releasePluginDefinitionLease(plugin, this);
				throw new PluginSetupError(plugin.ref.id, error, cleanupErrors);
			}
		}
		rollbackPendingBatchSync(pendingRecords) {
			const cleanupErrors = [];
			for (const record of [...pendingRecords].reverse()) {
				if (record.plugin.onDispose) try {
					const result = record.plugin.onDispose(record.lifecycleContext);
					if (isPromiseLike(result)) {
						Promise.resolve(result).catch((error) => {
							reportErrorSafely(this.options.errorSink, error);
						});
						throw new Error("Synchronous Plugin onDispose returned a Promise.");
					}
				} catch (error) {
					cleanupErrors.push(new PluginLifecycleError(record.plugin.ref.id, "dispose", error));
				}
				cleanupErrors.push(...record.scope.rollbackSync());
				releasePluginDefinitionLease(record.plugin, this);
			}
			return Object.freeze(cleanupErrors);
		}
		createDependencyError(consumerPluginId, dependency, availablePluginIds) {
			const packageHint = getOfficialPluginPackageHint(dependency.id);
			return new PluginDependencyError({
				consumerPluginId,
				dependencyId: dependency.id,
				requiredApiVersion: dependency.apiVersion,
				availablePluginIds: Object.freeze([...new Set(availablePluginIds)].sort()),
				...packageHint ? { packageHint } : {},
				planHint: "Pass the dependency to install([...]) or include it in composePlugins(...)."
			});
		}
		assertPluginDependenciesInstalled(plugin) {
			var _a;
			for (const dependency of (_a = plugin.manifest.requiresPlugins) !== null && _a !== void 0 ? _a : []) {
				const installedDependency = this.installed.get(dependency.id);
				if ((installedDependency === null || installedDependency === void 0 ? void 0 : installedDependency.refObject) === dependency) continue;
				throw this.createDependencyError(plugin.ref.id, dependency, [...this.installed.keys()]);
			}
		}
		performInstallSync(input) {
			const plugin = this.normalizePluginDefinition(input);
			if (plugin.setupMode !== "sync") throw new InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" must declare setupMode "sync" for installSync().`, plugin.ref.id);
			const pluginId = plugin.ref.id;
			if (this.installed.get(pluginId)) throw new PluginAlreadyInstalledError(pluginId);
			this.assertPluginDependenciesInstalled(plugin);
			const { required, optional } = this.resolveCapabilities(plugin);
			acquirePluginDefinitionLease(plugin, this, pluginId);
			const scope = new RegistrationScope(pluginId, this.options);
			try {
				const contexts = this.createContexts(plugin.ref, scope, required, optional);
				const api = plugin.setup(contexts.setup);
				if (isPromiseLike(api)) throw new InvalidPluginDefinitionError(`Plugin "${pluginId}" returned a Promise from synchronous setup.`, pluginId);
				if (!isPluginApi(api)) throw new InvalidPluginDefinitionError(`Plugin "${pluginId}" setup must return a non-null object or function API.`, pluginId);
				scope.commit();
				this.installed.set(pluginId, {
					plugin,
					refObject: plugin.ref,
					api,
					scope,
					lifecycleContext: contexts.lifecycle
				});
				this.installationOrder.push(pluginId);
				return {
					api,
					installedPlugin: plugin
				};
			} catch (error) {
				const cleanupErrors = scope.rollbackSync();
				releasePluginDefinitionLease(plugin, this);
				throw new PluginSetupError(pluginId, error, cleanupErrors);
			}
		}
		resolveCapabilities(plugin, visibleTransactions) {
			var _a, _b;
			const required = /* @__PURE__ */ new Map();
			const optional = /* @__PURE__ */ new Map();
			for (const requirement of (_a = plugin.manifest.requires) !== null && _a !== void 0 ? _a : []) {
				this.assertCapabilityPermission(plugin, requirement.token.id, visibleTransactions);
				required.set(requirement.token.id, {
					token: requirement.token,
					value: this.capabilityRegistry.requireDefinition(requirement, plugin.ref.id, visibleTransactions)
				});
			}
			for (const requirement of (_b = plugin.manifest.optional) !== null && _b !== void 0 ? _b : []) {
				this.assertCapabilityPermission(plugin, requirement.token.id, visibleTransactions);
				const value = this.capabilityRegistry.optionalDefinition(requirement, plugin.ref.id, visibleTransactions);
				optional.set(requirement.token.id, {
					token: requirement.token,
					value,
					status: value !== null ? "available" : this.capabilityRegistry.getProviderInfo(requirement.token.id) ? "incompatible" : "missing"
				});
			}
			return {
				required,
				optional
			};
		}
		assertCapabilityPermission(plugin, capabilityId, visibleTransactions) {
			var _a;
			const permission = this.capabilityRegistry.getRequiredPermission(capabilityId, visibleTransactions);
			if (!permission || ((_a = plugin.manifest.permissions) === null || _a === void 0 ? void 0 : _a.includes(permission))) return;
			throw new PluginPermissionError(plugin.ref.id, permission, capabilityId);
		}
		createContexts(plugin, scope, required, optional) {
			const pluginId = plugin.id;
			const state = this.stateStore.createScoped(pluginId, (disposable) => scope.add(disposable), (disposable) => scope.addFinalizer(disposable), () => scope.active);
			const capabilities = Object.freeze({
				require: (token) => {
					const resolved = required.get(token.id);
					if (!resolved || resolved.token !== token) throw new PluginCapabilityError({
						consumerPluginId: pluginId,
						capabilityId: token.id,
						requestedRange: "undeclared-required-capability",
						reason: "missing"
					});
					return resolved.value;
				},
				optional: (token) => {
					const resolved = optional.get(token.id);
					if (!resolved || resolved.token !== token) throw new PluginCapabilityError({
						consumerPluginId: pluginId,
						capabilityId: token.id,
						requestedRange: "undeclared-optional-capability",
						reason: "missing"
					});
					return resolved.value;
				},
				getOptionalStatus: (token) => {
					const resolved = optional.get(token.id);
					if (!resolved || resolved.token !== token) throw new PluginCapabilityError({
						consumerPluginId: pluginId,
						capabilityId: token.id,
						requestedRange: "undeclared-optional-capability",
						reason: "missing"
					});
					return resolved.status;
				}
			});
			const operations = Object.freeze({
				begin: (operationId) => {
					if (!this.canRunOperation(operationId)) throw this.operationRejectedByTool(operationId);
					return this.operationRegistry.begin(operationId, pluginId);
				},
				run: (operationId, args, task, options = {}) => this.canRunOperation(operationId) ? this.operationRegistry.run(operationId, pluginId, args, task, options) : Promise.reject(this.operationRejectedByTool(operationId)),
				get: (operationId) => this.operationRegistry.get(operationId),
				isActive: (operationId) => this.operationRegistry.isActive(operationId)
			});
			const tools = Object.freeze({
				enter: (toolId) => this.toolCoordinator.enter(toolId, pluginId),
				exit: (reason) => this.toolCoordinator.exit(reason),
				getActiveToolId: () => this.toolCoordinator.getActiveToolId(),
				canRunOperation: (operationId) => this.toolCoordinator.canRunOperation(operationId)
			});
			const events = Object.freeze({ emitCommitted: (eventName, payload) => this.eventBus.emitCommitted(eventName, payload) });
			const lifecycle = Object.freeze({
				plugin,
				pluginId,
				state,
				capabilities,
				operations,
				tools,
				events
			});
			const setupCapabilities = Object.freeze({
				...capabilities,
				provide: (token, implementation, options) => {
					var _a;
					scope.assertOpen();
					return scope.add(this.capabilityRegistry.providePending(token, implementation, pluginId, scope.transactionId, (_a = options === null || options === void 0 ? void 0 : options.version) !== null && _a !== void 0 ? _a : token.version, options === null || options === void 0 ? void 0 : options.requiredPermission));
				}
			});
			const setupOperations = Object.freeze({
				...operations,
				register: (definition) => {
					scope.assertOpen();
					return scope.add(this.operationRegistry.register(definition, pluginId));
				}
			});
			const setupTools = Object.freeze({
				...tools,
				register: (definition) => {
					scope.assertOpen();
					return scope.add(this.toolCoordinator.register(definition, pluginId));
				}
			});
			const setupEvents = Object.freeze({
				...events,
				on: (eventName, listener) => {
					scope.assertOpen();
					return scope.add(this.eventBus.on(eventName, listener));
				}
			});
			const disposables = Object.freeze({
				get active() {
					return scope.active;
				},
				add: (disposable) => {
					scope.assertOpen();
					return scope.add(disposable);
				}
			});
			return {
				setup: Object.freeze({
					plugin,
					pluginId,
					state,
					capabilities: setupCapabilities,
					operations: setupOperations,
					tools: setupTools,
					events: setupEvents,
					disposables
				}),
				lifecycle
			};
		}
		normalizePluginDefinition(plugin) {
			if (isCanonicalPluginDefinition(plugin)) return plugin;
			if (typeof plugin !== "object" || plugin === null) throw new InvalidPluginDefinitionError("Plugin definition must be an object.");
			if (!isPluginRef(plugin.ref)) throw new InvalidPluginDefinitionError("Plugin definition must use a PluginRef created by definePluginRef().");
			if (typeof plugin.setup !== "function") throw new InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" must define setup().`, plugin.ref.id);
			const manifest = validatePluginManifest(plugin.ref, "manifest" in plugin ? plugin.manifest : {
				id: plugin.ref.id,
				version: plugin.version,
				apiVersion: plugin.ref.apiVersion,
				engine: "*",
				...plugin.requires ? { requires: plugin.requires } : {},
				...plugin.optional ? { optional: plugin.optional } : {},
				...plugin.permissions ? { permissions: plugin.permissions } : {}
			});
			const normalized = Object.freeze({
				...plugin,
				ref: plugin.ref,
				manifest,
				...!("manifest" in plugin) ? {
					version: manifest.version,
					...manifest.requires ? { requires: manifest.requires } : {},
					...manifest.optional ? { optional: manifest.optional } : {},
					...manifest.permissions ? { permissions: manifest.permissions } : {}
				} : {}
			});
			return markCanonicalPluginDefinition(normalized, plugin);
		}
		getAsyncInstallationHost() {
			return this;
		}
		async performDispose() {
			const errors = await this.cleanupAll();
			this.hostState = "disposed";
			if (errors.length > 0) throw new PluginAggregateError("[ImageEditor] Plugin Kernel disposal completed with cleanup errors.", errors);
		}
		async cleanupAll() {
			const errors = [];
			try {
				await this.operationRegistry.suspend(new DOMException("Plugin Kernel disposal aborted active operations.", "AbortError"));
			} catch (error) {
				recordPluginCleanupError(errors, this.options.errorSink, error);
			}
			const traversal = createPluginCleanupTraversal(this.installationOrder, this.installed, this.toolCoordinator, this.operationRegistry, this.eventBus, this.capabilityRegistry, this.stateStore);
			for (const record of traversal.records) {
				if (!record.plugin.onDispose) continue;
				try {
					await record.plugin.onDispose(record.lifecycleContext);
				} catch (error) {
					const lifecycleError = new PluginLifecycleError(record.plugin.ref.id, "dispose", error);
					recordPluginCleanupError(errors, this.options.errorSink, lifecycleError);
				}
			}
			for (const record of traversal.records) {
				try {
					await record.scope.dispose();
				} catch (error) {
					recordPluginCleanupError(errors, this.options.errorSink, error);
				}
				releasePluginCleanupRecord(record, this);
			}
			clearInstalledPluginRecords(this.installed, this.installationOrder);
			for (const target of traversal.kernelTargets) try {
				await target.disposable.dispose();
			} catch (error) {
				recordPluginCleanupError(errors, this.options.errorSink, error);
			}
			return errors;
		}
		cleanupAllSync() {
			const errors = [];
			const traversal = createPluginCleanupTraversal(this.installationOrder, this.installed, this.toolCoordinator, this.operationRegistry, this.eventBus, this.capabilityRegistry, this.stateStore);
			for (const record of traversal.records) {
				if (!record.plugin.onDispose) continue;
				try {
					const result = record.plugin.onDispose(record.lifecycleContext);
					if (isPromiseLike(result)) {
						Promise.resolve(result).catch((error) => {
							reportErrorSafely(this.options.errorSink, error);
						});
						throw new PluginLifecycleError(record.plugin.ref.id, "dispose", /* @__PURE__ */ new Error("Synchronous plugin onDispose returned a Promise."));
					}
				} catch (error) {
					const lifecycleError = error instanceof PluginLifecycleError ? error : new PluginLifecycleError(record.plugin.ref.id, "dispose", error);
					recordPluginCleanupError(errors, this.options.errorSink, lifecycleError);
				}
			}
			for (const record of traversal.records) {
				try {
					record.scope.disposeSync();
				} catch (error) {
					recordPluginCleanupError(errors, this.options.errorSink, error);
				}
				releasePluginCleanupRecord(record, this);
			}
			clearInstalledPluginRecords(this.installed, this.installationOrder);
			for (const target of traversal.kernelTargets) try {
				target.disposeSync();
			} catch (error) {
				recordPluginCleanupError(errors, this.options.errorSink, error);
			}
			return Object.freeze(errors);
		}
		assertCanInstall() {
			this.assertUsable("install a plugin");
			if (this.hostState !== "created") throw new PluginKernelStateError("install a plugin", this.hostState);
		}
		canRunOperation(operationId) {
			var _a;
			const activeToolId = this.toolCoordinator.getActiveToolId();
			const operation = this.operationRegistry.get(operationId);
			if (activeToolId && ((_a = operation === null || operation === void 0 ? void 0 : operation.allowedDuringTool) === null || _a === void 0 ? void 0 : _a.includes(activeToolId))) return true;
			return this.toolCoordinator.canRunOperation(operationId);
		}
		operationRejectedByTool(operationId) {
			return new PluginKernelStateError(`run operation "${operationId}" while the active tool rejects it`, this.hostState);
		}
		assertLifecycleReady(operation) {
			this.assertUsable(operation);
			if (this.hostState !== "initialized") throw new PluginKernelStateError(operation, this.hostState);
		}
		assertUsable(operation) {
			if (this.hostState === "disposed" || this.hostState === "disposing") throw new PluginKernelDisposedError(operation);
		}
	};

//#endregion
//#region dist/esm/plugin-kernel/plugin-plan.js
	const pluginPlanDefinition = Symbol("image-editor.plugin-plan.definition");
	function isPluginPlan(value) {
		return typeof value === "object" && value !== null && pluginPlanDefinition in value && Array.isArray(value.plugins);
	}
	function assertPluginPlanItem(value, key) {
		if (isPluginPlan(value)) return;
		if (typeof value !== "object" || value === null || !("ref" in value) || !("setup" in value)) throw new InvalidPluginDefinitionError(`Plugin Plan entry "${key}" must be a Plugin or nested Plugin Plan.`);
	}
	function composePlugins(definitions) {
		if (typeof definitions !== "object" || definitions === null) throw new InvalidPluginDefinitionError("Plugin Plan definitions must be an object.");
		const entries = Object.entries(definitions);
		if (entries.length === 0) throw new InvalidPluginDefinitionError("Plugin Plan must contain at least one Plugin.");
		const plugins = [];
		for (const [key, value] of entries) {
			assertPluginPlanItem(value, key);
			if (isPluginPlan(value)) plugins.push(...value.plugins);
			else plugins.push(value);
		}
		const preservedDefinitions = Object.freeze({ ...definitions });
		return Object.freeze({
			plugins: Object.freeze(plugins),
			[pluginPlanDefinition]: preservedDefinitions
		});
	}
	function resolvePluginPlanApis(plan, resolveApi) {
		const result = Object.create(null);
		for (const [key, value] of Object.entries(plan[pluginPlanDefinition])) result[key] = isPluginPlan(value) ? resolvePluginPlanApis(value, resolveApi) : resolveApi(value);
		return Object.freeze(result);
	}

//#endregion
//#region dist/esm/utils/dom.js
	function forceReflow(element) {
		if (!element) return;
		element.offsetWidth;
	}

//#endregion
//#region dist/esm/image/layout-manager.js
	function selectLayoutStrategy(mode) {
		return mode;
	}
	const ZERO_SCROLLBAR_SIZE = Object.freeze({
		width: 0,
		height: 0
	});
	const scrollbarSizeCache = /* @__PURE__ */ new WeakMap();
	var ViewportCache = class {
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
			if (!container) return fallback;
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
	};
	const OVERFLOW_EPSILON = .5;
	function normalizeOverflowValue(value) {
		return typeof value === "string" ? value.trim().toLowerCase() : "";
	}
	function getContainerOverflowValues(container) {
		var _a, _b;
		const style = container.style;
		let computedOverflow = "";
		let computedOverflowX = "";
		let computedOverflowY = "";
		const view = (_b = (_a = container.ownerDocument) === null || _a === void 0 ? void 0 : _a.defaultView) !== null && _b !== void 0 ? _b : typeof window === "undefined" ? null : window;
		if (typeof (view === null || view === void 0 ? void 0 : view.getComputedStyle) === "function") {
			const computed = view.getComputedStyle(container);
			computedOverflow = computed.overflow;
			computedOverflowX = computed.overflowX;
			computedOverflowY = computed.overflowY;
		}
		const x = [
			normalizeOverflowValue(style === null || style === void 0 ? void 0 : style.overflow),
			normalizeOverflowValue(style === null || style === void 0 ? void 0 : style.overflowX),
			normalizeOverflowValue(computedOverflow),
			normalizeOverflowValue(computedOverflowX)
		];
		const y = [
			normalizeOverflowValue(style === null || style === void 0 ? void 0 : style.overflow),
			normalizeOverflowValue(style === null || style === void 0 ? void 0 : style.overflowY),
			normalizeOverflowValue(computedOverflow),
			normalizeOverflowValue(computedOverflowY)
		];
		return {
			x,
			y,
			all: [...x, ...y]
		};
	}
	function isAutoScrollableOverflow(value) {
		return value === "auto" || value === "overlay";
	}
	function measureScrollbarSize(ownerDocument) {
		const doc = ownerDocument !== null && ownerDocument !== void 0 ? ownerDocument : typeof document === "undefined" ? null : document;
		if (!(doc === null || doc === void 0 ? void 0 : doc.body)) return ZERO_SCROLLBAR_SIZE;
		const cached = scrollbarSizeCache.get(doc);
		if (cached) return cached;
		const probe = doc.createElement("div");
		probe.style.position = "absolute";
		probe.style.left = "-9999px";
		probe.style.top = "-9999px";
		probe.style.width = "100px";
		probe.style.height = "100px";
		probe.style.overflow = "scroll";
		probe.style.visibility = "hidden";
		probe.style.pointerEvents = "none";
		doc.body.appendChild(probe);
		const width = Math.max(0, probe.offsetWidth - probe.clientWidth);
		const height = Math.max(0, probe.offsetHeight - probe.clientHeight);
		probe.remove();
		const measured = Object.freeze({
			width,
			height
		});
		scrollbarSizeCache.set(doc, measured);
		return measured;
	}
	function normalizeScrollbarSize(scrollbarSize) {
		return {
			width: Math.max(0, Number(scrollbarSize === null || scrollbarSize === void 0 ? void 0 : scrollbarSize.width) || 0),
			height: Math.max(0, Number(scrollbarSize === null || scrollbarSize === void 0 ? void 0 : scrollbarSize.height) || 0)
		};
	}
	function measureContainerViewport(container, fallback, scrollbarSize) {
		if (!container) return fallback;
		const clientWidth = Math.floor(container.clientWidth || 0);
		const clientHeight = Math.floor(container.clientHeight || 0);
		if (clientWidth <= 0 || clientHeight <= 0) return fallback;
		const overflow = getContainerOverflowValues(container);
		if (overflow.all.includes("scroll")) return {
			width: clientWidth,
			height: clientHeight
		};
		const scrollbar = normalizeScrollbarSize(scrollbarSize);
		const canAutoScrollX = overflow.x.some(isAutoScrollableOverflow);
		const canAutoScrollY = overflow.y.some(isAutoScrollableOverflow);
		const scrollWidth = Math.ceil(container.scrollWidth || 0);
		const scrollHeight = Math.ceil(container.scrollHeight || 0);
		const hasHorizontalScrollbar = canAutoScrollX && scrollWidth > clientWidth + OVERFLOW_EPSILON;
		return {
			width: clientWidth + (canAutoScrollY && scrollHeight > clientHeight + OVERFLOW_EPSILON ? scrollbar.width : 0),
			height: clientHeight + (hasHorizontalScrollbar ? scrollbar.height : 0)
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
			if (nextHorizontal === hasHorizontal && nextVertical === hasVertical) break;
			hasHorizontal = nextHorizontal;
			hasVertical = nextVertical;
		}
		const effectiveW = Math.max(1, viewportW - (hasVertical ? scrollbar.width : 0));
		const effectiveH = Math.max(1, viewportH - (hasHorizontal ? scrollbar.height : 0));
		return {
			width: hasHorizontal ? Math.ceil(contentWidth) : effectiveW,
			height: hasVertical ? Math.ceil(contentHeight) : effectiveH
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
			baseImageScale: fitScale
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
			if (nextHasHorizontal === hasHorizontal && nextHasVertical === hasVertical) break;
			hasHorizontal = nextHasHorizontal;
			hasVertical = nextHasVertical;
		}
		const canvasSize = computeScrollableCanvasSize(scaledW, scaledH, {
			width: viewportW,
			height: viewportH
		}, scrollbar);
		return {
			canvasWidth: canvasSize.width,
			canvasHeight: canvasSize.height,
			imageScale: coverScale,
			imageLeft: 0,
			imageTop: 0,
			baseImageScale: coverScale
		};
	}
	function computeExpandLayout(imageWidth, imageHeight, containerSize) {
		return {
			canvasWidth: Math.max(containerSize.width, Math.floor(imageWidth)),
			canvasHeight: Math.max(containerSize.height, Math.floor(imageHeight)),
			imageScale: 1,
			imageLeft: 0,
			imageTop: 0,
			baseImageScale: 1
		};
	}
	function applyCanvasDimensions(canvas, width, height, containerElement) {
		const integerWidth = Math.max(1, Math.round(Number(width) || 1));
		const integerHeight = Math.max(1, Math.round(Number(height) || 1));
		canvas.setDimensions({
			width: integerWidth,
			height: integerHeight
		});
		forceReflow(containerElement);
	}

//#endregion
//#region dist/esm/core-runtime/errors.js
	function severityFor(behavior) {
		if (behavior === "operation-cancelled") return "cancelled";
		if (behavior === "recoverable-object" || behavior === "recoverable-optional-capability" || behavior === "operation-conflict") return "recoverable";
		return "fatal";
	}
	function errorCode(value) {
		if (!value || typeof value !== "object" || !("code" in value)) return null;
		return typeof value.code === "string" ? value.code : null;
	}
	function classifyCoreError(error) {
		if (error instanceof CoreRuntimeError) return Object.freeze({
			behavior: error.behavior,
			severity: error.severity
		});
		if (error instanceof DOMException && error.name === "AbortError") return Object.freeze({
			behavior: "operation-cancelled",
			severity: "cancelled"
		});
		const code = errorCode(error);
		if (code === "OPTIONAL_CAPABILITY_INCOMPATIBLE") return Object.freeze({
			behavior: "recoverable-optional-capability",
			severity: "recoverable"
		});
		if (code === "OPERATION_CONFLICT") return Object.freeze({
			behavior: "operation-conflict",
			severity: "recoverable"
		});
		return Object.freeze({
			behavior: "fatal-participant",
			severity: "fatal"
		});
	}
	var CoreRuntimeError = class extends Error {
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
			this.code = (_a = options.code) !== null && _a !== void 0 ? _a : "CORE_RUNTIME_ERROR";
			this.cause = options.cause;
			this.behavior = (_b = options.behavior) !== null && _b !== void 0 ? _b : "fatal-participant";
			this.severity = severityFor(this.behavior);
		}
	};
	var EditorAlreadyInitializedError = class extends CoreRuntimeError {
		constructor() {
			super("[ImageEditor] The editor is already initialized.", {
				code: "EDITOR_ALREADY_INITIALIZED",
				behavior: "lifecycle"
			});
		}
	};
	var EditorInitializationInProgressError = class extends CoreRuntimeError {
		constructor(operation = "initialize") {
			super(`[ImageEditor] Cannot ${operation} while initialization is in progress.`, {
				code: "EDITOR_INITIALIZATION_IN_PROGRESS",
				behavior: "lifecycle"
			});
		}
	};
	var EditorDisposingError = class extends CoreRuntimeError {
		constructor(operation) {
			super(`[ImageEditor] Cannot ${operation} while the editor is disposing.`, {
				code: "EDITOR_DISPOSING",
				behavior: "lifecycle"
			});
		}
	};
	var EditorDisposedError = class extends CoreRuntimeError {
		constructor(operation) {
			super(`[ImageEditor] Cannot ${operation} after the editor has been disposed.`, {
				code: "EDITOR_DISPOSED",
				behavior: "lifecycle"
			});
		}
	};
	var EditorFaultedError = class extends CoreRuntimeError {
		constructor(operation) {
			super(`[ImageEditor] Cannot ${operation} while the editor is faulted.`, {
				code: "EDITOR_FAULTED",
				behavior: "lifecycle"
			});
		}
	};
	var StateRegistrationError = class extends CoreRuntimeError {
		constructor(message, sliceId) {
			super(`[ImageEditor] ${message}`, { code: "STATE_REGISTRATION_ERROR" });
			Object.defineProperty(this, "sliceId", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: sliceId
			});
		}
	};
	var StateCloneError = class extends CoreRuntimeError {
		constructor(message, cause) {
			super(`[ImageEditor] ${message}`, {
				code: "STATE_CLONE_ERROR",
				cause
			});
		}
	};
	var MementoCaptureError = class extends CoreRuntimeError {
		constructor(sliceId, cause) {
			super(`[ImageEditor] Failed to capture state slice "${sliceId}".`, {
				code: "MEMENTO_CAPTURE_ERROR",
				cause
			});
			Object.defineProperty(this, "sliceId", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: sliceId
			});
		}
	};
	var MementoRestoreError = class extends CoreRuntimeError {
		constructor(sliceId, phase, cause, rollbackErrors = []) {
			super(`[ImageEditor] Failed to ${phase} state slice "${sliceId}"${rollbackErrors.length > 0 ? `; ${rollbackErrors.length} rollback error(s) followed` : ""}.`, {
				code: "MEMENTO_RESTORE_ERROR",
				cause,
				behavior: rollbackErrors.length > 0 ? "fatal-rollback" : "fatal-restore"
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
	};
	var SnapshotValidationError = class extends CoreRuntimeError {
		constructor(message, path = "$", cause, code = "SNAPSHOT_VALIDATION_ERROR") {
			super(`[ImageEditor] Invalid snapshot at ${path}: ${message}`, {
				code,
				cause,
				behavior: "snapshot-validation"
			});
			Object.defineProperty(this, "path", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: path
			});
		}
	};
	var SnapshotVersionUnsupportedError = class extends SnapshotValidationError {
		constructor(detectedVersion = "unversioned") {
			super(`snapshot version "${detectedVersion}" is unsupported; migrate it with "@bensitu/image-editor/migrate-v2" before loading.`, "$.version", void 0, "SNAPSHOT_VERSION_UNSUPPORTED");
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
				value: "@bensitu/image-editor/migrate-v2"
			});
		}
	};
	var EmergencyResetError = class extends CoreRuntimeError {
		constructor(diagnostics, cause) {
			super(`[ImageEditor] Emergency reset failed with ${diagnostics.length} diagnostic(s); the editor was permanently disposed.`, {
				code: "EMERGENCY_RESET_ERROR",
				cause,
				behavior: "lifecycle"
			});
			Object.defineProperty(this, "diagnostics", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: diagnostics
			});
		}
	};
	var GeometryRegistrationError = class extends CoreRuntimeError {
		constructor(message, participantId) {
			super(`[ImageEditor] ${message}`, { code: "GEOMETRY_REGISTRATION_ERROR" });
			Object.defineProperty(this, "participantId", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: participantId
			});
		}
	};
	var GeometryMutationError = class extends CoreRuntimeError {
		constructor(mutationId, message, cause, rollbackErrors = []) {
			super(`[ImageEditor] Geometry mutation "${mutationId}" failed: ${message}`, {
				code: "GEOMETRY_MUTATION_ERROR",
				cause
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
	};
	var GeometryRecoverableObjectError = class extends CoreRuntimeError {
		constructor(message, objectIdentity, objectKind, cause) {
			super(`[ImageEditor] Recoverable overlay geometry failure: ${message}`, {
				code: "GEOMETRY_RECOVERABLE_OBJECT_ERROR",
				cause,
				behavior: "recoverable-object"
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
	};
	var GeometryUnrecoverableError = class extends CoreRuntimeError {
		constructor(mutationId, cause, errors) {
			super(`[ImageEditor] Geometry mutation "${mutationId}" could not restore its pre-operation state.`, {
				code: "GEOMETRY_UNRECOVERABLE_ERROR",
				cause,
				behavior: "fatal-restore"
			});
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
	};
	var DocumentMutationRegistrationError = class extends CoreRuntimeError {
		constructor(message, transactionId) {
			super(`[ImageEditor] ${message}`, { code: "DOCUMENT_MUTATION_REGISTRATION_ERROR" });
			Object.defineProperty(this, "transactionId", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: transactionId
			});
		}
	};
	var DocumentMutationError = class extends CoreRuntimeError {
		constructor(transactionId, message, cause, rollbackErrors = [], code = "DOCUMENT_MUTATION_ERROR", behavior = rollbackErrors.length > 0 ? "fatal-rollback" : "fatal-participant") {
			super(`[ImageEditor] Document mutation "${transactionId}" failed: ${message}`, {
				code,
				cause,
				behavior
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
	};
	var DocumentMutationInvariantError = class extends DocumentMutationError {
		constructor(transactionId, cause) {
			super(transactionId, cause instanceof Error ? cause.message : "invariant validation failed.", cause, [], "DOCUMENT_MUTATION_INVARIANT_ERROR", "fatal-invariant");
		}
	};
	var DocumentMutationUnrecoverableError = class extends DocumentMutationError {
		constructor(transactionId, cause, rollbackErrors) {
			super(transactionId, "the pre-operation state could not be restored.", cause, rollbackErrors, "DOCUMENT_MUTATION_UNRECOVERABLE_ERROR", "fatal-restore");
		}
	};

//#endregion
//#region dist/esm/utils/image-budget.js
	function resolveRasterAllocation(width, height, multiplier = 1) {
		if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(multiplier) || width <= 0 || height <= 0 || multiplier <= 0) return null;
		const allocationWidth = Math.ceil(width * multiplier);
		const allocationHeight = Math.ceil(height * multiplier);
		if (!Number.isSafeInteger(allocationWidth) || !Number.isSafeInteger(allocationHeight) || allocationWidth <= 0 || allocationHeight <= 0) return null;
		const pixels = allocationWidth * allocationHeight;
		if (!Number.isSafeInteger(pixels)) return null;
		return Object.freeze({
			width: allocationWidth,
			height: allocationHeight,
			pixels
		});
	}
	function isRasterAllocationWithinBudget(width, height, budget, multiplier = 1) {
		const allocation = resolveRasterAllocation(width, height, multiplier);
		return allocation !== null && Number.isSafeInteger(budget.maxDimension) && Number.isSafeInteger(budget.maxPixels) && budget.maxDimension > 0 && budget.maxPixels > 0 && allocation.width <= budget.maxDimension && allocation.height <= budget.maxDimension && allocation.width <= Math.floor(budget.maxPixels / allocation.height);
	}

//#endregion
//#region dist/esm/core-runtime/core-state-adapter.js
	const DEFAULT_SECURITY_LIMITS = Object.freeze({
		maxDecodedPixels: 5e7,
		maxImageDimension: 32768,
		decodeTimeoutMs: 15e3
	});
	function isRecord$1(value) {
		return typeof value === "object" && value !== null && !Array.isArray(value);
	}
	function isPositiveSafeInteger(value) {
		return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
	}
	function isImageMimeType(value) {
		return value === "image/jpeg" || value === "image/png" || value === "image/webp";
	}
	function isBaseImage(object) {
		return object.editorObjectKind === "baseImage";
	}
	function disposeReplacedBaseImage(previous, replacement, operation) {
		if (!previous || previous === replacement) return;
		try {
			previous.dispose();
		} catch (cause) {
			throw new CoreRuntimeError(`[ImageEditor] Replaced base image cleanup failed during ${operation}.`, {
				code: "BASE_IMAGE_DISPOSAL_ERROR",
				cause
			});
		}
	}
	function disposeRejectedBaseImages(canvas, retainedImage, cause) {
		const cleanupErrors = [];
		let objects = [];
		try {
			objects = canvas.getObjects();
		} catch (error) {
			cleanupErrors.push(error);
		}
		const visited = /* @__PURE__ */ new Set();
		for (const object of objects) {
			if (!isBaseImage(object) || object === retainedImage || visited.has(object)) continue;
			visited.add(object);
			try {
				disposeReplacedBaseImage(object, null, "failed state restore");
			} catch (error) {
				cleanupErrors.push(error);
			}
		}
		if (cleanupErrors.length > 0) throw new CoreRuntimeError("[ImageEditor] State restore failed and rejected base image cleanup also failed.", { cause: Object.freeze([cause, ...cleanupErrors]) });
	}
	var CanvasCoreStateAdapter = class {
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
			if (!canvas) return {
				initialized: false,
				canvasWidth: 0,
				canvasHeight: 0,
				canvas: null,
				imageMimeType: null,
				baseImageScale: 1,
				geometryRevision: this.access.getGeometryRevision()
			};
			const serializedValue = canvas.toJSON(this.properties.listKeys());
			if (!isRecord$1(serializedValue)) throw new SnapshotValidationError("Fabric canvas serialization must be an object.");
			const serialized = { ...serializedValue };
			const serializedObjects = Array.isArray(serialized.objects) ? serialized.objects : [];
			const liveObjects = canvas.getObjects();
			const propertyKeys = this.properties.listKeys();
			for (let index = 0; index < serializedObjects.length; index += 1) {
				const serializedObject = serializedObjects[index];
				const liveObject = liveObjects[index];
				if (!isRecord$1(serializedObject) || !liveObject) continue;
				const liveRecord = liveObject;
				for (const key of propertyKeys) if (liveRecord[key] !== void 0) serializedObject[key] = liveRecord[key];
			}
			serialized.objects = serializedObjects.filter((entry, index) => {
				const liveObject = liveObjects[index];
				if (!entry || !liveObject || this.transientObjects.isTransient(liveObject) || this.externalObjects.isTransient(liveObject)) return false;
				if (context.mode === "snapshot") return isBaseImage(liveObject);
				return true;
			});
			return {
				initialized: true,
				canvasWidth: canvas.getWidth(),
				canvasHeight: canvas.getHeight(),
				canvas: serialized,
				imageMimeType: this.access.getImageMimeType(),
				baseImageScale: this.access.getBaseImageScale(),
				geometryRevision: this.access.getGeometryRevision()
			};
		}
		async restore(state, context) {
			var _a, _b, _c;
			if (this.access.isDisposed()) throw new Error("Cannot restore Core state after disposal.");
			const validated = this.validateState(state, context.mode === "public-snapshot");
			if (!validated.valid) throw new SnapshotValidationError(validated.message, validated.path);
			const next = validated.value;
			if (context.signal.aborted) throw (_a = context.signal.reason) !== null && _a !== void 0 ? _a : /* @__PURE__ */ new Error("State restore aborted.");
			const previousBaseImage = this.access.getBaseImage();
			if (!next.initialized) {
				const canvas = this.access.getCanvas();
				canvas === null || canvas === void 0 || canvas.clear();
				this.access.setBaseImage(null);
				this.access.setImageMimeType(null);
				this.access.setBaseImageScale(1);
				this.access.setGeometryRevision(next.geometryRevision);
				disposeReplacedBaseImage(previousBaseImage, null, "state restore");
				return;
			}
			const canvas = this.access.getCanvas();
			if (!canvas) throw new Error("Core Canvas must be initialized before state restore.");
			this.access.setCanvasSize(next.canvasWidth, next.canvasHeight);
			if (!next.canvas) throw new Error("Initialized Core state requires Canvas JSON.");
			const controller = new AbortController();
			const abort = () => controller.abort(context.signal.reason);
			context.signal.addEventListener("abort", abort, { once: true });
			if (context.signal.aborted) abort();
			const timeout = setTimeout(() => {
				controller.abort(new SnapshotValidationError(`Canvas decode timed out after ${this.securityLimits.decodeTimeoutMs}ms.`, "$.core.canvas"));
			}, this.securityLimits.decodeTimeoutMs);
			try {
				try {
					await canvas.loadFromJSON(next.canvas, void 0, { signal: controller.signal });
				} catch (error) {
					if (controller.signal.aborted && controller.signal.reason) throw controller.signal.reason;
					throw error;
				} finally {
					clearTimeout(timeout);
					context.signal.removeEventListener("abort", abort);
				}
				if (context.signal.aborted) throw (_b = context.signal.reason) !== null && _b !== void 0 ? _b : /* @__PURE__ */ new Error("State restore aborted.");
				const baseImages = canvas.getObjects().filter(isBaseImage);
				if (baseImages.length > 1) throw new Error("Restored Core state contains multiple base images.");
				const baseImage = (_c = baseImages[0]) !== null && _c !== void 0 ? _c : null;
				if (baseImage) {
					baseImage.set({
						selectable: false,
						evented: false
					});
					baseImage.setCoords();
					canvas.sendObjectToBack(baseImage);
				}
				this.access.setBaseImage(baseImage);
				this.access.setImageMimeType(next.imageMimeType);
				this.access.setBaseImageScale(next.baseImageScale);
				this.access.setGeometryRevision(next.geometryRevision);
				disposeReplacedBaseImage(previousBaseImage, baseImage, "state restore");
			} catch (error) {
				if (this.access.getBaseImage() === previousBaseImage) disposeRejectedBaseImages(canvas, previousBaseImage, error);
				throw error;
			}
		}
		validateSnapshot(value) {
			return this.validateState(value, true);
		}
		validateState(value, publicInput) {
			if (!isRecord$1(value)) return {
				valid: false,
				message: "Core state must be an object."
			};
			if (typeof value.initialized !== "boolean") return {
				valid: false,
				message: "initialized must be boolean.",
				path: "$.core.initialized"
			};
			if (!Number.isSafeInteger(value.geometryRevision) || Number(value.geometryRevision) < 0) return {
				valid: false,
				message: "geometryRevision must be a non-negative integer.",
				path: "$.core:geometryRevision"
			};
			if (!value.initialized) return {
				valid: true,
				value: {
					initialized: false,
					canvasWidth: 0,
					canvasHeight: 0,
					canvas: null,
					imageMimeType: null,
					baseImageScale: 1,
					geometryRevision: Number(value.geometryRevision)
				}
			};
			if (!isPositiveSafeInteger(value.canvasWidth) || !isPositiveSafeInteger(value.canvasHeight)) return {
				valid: false,
				message: "Canvas dimensions must be positive safe integers.",
				path: "$.core.canvasWidth"
			};
			if (!isRasterAllocationWithinBudget(value.canvasWidth, value.canvasHeight, {
				maxDimension: this.securityLimits.maxImageDimension,
				maxPixels: this.securityLimits.maxDecodedPixels
			})) return {
				valid: false,
				message: "Canvas dimensions exceed the configured Snapshot budget.",
				path: "$.core.canvasWidth"
			};
			if (!isRecord$1(value.canvas)) return {
				valid: false,
				message: "canvas must be an object.",
				path: "$.core.canvas"
			};
			if (publicInput) {
				const objects = value.canvas.objects;
				if (!Array.isArray(objects)) return {
					valid: false,
					message: "Canvas objects must be an array.",
					path: "$.core.canvas.objects"
				};
				for (let index = 0; index < objects.length; index += 1) {
					const object = objects[index];
					if (!isRecord$1(object)) return {
						valid: false,
						message: "Canvas object must be a record.",
						path: `$.core.canvas.objects.${index}`
					};
					if (object.type !== "Image") return {
						valid: false,
						message: `unknown Fabric class "${String(object.type)}".`,
						path: `$.core.canvas.objects.${index}.type`
					};
					if (object.editorObjectKind !== "baseImage") return {
						valid: false,
						message: "persistent Canvas objects require an installed Object Codec.",
						path: `$.core.canvas.objects.${index}.editorObjectKind`
					};
					if ("filters" in object && (!Array.isArray(object.filters) || object.filters.length > 0)) return {
						valid: false,
						message: "Base Image Fabric filters are not accepted in public Snapshots.",
						path: `$.core.canvas.objects.${index}.filters`
					};
				}
				if (objects.length > 1) return {
					valid: false,
					message: "Public Core Snapshot may contain at most one base image.",
					path: "$.core.canvas.objects"
				};
			}
			if (value.imageMimeType !== null && value.imageMimeType !== void 0 && !isImageMimeType(value.imageMimeType)) return {
				valid: false,
				message: "imageMimeType is unsupported.",
				path: "$.core.imageMimeType"
			};
			if (typeof value.baseImageScale !== "number" || !Number.isFinite(value.baseImageScale) || value.baseImageScale <= 0) return {
				valid: false,
				message: "baseImageScale must be positive and finite.",
				path: "$.core.baseImageScale"
			};
			return {
				valid: true,
				value: {
					initialized: true,
					canvasWidth: value.canvasWidth,
					canvasHeight: value.canvasHeight,
					canvas: value.canvas,
					imageMimeType: isImageMimeType(value.imageMimeType) ? value.imageMimeType : null,
					baseImageScale: value.baseImageScale,
					geometryRevision: Number(value.geometryRevision)
				}
			};
		}
	};

//#endregion
//#region dist/esm/core-runtime/export-contributor-registry.js
	var ExportContributorRegistry = class {
		constructor() {
			Object.defineProperty(this, "contributors", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: /* @__PURE__ */ new Map()
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
			this.assertActive("register an export contributor");
			if (!isRuntimeIdentifier(owner)) throw new CoreRuntimeError("[ImageEditor] Invalid Export contributor owner Runtime ID.");
			if (!isRuntimeIdentifier(contributor.id)) throw new CoreRuntimeError("[ImageEditor] Invalid Export contributor Runtime ID.");
			if (!Number.isFinite(contributor.order)) throw new CoreRuntimeError(`[ImageEditor] Export contributor "${contributor.id}" must use a finite order.`);
			const existing = this.contributors.get(contributor.id);
			if (existing) throw new CoreRuntimeError(`[ImageEditor] Export contributor "${contributor.id}" is already registered by "${existing.owner}".`);
			const record = {
				owner,
				contributor: Object.freeze({ ...contributor }),
				registrationOrder: this.registrationSequence++
			};
			this.contributors.set(contributor.id, record);
			return createDisposable(() => {
				if (this.contributors.get(contributor.id) === record) this.contributors.delete(contributor.id);
			});
		}
		async render(context) {
			this.assertActive("render export contributors");
			const records = [...this.contributors.values()].sort((left, right) => left.contributor.order - right.contributor.order || left.registrationOrder - right.registrationOrder);
			for (const record of records) {
				let enabled;
				try {
					enabled = record.contributor.isEnabled(context.options);
				} catch (error) {
					throw new CoreRuntimeError(`[ImageEditor] Export contributor "${record.contributor.id}" enablement failed.`, {
						code: "EXPORT_CONTRIBUTOR_ERROR",
						cause: error
					});
				}
				if (!enabled) continue;
				try {
					await record.contributor.render(context);
				} catch (error) {
					throw new CoreRuntimeError(`[ImageEditor] Export contributor "${record.contributor.id}" render failed.`, {
						code: "EXPORT_CONTRIBUTOR_ERROR",
						cause: error
					});
				}
			}
		}
		dispose() {
			if (this.disposed) return;
			this.contributors.clear();
			this.disposed = true;
		}
		assertActive(operation) {
			if (this.disposed) throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} after disposal.`);
		}
	};

//#endregion
//#region dist/esm/core-runtime/geometry/affine-matrix.js
	const IDENTITY_AFFINE_MATRIX = Object.freeze([
		1,
		0,
		0,
		1,
		0,
		0
	]);
	const AFFINE_EPSILON = 1e-10;
	function isFiniteAffineMatrix(value) {
		return Array.isArray(value) && value.length === 6 && value.every((entry) => typeof entry === "number" && Number.isFinite(entry));
	}
	function assertAffineMatrix(value, label = "matrix") {
		if (!isFiniteAffineMatrix(value)) throw new GeometryMutationError("affine", `${label} must contain six finite numbers.`);
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
			b1 * e2 + d1 * f2 + f1
		]);
	}
	function invertAffine(matrix, epsilon = AFFINE_EPSILON) {
		const [a, b, c, d, e, f] = matrix;
		const determinant = affineDeterminant(matrix);
		if (!Number.isFinite(determinant) || Math.abs(determinant) <= epsilon) throw new GeometryMutationError("affine", "matrix is singular and cannot be inverted.");
		return Object.freeze([
			d / determinant,
			-b / determinant,
			-c / determinant,
			a / determinant,
			(c * f - d * e) / determinant,
			(b * e - a * f) / determinant
		]);
	}
	function applyAffineToPoint(matrix, point) {
		return Object.freeze({
			x: matrix[0] * point.x + matrix[2] * point.y + matrix[4],
			y: matrix[1] * point.x + matrix[3] * point.y + matrix[5]
		});
	}
	function transformRectBounds(matrix, rect) {
		const points = [
			applyAffineToPoint(matrix, {
				x: rect.left,
				y: rect.top
			}),
			applyAffineToPoint(matrix, {
				x: rect.left + rect.width,
				y: rect.top
			}),
			applyAffineToPoint(matrix, {
				x: rect.left,
				y: rect.top + rect.height
			}),
			applyAffineToPoint(matrix, {
				x: rect.left + rect.width,
				y: rect.top + rect.height
			})
		];
		const xs = points.map((point) => point.x);
		const ys = points.map((point) => point.y);
		const left = Math.min(...xs);
		const top = Math.min(...ys);
		return Object.freeze({
			left,
			top,
			width: Math.max(...xs) - left,
			height: Math.max(...ys) - top
		});
	}
	function approximatelyEqualAffine(left, right, epsilon = AFFINE_EPSILON) {
		return left.every((entry, index) => Math.abs(entry - right[index]) <= epsilon);
	}
	function sanitizeAffineMatrix(matrix, epsilon = AFFINE_EPSILON) {
		return Object.freeze(matrix.map((entry) => Math.abs(entry) <= epsilon ? 0 : entry));
	}
	function computeAffineDelta(before, after) {
		return sanitizeAffineMatrix(multiplyAffine(after, invertAffine(before)));
	}

//#endregion
//#region dist/esm/utils/internal-operation-conflict-domains.js
	const DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS = Object.freeze([
		"document",
		"base-image",
		"geometry",
		"raster",
		"overlay",
		"state"
	]);
	const GEOMETRY_MUTATION_CONFLICT_DOMAINS = Object.freeze([
		"document",
		"base-image",
		"geometry",
		"overlay",
		"state"
	]);
	const PERSISTENT_OVERLAY_MUTATION_CONFLICT_DOMAINS = Object.freeze([
		"document",
		"overlay",
		"selection",
		"state"
	]);
	const OVERLAY_AUTHORING_SESSION_CONFLICT_DOMAINS = Object.freeze([
		"overlay",
		"selection",
		"state"
	]);

//#endregion
//#region dist/esm/core-runtime/state/clone-state-value.js
	function isObject(value) {
		return typeof value === "object" && value !== null;
	}
	function assertSafeStateValue(value, seen = /* @__PURE__ */ new WeakSet(), path = "$") {
		var _a;
		if (!isObject(value) || seen.has(value)) return;
		seen.add(value);
		if (value instanceof Map) {
			for (const [key, entry] of value) {
				assertSafeStateValue(key, seen, `${path}.<map-key>`);
				assertSafeStateValue(entry, seen, `${path}.<map-value>`);
			}
			return;
		}
		if (value instanceof Set) {
			for (const entry of value) assertSafeStateValue(entry, seen, `${path}.<set-value>`);
			return;
		}
		if (value instanceof Date || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return;
		for (const key of Object.getOwnPropertySymbols(value)) if ((_a = Object.getOwnPropertyDescriptor(value, key)) === null || _a === void 0 ? void 0 : _a.enumerable) throw new StateCloneError(`State at ${path} contains an enumerable symbol key.`);
		const descriptors = Object.getOwnPropertyDescriptors(value);
		for (const [key, descriptor] of Object.entries(descriptors)) {
			if (!(descriptor === null || descriptor === void 0 ? void 0 : descriptor.enumerable)) continue;
			if (isDangerousStateKey(key)) throw new StateCloneError(`State contains dangerous key "${key}".`);
			if (!("value" in descriptor)) throw new StateCloneError(`State at ${path}.${key} contains an accessor property.`);
			assertSafeStateValue(descriptor.value, seen, `${path}.${key}`);
		}
	}
	function cloneFallback(value, seen) {
		var _a, _b;
		if (!isObject(value)) {
			if (typeof value === "function" || typeof value === "symbol") throw new StateCloneError(`State contains an unsupported ${typeof value} value.`);
			return value;
		}
		const existing = seen.get(value);
		if (existing !== void 0) return existing;
		if (value instanceof Date) return new Date(value.getTime());
		if (value instanceof ArrayBuffer) return value.slice(0);
		if (ArrayBuffer.isView(value)) {
			const source = value;
			return new Uint8Array(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength));
		}
		if (value instanceof Map) {
			const result = /* @__PURE__ */ new Map();
			seen.set(value, result);
			for (const [key, entry] of value) result.set(cloneFallback(key, seen), cloneFallback(entry, seen));
			return result;
		}
		if (value instanceof Set) {
			const result = /* @__PURE__ */ new Set();
			seen.set(value, result);
			for (const entry of value) result.add(cloneFallback(entry, seen));
			return result;
		}
		if (Array.isArray(value)) {
			const result = [];
			seen.set(value, result);
			for (const entry of value) result.push(cloneFallback(entry, seen));
			return result;
		}
		const prototype = Object.getPrototypeOf(value);
		if (prototype !== Object.prototype && prototype !== null) throw new StateCloneError(`State contains unsupported object type "${(_b = (_a = prototype === null || prototype === void 0 ? void 0 : prototype.constructor) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : "unknown"}".`);
		const result = Object.create(null);
		seen.set(value, result);
		for (const key of Object.keys(value)) {
			if (isDangerousStateKey(key)) throw new StateCloneError(`State contains dangerous key "${key}".`);
			result[key] = cloneFallback(value[key], seen);
		}
		return result;
	}
	function deepFreeze(value, seen = /* @__PURE__ */ new WeakSet()) {
		if (!isObject(value) || seen.has(value)) return value;
		seen.add(value);
		if (value instanceof Map) for (const [key, entry] of value) {
			deepFreeze(key, seen);
			deepFreeze(entry, seen);
		}
		else if (value instanceof Set) for (const entry of value) deepFreeze(entry, seen);
		else for (const key of Object.keys(value)) deepFreeze(value[key], seen);
		try {
			Object.freeze(value);
		} catch {}
		return value;
	}
	function cloneStateValue(value) {
		try {
			assertSafeStateValue(value);
			const structuredCloneFunction = globalThis.structuredClone;
			return deepFreeze(typeof structuredCloneFunction === "function" ? structuredCloneFunction(value) : cloneFallback(value, /* @__PURE__ */ new Map()));
		} catch (error) {
			if (error instanceof StateCloneError) throw error;
			throw new StateCloneError("State could not be cloned safely.", error);
		}
	}
	function assertSafeImmutableReference(value, path = "$", seen = /* @__PURE__ */ new WeakSet()) {
		var _a, _b;
		if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") throw new StateCloneError(`Reference state at ${path} contains an unsupported ${typeof value}.`);
		if (typeof value === "number" && !Number.isFinite(value)) throw new StateCloneError(`Reference state at ${path} contains a non-finite number.`);
		if (!isObject(value)) return;
		if (seen.has(value)) throw new StateCloneError(`Reference state at ${path} contains a cyclic reference.`);
		if (!Object.isFrozen(value)) throw new StateCloneError(`Reference state at ${path} must be frozen.`);
		const prototype = Object.getPrototypeOf(value);
		if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) throw new StateCloneError(`Reference state at ${path} contains unsupported object type "${(_b = (_a = prototype === null || prototype === void 0 ? void 0 : prototype.constructor) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : "unknown"}".`);
		seen.add(value);
		for (const key of Object.keys(value)) {
			if (isDangerousStateKey(key)) throw new StateCloneError(`Reference state at ${path} contains dangerous key "${key}".`);
			assertSafeImmutableReference(value[key], Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`, seen);
		}
		seen.delete(value);
	}

//#endregion
//#region dist/esm/core-runtime/mutation/bounded-replay-id-tracker.js
	const DEFAULT_RECENT_REPLAY_ID_LIMIT = 1e4;
	var BoundedReplayIdTracker = class {
		constructor(recentLimit = DEFAULT_RECENT_REPLAY_ID_LIMIT) {
			Object.defineProperty(this, "recentLimit", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: recentLimit
			});
			Object.defineProperty(this, "activeIds", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: /* @__PURE__ */ new Set()
			});
			Object.defineProperty(this, "recentCompletedIds", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: /* @__PURE__ */ new Set()
			});
			if (!Number.isSafeInteger(recentLimit) || recentLimit <= 0) throw new RangeError("recentLimit must be a positive safe integer.");
		}
		get activeSize() {
			return this.activeIds.size;
		}
		get recentSize() {
			return this.recentCompletedIds.size;
		}
		has(id) {
			return this.activeIds.has(id) || this.recentCompletedIds.has(id);
		}
		start(id) {
			if (this.has(id)) return false;
			this.activeIds.add(id);
			return true;
		}
		complete(id) {
			if (!this.activeIds.delete(id)) return;
			this.recentCompletedIds.add(id);
			while (this.recentCompletedIds.size > this.recentLimit) {
				const oldest = this.recentCompletedIds.values().next().value;
				if (oldest === void 0) break;
				this.recentCompletedIds.delete(oldest);
			}
		}
		clear() {
			this.activeIds.clear();
			this.recentCompletedIds.clear();
		}
	};

//#endregion
//#region dist/esm/core-runtime/geometry/geometry-mutation-coordinator.js
	function assertIdentifier$2(value, label) {
		if (value.trim().length === 0 || value.trim() !== value) throw new GeometryMutationError(value || "unknown", `${label} must be non-empty and trimmed.`);
	}
	function freezeGeometry(snapshot) {
		if (!isFiniteAffineMatrix(snapshot.matrix) || !Number.isFinite(snapshot.canvasWidth) || !Number.isFinite(snapshot.canvasHeight) || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0) throw new GeometryMutationError("geometry", "captured geometry is malformed.");
		return Object.freeze({
			...snapshot,
			matrix: Object.freeze([...snapshot.matrix]),
			boundingBox: Object.freeze({ ...snapshot.boundingBox })
		});
	}
	function createDescriptor(request, before, after, metadata, provisional) {
		const affineDelta = provisional ? IDENTITY_AFFINE_MATRIX : request.kind === "raster-replace" ? null : computeAffineDelta(before.matrix, after.matrix);
		return Object.freeze({
			id: request.id,
			kind: request.kind,
			operationId: request.operationId,
			before,
			after,
			affineDelta,
			hasReflection: affineDelta ? hasAffineReflection(affineDelta) : false,
			...request.sourceRect ? { sourceRect: Object.freeze({ ...request.sourceRect }) } : {},
			...request.targetSize ? { targetSize: Object.freeze({ ...request.targetSize }) } : {},
			metadata
		});
	}
	var GeometryMutationCoordinator = class {
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
				value: /* @__PURE__ */ new Map()
			});
			Object.defineProperty(this, "usedMutationIds", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: new BoundedReplayIdTracker()
			});
			Object.defineProperty(this, "activeControllers", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: /* @__PURE__ */ new Set()
			});
			Object.defineProperty(this, "activePromises", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: /* @__PURE__ */ new Set()
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
			this.assertActive("register a participant");
			assertIdentifier$2(participant.id, "Participant id");
			if (!Number.isFinite(participant.order)) throw new GeometryRegistrationError(`Geometry participant "${participant.id}" must use a finite order.`, participant.id);
			if (this.participants.has(participant.id)) throw new GeometryRegistrationError(`Geometry participant "${participant.id}" is already registered.`, participant.id);
			const record = {
				participant: Object.freeze({ ...participant }),
				registrationOrder: this.registrationCounter++
			};
			this.participants.set(participant.id, record);
			return createDisposable(() => {
				if (this.participants.get(participant.id) === record) this.participants.delete(participant.id);
			});
		}
		run(request) {
			this.assertActive("run a geometry mutation");
			let metadata;
			try {
				metadata = this.validateRequest(request);
			} catch (error) {
				return Promise.reject(error);
			}
			if (!this.usedMutationIds.start(request.id)) return Promise.reject(new GeometryMutationError(request.id, "mutation id has already been used."));
			const controller = new AbortController();
			this.activeControllers.add(controller);
			const operation = this.performRun(request, metadata, controller.signal);
			this.activePromises.add(operation);
			return operation.finally(() => {
				this.activePromises.delete(operation);
				this.activeControllers.delete(controller);
				this.usedMutationIds.complete(request.id);
			});
		}
		async dispose() {
			if (this.disposed) return;
			this.disposed = true;
			for (const controller of this.activeControllers) controller.abort(new DOMException("Geometry coordinator was disposed.", "AbortError"));
			await Promise.allSettled([...this.activePromises]);
			this.participants.clear();
			this.usedMutationIds.clear();
		}
		async abortActive(reason) {
			this.assertActive("abort geometry mutations");
			for (const controller of this.activeControllers) controller.abort(reason);
			await Promise.allSettled([...this.activePromises]);
		}
		reset() {
			this.assertActive("reset geometry mutations");
			if (this.activePromises.size > 0) throw new GeometryRegistrationError("Cannot reset while a geometry mutation is active.");
			this.participants.clear();
			this.usedMutationIds.clear();
			this.registrationCounter = 0;
		}
		disposeSync() {
			if (this.disposed) return;
			if (this.activePromises.size > 0) throw new GeometryRegistrationError("Cannot synchronously dispose an active geometry mutation.");
			this.disposed = true;
			this.participants.clear();
			this.usedMutationIds.clear();
		}
		async performRun(request, metadata, signal) {
			var _a, _b;
			let before = null;
			let provisional = null;
			const participantSnapshot = Object.freeze([...this.participants.values()].sort((left, right) => left.participant.order - right.participant.order || left.registrationOrder - right.registrationOrder));
			const geometryParticipant = Object.freeze({
				id: "core:geometry-participants",
				order: 0,
				prepare: async (context) => {
					const capturedBefore = freezeGeometry(this.options.state.captureGeometry());
					const provisionalDescriptor = createDescriptor(request, capturedBefore, capturedBefore, metadata, true);
					before = capturedBefore;
					provisional = provisionalDescriptor;
					const participantContext = this.createParticipantContext(request.id, context.signal);
					const entries = [];
					for (const record of participantSnapshot) {
						if (!record.participant.supports(provisionalDescriptor)) continue;
						const prepared = record.participant.prepare ? await record.participant.prepare(provisionalDescriptor, participantContext) : void 0;
						entries.push({
							record,
							prepared
						});
					}
					return Object.freeze({
						entries: Object.freeze(entries),
						context: participantContext
					});
				},
				apply: async (descriptor, prepared) => {
					for (const entry of prepared.entries) try {
						await entry.record.participant.apply(descriptor, entry.prepared, prepared.context);
					} catch (error) {
						if (error instanceof GeometryRecoverableObjectError) {
							this.warnRecoverable(request.id, entry.record.participant.id, error);
							continue;
						}
						throw error;
					}
				},
				synchronize: async (descriptor, prepared) => {
					var _a, _b;
					for (const entry of prepared.entries) try {
						await ((_b = (_a = entry.record.participant).synchronize) === null || _b === void 0 ? void 0 : _b.call(_a, descriptor, prepared.context));
					} catch (error) {
						if (error instanceof GeometryRecoverableObjectError) {
							this.warn({
								code: "GEOMETRY_SYNCHRONIZE_WARNING",
								message: error.message,
								mutationId: request.id,
								participantId: entry.record.participant.id,
								...error.objectIdentity === void 0 ? {} : { objectIdentity: error.objectIdentity },
								...error.objectKind === void 0 ? {} : { objectKind: error.objectKind },
								cause: error.cause
							});
							continue;
						}
						throw error;
					}
				},
				...participantSnapshot.some(({ participant }) => participant.rollback) ? { rollback: async (prepared, rollbackContext) => {
					var _a, _b, _c;
					const descriptor = (_a = rollbackContext.result) !== null && _a !== void 0 ? _a : provisional;
					if (!descriptor) return;
					for (let index = prepared.entries.length - 1; index >= 0; index -= 1) {
						const entry = prepared.entries[index];
						if (!entry) continue;
						await ((_c = (_b = entry.record.participant).rollback) === null || _c === void 0 ? void 0 : _c.call(_b, descriptor, entry.prepared, prepared.context));
					}
				} } : {}
			});
			try {
				return await this.options.mutations.run({
					id: request.id,
					kind: "geometry",
					operationId: request.operationId,
					conflictDomains: GEOMETRY_MUTATION_CONFLICT_DOMAINS,
					signal,
					...request.parent ? { parent: request.parent } : {},
					metadata,
					participants: [geometryParticipant],
					mutate: async (context) => {
						const capturedBefore = before;
						if (!capturedBefore) throw new GeometryMutationError(request.id, "geometry preparation did not capture the before state.");
						await request.mutateBase(Object.freeze({
							signal: context.signal,
							transaction: context
						}));
						await this.options.state.finalizeGeometry();
						const after = freezeGeometry(this.options.state.captureGeometry());
						if (after.revision <= capturedBefore.revision) throw new GeometryMutationError(request.id, `geometry revision must increase (${capturedBefore.revision} -> ${after.revision}).`);
						return createDescriptor(request, capturedBefore, after, metadata, false);
					},
					...request.rollbackBase ? { rollback: async (context) => {
						var _a, _b, _c;
						await ((_a = request.rollbackBase) === null || _a === void 0 ? void 0 : _a.call(request, Object.freeze({
							signal: context.signal,
							cause: context.cause
						})));
						if (before) await ((_c = (_b = this.options.state).restoreGeometry) === null || _c === void 0 ? void 0 : _c.call(_b, before));
					} } : {}
				});
			} catch (error) {
				const failure = this.toGeometryFailure(request.id, error);
				(_b = (_a = this.options).errorSink) === null || _b === void 0 || _b.call(_a, failure);
				throw failure;
			}
		}
		createParticipantContext(mutationId, signal) {
			return Object.freeze({
				signal,
				warnRecoverable: (error, objectIdentity, objectKind) => {
					this.warn({
						code: "GEOMETRY_OBJECT_SKIPPED",
						message: "An overlay transform skipped a malformed or unsupported object.",
						mutationId,
						...objectIdentity === void 0 ? {} : { objectIdentity },
						...objectKind === void 0 ? {} : { objectKind },
						cause: error
					});
				}
			});
		}
		warnRecoverable(mutationId, participantId, error) {
			this.warn({
				code: "GEOMETRY_OBJECT_SKIPPED",
				message: error.message,
				mutationId,
				participantId,
				...error.objectIdentity === void 0 ? {} : { objectIdentity: error.objectIdentity },
				...error.objectKind === void 0 ? {} : { objectKind: error.objectKind },
				cause: error.cause
			});
		}
		toGeometryFailure(mutationId, error) {
			if (error instanceof DocumentMutationUnrecoverableError) return new GeometryUnrecoverableError(mutationId, error.cause, error.rollbackErrors);
			if (error instanceof DocumentMutationError) return new GeometryMutationError(mutationId, error.cause instanceof Error ? error.cause.message : error.message, error.cause, error.rollbackErrors);
			if (error instanceof GeometryMutationError) return error;
			return new GeometryMutationError(mutationId, error instanceof Error ? error.message : "unknown failure.", error);
		}
		validateRequest(request) {
			var _a, _b;
			assertIdentifier$2(request.id, "Mutation id");
			assertIdentifier$2(request.kind, "Mutation kind");
			assertIdentifier$2(request.operationId, "Operation id");
			if (this.usedMutationIds.has(request.id)) throw new GeometryMutationError(request.id, "mutation id has already been used.");
			if (typeof request.mutateBase !== "function") throw new GeometryMutationError(request.id, "mutateBase must be a function.");
			let clonedMetadata;
			let serializedMetadata;
			try {
				clonedMetadata = cloneStateValue((_a = request.metadata) !== null && _a !== void 0 ? _a : {});
				serializedMetadata = JSON.stringify(clonedMetadata);
			} catch (error) {
				throw new GeometryMutationError(request.id, "metadata must be safely JSON-serializable.", error);
			}
			const maxMetadataBytes = (_b = this.options.maxMetadataBytes) !== null && _b !== void 0 ? _b : 65536;
			if (new TextEncoder().encode(serializedMetadata).byteLength > maxMetadataBytes) throw new GeometryMutationError(request.id, `metadata exceeds ${maxMetadataBytes} bytes.`);
			return clonedMetadata;
		}
		warn(warning) {
			var _a, _b, _c, _d;
			try {
				(_b = (_a = this.options).warningSink) === null || _b === void 0 || _b.call(_a, Object.freeze(warning));
			} catch (error) {
				(_d = (_c = this.options).errorSink) === null || _d === void 0 || _d.call(_c, error);
			}
		}
		assertActive(operation) {
			if (this.disposed) throw new GeometryRegistrationError(`Cannot ${operation} after coordinator disposal.`);
		}
	};

//#endregion
//#region dist/esm/core-runtime/history-commit-router.js
	const unavailableHistory = Object.freeze({
		isAvailable: () => false,
		commit: () => void 0
	});
	var HistoryCommitRouter = class {
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
			if (!isRuntimeIdentifier(owner)) throw new CoreRuntimeError("[ImageEditor] Invalid History provider owner Runtime ID.");
			if (this.owner) throw new CoreRuntimeError(`[ImageEditor] History commit provider is already registered by "${this.owner}".`);
			this.owner = owner;
			this.provider = provider;
			return createDisposable(() => {
				if (this.owner !== owner || this.provider !== provider) return;
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
				detail: record.detail
			});
			return this.provider.commit(coreRecord);
		}
	};

//#endregion
//#region dist/esm/sdk/core-capabilities.js
	const CORE_STATUS_CAPABILITY = createCapabilityToken("core:status", "1.0.0");
	const CORE_DIAGNOSTICS_CAPABILITY = createCapabilityToken("core:diagnostics", "1.0.0");
	const CORE_PRESENTATION_CAPABILITY = createCapabilityToken("core:presentation", "1.0.0");
	const FABRIC_RUNTIME_CAPABILITY = createCapabilityToken("fabric:runtime", "1.0.0");
	const CANVAS_READ_CAPABILITY = createCapabilityToken("core:canvas-read", "1.0.0");
	const BASE_IMAGE_READ_CAPABILITY = createCapabilityToken("core:base-image-read", "1.0.0");
	const BASE_IMAGE_INFO_CAPABILITY = createCapabilityToken("core:base-image-info", "1.0.0");
	const IMAGE_RESOURCE_POLICY_CAPABILITY = createCapabilityToken("core:image-resource-policy", "1.0.0");
	const RENDER_REQUEST_CAPABILITY = createCapabilityToken("core:render-request", "1.0.0");
	const CANVAS_RESIZE_CAPABILITY = createCapabilityToken("core:canvas-resize", "1.0.0");
	const RASTER_MUTATION_CAPABILITY = createCapabilityToken("core:raster-mutation", "1.0.0");
	const SNAPSHOT_REGISTRATION_CAPABILITY = createCapabilityToken("core:snapshot-registration", "1.0.0");
	const MEMENTO_HISTORY_CAPABILITY = createCapabilityToken("core:memento-history", "1.0.0");
	const GEOMETRY_MUTATION_CAPABILITY = createCapabilityToken("core:geometry", "1.0.0");
	const DOCUMENT_MUTATION_CAPABILITY = createCapabilityToken("core:document-mutation", "1.0.0");
	const EXPORT_CONTRIBUTION_CAPABILITY = createCapabilityToken("core:export", "1.0.0");

//#endregion
//#region dist/esm/core-runtime/internal-capabilities.js
	const CORE_ENVIRONMENT_CAPABILITY = createCapabilityToken("core:environment", "1.0.0");

//#endregion
//#region dist/esm/core-runtime/lifecycle.js
	const ALLOWED_TRANSITIONS = {
		configured: ["initializing", "disposing"],
		initializing: [
			"configured",
			"initialized",
			"faulted"
		],
		initialized: ["disposing", "faulted"],
		disposing: ["disposed"],
		disposed: [],
		faulted: ["configured", "disposing"]
	};
	var EditorLifecycleController = class {
		constructor() {
			Object.defineProperty(this, "state", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: "configured"
			});
		}
		get current() {
			return this.state;
		}
		beginInitialization() {
			switch (this.state) {
				case "configured":
					this.transition("initializing");
					return;
				case "initializing": throw new EditorInitializationInProgressError();
				case "initialized": throw new EditorAlreadyInitializedError();
				case "disposing": throw new EditorDisposingError("initialize");
				case "disposed": throw new EditorDisposedError("initialize");
				case "faulted": throw new EditorFaultedError("initialize");
			}
		}
		completeInitialization() {
			this.transition("initialized");
		}
		recoverInitialization() {
			this.transition("configured");
		}
		failInitialization() {
			this.transition("faulted");
		}
		failRuntime() {
			if (this.state === "faulted") return;
			if (this.state !== "initialized") throw new CoreRuntimeError(`[ImageEditor] Cannot enter faulted from "${this.state}" during runtime.`, {
				code: "INVALID_LIFECYCLE_TRANSITION",
				behavior: "lifecycle"
			});
			this.transition("faulted");
		}
		recoverFault() {
			if (this.state !== "faulted") throw new CoreRuntimeError(`[ImageEditor] Cannot complete emergency reset from "${this.state}".`, {
				code: "INVALID_LIFECYCLE_TRANSITION",
				behavior: "lifecycle"
			});
			this.transition("configured");
		}
		beginDisposal() {
			if (this.state === "disposing" || this.state === "disposed") return false;
			if (this.state === "initializing") throw new EditorInitializationInProgressError("dispose");
			this.transition("disposing");
			return true;
		}
		completeDisposal() {
			this.transition("disposed");
		}
		assertOperational(operation) {
			switch (this.state) {
				case "initialized": return;
				case "configured": throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} before initialization.`, { code: "EDITOR_NOT_INITIALIZED" });
				case "initializing": throw new EditorInitializationInProgressError(operation);
				case "disposing": throw new EditorDisposingError(operation);
				case "disposed": throw new EditorDisposedError(operation);
				case "faulted": throw new EditorFaultedError(operation);
			}
		}
		assertAvailable(operation) {
			switch (this.state) {
				case "disposing": throw new EditorDisposingError(operation);
				case "disposed": throw new EditorDisposedError(operation);
				case "faulted": throw new EditorFaultedError(operation);
				default: return;
			}
		}
		transition(next) {
			if (!ALLOWED_TRANSITIONS[this.state].includes(next)) throw new CoreRuntimeError(`[ImageEditor] Invalid lifecycle transition from "${this.state}" to "${next}".`, { code: "INVALID_LIFECYCLE_TRANSITION" });
			this.state = next;
		}
	};

//#endregion
//#region dist/esm/core-runtime/plugin-api-handle.js
	function isProxyablePluginApi(value) {
		return typeof value === "object" && value !== null || typeof value === "function";
	}
	var StablePluginApiHandle = class {
		constructor(pluginId, initialTarget, assertAvailable) {
			Object.defineProperty(this, "pluginId", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: pluginId
			});
			Object.defineProperty(this, "assertAvailable", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: assertAvailable
			});
			Object.defineProperty(this, "target", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "methodWrappers", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: /* @__PURE__ */ new Map()
			});
			Object.defineProperty(this, "api", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			this.target = initialTarget;
			const shadowTarget = typeof initialTarget === "function" ? function stablePluginApi() {} : Object.create(null);
			this.api = new Proxy(shadowTarget, {
				apply: (shadow, thisArgument, argumentsList) => {
					const target = this.requireTarget();
					if (typeof target !== "function") throw this.incompatibleReplayError("is no longer callable");
					return Reflect.apply(target, thisArgument, argumentsList);
				},
				construct: (shadow, argumentsList, newTarget) => {
					const target = this.requireTarget();
					if (typeof target !== "function") throw this.incompatibleReplayError("is no longer constructable");
					const instance = Reflect.construct(target, argumentsList, newTarget);
					if (!isProxyablePluginApi(instance)) throw this.incompatibleReplayError("returned a non-object from its constructor");
					return instance;
				},
				deleteProperty: (shadow, property) => {
					return Reflect.deleteProperty(this.requireTarget(), property);
				},
				get: (shadow, property) => {
					if (property === "then" && (!this.target || !Reflect.has(this.target, property))) return;
					const target = this.requireTarget();
					const value = Reflect.get(target, property, target);
					if (typeof value !== "function") return value;
					return this.getMethodWrapper(property);
				},
				has: (shadow, property) => {
					return Reflect.has(this.requireTarget(), property);
				},
				set: (shadow, property, value) => {
					const target = this.requireTarget();
					return Reflect.set(target, property, value, target);
				}
			});
		}
		assertCompatible(nextTarget) {
			if (typeof nextTarget !== typeof this.api) throw this.incompatibleReplayError("changed between callable and object forms");
		}
		update(nextTarget) {
			this.assertCompatible(nextTarget);
			this.target = nextTarget;
		}
		clear() {
			this.target = null;
		}
		getMethodWrapper(property) {
			const existing = this.methodWrappers.get(property);
			if (existing) return existing;
			const wrapper = (...args) => {
				const target = this.requireTarget();
				const method = Reflect.get(target, property, target);
				if (typeof method !== "function") throw this.incompatibleReplayError(`no longer exposes method "${String(property)}"`);
				return Reflect.apply(method, target, args);
			};
			this.methodWrappers.set(property, wrapper);
			return wrapper;
		}
		requireTarget() {
			this.assertAvailable(`use Plugin API "${this.pluginId}"`);
			if (!this.target) throw new CoreRuntimeError(`[ImageEditor] Plugin API "${this.pluginId}" is no longer available.`, {
				code: "PLUGIN_API_UNAVAILABLE",
				behavior: "lifecycle"
			});
			return this.target;
		}
		incompatibleReplayError(reason) {
			return new CoreRuntimeError(`[ImageEditor] Plugin API "${this.pluginId}" ${reason} during runtime replay.`, {
				code: "PLUGIN_API_REPLAY_INCOMPATIBLE",
				behavior: "lifecycle"
			});
		}
	};

//#endregion
//#region dist/esm/core-runtime/mutation/document-mutation-coordinator.js
	const DEFAULT_ROLLBACK_TIMEOUT_MS$1 = 3e4;
	const INTERACTIVE_MUTATION_BOUNDARY = Symbol.for("@bensitu/image-editor/internal-interactive-mutation-boundary/v1");
	function getInteractiveMutationBoundary(request) {
		var _a;
		return (_a = Reflect.get(request, INTERACTIVE_MUTATION_BOUNDARY)) !== null && _a !== void 0 ? _a : null;
	}
	function requireSealedInteractiveBoundary(transactionId, after) {
		if (!after) throw new DocumentMutationInvariantError(transactionId, /* @__PURE__ */ new Error("Interactive mutation was not sealed before commit."));
		return after;
	}
	function isCancellation(error) {
		return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
	}
	function assertIdentifier$1(value, label) {
		if (value.trim().length === 0 || value.trim() !== value) throw new DocumentMutationRegistrationError(`${label} must be non-empty and trimmed.`);
	}
	function immutableMetadata(value) {
		const cloned = cloneStateValue(value !== null && value !== void 0 ? value : {});
		if (typeof cloned !== "object" || cloned === null || Array.isArray(cloned)) throw new DocumentMutationRegistrationError("Mutation metadata must be an object.");
		return Object.freeze(cloned);
	}
	var DocumentMutationCoordinator = class {
		constructor(options) {
			var _a;
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
				value: new BoundedReplayIdTracker()
			});
			Object.defineProperty(this, "contextRecords", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: /* @__PURE__ */ new WeakMap()
			});
			Object.defineProperty(this, "activeControllers", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: /* @__PURE__ */ new Set()
			});
			Object.defineProperty(this, "activePromises", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: /* @__PURE__ */ new Set()
			});
			Object.defineProperty(this, "disposed", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: false
			});
			const rollbackTimeoutMs = (_a = options.rollbackTimeoutMs) !== null && _a !== void 0 ? _a : DEFAULT_ROLLBACK_TIMEOUT_MS$1;
			if (!Number.isSafeInteger(rollbackTimeoutMs) || rollbackTimeoutMs <= 0) throw new DocumentMutationRegistrationError("rollbackTimeoutMs must be a positive safe integer.");
		}
		get isRunning() {
			return this.activePromises.size > 0;
		}
		assertContextActive(context) {
			const record = this.contextRecords.get(context);
			if (!record || record.session.closed || context.signal.aborted) throw new DocumentMutationInvariantError(context.transactionId, /* @__PURE__ */ new Error("The document mutation context is not active."));
		}
		run(request) {
			var _a, _b, _c, _d, _e;
			let normalized;
			let parentRecord;
			try {
				this.assertActive("run a document mutation");
				(_b = (_a = this.options.state).assertOperational) === null || _b === void 0 || _b.call(_a, "run a document mutation");
				normalized = this.normalizeRequest(request);
				parentRecord = normalized.parent ? this.requireParent(normalized.parent) : null;
			} catch (error) {
				return Promise.reject(error);
			}
			if (!this.usedTransactionIds.start(normalized.id)) return Promise.reject(new DocumentMutationRegistrationError(`Transaction id "${normalized.id}" has already been used.`, normalized.id));
			const controller = new AbortController();
			const abort = () => {
				var _a;
				return controller.abort((_a = normalized.signal) === null || _a === void 0 ? void 0 : _a.reason);
			};
			let operation;
			try {
				if ((_c = normalized.signal) === null || _c === void 0 ? void 0 : _c.aborted) abort();
				else (_d = normalized.signal) === null || _d === void 0 || _d.addEventListener("abort", abort, { once: true });
				this.activeControllers.add(controller);
				operation = this.options.operations.run(normalized.operationId, (operationContext) => parentRecord ? this.performNested(normalized, operationContext.token, parentRecord) : this.performTopLevel(normalized, operationContext.token), {
					signal: controller.signal,
					...parentRecord ? { parent: parentRecord.operationToken } : {}
				});
			} catch (error) {
				(_e = normalized.signal) === null || _e === void 0 || _e.removeEventListener("abort", abort);
				this.activeControllers.delete(controller);
				this.usedTransactionIds.complete(normalized.id);
				return Promise.reject(error);
			}
			this.activePromises.add(operation);
			return operation.finally(() => {
				var _a;
				(_a = normalized.signal) === null || _a === void 0 || _a.removeEventListener("abort", abort);
				this.activeControllers.delete(controller);
				this.activePromises.delete(operation);
				this.usedTransactionIds.complete(normalized.id);
			});
		}
		async dispose() {
			if (this.disposed) return;
			this.disposed = true;
			const reason = new DOMException("Document Mutation Coordinator was disposed.", "AbortError");
			for (const controller of this.activeControllers) controller.abort(reason);
			await Promise.allSettled([...this.activePromises]);
			this.activeControllers.clear();
			this.usedTransactionIds.clear();
		}
		async abortActive(reason) {
			this.assertActive("abort document mutations");
			for (const controller of this.activeControllers) controller.abort(reason);
			await Promise.allSettled([...this.activePromises]);
		}
		reset() {
			this.assertActive("reset document mutations");
			if (this.activePromises.size > 0) throw new DocumentMutationRegistrationError("Cannot reset while a document mutation is active.");
			this.usedTransactionIds.clear();
		}
		disposeSync() {
			if (this.disposed) return;
			if (this.activePromises.size > 0) throw new DocumentMutationRegistrationError("Cannot synchronously dispose an active document mutation.");
			this.disposed = true;
			this.usedTransactionIds.clear();
		}
		async performTopLevel(request, operationToken) {
			var _a;
			const interactiveBoundary = getInteractiveMutationBoundary(request);
			const before = (_a = interactiveBoundary === null || interactiveBoundary === void 0 ? void 0 : interactiveBoundary.before) !== null && _a !== void 0 ? _a : this.options.mementos.capture();
			const session = {
				before,
				rollbackEntries: [],
				validators: [],
				diagnostics: [],
				failure: null,
				closed: false
			};
			const context = this.createContext(request, operationToken, session, null);
			let result;
			let committedResult;
			try {
				result = await this.executeRequest(request, context, session);
				if (session.failure) throw session.failure;
				this.throwIfUnavailable(context.signal, request.id);
				this.options.state.requestRender();
				for (const validate of session.validators) {
					this.throwIfUnavailable(context.signal, request.id);
					try {
						await validate();
					} catch (error) {
						throw new DocumentMutationInvariantError(request.id, error);
					}
				}
				this.throwIfUnavailable(context.signal, request.id);
				committedResult = request.describeCommit ? await request.describeCommit(result, context) : result;
				this.throwIfUnavailable(context.signal, request.id);
			} catch (error) {
				session.closed = true;
				throw await this.restoreAfterFailure(request.id, session, error);
			}
			let descriptor;
			try {
				const after = interactiveBoundary ? requireSealedInteractiveBoundary(request.id, interactiveBoundary.after) : this.options.mementos.capture();
				descriptor = Object.freeze({
					transactionId: request.id,
					parentTransactionId: null,
					kind: request.kind,
					operationId: request.operationId,
					conflictDomains: request.conflictDomains,
					metadata: request.metadata,
					diagnostics: Object.freeze([...session.diagnostics]),
					result: committedResult,
					committedAt: Date.now()
				});
				if (this.options.history.isAvailable()) await this.options.history.commit(Object.freeze({
					operationId: request.operationId,
					before,
					after,
					timestamp: descriptor.committedAt,
					detail: descriptor
				}));
			} catch (error) {
				session.closed = true;
				throw await this.restoreAfterFailure(request.id, session, error);
			}
			session.closed = true;
			try {
				await this.options.events.emitCommitted(descriptor);
			} catch (error) {
				this.warn({
					code: "DOCUMENT_COMMITTED_OBSERVER_FAILED",
					message: "A committed document observer failed after the transaction committed.",
					transactionId: request.id,
					cause: error
				});
			}
			return result;
		}
		async performNested(request, operationToken, parentRecord) {
			var _a;
			var _b;
			const parent = request.parent;
			if (!parent) throw new DocumentMutationRegistrationError("Nested mutation requires a parent.");
			const context = this.createContext(request, operationToken, parentRecord.session, parent);
			try {
				return await this.executeRequest(request, context, parentRecord.session);
			} catch (error) {
				(_a = (_b = parentRecord.session).failure) !== null && _a !== void 0 || (_b.failure = normalizeThrownError(error, `[ImageEditor] Nested document mutation "${request.id}" failed with a non-Error value.`));
				throw error;
			}
		}
		async executeRequest(request, context, session) {
			var _a, _b, _c, _d, _e;
			const outcome = { result: void 0 };
			const requestRollback = request.rollback ? {
				enabled: false,
				run: async (cause, signal) => {
					var _a;
					const rollbackContext = this.createRollbackContext(context, cause, outcome.result, signal);
					await ((_a = request.rollback) === null || _a === void 0 ? void 0 : _a.call(request, rollbackContext));
				}
			} : null;
			if (requestRollback) session.rollbackEntries.push(requestRollback);
			const prepared = [];
			for (const participant of request.participants) {
				this.throwIfUnavailable(context.signal, request.id);
				const preparedValue = participant.prepare ? await participant.prepare(context) : void 0;
				prepared.push({
					participant,
					value: preparedValue
				});
				if (participant.rollback) session.rollbackEntries.push({
					enabled: true,
					run: async (cause, signal) => {
						var _a;
						const rollbackContext = this.createRollbackContext(context, cause, outcome.result, signal);
						await ((_a = participant.rollback) === null || _a === void 0 ? void 0 : _a.call(participant, preparedValue, rollbackContext));
					}
				});
			}
			this.throwIfUnavailable(context.signal, request.id);
			if (requestRollback) requestRollback.enabled = true;
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
			if (request.validate) session.validators.push(async () => {
				var _a;
				return (_a = request.validate) === null || _a === void 0 ? void 0 : _a.call(request, result, context);
			});
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
				historyOwner: parent ? "parent" : "self",
				eventOwner: parent ? "parent" : "self",
				signal: operationToken.signal,
				participantIds,
				metadata: request.metadata
			});
			this.contextRecords.set(context, {
				session,
				operationToken
			});
			session.diagnostics.push(Object.freeze({
				transactionId: request.id,
				parentTransactionId: (_b = parent === null || parent === void 0 ? void 0 : parent.transactionId) !== null && _b !== void 0 ? _b : null,
				participantIds,
				metadata: request.metadata
			}));
			return context;
		}
		createRollbackContext(context, cause, result, signal) {
			return Object.freeze({
				...context,
				signal,
				cause,
				result
			});
		}
		async restoreAfterFailure(transactionId, session, cause) {
			var _a, _b, _c, _d, _e, _f, _g;
			const rollbackErrors = [];
			const rollbackTimeoutMs = (_a = this.options.rollbackTimeoutMs) !== null && _a !== void 0 ? _a : DEFAULT_ROLLBACK_TIMEOUT_MS$1;
			const rollbackController = new AbortController();
			const timeoutError = /* @__PURE__ */ new Error(`Document mutation rollback timed out after ${rollbackTimeoutMs}ms.`);
			timeoutError.name = "TimeoutError";
			const timeout = setTimeout(() => rollbackController.abort(timeoutError), rollbackTimeoutMs);
			const runRollbackTask = async (task) => {
				var _a;
				if (rollbackController.signal.aborted) throw (_a = rollbackController.signal.reason) !== null && _a !== void 0 ? _a : timeoutError;
				let removeAbortListener = () => void 0;
				const aborted = new Promise((resolve, reject) => {
					const abort = () => {
						var _a;
						return reject((_a = rollbackController.signal.reason) !== null && _a !== void 0 ? _a : timeoutError);
					};
					removeAbortListener = () => rollbackController.signal.removeEventListener("abort", abort);
					rollbackController.signal.addEventListener("abort", abort, { once: true });
				});
				try {
					await Promise.race([task(), aborted]);
				} finally {
					removeAbortListener();
				}
			};
			try {
				for (let index = session.rollbackEntries.length - 1; index >= 0; index -= 1) {
					const entry = session.rollbackEntries[index];
					if (!(entry === null || entry === void 0 ? void 0 : entry.enabled)) continue;
					try {
						await runRollbackTask(() => entry.run(cause, rollbackController.signal));
					} catch (error) {
						rollbackErrors.push(error);
					}
				}
				let targetedStateMatches = false;
				if (session.rollbackEntries.some((entry) => entry.enabled) && rollbackErrors.length === 0 && this.options.mementos.matches) try {
					targetedStateMatches = await this.options.mementos.matches(session.before);
				} catch (error) {
					rollbackErrors.push(error);
				}
				if (!targetedStateMatches) try {
					await runRollbackTask(() => this.options.mementos.restore(session.before, {
						rollbackOnFailure: false,
						signal: rollbackController.signal
					}));
				} catch (restoreError) {
					rollbackErrors.push(restoreError);
					const failure = new DocumentMutationUnrecoverableError(transactionId, cause, Object.freeze(rollbackErrors));
					(_c = (_b = this.options).faultSink) === null || _c === void 0 || _c.call(_b, failure);
					(_e = (_d = this.options).errorSink) === null || _e === void 0 || _e.call(_d, failure);
					return failure;
				}
				if (!this.options.state.isDisposed()) try {
					this.options.state.requestRender();
				} catch (error) {
					rollbackErrors.push(error);
				}
			} finally {
				clearTimeout(timeout);
			}
			if (isCancellation(cause)) return cause;
			const failure = cause instanceof DocumentMutationError ? cause : new DocumentMutationError(transactionId, cause instanceof Error ? cause.message : "unknown failure.", cause, Object.freeze(rollbackErrors));
			(_g = (_f = this.options).errorSink) === null || _g === void 0 || _g.call(_f, failure);
			return failure;
		}
		normalizeRequest(request) {
			var _a, _b;
			assertIdentifier$1(request.id, "Transaction id");
			assertIdentifier$1(request.kind, "Mutation kind");
			assertIdentifier$1(request.operationId, "Operation id");
			if (this.usedTransactionIds.has(request.id)) throw new DocumentMutationRegistrationError(`Transaction id "${request.id}" has already been used.`, request.id);
			if (!this.options.operations.has(request.operationId)) throw new DocumentMutationRegistrationError(`Operation "${request.operationId}" is not registered.`, request.id);
			const operation = this.options.operations.get(request.operationId);
			if (!operation) throw new DocumentMutationRegistrationError(`Operation "${request.operationId}" is unavailable.`, request.id);
			if (!Array.isArray(request.conflictDomains) || request.conflictDomains.length === 0 || request.conflictDomains.some((domain) => !operation.conflictDomains.includes(domain))) throw new DocumentMutationRegistrationError("Mutation conflict domains must be covered by its registered operation.", request.id);
			if (typeof request.mutate !== "function") throw new DocumentMutationRegistrationError("Mutation request must define mutate().", request.id);
			const participants = [...(_a = request.participants) !== null && _a !== void 0 ? _a : []];
			const participantIds = /* @__PURE__ */ new Set();
			for (const participant of participants) {
				assertIdentifier$1(participant.id, "Participant id");
				if (!Number.isFinite(participant.order)) throw new DocumentMutationRegistrationError(`Participant "${participant.id}" must use a finite order.`, request.id);
				if (participantIds.has(participant.id)) throw new DocumentMutationRegistrationError(`Participant "${participant.id}" is duplicated.`, request.id);
				participantIds.add(participant.id);
			}
			participants.sort((left, right) => left.order - right.order);
			let metadata;
			let serializedMetadata;
			try {
				metadata = immutableMetadata(request.metadata);
				serializedMetadata = JSON.stringify(metadata);
			} catch (error) {
				if (error instanceof DocumentMutationRegistrationError) throw error;
				throw new DocumentMutationRegistrationError("Mutation metadata must be safely JSON-serializable.", request.id);
			}
			const maxMetadataBytes = (_b = this.options.maxMetadataBytes) !== null && _b !== void 0 ? _b : 65536;
			if (new TextEncoder().encode(serializedMetadata).byteLength > maxMetadataBytes) throw new DocumentMutationRegistrationError(`Mutation metadata exceeds ${maxMetadataBytes} bytes.`, request.id);
			return Object.freeze({
				...request,
				conflictDomains: Object.freeze([...request.conflictDomains]),
				participants: Object.freeze(participants),
				metadata
			});
		}
		requireParent(parent) {
			const record = this.contextRecords.get(parent);
			if (!record || record.session.closed || parent.signal.aborted) throw new DocumentMutationRegistrationError(`Parent transaction "${parent.transactionId}" is not active.`, parent.transactionId);
			return record;
		}
		throwIfUnavailable(signal, transactionId) {
			var _a;
			if (signal.aborted) throw (_a = signal.reason) !== null && _a !== void 0 ? _a : new DOMException("Document mutation was aborted.", "AbortError");
			if (this.options.state.isDisposed()) throw new DocumentMutationError(transactionId, "Core state is disposed.");
		}
		warn(warning) {
			var _a, _b, _c, _d;
			try {
				(_b = (_a = this.options).warningSink) === null || _b === void 0 || _b.call(_a, Object.freeze(warning));
			} catch (error) {
				(_d = (_c = this.options).errorSink) === null || _d === void 0 || _d.call(_c, error);
			}
		}
		assertActive(operation) {
			if (this.disposed) throw new DocumentMutationRegistrationError(`Cannot ${operation} after coordinator disposal.`);
		}
	};

//#endregion
//#region dist/esm/core-runtime/state/memento-service.js
	const DEFAULT_ROLLBACK_TIMEOUT_MS = 3e4;
	function createAbortError(message) {
		if (typeof DOMException === "function") return new DOMException(message, "AbortError");
		const error = new Error(message);
		error.name = "AbortError";
		return error;
	}
	function throwIfAborted(signal) {
		var _a;
		if (signal.aborted) throw (_a = signal.reason) !== null && _a !== void 0 ? _a : createAbortError("State restoration was aborted.");
	}
	async function runBoundedRollback(task, timeoutMs) {
		const controller = new AbortController();
		const timeoutError = /* @__PURE__ */ new Error(`Memento rollback timed out after ${timeoutMs}ms.`);
		timeoutError.name = "TimeoutError";
		const timeout = setTimeout(() => controller.abort(timeoutError), timeoutMs);
		let removeAbortListener = () => void 0;
		const aborted = new Promise((resolve, reject) => {
			const abort = () => {
				var _a;
				return reject((_a = controller.signal.reason) !== null && _a !== void 0 ? _a : timeoutError);
			};
			removeAbortListener = () => controller.signal.removeEventListener("abort", abort);
			controller.signal.addEventListener("abort", abort, { once: true });
		});
		try {
			await Promise.race([task(controller.signal), aborted]);
		} finally {
			clearTimeout(timeout);
			removeAbortListener();
		}
	}
	function stateValuesMatch(left, right) {
		if (Object.is(left, right)) return true;
		if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) return false;
		if (Array.isArray(left) !== Array.isArray(right)) return false;
		const leftRecord = left;
		const rightRecord = right;
		const leftKeys = Object.keys(leftRecord);
		const rightKeys = Object.keys(rightRecord);
		if (leftKeys.length !== rightKeys.length) return false;
		return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(rightRecord, key) && stateValuesMatch(leftRecord[key], rightRecord[key]));
	}
	var MementoService = class {
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
				value: /* @__PURE__ */ new WeakSet()
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
			this.assertActive("capture a memento");
			if (this.restoring) throw new StateRegistrationError("Cannot capture a new memento during restoration.");
			return this.captureInternal();
		}
		isTrusted(value) {
			return typeof value === "object" && value !== null && this.trustedMementos.has(value);
		}
		matches(memento) {
			this.assertActive("compare a memento");
			if (!this.isTrusted(memento)) return false;
			const current = this.captureInternal(false);
			return stateValuesMatch(current.core, memento.core) && stateValuesMatch(current.plugins, memento.plugins);
		}
		async restore(memento, options = {}) {
			var _a;
			this.assertActive("restore a memento");
			if (!this.isTrusted(memento)) throw new MementoRestoreError("core", "restore", /* @__PURE__ */ new Error("Untrusted memento."));
			if (this.restoring) throw new MementoRestoreError("core", "restore", /* @__PURE__ */ new Error("Reentrant memento restoration is not allowed."));
			const rollbackTimeoutMs = (_a = options.rollbackTimeoutMs) !== null && _a !== void 0 ? _a : DEFAULT_ROLLBACK_TIMEOUT_MS;
			if (!Number.isSafeInteger(rollbackTimeoutMs) || rollbackTimeoutMs <= 0) throw new MementoRestoreError("core", "restore", /* @__PURE__ */ new TypeError("rollbackTimeoutMs must be a positive safe integer."));
			const controller = new AbortController();
			const providedSignal = options.signal;
			const abort = () => controller.abort(providedSignal === null || providedSignal === void 0 ? void 0 : providedSignal.reason);
			providedSignal === null || providedSignal === void 0 || providedSignal.addEventListener("abort", abort, { once: true });
			if (providedSignal === null || providedSignal === void 0 ? void 0 : providedSignal.aborted) abort();
			this.restoring = true;
			let rollback = null;
			try {
				if (options.rollbackOnFailure !== false) rollback = this.captureInternal(false);
				await this.restoreInternal(memento, "trusted-memento", controller.signal);
			} catch (error) {
				if (!rollback) {
					if (error instanceof MementoRestoreError) throw error;
					throw new MementoRestoreError("core", "restore", error);
				}
				const rollbackMemento = rollback;
				const rollbackErrors = [];
				try {
					await runBoundedRollback((signal) => this.restoreInternal(rollbackMemento, "rollback", signal), rollbackTimeoutMs);
				} catch (rollbackError) {
					rollbackErrors.push(rollbackError);
				}
				if (error instanceof MementoRestoreError) throw new MementoRestoreError(error.sliceId, "restore", error.cause, rollbackErrors);
				throw new MementoRestoreError("core", "restore", error, rollbackErrors);
			} finally {
				providedSignal === null || providedSignal === void 0 || providedSignal.removeEventListener("abort", abort);
				this.restoring = false;
			}
		}
		dispose() {
			this.disposed = true;
		}
		reset() {
			this.assertActive("reset MementoService");
			if (this.restoring) throw new StateRegistrationError("Cannot reset MementoService during restoration.");
			this.trustedMementos = /* @__PURE__ */ new WeakSet();
			this.revision = 0;
		}
		captureInternal(validateReferenceIdentity = true) {
			var _a;
			const capturedAt = Date.now();
			const context = Object.freeze({
				mode: "memento",
				capturedAt
			});
			let core;
			try {
				core = cloneStateValue(this.coreAdapter.capture(context));
				assertSafeImmutableReference(core);
			} catch (error) {
				throw new MementoCaptureError("core", error);
			}
			const plugins = Object.create(null);
			for (const slice of this.slices.list()) try {
				const captured = slice.capture(context);
				let capturePolicy = (_a = slice.capturePolicy) !== null && _a !== void 0 ? _a : "always";
				let data;
				if (capturePolicy === "reference") if (validateReferenceIdentity) {
					const validation = slice.validate(captured, {
						sliceId: slice.id,
						version: slice.version
					});
					if (!validation.valid || validation.value !== captured) throw new Error(validation.valid ? "Reference validation must preserve the captured identity." : validation.message);
					assertSafeImmutableReference(captured);
					data = captured;
				} else {
					data = cloneStateValue(captured);
					capturePolicy = "always";
				}
				else data = cloneStateValue(captured);
				assertSafeImmutableReference(data);
				plugins[slice.id] = Object.freeze({
					version: slice.version,
					capturePolicy,
					data
				});
			} catch (error) {
				throw new MementoCaptureError(slice.id, error);
			}
			const memento = Object.freeze({
				revision: ++this.revision,
				capturedAt,
				core,
				plugins: Object.freeze(plugins)
			});
			this.trustedMementos.add(memento);
			return memento;
		}
		async restoreInternal(memento, mode, signal) {
			var _a;
			const context = Object.freeze({
				mode,
				signal
			});
			throwIfAborted(signal);
			try {
				await this.coreAdapter.restore(cloneStateValue(memento.core), context);
			} catch (error) {
				throw new MementoRestoreError("core", mode === "rollback" ? "rollback" : "restore", error);
			}
			for (const slice of this.slices.list()) {
				throwIfAborted(signal);
				const entry = memento.plugins[slice.id];
				try {
					if (!entry) {
						await ((_a = slice.clearState) === null || _a === void 0 ? void 0 : _a.call(slice, context));
						continue;
					}
					if (entry.version !== slice.version) throw new Error(`Captured version ${entry.version} does not match installed version ${slice.version}.`);
					await slice.restore(entry.capturePolicy === "reference" ? entry.data : cloneStateValue(entry.data), context);
				} catch (error) {
					throw new MementoRestoreError(slice.id, mode === "rollback" ? "rollback" : "restore", error);
				}
			}
		}
		assertActive(operation) {
			if (this.disposed) throw new StateRegistrationError(`Cannot ${operation} after MementoService disposal.`);
		}
	};

//#endregion
//#region dist/esm/core-runtime/state/object-property-registry.js
	function assertIdentifier(value, label) {
		if (value.trim().length === 0 || value.trim() !== value) throw new StateRegistrationError(`${label} must be a non-empty trimmed string.`);
	}
	var ObjectPropertyRegistry = class {
		constructor() {
			Object.defineProperty(this, "properties", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: {
					records: /* @__PURE__ */ new Map(),
					snapshot: Object.freeze([])
				}
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
			if (!isRuntimeIdentifier(registration.owner)) throw new StateRegistrationError("Invalid object property owner Runtime ID.", registration.owner);
			if (registration.keys.length === 0) throw new StateRegistrationError(`Object property registration for "${registration.owner}" must include a key.`);
			const keys = [...new Set(registration.keys)];
			for (const key of keys) {
				assertIdentifier(key, "Object property key");
				if (isDangerousStateKey(key)) throw new StateRegistrationError(`Object property key "${key}" is forbidden.`);
				const existing = this.properties.records.get(key);
				if (existing && existing.owner !== registration.owner) throw new StateRegistrationError(`Object property "${key}" is already owned by "${existing.owner}".`);
			}
			let keySetChanged = false;
			for (const key of keys) {
				const existing = this.properties.records.get(key);
				if (existing) existing.references += 1;
				else {
					this.properties.records.set(key, {
						owner: registration.owner,
						references: 1
					});
					keySetChanged = true;
				}
			}
			if (keySetChanged) this.properties.snapshot = Object.freeze([...this.properties.records.keys()]);
			return createDisposable(() => {
				let registeredKeyRemoved = false;
				for (const key of keys) {
					const record = this.properties.records.get(key);
					if (!record || record.owner !== registration.owner) continue;
					record.references -= 1;
					if (record.references === 0) {
						this.properties.records.delete(key);
						registeredKeyRemoved = true;
					}
				}
				if (registeredKeyRemoved) this.properties.snapshot = Object.freeze([...this.properties.records.keys()]);
			});
		}
		listKeys() {
			this.assertActive();
			return this.properties.snapshot;
		}
		getOwner(key) {
			var _a, _b;
			this.assertActive();
			return (_b = (_a = this.properties.records.get(key)) === null || _a === void 0 ? void 0 : _a.owner) !== null && _b !== void 0 ? _b : null;
		}
		dispose() {
			if (this.disposed) return;
			this.properties.records.clear();
			this.properties.snapshot = Object.freeze([]);
			this.disposed = true;
		}
		assertActive() {
			if (this.disposed) throw new StateRegistrationError("Object property registry is disposed.");
		}
	};

//#endregion
//#region dist/esm/core-runtime/state/image-data-url.js
	const PNG_SIGNATURE = [
		137,
		80,
		78,
		71,
		13,
		10,
		26,
		10
	];
	const HEADER_PROBE_BASE64_CHARACTERS = Math.ceil(262144 / 3) * 4;
	const MAX_DATA_URL_HEADER_LENGTH = 64;
	const ASCII_CHUNK_SIZE = 8192;
	function matchesAscii(bytes, offset, value) {
		if (offset < 0 || offset + value.length > bytes.length) return false;
		for (let index = 0; index < value.length; index += 1) if (bytes[offset + index] !== value.charCodeAt(index)) return false;
		return true;
	}
	function uint16BE(bytes, offset) {
		if (offset < 0 || offset + 2 > bytes.length) return null;
		return bytes[offset] << 8 | bytes[offset + 1];
	}
	function uint16LE(bytes, offset) {
		if (offset < 0 || offset + 2 > bytes.length) return null;
		return bytes[offset] | bytes[offset + 1] << 8;
	}
	function uint24LE(bytes, offset) {
		if (offset < 0 || offset + 3 > bytes.length) return null;
		return bytes[offset] | bytes[offset + 1] << 8 | bytes[offset + 2] << 16;
	}
	function uint32BE(bytes, offset) {
		if (offset < 0 || offset + 4 > bytes.length) return null;
		return bytes[offset] * 16777216 + (bytes[offset + 1] << 16 | bytes[offset + 2] << 8 | bytes[offset + 3]);
	}
	function positiveDimensions(width, height) {
		return width !== null && height !== null && width > 0 && height > 0 ? Object.freeze({
			width,
			height
		}) : null;
	}
	function readPngDimensions(bytes) {
		if (bytes.length < 24 || !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte) || !matchesAscii(bytes, 12, "IHDR")) return null;
		return positiveDimensions(uint32BE(bytes, 16), uint32BE(bytes, 20));
	}
	function isJpegStartOfFrame(marker) {
		return marker >= 192 && marker <= 195 || marker >= 197 && marker <= 199 || marker >= 201 && marker <= 203 || marker >= 205 && marker <= 207;
	}
	function readJpegDimensions(bytes) {
		if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216) return null;
		let offset = 2;
		while (offset + 1 < bytes.length) {
			while (offset < bytes.length && bytes[offset] === 255) offset += 1;
			if (offset >= bytes.length) return null;
			const marker = bytes[offset];
			offset += 1;
			if (marker === 218 || marker === 217) return null;
			if (marker === 1 || marker >= 208 && marker <= 215) continue;
			const length = uint16BE(bytes, offset);
			if (length === null || length < 2 || offset + length > bytes.length) return null;
			if (isJpegStartOfFrame(marker) && length >= 7) return positiveDimensions(uint16BE(bytes, offset + 5), uint16BE(bytes, offset + 3));
			offset += length;
		}
		return null;
	}
	function readWebpDimensions(bytes) {
		var _a, _b;
		if (bytes.length < 20 || !matchesAscii(bytes, 0, "RIFF") || !matchesAscii(bytes, 8, "WEBP")) return null;
		if (matchesAscii(bytes, 12, "VP8X") && bytes.length >= 30) {
			const width = uint24LE(bytes, 24);
			const height = uint24LE(bytes, 27);
			return width === null || height === null ? null : Object.freeze({
				width: width + 1,
				height: height + 1
			});
		}
		if (matchesAscii(bytes, 12, "VP8 ") && bytes.length >= 30) return positiveDimensions(((_a = uint16LE(bytes, 26)) !== null && _a !== void 0 ? _a : 0) & 16383, ((_b = uint16LE(bytes, 28)) !== null && _b !== void 0 ? _b : 0) & 16383);
		if (matchesAscii(bytes, 12, "VP8L") && bytes.length >= 25 && bytes[20] === 47) return Object.freeze({
			width: 1 + bytes[21] + ((bytes[22] & 63) << 8),
			height: 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 15) << 10)
		});
		return null;
	}
	function decodePrefix(encoded) {
		if (!encoded) return /* @__PURE__ */ new Uint8Array();
		const remainder = encoded.length % 4;
		if (remainder === 1) return null;
		const padded = remainder === 0 ? encoded : `${encoded}${"=".repeat(4 - remainder)}`;
		const buffer = globalThis.Buffer;
		if (buffer) return buffer.from(padded, "base64");
		if (typeof globalThis.atob !== "function") return null;
		try {
			const binary = globalThis.atob(padded);
			return Uint8Array.from(binary, (character) => character.charCodeAt(0));
		} catch {
			return null;
		}
	}
	function isBase64Character(code) {
		return code >= 65 && code <= 90 || code >= 97 && code <= 122 || code >= 48 && code <= 57 || code === 43 || code === 47;
	}
	function prefixToString(prefix, length) {
		let result = "";
		for (let offset = 0; offset < length; offset += ASCII_CHUNK_SIZE) result += String.fromCharCode(...prefix.subarray(offset, Math.min(length, offset + ASCII_CHUNK_SIZE)));
		return result;
	}
	function scanBase64Payload(value, payloadOffset) {
		const prefix = new Uint8Array(HEADER_PROBE_BASE64_CHARACTERS);
		let prefixLength = 0;
		let encodedLength = 0;
		let padding = 0;
		let sawPadding = false;
		for (let index = payloadOffset; index < value.length; index += 1) {
			const code = value.charCodeAt(index);
			if (isBase64Character(code)) {
				if (sawPadding) return null;
			} else if (code === 61) {
				sawPadding = true;
				padding += 1;
				if (padding > 2) return null;
			} else if (/\s/u.test(value[index])) continue;
			else return null;
			encodedLength += 1;
			if (prefixLength < prefix.length) {
				prefix[prefixLength] = code;
				prefixLength += 1;
			}
		}
		const remainder = encodedLength % 4;
		if (remainder === 1 || padding > 0 && remainder !== 0) return null;
		return Object.freeze({
			encodedBytes: Math.max(0, Math.floor(encodedLength * 3 / 4) - padding),
			prefix: prefixToString(prefix, prefixLength)
		});
	}
	function inspectEncodedImageDataUrl(value) {
		var _a, _b;
		const commaIndex = value.indexOf(",");
		if (commaIndex < 0 || commaIndex > MAX_DATA_URL_HEADER_LENGTH) return null;
		const header = value.slice(0, commaIndex).toLowerCase();
		let mimeType;
		if (header === "data:image/png;base64") mimeType = "image/png";
		else if (header === "data:image/jpeg;base64") mimeType = "image/jpeg";
		else if (header === "data:image/webp;base64") mimeType = "image/webp";
		else return null;
		const payload = scanBase64Payload(value, commaIndex + 1);
		if (!payload) return null;
		const decodedPrefix = decodePrefix(payload.prefix);
		const dimensions = decodedPrefix ? (_b = (_a = readPngDimensions(decodedPrefix)) !== null && _a !== void 0 ? _a : readJpegDimensions(decodedPrefix)) !== null && _b !== void 0 ? _b : readWebpDimensions(decodedPrefix) : null;
		return Object.freeze({
			mimeType,
			encodedBytes: payload.encodedBytes,
			dimensions
		});
	}

//#endregion
//#region dist/esm/core-runtime/state/snapshot-service.js
	const EXTERNAL_RESOURCE_KEYS = /* @__PURE__ */ new Set([
		"href",
		"source",
		"src",
		"url"
	]);
	function isExternalResourceKey(propertyName) {
		if (!propertyName) return false;
		const normalized = propertyName.toLowerCase();
		return EXTERNAL_RESOURCE_KEYS.has(normalized) || normalized.endsWith("url");
	}
	const DEFAULT_SNAPSHOT_LIMITS = Object.freeze({
		maxInputBytes: 16777216,
		maxDepth: 64,
		maxObjectCount: 1e5,
		maxPluginCount: 256,
		maxPluginPayloadBytes: 4194304,
		maxMetadataBytes: 262144,
		maxStringLength: 16777216,
		maxDataUrlBytes: 16777216,
		maxDecodedPixels: 5e7,
		maxImageDimension: 32768,
		externalUrlPolicy: "reject"
	});
	function byteLength(value) {
		return new TextEncoder().encode(value).byteLength;
	}
	function inspectTree(value, limits, path = "$", depth = 0, ancestors = /* @__PURE__ */ new WeakSet(), counter = { count: 0 }, propertyName) {
		if (depth > limits.maxDepth) throw new SnapshotValidationError(`nesting exceeds ${limits.maxDepth}.`, path);
		if (value === null || typeof value !== "object") {
			if (typeof value === "number" && !Number.isFinite(value)) throw new SnapshotValidationError("number must be finite.", path);
			if (typeof value === "string") {
				if (value.length > limits.maxStringLength) throw new SnapshotValidationError(`string length exceeds ${limits.maxStringLength}.`, path);
				if (value.startsWith("data:")) {
					const inspection = inspectEncodedImageDataUrl(value);
					if (!inspection) throw new SnapshotValidationError("Data URL must be a base64 PNG, JPEG, or WebP image.", path);
					if (inspection.encodedBytes > limits.maxDataUrlBytes) throw new SnapshotValidationError(`Data URL exceeds ${limits.maxDataUrlBytes} bytes.`, path);
					if (inspection.dimensions) {
						const { width, height } = inspection.dimensions;
						if (width * height > limits.maxDecodedPixels) throw new SnapshotValidationError(`decoded pixel count exceeds ${limits.maxDecodedPixels}.`, path);
						if (width > limits.maxImageDimension || height > limits.maxImageDimension) throw new SnapshotValidationError(`image dimensions exceed ${limits.maxImageDimension}.`, path);
					}
				} else if (limits.externalUrlPolicy === "reject" && isExternalResourceKey(propertyName) && /^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(value)) throw new SnapshotValidationError("external URL references are forbidden.", path);
			}
			if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") throw new SnapshotValidationError(`unsupported ${typeof value} value.`, path);
			return;
		}
		counter.count += 1;
		if (counter.count > limits.maxObjectCount) throw new SnapshotValidationError(`object count exceeds ${limits.maxObjectCount}.`, path);
		if (ancestors.has(value)) throw new SnapshotValidationError("cyclic value.", path);
		const prototype = Object.getPrototypeOf(value);
		if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) throw new SnapshotValidationError("only plain objects and arrays are accepted.", path);
		if (Object.prototype.hasOwnProperty.call(value, "toJSON") || Object.getOwnPropertySymbols(value).length > 0) throw new SnapshotValidationError("toJSON hooks and symbol properties are forbidden.", path);
		ancestors.add(value);
		for (const key of Object.keys(value)) {
			if (isDangerousStateKey(key)) throw new SnapshotValidationError(`dangerous key "${key}" is forbidden.`, `${path}.${key}`);
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			if (!descriptor || !("value" in descriptor)) throw new SnapshotValidationError("accessor properties are forbidden.", `${path}.${key}`);
			const nestedValue = descriptor.value;
			inspectTree(nestedValue, limits, `${path}.${key}`, depth + 1, ancestors, counter, key);
			if (key === "metadata" || key.endsWith("Metadata")) {
				if (byteLength(JSON.stringify(nestedValue)) > limits.maxMetadataBytes) throw new SnapshotValidationError(`metadata exceeds ${limits.maxMetadataBytes} bytes.`, `${path}.${key}`);
			}
		}
		ancestors.delete(value);
	}
	function stableJson(value, limits) {
		inspectTree(value, limits);
		const sortValue = (entry) => {
			if (Array.isArray(entry)) return entry.map(sortValue);
			if (entry && typeof entry === "object") {
				const result = {};
				for (const key of Object.keys(entry).sort()) result[key] = sortValue(entry[key]);
				return result;
			}
			return entry;
		};
		return JSON.stringify(sortValue(value));
	}
	function parseInput(input, limits) {
		if (typeof input !== "string") {
			inspectTree(input, limits);
			if (byteLength(JSON.stringify(input)) > limits.maxInputBytes) throw new SnapshotValidationError(`input exceeds ${limits.maxInputBytes} bytes.`);
			return input;
		}
		if (byteLength(input) > limits.maxInputBytes) throw new SnapshotValidationError(`input exceeds ${limits.maxInputBytes} bytes.`);
		try {
			const parsed = JSON.parse(input);
			inspectTree(parsed, limits);
			return parsed;
		} catch (error) {
			if (error instanceof SnapshotValidationError) throw error;
			throw new SnapshotValidationError("input is not valid JSON.", "$", error);
		}
	}
	function isRecord(value) {
		return typeof value === "object" && value !== null && !Array.isArray(value);
	}
	function isUnsupportedCanvasEnvelope(value) {
		if ("schema" in value || !Array.isArray(value.objects) || !isRecord(value._editorState)) return false;
		const editorState = value._editorState;
		return [
			"currentScale",
			"currentRotation",
			"baseImageScale"
		].every((key) => typeof editorState[key] === "number");
	}
	var SnapshotService = class {
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
				value: /* @__PURE__ */ new Map()
			});
			Object.defineProperty(this, "prepared", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: /* @__PURE__ */ new WeakSet()
			});
			Object.defineProperty(this, "disposed", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: false
			});
		}
		capture() {
			this.assertActive("capture a public snapshot");
			const context = Object.freeze({
				mode: "snapshot",
				capturedAt: Date.now()
			});
			const plugins = Object.create(null);
			for (const [id, entry] of this.opaque) plugins[id] = cloneStateValue(entry);
			for (const slice of this.slices.list()) plugins[slice.id] = Object.freeze({
				version: slice.version,
				data: cloneStateValue(slice.capture(context))
			});
			return Object.freeze({
				schema: "image-editor.state",
				version: 3,
				core: cloneStateValue(this.coreAdapter.capture(context)),
				plugins: Object.freeze(plugins)
			});
		}
		stringify() {
			return stableJson(this.capture(), this.limits);
		}
		async load(input, options = {}) {
			this.assertActive("load a public snapshot");
			const prepared = await this.prepareForLoad(input, options);
			await this.loadPrepared(prepared, options);
		}
		prepare(input, options = {}) {
			this.assertActive("prepare a public snapshot");
			return this.prepareParsed(parseInput(input, this.limits), options);
		}
		async prepareForLoad(input, options = {}) {
			var _a;
			this.assertActive("prepare a public snapshot");
			const parsed = parseInput(input, this.limits);
			if (!((_a = options.migrations) === null || _a === void 0 ? void 0 : _a.length) || isRecord(parsed) && parsed.schema === "image-editor.state" && parsed.version === 3) return this.prepareParsed(parsed, options);
			const immutableInput = cloneStateValue(parsed);
			const migration = options.migrations.find((candidate) => candidate.canMigrate(immutableInput));
			if (!migration) return this.prepareParsed(parsed, options);
			const context = options.signal ? { signal: options.signal } : {};
			const migrated = await migration.migrate(immutableInput, context);
			return this.prepareParsed(parseInput(migrated, this.limits), options);
		}
		prepareParsed(input, options) {
			var _a, _b, _c, _d;
			const snapshot = this.validateEnvelope(input);
			const policy = (_a = options.missingPluginPolicy) !== null && _a !== void 0 ? _a : "warn-and-skip";
			const coreValidation = this.coreAdapter.validateSnapshot(snapshot.core);
			if (!coreValidation.valid) throw new SnapshotValidationError(coreValidation.message, (_b = coreValidation.path) !== null && _b !== void 0 ? _b : "$.core");
			const validatedSlices = [];
			const opaqueSlices = [];
			for (const [id, entry] of Object.entries(snapshot.plugins)) {
				if (byteLength(stableJson(entry.data, this.limits)) > this.limits.maxPluginPayloadBytes) throw new SnapshotValidationError(`plugin payload exceeds ${this.limits.maxPluginPayloadBytes} bytes.`, `$.plugins.${id}.data`);
				const slice = this.slices.get(id);
				if (!slice) {
					if (policy === "error") throw new SnapshotValidationError("required plugin is not installed.", `$.plugins.${id}`);
					if (policy === "preserve-opaque") opaqueSlices.push(Object.freeze({
						id,
						entry: cloneStateValue(entry)
					}));
					(_c = this.warningSink) === null || _c === void 0 || _c.call(this, {
						code: "SNAPSHOT_PLUGIN_MISSING",
						message: `Snapshot data for missing plugin "${id}" was ${policy === "preserve-opaque" ? "preserved opaquely" : "skipped"}.`,
						sliceId: id
					});
					continue;
				}
				if (entry.version !== slice.version) throw new SnapshotValidationError(`version ${entry.version} is incompatible with installed version ${slice.version}.`, `$.plugins.${id}.version`);
				const validation = slice.validate(entry.data, {
					sliceId: id,
					version: entry.version
				});
				if (!validation.valid) throw new SnapshotValidationError(validation.message, (_d = validation.path) !== null && _d !== void 0 ? _d : `$.plugins.${id}.data`);
				validatedSlices.push(Object.freeze({
					id,
					value: cloneStateValue(validation.value)
				}));
			}
			const prepared = Object.freeze({
				core: cloneStateValue(coreValidation.value),
				validatedSlices: Object.freeze(validatedSlices),
				opaqueSlices: Object.freeze(opaqueSlices)
			});
			this.prepared.add(prepared);
			return prepared;
		}
		async loadPrepared(prepared, options = {}) {
			var _a, _b, _c, _d;
			this.assertActive("load a prepared public snapshot");
			if (!this.prepared.has(prepared)) throw new SnapshotValidationError("prepared snapshot is not trusted.");
			const before = options.rollbackOnFailure === false ? null : this.mementos.capture();
			const controller = new AbortController();
			const abort = () => {
				var _a;
				return controller.abort((_a = options.signal) === null || _a === void 0 ? void 0 : _a.reason);
			};
			(_a = options.signal) === null || _a === void 0 || _a.addEventListener("abort", abort, { once: true });
			if ((_b = options.signal) === null || _b === void 0 ? void 0 : _b.aborted) abort();
			const context = Object.freeze({
				mode: "public-snapshot",
				signal: controller.signal
			});
			const validatedSlices = new Map(prepared.validatedSlices.map(({ id, value }) => [id, value]));
			const nextOpaque = new Map(prepared.opaqueSlices.map(({ id, entry }) => [id, entry]));
			try {
				await this.coreAdapter.restore(cloneStateValue(prepared.core), context);
				for (const slice of this.slices.list()) if (validatedSlices.has(slice.id)) await slice.restore(validatedSlices.get(slice.id), context);
				else await ((_c = slice.clearState) === null || _c === void 0 ? void 0 : _c.call(slice, context));
				this.opaque = nextOpaque;
			} catch (error) {
				if (!before) throw error;
				try {
					await this.mementos.restore(before, { rollbackOnFailure: false });
				} catch (rollbackError) {
					const combinedError = /* @__PURE__ */ new Error("Snapshot load and rollback both failed.");
					combinedError.causes = Object.freeze([error, rollbackError]);
					throw new SnapshotValidationError("load failed and rollback could not restore the previous state.", "$", combinedError);
				}
				throw error;
			} finally {
				(_d = options.signal) === null || _d === void 0 || _d.removeEventListener("abort", abort);
			}
		}
		dispose() {
			this.opaque.clear();
			this.disposed = true;
		}
		reset() {
			this.assertActive("reset SnapshotService");
			this.opaque.clear();
			this.prepared = /* @__PURE__ */ new WeakSet();
		}
		validateEnvelope(value) {
			if (!isRecord(value)) throw new SnapshotValidationError("snapshot must be an object.");
			if (isUnsupportedCanvasEnvelope(value)) throw new SnapshotVersionUnsupportedError(typeof value.version === "number" ? value.version : "unversioned");
			if (value.schema !== "image-editor.state") throw new SnapshotValidationError("schema must be \"image-editor.state\".", "$.schema");
			if (value.version !== 3) throw new SnapshotVersionUnsupportedError(typeof value.version === "number" ? value.version : "unversioned");
			if (!isRecord(value.core)) throw new SnapshotValidationError("core must be an object.", "$.core");
			if (!isRecord(value.plugins)) throw new SnapshotValidationError("plugins must be an object.", "$.plugins");
			const entries = Object.entries(value.plugins);
			if (entries.length > this.limits.maxPluginCount) throw new SnapshotValidationError(`plugin count exceeds ${this.limits.maxPluginCount}.`, "$.plugins");
			const plugins = Object.create(null);
			for (const [id, entry] of entries) {
				if (!isRuntimeIdentifier(id) || isDangerousStateKey(id)) throw new SnapshotValidationError("plugin id is invalid.", `$.plugins.${id}`);
				if (!isRecord(entry) || !Number.isSafeInteger(entry.version) || Number(entry.version) <= 0) throw new SnapshotValidationError("plugin entry requires a positive integer version and data.", `$.plugins.${id}`);
				plugins[id] = Object.freeze({
					version: Number(entry.version),
					data: entry.data
				});
			}
			return Object.freeze({
				schema: "image-editor.state",
				version: 3,
				core: cloneStateValue(value.core),
				plugins: Object.freeze(plugins)
			});
		}
		assertActive(operation) {
			if (this.disposed) throw new StateRegistrationError(`Cannot ${operation} after disposal.`);
		}
	};

//#endregion
//#region dist/esm/core-runtime/state/state-slice-registry.js
	function assertDefinition(definition) {
		if (!isRuntimeIdentifier(definition.id)) throw new StateRegistrationError("Invalid State Slice Runtime ID.", definition.id);
		if (!Number.isSafeInteger(definition.version) || definition.version <= 0) throw new StateRegistrationError(`State slice "${definition.id}" must use a positive integer version.`, definition.id);
		if (typeof definition.capture !== "function" || typeof definition.validate !== "function" || typeof definition.restore !== "function") throw new StateRegistrationError(`State slice "${definition.id}" has an incomplete contract.`, definition.id);
		if (definition.capturePolicy !== void 0 && definition.capturePolicy !== "always" && definition.capturePolicy !== "reference") throw new StateRegistrationError(`State slice "${definition.id}" capturePolicy must be "always" or "reference".`, definition.id);
	}
	var StateSliceRegistry = class {
		constructor() {
			Object.defineProperty(this, "definitions", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: {
					records: /* @__PURE__ */ new Map(),
					snapshot: Object.freeze([])
				}
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
			if (this.definitions.records.has(definition.id)) throw new StateRegistrationError(`State slice "${definition.id}" is already registered.`, definition.id);
			const stored = Object.freeze({
				...definition,
				capturePolicy: (_a = definition.capturePolicy) !== null && _a !== void 0 ? _a : "always"
			});
			this.definitions.records.set(definition.id, stored);
			this.definitions.snapshot = Object.freeze([...this.definitions.records.values()]);
			return createDisposable(() => {
				if (this.definitions.records.get(definition.id) === stored) {
					this.definitions.records.delete(definition.id);
					this.definitions.snapshot = Object.freeze([...this.definitions.records.values()]);
				}
			});
		}
		get(id) {
			var _a;
			this.assertActive();
			return (_a = this.definitions.records.get(id)) !== null && _a !== void 0 ? _a : null;
		}
		list() {
			this.assertActive();
			return this.definitions.snapshot;
		}
		dispose() {
			if (this.disposed) return;
			this.definitions.records.clear();
			this.definitions.snapshot = Object.freeze([]);
			this.disposed = true;
		}
		assertActive() {
			if (this.disposed) throw new StateRegistrationError("State slice registry is disposed.");
		}
	};

//#endregion
//#region dist/esm/core-runtime/state/transient-object-registry.js
	var TransientObjectRegistry = class {
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
				value: {
					records: [],
					snapshot: Object.freeze([])
				}
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
			if (!isRuntimeIdentifier(owner)) throw new StateRegistrationError("Invalid transient predicate owner Runtime ID.");
			if (typeof predicate !== "function") throw new StateRegistrationError(`Transient predicate for "${owner}" must be a function.`);
			const record = {
				owner,
				predicate
			};
			this.predicates.records.push(record);
			this.predicates.snapshot = Object.freeze([...this.predicates.records]);
			return createDisposable(() => {
				const index = this.predicates.records.indexOf(record);
				if (index < 0) return;
				this.predicates.records.splice(index, 1);
				this.predicates.snapshot = Object.freeze([...this.predicates.records]);
			});
		}
		isTransient(object) {
			var _a;
			this.assertActive();
			const snapshot = this.predicates.snapshot;
			for (const record of snapshot) try {
				if (record.predicate(object)) return true;
			} catch (error) {
				(_a = this.warningSink) === null || _a === void 0 || _a.call(this, {
					code: "TRANSIENT_PREDICATE_FAILED",
					message: `Transient object predicate owned by "${record.owner}" failed and was ignored.`,
					details: Object.freeze({
						owner: record.owner,
						cause: error
					})
				});
			}
			return false;
		}
		dispose() {
			if (this.disposed) return;
			this.predicates.records.length = 0;
			this.predicates.snapshot = Object.freeze([]);
			this.disposed = true;
		}
		assertActive() {
			if (this.disposed) throw new StateRegistrationError("Transient object registry is disposed.");
		}
	};

//#endregion
//#region dist/esm/core-runtime/image-editor-core.js
	const DEFAULT_CORE_OPTIONS = Object.freeze({
		canvasWidth: 800,
		canvasHeight: 600,
		backgroundColor: "#ffffff",
		layoutMode: "expand",
		groupSelection: true,
		maxInputBytes: 33554432,
		maxInputPixels: 67108864,
		imageLoadTimeoutMs: 3e4,
		maxExportPixels: 67108864,
		maxExportDimension: 16384,
		exportMultiplier: 1,
		initialImageBase64: ""
	});
	const MAX_RETAINED_DIAGNOSTICS = 1e3;
	function positiveFinite(value, fallback) {
		return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
	}
	function positiveInteger(value, fallback) {
		return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : fallback;
	}
	function isLayoutMode(value) {
		return value === "fit" || value === "cover" || value === "expand";
	}
	function resolveOptions(options) {
		var _a, _b, _c;
		const layoutMode = options.defaultLayoutMode;
		return Object.freeze({
			canvasWidth: positiveFinite(options.canvasWidth, DEFAULT_CORE_OPTIONS.canvasWidth),
			canvasHeight: positiveFinite(options.canvasHeight, DEFAULT_CORE_OPTIONS.canvasHeight),
			backgroundColor: (_a = options.backgroundColor) !== null && _a !== void 0 ? _a : DEFAULT_CORE_OPTIONS.backgroundColor,
			layoutMode: isLayoutMode(layoutMode) ? layoutMode : DEFAULT_CORE_OPTIONS.layoutMode,
			groupSelection: (_b = options.groupSelection) !== null && _b !== void 0 ? _b : DEFAULT_CORE_OPTIONS.groupSelection,
			maxInputBytes: positiveInteger(options.maxInputBytes, DEFAULT_CORE_OPTIONS.maxInputBytes),
			maxInputPixels: positiveInteger(options.maxInputPixels, DEFAULT_CORE_OPTIONS.maxInputPixels),
			imageLoadTimeoutMs: positiveInteger(options.imageLoadTimeoutMs, DEFAULT_CORE_OPTIONS.imageLoadTimeoutMs),
			maxExportPixels: positiveInteger(options.maxExportPixels, DEFAULT_CORE_OPTIONS.maxExportPixels),
			maxExportDimension: positiveInteger(options.maxExportDimension, DEFAULT_CORE_OPTIONS.maxExportDimension),
			exportMultiplier: positiveFinite(options.exportMultiplier, DEFAULT_CORE_OPTIONS.exportMultiplier),
			initialImageBase64: (_c = options.initialImageBase64) !== null && _c !== void 0 ? _c : "",
			...options.onError ? { onError: options.onError } : {},
			...options.onWarning ? { onWarning: options.onWarning } : {}
		});
	}
	function resolveElement(target, ownerDocument) {
		if (!target) return null;
		if (typeof target === "string") return ownerDocument.getElementById(target);
		return target;
	}
	function inferMimeType(source) {
		var _a;
		const match = /^data:(image\/(?:jpeg|png|webp))(?:[;,])/i.exec(source);
		const mimeType = (_a = match === null || match === void 0 ? void 0 : match[1]) === null || _a === void 0 ? void 0 : _a.toLowerCase();
		return mimeType === "image/jpeg" || mimeType === "image/png" || mimeType === "image/webp" ? mimeType : null;
	}
	function loadAbortError(message) {
		return new DOMException(message, "AbortError");
	}
	function loadAbortReason(signal, message) {
		const reason = signal.reason;
		return reason instanceof DOMException && reason.name === "AbortError" ? reason : loadAbortError(message);
	}
	function isLoadCancellation(error) {
		return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
	}
	function withCoreTimeout(task, timeoutMs, label, signal, disposeLateResult) {
		return new Promise((resolve, reject) => {
			const startedAt = Date.now();
			const controller = new AbortController();
			let settled = false;
			const finish = (body) => {
				if (settled) return;
				settled = true;
				clearTimeout(timeoutId);
				signal.removeEventListener("abort", abort);
				body();
			};
			const abort = () => {
				const reason = loadAbortReason(signal, `${label} was aborted.`);
				controller.abort(reason);
				finish(() => reject(reason));
			};
			const timeoutId = setTimeout(() => {
				const timeoutError = new CoreRuntimeError(`[ImageEditor] ${label} timed out after ${Date.now() - startedAt}ms.`, { code: "IMAGE_LOAD_TIMEOUT" });
				controller.abort(timeoutError);
				finish(() => reject(timeoutError));
			}, timeoutMs);
			signal.addEventListener("abort", abort, { once: true });
			if (signal.aborted) {
				abort();
				return;
			}
			try {
				task(controller.signal).then((value) => {
					if (settled) {
						try {
							disposeLateResult === null || disposeLateResult === void 0 || disposeLateResult(value);
						} catch {}
						return;
					}
					finish(() => resolve(value));
				}, (error) => finish(() => reject(error)));
			} catch (error) {
				finish(() => reject(error));
			}
		});
	}
	function toAffineMatrix(value) {
		if (value.length !== 6 || value.some((entry) => !Number.isFinite(entry))) throw new CoreRuntimeError("[ImageEditor] Base image returned a malformed transform matrix.");
		return Object.freeze([
			value[0],
			value[1],
			value[2],
			value[3],
			value[4],
			value[5]
		]);
	}
	function markBaseImage(image) {
		image.editorObjectKind = "baseImage";
		return image;
	}
	function isCoreImageInfo(value) {
		if (!value || typeof value !== "object") return false;
		const candidate = value;
		return typeof candidate.width === "number" && typeof candidate.height === "number" && typeof candidate.naturalWidth === "number" && typeof candidate.naturalHeight === "number" && typeof candidate.geometryRevision === "number";
	}
	function reportSafely(callback, error, message, fallback) {
		try {
			callback === null || callback === void 0 || callback(error, message);
		} catch (callbackError) {
			fallback("[ImageEditor] Error callback failed.", callbackError);
		}
	}
	function base64ToFile(dataUrl, fileName) {
		var _a, _b;
		const [header = "", payload = ""] = dataUrl.split(",", 2);
		const mimeType = (_b = (_a = /data:([^;]+)/.exec(header)) === null || _a === void 0 ? void 0 : _a[1]) !== null && _b !== void 0 ? _b : "application/octet-stream";
		const binary = /;base64/i.test(header) ? atob(payload) : decodeURIComponent(payload);
		const bytes = new Uint8Array(binary.length);
		for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
		return new File([bytes], fileName, { type: mimeType });
	}
	var ImageEditorCore = class {
		constructor(fabric, options = {}) {
			Object.defineProperty(this, "fabric", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: fabric
			});
			Object.defineProperty(this, "options", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "slices", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: new StateSliceRegistry()
			});
			Object.defineProperty(this, "objectProperties", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: new ObjectPropertyRegistry()
			});
			Object.defineProperty(this, "transientObjects", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "externalObjects", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "history", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: new HistoryCommitRouter()
			});
			Object.defineProperty(this, "exportContributors", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: new ExportContributorRegistry()
			});
			Object.defineProperty(this, "mementos", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "snapshots", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "documentMutations", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "geometry", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "plugins", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "installationPlan", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: []
			});
			Object.defineProperty(this, "pluginApiHandles", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: /* @__PURE__ */ new Map()
			});
			Object.defineProperty(this, "lifecycle", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: new EditorLifecycleController()
			});
			Object.defineProperty(this, "viewportCache", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: new ViewportCache()
			});
			Object.defineProperty(this, "canvas", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: null
			});
			Object.defineProperty(this, "canvasElement", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: null
			});
			Object.defineProperty(this, "containerElement", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: null
			});
			Object.defineProperty(this, "placeholderElement", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: null
			});
			Object.defineProperty(this, "baseImage", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: null
			});
			Object.defineProperty(this, "imageMimeType", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: null
			});
			Object.defineProperty(this, "imageLoaded", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: false
			});
			Object.defineProperty(this, "baseImageScale", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: 1
			});
			Object.defineProperty(this, "layoutMode", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "geometryRevision", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: 0
			});
			Object.defineProperty(this, "loadSequence", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: 0
			});
			Object.defineProperty(this, "latestLoadSequence", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: 0
			});
			Object.defineProperty(this, "stateLoadSequence", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: 0
			});
			Object.defineProperty(this, "initialImageLoadActive", {
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
			Object.defineProperty(this, "emergencyResetPromise", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: null
			});
			Object.defineProperty(this, "diagnostics", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: []
			});
			if (!fabric || typeof fabric.Canvas !== "function" || typeof fabric.FabricImage !== "function") throw new CoreRuntimeError("[ImageEditor] ImageEditorCore requires a supported Fabric.js module.");
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
				owner: "core:host",
				keys: ["editorObjectKind"]
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
				isDisposed: () => this.lifecycle.current === "disposed"
			}, this.objectProperties, this.transientObjects, this.externalObjects, {
				maxDecodedPixels: Math.min(this.options.maxInputPixels, this.options.maxExportPixels),
				maxImageDimension: Math.min(DEFAULT_SNAPSHOT_LIMITS.maxImageDimension, this.options.maxExportDimension),
				decodeTimeoutMs: this.options.imageLoadTimeoutMs
			});
			this.mementos = new MementoService(stateAdapter, this.slices);
			this.snapshots = new SnapshotService(stateAdapter, this.slices, this.mementos, (warning) => {
				var _a;
				return this.reportWarning((_a = warning.details) === null || _a === void 0 ? void 0 : _a.cause, warning.message);
			}, Object.freeze({
				...DEFAULT_SNAPSHOT_LIMITS,
				maxInputBytes: Math.ceil(this.options.maxInputBytes * 4 / 3) + 1048576,
				maxStringLength: Math.ceil(this.options.maxInputBytes * 4 / 3) + 1024,
				maxDataUrlBytes: this.options.maxInputBytes,
				maxDecodedPixels: Math.min(this.options.maxInputPixels, this.options.maxExportPixels),
				maxImageDimension: Math.min(DEFAULT_SNAPSHOT_LIMITS.maxImageDimension, this.options.maxExportDimension)
			}));
			this.documentMutations = new DocumentMutationCoordinator({
				mementos: this.mementos,
				operations: {
					has: (operationId) => {
						var _a, _b;
						return (_b = (_a = this.plugins) === null || _a === void 0 ? void 0 : _a.hasOperation(operationId)) !== null && _b !== void 0 ? _b : false;
					},
					get: (operationId) => {
						var _a, _b;
						return (_b = (_a = this.plugins) === null || _a === void 0 ? void 0 : _a.getOperationForHost(operationId)) !== null && _b !== void 0 ? _b : null;
					},
					run: (operationId, task, operationOptions) => {
						if (!this.plugins) throw new Error("Plugin Manager is not ready.");
						return this.plugins.runOperationForHost(operationId, null, (args, context) => {
							return task(context);
						}, operationOptions);
					}
				},
				state: {
					requestRender: () => this.requestRender(),
					isDisposed: () => this.lifecycle.current === "disposed",
					assertOperational: (operation) => this.assertDocumentMutationOperational(operation)
				},
				history: this.history,
				events: { emitCommitted: (descriptor) => this.emitDocumentCommitted(descriptor) },
				warningSink: (warning) => this.reportWarning(warning.cause, warning.message),
				errorSink: (error) => {
					if (!this.initialImageLoadActive) this.reportError(error, "Document mutation failed.");
				},
				faultSink: (error) => this.enterFaulted(error)
			});
			this.geometry = new GeometryMutationCoordinator({
				mutations: this.documentMutations,
				state: {
					captureGeometry: () => this.captureGeometry(),
					finalizeGeometry: () => {
						var _a;
						this.finalizeBaseImageGeometry();
						(_a = this.baseImage) === null || _a === void 0 || _a.setCoords();
						this.geometryRevision += 1;
					},
					restoreGeometry: (snapshot) => {
						this.setCanvasSize(snapshot.canvasWidth, snapshot.canvasHeight);
						this.geometryRevision = snapshot.revision;
					},
					requestRender: () => this.requestRender(),
					isDisposed: () => this.isDisposingOrDisposed()
				},
				warningSink: (warning) => this.reportWarning(warning.cause, warning.message),
				errorSink: (error) => this.reportError(error, "Geometry mutation failed.")
			});
			this.plugins = this.createPluginManager();
		}
		use(plugin) {
			this.lifecycle.assertAvailable("install a plugin");
			const outcome = this.plugins.installSyncForHost(plugin);
			this.installationPlan.push(Object.freeze({ definition: outcome.installedPlugin }));
			return this.publishPluginApi(plugin.ref.id, outcome.api);
		}
		install(pluginsOrPlan) {
			this.lifecycle.assertAvailable("install a plugin batch");
			const plugins = isPluginPlan(pluginsOrPlan) ? pluginsOrPlan.plugins : pluginsOrPlan;
			const outcome = this.plugins.installBatchSync(plugins);
			for (const plugin of outcome.installedPlugins) this.installationPlan.push(Object.freeze({ definition: plugin }));
			const resolveApi = (plugin) => {
				const api = outcome.apisByPluginId.get(plugin.ref.id);
				if (api === void 0) throw new PluginNotInstalledError(plugin.ref.id);
				return this.publishPluginApi(plugin.ref.id, api);
			};
			if (isPluginPlan(pluginsOrPlan)) return resolvePluginPlanApis(pluginsOrPlan, resolveApi);
			return Object.freeze(pluginsOrPlan.map((plugin) => resolveApi(plugin)));
		}
		getPlugin(ref) {
			const api = this.plugins.get(ref);
			return api === null ? null : this.publishPluginApi(ref.id, api);
		}
		requirePlugin(ref) {
			const api = this.getPlugin(ref);
			if (api === null) throw new PluginNotInstalledError(ref.id);
			return api;
		}
		getPluginById(pluginId) {
			const api = this.plugins.getById(pluginId);
			return api === null ? null : this.publishPluginApi(pluginId, api);
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
			let pluginInitializationCompleted = false;
			let initialImageLoadStarted = false;
			try {
				this.createCanvas(elements);
				pluginInitializationStarted = true;
				await this.plugins.initialize();
				pluginInitializationCompleted = true;
				if (this.options.initialImageBase64) {
					initialImageLoadStarted = true;
					this.initialImageLoadActive = true;
					try {
						await this.performImageLoad(this.options.initialImageBase64);
					} finally {
						this.initialImageLoadActive = false;
					}
				} else this.updatePlaceholder();
				this.lifecycle.completeInitialization();
			} catch (error) {
				this.initialImageLoadActive = false;
				const cleanupErrors = await this.rollbackInitialization(error, pluginInitializationStarted, pluginInitializationCompleted);
				if (cleanupErrors.length > 0) {
					this.lifecycle.failInitialization();
					this.recordDiagnostic(error, "Initialization failed and cleanup was incomplete.");
					for (const cleanupError of cleanupErrors) this.recordDiagnostic(cleanupError, "Initialization cleanup failed.");
				} else this.lifecycle.recoverInitialization();
				if (initialImageLoadStarted) this.reportError(error, "Initial image load failed.");
				throw error;
			}
		}
		createCanvas(elements) {
			var _a, _b, _c, _d, _e, _f;
			const ownerDocument = typeof elements.canvas === "string" ? globalThis.document : (_a = elements.canvas) === null || _a === void 0 ? void 0 : _a.ownerDocument;
			if (!ownerDocument) throw new CoreRuntimeError("[ImageEditor] Canvas document is unavailable.");
			const canvasElement = resolveElement(elements.canvas, ownerDocument);
			if (!canvasElement || canvasElement.tagName.toLowerCase() !== "canvas" || typeof canvasElement.getContext !== "function") throw new CoreRuntimeError("[ImageEditor] Core canvas element was not found.");
			this.canvasElement = canvasElement;
			this.containerElement = (_b = resolveElement(elements.canvasContainer, ownerDocument)) !== null && _b !== void 0 ? _b : canvasElement.parentElement;
			this.placeholderElement = resolveElement(elements.imagePlaceholder, ownerDocument);
			const containerWidth = Math.floor((_d = (_c = this.containerElement) === null || _c === void 0 ? void 0 : _c.clientWidth) !== null && _d !== void 0 ? _d : 0);
			const containerHeight = Math.floor((_f = (_e = this.containerElement) === null || _e === void 0 ? void 0 : _e.clientHeight) !== null && _f !== void 0 ? _f : 0);
			const hasVisibleContainer = containerWidth > 0 && containerHeight > 0;
			const initialWidth = Math.max(1, Math.ceil(hasVisibleContainer ? containerWidth : this.options.canvasWidth));
			const initialHeight = Math.max(1, Math.ceil(hasVisibleContainer ? containerHeight : this.options.canvasHeight));
			this.assertRasterBudget(initialWidth, initialHeight);
			this.canvas = new this.fabric.Canvas(canvasElement, {
				width: initialWidth,
				height: initialHeight,
				backgroundColor: this.options.backgroundColor,
				selection: this.options.groupSelection,
				preserveObjectStacking: false
			});
		}
		async loadImage(source, options = {}) {
			this.assertReady("load an image");
			await this.performImageLoad(source, options);
		}
		async performImageLoad(source, options = {}) {
			const encodedImage = inspectEncodedImageDataUrl(source);
			if (!inferMimeType(source) || !encodedImage) throw new CoreRuntimeError("[ImageEditor] Unsupported image Data URL.");
			if (encodedImage.encodedBytes > this.options.maxInputBytes) throw new CoreRuntimeError("[ImageEditor] Image input exceeds maxInputBytes.");
			if (encodedImage.dimensions && !this.isInputRasterWithinBudget(encodedImage.dimensions.width, encodedImage.dimensions.height)) throw new CoreRuntimeError("[ImageEditor] Image input dimensions exceed the configured budget.");
			if (options.concurrency && options.concurrency !== "replace-pending") throw new CoreRuntimeError("[ImageEditor] Unsupported load concurrency policy.");
			try {
				await this.plugins.runOperationForHost("core:load-image", source, async (loadSource, operationContext) => {
					const sequence = ++this.loadSequence;
					this.latestLoadSequence = sequence;
					const image = await withCoreTimeout((signal) => this.fabric.FabricImage.fromURL(loadSource, {
						crossOrigin: "anonymous",
						signal
					}), this.options.imageLoadTimeoutMs, "FabricImage.fromURL", operationContext.signal, (lateImage) => lateImage.dispose());
					let imageAdopted = false;
					let previousScroll;
					try {
						this.assertCurrentLoad(sequence, operationContext.signal);
						const naturalWidth = Number(image.width) || 0;
						const naturalHeight = Number(image.height) || 0;
						if (!this.isInputRasterWithinBudget(naturalWidth, naturalHeight)) throw new CoreRuntimeError("[ImageEditor] Decoded image dimensions exceed the configured budget.");
						previousScroll = this.containerElement ? {
							left: this.containerElement.scrollLeft,
							top: this.containerElement.scrollTop
						} : null;
						await this.documentMutations.run({
							id: `core:load-image-transaction:${sequence}`,
							kind: "raster",
							operationId: "core:commit-load-image",
							conflictDomains: DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS,
							signal: operationContext.signal,
							metadata: Object.freeze({ sequence }),
							mutate: async (commitContext) => {
								this.assertCurrentLoad(sequence, commitContext.signal);
								const previousBaseImage = this.baseImage;
								if (previousBaseImage) {
									await this.plugins.notifyImageCleared();
									this.assertCurrentLoad(sequence, commitContext.signal);
								}
								const canvas = this.requireCanvasForImageLoad("loadImage");
								canvas.discardActiveObject();
								canvas.clear();
								canvas.backgroundColor = this.options.backgroundColor;
								const baseImage = markBaseImage(image);
								baseImage.set({
									originX: "left",
									originY: "top",
									selectable: false,
									evented: false
								});
								const layout = this.computeLayout(baseImage);
								this.setCanvasSize(layout.canvasWidth, layout.canvasHeight);
								baseImage.set({
									left: layout.imageLeft,
									top: layout.imageTop,
									scaleX: layout.imageScale,
									scaleY: layout.imageScale
								});
								baseImage.setCoords();
								canvas.add(baseImage);
								canvas.sendObjectToBack(baseImage);
								this.baseImage = baseImage;
								imageAdopted = true;
								this.imageLoaded = true;
								this.baseImageScale = layout.imageScale;
								this.imageMimeType = inferMimeType(loadSource);
								this.geometryRevision += 1;
								disposeReplacedBaseImage(previousBaseImage, baseImage, "image replacement");
								const imageInfo = this.getImageInfo();
								if (!imageInfo) throw new Error("Loaded image information is unavailable.");
								await this.plugins.notifyImageLoaded(imageInfo);
								this.assertCurrentLoad(sequence, commitContext.signal);
								return imageInfo;
							},
							validate: (imageInfo, commitContext) => {
								if (!isCoreImageInfo(imageInfo)) throw new Error("Loaded image information is malformed.");
								this.assertCurrentLoad(sequence, commitContext.signal);
							}
						});
					} catch (error) {
						if (!imageAdopted) try {
							disposeReplacedBaseImage(image, null, "failed image load");
						} catch (cleanupError) {
							throw new CoreRuntimeError("[ImageEditor] Image load failed and decoded image cleanup also failed.", { cause: Object.freeze([error, cleanupError]) });
						}
						throw error;
					}
					if (options.preserveScroll && previousScroll && this.containerElement) {
						this.containerElement.scrollLeft = previousScroll.left;
						this.containerElement.scrollTop = previousScroll.top;
					}
					this.updatePlaceholder();
				}, options.signal ? { signal: options.signal } : {});
			} catch (error) {
				if (!isLoadCancellation(error) && !this.initialImageLoadActive) this.reportError(error, "loadImage failed.");
				throw error;
			}
		}
		async loadImageFile(file, options = {}) {
			var _a;
			if (!(file instanceof File)) throw new TypeError("[ImageEditor] loadImageFile expects a File.");
			if (file.size > this.options.maxInputBytes) throw new CoreRuntimeError("[ImageEditor] Image file exceeds maxInputBytes.");
			if ((_a = options.signal) === null || _a === void 0 ? void 0 : _a.aborted) throw loadAbortReason(options.signal, "Image file read was aborted.");
			const dataUrl = await new Promise((resolve, reject) => {
				var _a;
				const reader = new FileReader();
				const cleanup = () => {
					var _a;
					return (_a = options.signal) === null || _a === void 0 ? void 0 : _a.removeEventListener("abort", abort);
				};
				const abort = () => {
					reader.abort();
					cleanup();
					reject(loadAbortReason(options.signal, "Image file read was aborted."));
				};
				reader.onerror = () => {
					var _a;
					cleanup();
					reject((_a = reader.error) !== null && _a !== void 0 ? _a : /* @__PURE__ */ new Error("FileReader failed."));
				};
				reader.onload = () => {
					cleanup();
					if (typeof reader.result === "string") resolve(reader.result);
					else reject(/* @__PURE__ */ new Error("FileReader did not produce a Data URL."));
				};
				(_a = options.signal) === null || _a === void 0 || _a.addEventListener("abort", abort, { once: true });
				reader.readAsDataURL(file);
			});
			await this.loadImage(dataUrl, options);
		}
		saveState() {
			this.assertReady("save state");
			return this.snapshots.stringify();
		}
		async loadFromState(input, options = {}) {
			this.assertReady("load state");
			try {
				const prepared = await this.snapshots.prepareForLoad(input, {
					...options.missingPluginPolicy ? { missingPluginPolicy: options.missingPluginPolicy } : {},
					...options.migrations ? { migrations: options.migrations } : {},
					...options.signal ? { signal: options.signal } : {}
				});
				const sequence = ++this.stateLoadSequence;
				await this.documentMutations.run({
					id: `core:load-state-transaction:${sequence}`,
					kind: "compound",
					operationId: "core:load-state",
					conflictDomains: DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS,
					...options.signal ? { signal: options.signal } : {},
					metadata: Object.freeze({ sequence }),
					mutate: async (context) => {
						await this.snapshots.loadPrepared(prepared, {
							signal: context.signal,
							rollbackOnFailure: false
						});
						return Object.freeze({ schemaVersion: 3 });
					}
				});
				this.updatePlaceholder();
			} catch (error) {
				if (!isLoadCancellation(error)) this.reportError(error, "loadFromState failed.");
				throw error;
			}
		}
		exportImageBase64(options = {}) {
			return this.runExport(options);
		}
		async exportImageFile(options = {}) {
			var _a, _b;
			const dataUrl = await this.runExport(options);
			const format = (_a = options.format) !== null && _a !== void 0 ? _a : "png";
			return base64ToFile(dataUrl, (_b = options.fileName) !== null && _b !== void 0 ? _b : `image.${format === "jpeg" ? "jpg" : format}`);
		}
		isImageLoaded() {
			return this.imageLoaded && this.baseImage !== null;
		}
		getImageInfo() {
			const image = this.baseImage;
			if (!image) return null;
			image.setCoords();
			const bounds = image.getBoundingRect();
			return Object.freeze({
				width: bounds.width,
				height: bounds.height,
				naturalWidth: Number(image.width) || 0,
				naturalHeight: Number(image.height) || 0,
				mimeType: this.imageMimeType,
				geometryRevision: this.geometryRevision
			});
		}
		getCanvas() {
			return this.canvas;
		}
		setLayoutMode(mode) {
			this.assertNotDisposed("set layout mode");
			if (!isLayoutMode(mode)) throw new TypeError("[ImageEditor] Layout mode must be \"fit\", \"cover\", or \"expand\".");
			this.layoutMode = mode;
			this.viewportCache.clear();
		}
		emergencyReset() {
			if (this.emergencyResetPromise) return this.emergencyResetPromise;
			if (this.lifecycle.current !== "faulted") return Promise.reject(new CoreRuntimeError(`[ImageEditor] emergencyReset() is available only while the editor is faulted.`, {
				code: "EMERGENCY_RESET_NOT_ALLOWED",
				behavior: "lifecycle"
			}));
			const reset = this.performEmergencyReset();
			this.emergencyResetPromise = reset;
			reset.then(() => {
				if (this.emergencyResetPromise === reset) this.emergencyResetPromise = null;
			}, () => {
				if (this.emergencyResetPromise === reset) this.emergencyResetPromise = null;
			});
			return reset;
		}
		async forceDispose() {
			if (this.lifecycle.current === "disposed") return;
			if (this.lifecycle.current !== "faulted") throw new CoreRuntimeError("[ImageEditor] forceDispose() is available only while the editor is faulted.", {
				code: "FORCE_DISPOSE_NOT_ALLOWED",
				behavior: "lifecycle"
			});
			try {
				await this.disposeAsync();
			} catch (error) {
				this.recordDiagnostic(error, "Forced disposal completed with cleanup failures.");
			}
		}
		dispose() {
			if (this.lifecycle.current === "disposed" || this.lifecycle.current === "disposing") return;
			if (this.geometry.isRunning || this.documentMutations.isRunning || this.plugins.hasRunningOperations()) {
				this.observeDetachedDisposal(this.disposeAsync());
				return;
			}
			if (!this.lifecycle.beginDisposal()) return;
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
				() => this.slices.dispose()
			]) try {
				cleanup();
			} catch (error) {
				errors.push(error);
			}
			const canvas = this.canvas;
			try {
				this.clearRuntimeReferences();
			} catch (error) {
				errors.push(error);
			}
			let canvasDispose;
			if (canvas) try {
				canvasDispose = canvas.dispose();
			} catch (error) {
				errors.push(error);
			}
			if (canvasDispose && typeof canvasDispose.then === "function") {
				const disposal = Promise.resolve(canvasDispose).then(() => this.completeDisposal(errors, "Core disposal"), (error) => {
					errors.push(error);
					this.completeDisposal(errors, "Core disposal");
				});
				this.disposePromise = disposal;
				this.observeDetachedDisposal(disposal);
				return;
			}
			try {
				this.completeDisposal(errors, "Core disposal");
			} catch (error) {
				this.recordDiagnostic(error, "Synchronous Core disposal completed with failures.");
				this.reportError(error, "Synchronous Core disposal completed with failures.");
				throw error;
			}
		}
		disposeAsync() {
			var _a;
			if (this.disposePromise) return this.disposePromise;
			if (this.lifecycle.current === "disposed") return Promise.resolve();
			if (!this.lifecycle.beginDisposal()) return (_a = this.disposePromise) !== null && _a !== void 0 ? _a : Promise.resolve();
			this.disposePromise = this.performDisposeAsync();
			return this.disposePromise;
		}
		async performEmergencyReset() {
			const failures = [];
			const abortReason = new DOMException("Core emergency reset aborted active work.", "AbortError");
			await Promise.all([
				this.runEmergencyStep(failures, "Operation abort failed during emergency reset.", () => this.plugins.abortOperationsForHost(abortReason)),
				this.runEmergencyStep(failures, "Document mutation abort failed during emergency reset.", () => this.documentMutations.abortActive(abortReason)),
				this.runEmergencyStep(failures, "Geometry mutation abort failed during emergency reset.", () => this.geometry.abortActive(abortReason))
			]);
			await this.runEmergencyStep(failures, "Tool exit failed during emergency reset.", () => this.plugins.exitActiveToolForHost());
			const canvas = this.canvas;
			if (canvas) await this.runEmergencyStep(failures, "Canvas disposal failed during emergency reset.", () => canvas.dispose());
			this.clearRuntimeReferences();
			await this.runEmergencyStep(failures, "Plugin scope disposal failed during emergency reset.", () => this.plugins.dispose());
			await this.runEmergencyStep(failures, "Snapshot reset failed during emergency reset.", () => this.snapshots.reset());
			await this.runEmergencyStep(failures, "Memento reset failed during emergency reset.", () => this.mementos.reset());
			await this.runEmergencyStep(failures, "Document mutation reset failed during emergency reset.", () => this.documentMutations.reset());
			await this.runEmergencyStep(failures, "Geometry mutation reset failed during emergency reset.", () => this.geometry.reset());
			this.geometryRevision = 0;
			this.loadSequence = 0;
			this.latestLoadSequence = 0;
			this.stateLoadSequence = 0;
			this.layoutMode = this.options.layoutMode;
			this.disposePromise = null;
			if (failures.length > 0) {
				const failure = new CoreRuntimeError(`[ImageEditor] Emergency reset cleanup failed in ${failures.length} step(s).`, {
					code: "EMERGENCY_RESET_CLEANUP_ERROR",
					cause: Object.freeze([...failures]),
					behavior: "lifecycle"
				});
				await this.failEmergencyReset(failure);
			}
			try {
				await this.replayInstallationPlan();
			} catch (error) {
				this.recordDiagnostic(error, "Plugin replay failed during emergency reset.");
				await this.failEmergencyReset(error);
			}
			this.lifecycle.recoverFault();
		}
		async runEmergencyStep(failures, message, task) {
			try {
				await task();
			} catch (error) {
				failures.push(error);
				this.recordDiagnostic(error, message);
			}
		}
		async failEmergencyReset(cause) {
			await this.disposeAfterEmergencyFailure();
			throw new EmergencyResetError(this.getDiagnostics(), cause);
		}
		async disposeAfterEmergencyFailure() {
			if (!this.lifecycle.beginDisposal()) return;
			const cleanupSteps = [
				["Plugin cleanup failed after emergency reset.", () => this.plugins.dispose()],
				["Geometry cleanup failed after emergency reset.", () => this.geometry.dispose()],
				["Document mutation cleanup failed after emergency reset.", () => this.documentMutations.dispose()],
				["Snapshot cleanup failed after emergency reset.", () => this.snapshots.dispose()],
				["Export registry cleanup failed after emergency reset.", () => this.exportContributors.dispose()],
				["Memento cleanup failed after emergency reset.", () => this.mementos.dispose()],
				["Transient registry cleanup failed after emergency reset.", () => this.transientObjects.dispose()],
				["External object registry cleanup failed after emergency reset.", () => this.externalObjects.dispose()],
				["Object property registry cleanup failed after emergency reset.", () => this.objectProperties.dispose()],
				["State Slice cleanup failed after emergency reset.", () => this.slices.dispose()]
			];
			for (const [message, cleanup] of cleanupSteps) try {
				await cleanup();
			} catch (error) {
				this.recordDiagnostic(error, message);
			}
			this.clearRuntimeReferences();
			this.lifecycle.completeDisposal();
			this.clearPluginApiHandles();
		}
		createPluginManager() {
			const manager = new PluginManager({
				warningSink: (warning) => this.reportWarning(warning.cause, warning.message),
				errorSink: (error) => this.reportError(error, "Plugin lifecycle failed."),
				hostCapabilities: [
					{
						token: CORE_ENVIRONMENT_CAPABILITY,
						implementation: this.createEnvironmentPort()
					},
					{
						token: CORE_STATUS_CAPABILITY,
						implementation: this.createStatusPort()
					},
					{
						token: CORE_DIAGNOSTICS_CAPABILITY,
						implementation: this.createDiagnosticsPort()
					},
					{
						token: CORE_PRESENTATION_CAPABILITY,
						implementation: this.createPresentationPort()
					},
					{
						token: FABRIC_RUNTIME_CAPABILITY,
						implementation: this.createFabricRuntimePort(),
						requiredPermission: "fabric:objects"
					},
					{
						token: CANVAS_READ_CAPABILITY,
						implementation: this.createCanvasReadPort(),
						requiredPermission: "fabric:canvas-read"
					},
					{
						token: BASE_IMAGE_READ_CAPABILITY,
						implementation: this.createBaseImageReadPort()
					},
					{
						token: BASE_IMAGE_INFO_CAPABILITY,
						implementation: this.createBaseImageInfoPort()
					},
					{
						token: IMAGE_RESOURCE_POLICY_CAPABILITY,
						implementation: this.createImageResourcePolicyPort()
					},
					{
						token: RENDER_REQUEST_CAPABILITY,
						implementation: this.createRenderRequestPort()
					},
					{
						token: CANVAS_RESIZE_CAPABILITY,
						implementation: this.createCanvasResizePort()
					},
					{
						token: RASTER_MUTATION_CAPABILITY,
						implementation: this.createRasterMutationPort(),
						requiredPermission: "core:raster-mutation"
					},
					{
						token: SNAPSHOT_REGISTRATION_CAPABILITY,
						implementation: this.createSnapshotRegistrationPort()
					},
					{
						token: MEMENTO_HISTORY_CAPABILITY,
						implementation: this.createMementoHistoryPort()
					},
					{
						token: GEOMETRY_MUTATION_CAPABILITY,
						implementation: this.geometry,
						requiredPermission: "core:geometry-participant"
					},
					{
						token: DOCUMENT_MUTATION_CAPABILITY,
						implementation: this.documentMutations
					},
					{
						token: EXPORT_CONTRIBUTION_CAPABILITY,
						implementation: this.exportContributors,
						requiredPermission: "core:export-contributor"
					}
				]
			});
			manager.registerHostOperation({
				id: "core:load-image",
				mode: "busy",
				conflictDomains: ["image-decode"],
				reentrancy: "replace"
			});
			manager.registerHostOperation({
				id: "core:commit-load-image",
				mode: "mutation",
				conflictDomains: DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS,
				reentrancy: "queue"
			});
			manager.registerHostOperation({
				id: "core:load-state",
				mode: "mutation",
				conflictDomains: DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS,
				reentrancy: "reject"
			});
			manager.registerHostOperation({
				id: "core:export",
				mode: "read",
				conflictDomains: [
					"document",
					"base-image",
					"overlay",
					"export",
					"state"
				],
				reentrancy: "queue"
			});
			return manager;
		}
		async rollbackInitialization(failure, pluginInitializationStarted, pluginInitializationCompleted) {
			const cleanupErrors = this.getInitializationCleanupErrors(failure);
			const canvas = this.canvas;
			if (pluginInitializationCompleted) try {
				await this.plugins.dispose();
			} catch (error) {
				cleanupErrors.push(error);
			}
			this.clearRuntimeReferences();
			if (canvas) try {
				await canvas.dispose();
			} catch (error) {
				cleanupErrors.push(error);
			}
			if (pluginInitializationStarted && cleanupErrors.length === 0) try {
				await this.replayInstallationPlan();
			} catch (error) {
				cleanupErrors.push(error);
			}
			return Object.freeze(cleanupErrors);
		}
		getInitializationCleanupErrors(failure) {
			return failure instanceof PluginLifecycleError ? [...failure.cleanupErrors] : [];
		}
		async replayInstallationPlan() {
			var _a, _b;
			const manager = this.createPluginManager();
			try {
				for (const planned of this.installationPlan) manager.installSync(planned.definition);
				const replayedApis = /* @__PURE__ */ new Map();
				for (const pluginId of this.pluginApiHandles.keys()) {
					const api = manager.getById(pluginId);
					if (!isProxyablePluginApi(api)) throw new CoreRuntimeError(`[ImageEditor] Replayed Plugin "${pluginId}" did not return a stable object API.`, {
						code: "PLUGIN_API_REPLAY_INCOMPATIBLE",
						behavior: "lifecycle"
					});
					replayedApis.set(pluginId, api);
				}
				for (const [pluginId, api] of replayedApis) (_a = this.pluginApiHandles.get(pluginId)) === null || _a === void 0 || _a.handle.assertCompatible(api);
				for (const [pluginId, api] of replayedApis) (_b = this.pluginApiHandles.get(pluginId)) === null || _b === void 0 || _b.handle.update(api);
			} catch (error) {
				await manager.dispose().catch(() => void 0);
				throw error;
			}
			this.plugins = manager;
		}
		publishPluginApi(pluginId, api) {
			if (!isProxyablePluginApi(api)) return api;
			const existing = this.pluginApiHandles.get(pluginId);
			if (existing) {
				existing.handle.update(api);
				return existing.handle.api;
			}
			const lifecycle = this.lifecycle;
			const handle = new StablePluginApiHandle(pluginId, api, (operation) => {
				if (lifecycle.current !== "disposing") lifecycle.assertAvailable(operation);
			});
			this.pluginApiHandles.set(pluginId, Object.freeze({ handle }));
			return handle.api;
		}
		clearPluginApiHandles() {
			for (const { handle } of this.pluginApiHandles.values()) handle.clear();
		}
		createEnvironmentPort() {
			return Object.freeze({
				options: this.options,
				isDisposed: () => this.isDisposingOrDisposed(),
				reportWarning: (error, message) => this.reportWarning(error, message),
				reportError: (error, message) => this.reportError(error, message)
			});
		}
		createStatusPort() {
			return Object.freeze({ isDisposed: () => this.isDisposingOrDisposed() });
		}
		createDiagnosticsPort() {
			return Object.freeze({
				reportWarning: (error, message) => this.reportWarning(error, message),
				reportError: (error, message) => this.reportError(error, message)
			});
		}
		createPresentationPort() {
			const resolveLayoutMode = () => this.layoutMode;
			return Object.freeze({
				backgroundColor: this.options.backgroundColor,
				get layoutMode() {
					return resolveLayoutMode();
				}
			});
		}
		createFabricRuntimePort() {
			return Object.freeze({ fabric: this.fabric });
		}
		createCanvasReadPort() {
			return Object.freeze({
				getCanvas: () => this.canvas,
				requireCanvas: (operation) => this.requireCanvasForPlugin(operation)
			});
		}
		createBaseImageReadPort() {
			return Object.freeze({
				getBaseImage: () => this.baseImage,
				...this.createBaseImageInfoPort()
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
						height: (_d = (_c = this.canvas) === null || _c === void 0 ? void 0 : _c.getHeight()) !== null && _d !== void 0 ? _d : 0
					});
				},
				getImageInfo: () => this.getImageInfo(),
				isImageLoaded: () => this.isImageLoaded()
			});
		}
		createImageResourcePolicyPort() {
			return Object.freeze({ getImageResourcePolicy: () => Object.freeze({
				maxInputBytes: this.options.maxInputBytes,
				maxInputPixels: this.options.maxInputPixels,
				imageLoadTimeoutMs: this.options.imageLoadTimeoutMs,
				maxExportPixels: this.options.maxExportPixels,
				maxExportDimension: this.options.maxExportDimension
			}) });
		}
		createRenderRequestPort() {
			return Object.freeze({ requestRender: () => this.requestRender() });
		}
		createCanvasResizePort() {
			return Object.freeze({ resizeCanvas: (width, height) => this.setCanvasSize(width, height) });
		}
		createRasterMutationPort() {
			return Object.freeze({ replaceBaseImage: (context, image, replacementOptions) => {
				var _a;
				this.documentMutations.assertContextActive(context);
				const canvas = this.requireCanvasForPlugin("replace the base image");
				if (this.baseImage && this.baseImage !== image) canvas.remove(this.baseImage);
				markBaseImage(image);
				if (!canvas.getObjects().includes(image)) canvas.add(image);
				canvas.sendObjectToBack(image);
				this.baseImage = image;
				this.imageLoaded = true;
				this.baseImageScale = positiveFinite(replacementOptions === null || replacementOptions === void 0 ? void 0 : replacementOptions.baseScale, 1);
				this.imageMimeType = (_a = replacementOptions === null || replacementOptions === void 0 ? void 0 : replacementOptions.mimeType) !== null && _a !== void 0 ? _a : this.imageMimeType;
				this.geometryRevision += 1;
				this.updatePlaceholder();
			} });
		}
		createSnapshotRegistrationPort() {
			return Object.freeze({
				registerSlice: (definition) => this.slices.register(definition),
				registerObjectProperties: (registration) => this.objectProperties.register(registration),
				registerTransientObject: (owner, predicate) => this.transientObjects.register(owner, predicate),
				registerExternalObject: (owner, predicate) => this.externalObjects.register(owner, predicate)
			});
		}
		createMementoHistoryPort() {
			return Object.freeze({
				captureMemento: () => this.mementos.capture(),
				restoreMemento: (memento, options) => this.mementos.restore(memento, options),
				registerHistoryProvider: (owner, provider) => this.history.register(owner, provider),
				reportFatal: (error) => this.enterFaulted(error)
			});
		}
		computeLayout(image) {
			var _a, _b;
			const scrollbarSize = measureScrollbarSize((_b = (_a = this.containerElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : null);
			const viewport = this.viewportCache.measure(this.containerElement, {
				width: this.options.canvasWidth,
				height: this.options.canvasHeight
			}, scrollbarSize);
			const strategy = selectLayoutStrategy(this.layoutMode);
			const width = Number(image.width) || 0;
			const height = Number(image.height) || 0;
			if (strategy === "fit") return computeFitLayout(width, height, this.options.canvasWidth, this.options.canvasHeight, viewport);
			if (strategy === "cover") return computeCoverLayout(width, height, this.options.canvasWidth, this.options.canvasHeight, viewport, scrollbarSize);
			return computeExpandLayout(width, height, viewport);
		}
		captureGeometry() {
			const canvas = this.requireCanvas("capture base-image geometry");
			const image = this.baseImage;
			if (!image) return Object.freeze({
				matrix: IDENTITY_AFFINE_MATRIX,
				boundingBox: Object.freeze({
					left: 0,
					top: 0,
					width: 0,
					height: 0
				}),
				canvasWidth: canvas.getWidth(),
				canvasHeight: canvas.getHeight(),
				revision: this.geometryRevision
			});
			image.setCoords();
			const bounds = image.getBoundingRect();
			return Object.freeze({
				matrix: toAffineMatrix(image.calcTransformMatrix()),
				boundingBox: Object.freeze({
					left: bounds.left,
					top: bounds.top,
					width: bounds.width,
					height: bounds.height
				}),
				canvasWidth: canvas.getWidth(),
				canvasHeight: canvas.getHeight(),
				revision: this.geometryRevision
			});
		}
		finalizeBaseImageGeometry() {
			var _a, _b, _c, _d, _e, _f;
			const image = this.baseImage;
			const canvas = this.canvas;
			if (!image || !canvas) return;
			image.setCoords();
			const bounds = image.getBoundingRect();
			const scrollbarSize = measureScrollbarSize((_d = (_b = (_a = this.containerElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : (_c = this.canvasElement) === null || _c === void 0 ? void 0 : _c.ownerDocument) !== null && _d !== void 0 ? _d : null);
			const viewport = this.viewportCache.measure(this.containerElement, {
				width: this.options.canvasWidth,
				height: this.options.canvasHeight
			}, scrollbarSize);
			if (bounds.width <= viewport.width + .5 && bounds.height <= viewport.height + .5) this.setCanvasSize(Math.max(1, viewport.width - 1), Math.max(1, viewport.height - 1));
			else if (this.layoutMode === "fit" || this.layoutMode === "cover") {
				const size = computeScrollableCanvasSize(bounds.width, bounds.height, viewport, scrollbarSize);
				this.setCanvasSize(size.width, size.height);
			} else this.setCanvasSize(Math.max(viewport.width, Math.ceil(bounds.width)), Math.max(viewport.height, Math.ceil(bounds.height)));
			image.set({
				left: ((_e = image.left) !== null && _e !== void 0 ? _e : 0) - bounds.left,
				top: ((_f = image.top) !== null && _f !== void 0 ? _f : 0) - bounds.top
			});
			image.setCoords();
			canvas.sendObjectToBack(image);
			canvas.renderAll();
		}
		setCanvasSize(width, height) {
			if (!this.canvas) return;
			const nextWidth = Math.max(1, Math.ceil(width));
			const nextHeight = Math.max(1, Math.ceil(height));
			this.assertRasterBudget(nextWidth, nextHeight);
			applyCanvasDimensions(this.canvas, nextWidth, nextHeight, this.containerElement);
		}
		isInputRasterWithinBudget(width, height) {
			return isRasterAllocationWithinBudget(width, height, {
				maxDimension: this.options.maxExportDimension,
				maxPixels: Math.min(this.options.maxInputPixels, this.options.maxExportPixels)
			});
		}
		assertRasterBudget(width, height, multiplier = 1) {
			if (!isRasterAllocationWithinBudget(width, height, {
				maxDimension: this.options.maxExportDimension,
				maxPixels: this.options.maxExportPixels
			}, multiplier)) throw new CoreRuntimeError("[ImageEditor] Dimensions exceed the configured budget.");
		}
		async runExport(options) {
			var _a, _b, _c, _d;
			this.assertReady("export an image");
			const operation = this.plugins.beginOperationForHost("core:export");
			try {
				const canvas = this.requireCanvas("exportImageBase64");
				const multiplier = positiveFinite(options.multiplier, this.options.exportMultiplier);
				const format = (_a = options.format) !== null && _a !== void 0 ? _a : "png";
				const quality = Math.max(0, Math.min(1, (_b = options.quality) !== null && _b !== void 0 ? _b : .92));
				let left = 0;
				let top = 0;
				let width = canvas.getWidth();
				let height = canvas.getHeight();
				if (((_c = options.area) !== null && _c !== void 0 ? _c : "image") === "image") {
					if (!this.baseImage) throw new CoreRuntimeError("[ImageEditor] No image is loaded.");
					this.baseImage.setCoords();
					const bounds = this.baseImage.getBoundingRect();
					left = bounds.left;
					top = bounds.top;
					width = bounds.width;
					height = bounds.height;
				}
				this.assertRasterBudget(width, height, multiplier);
				this.assertRasterBudget(canvas.getWidth(), canvas.getHeight());
				const exportElement = (_d = this.canvasElement) === null || _d === void 0 ? void 0 : _d.ownerDocument.createElement("canvas");
				if (!exportElement) throw new CoreRuntimeError("[ImageEditor] Export requires an initialized Canvas.");
				const exportCanvas = new this.fabric.StaticCanvas(exportElement, {
					width: canvas.getWidth(),
					height: canvas.getHeight(),
					backgroundColor: this.options.backgroundColor,
					renderOnAddRemove: false
				});
				try {
					if (this.baseImage) {
						const clonedBaseImage = await this.baseImage.clone();
						exportCanvas.add(clonedBaseImage);
						exportCanvas.sendObjectToBack(clonedBaseImage);
					}
					await this.exportContributors.render({
						canvas: exportCanvas,
						options
					});
					exportCanvas.renderAll();
					return exportCanvas.toDataURL({
						format,
						quality,
						multiplier,
						left,
						top,
						width,
						height
					});
				} finally {
					await exportCanvas.dispose();
				}
			} finally {
				await operation.dispose();
			}
		}
		async emitDocumentCommitted(descriptor) {
			var _a, _b, _c, _d;
			if (descriptor.kind === "geometry") {
				await ((_a = this.plugins) === null || _a === void 0 ? void 0 : _a.emitCommitted("geometry:committed", descriptor.result));
				return;
			}
			if (descriptor.operationId === "core:commit-load-image" && isCoreImageInfo(descriptor.result)) {
				await ((_b = this.plugins) === null || _b === void 0 ? void 0 : _b.emitCommitted("image:loaded", descriptor.result));
				return;
			}
			if (descriptor.operationId === "core:load-state") {
				await ((_c = this.plugins) === null || _c === void 0 ? void 0 : _c.emitCommitted("state:loaded", { schemaVersion: 3 }));
				return;
			}
			await ((_d = this.plugins) === null || _d === void 0 ? void 0 : _d.emitCommitted("document:committed", descriptor));
		}
		assertCurrentLoad(sequence, signal) {
			if (signal.aborted) throw loadAbortReason(signal, "Image load was aborted.");
			if (sequence !== this.latestLoadSequence) throw loadAbortError("Image load result is stale.");
		}
		requireCanvas(operation) {
			this.assertReady(operation);
			if (!this.canvas) throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} without Canvas.`);
			return this.canvas;
		}
		requireCanvasForImageLoad(operation) {
			if (!this.initialImageLoadActive || this.lifecycle.current !== "initializing") return this.requireCanvas(operation);
			if (!this.canvas) throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} without Canvas.`);
			return this.canvas;
		}
		requireCanvasForPlugin(operation) {
			if (this.lifecycle.current !== "initializing") this.lifecycle.assertOperational(operation);
			if (!this.canvas) throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} without Canvas.`);
			return this.canvas;
		}
		requestRender() {
			var _a;
			if (this.lifecycle.current !== "disposed") (_a = this.canvas) === null || _a === void 0 || _a.requestRenderAll();
		}
		updatePlaceholder() {
			if (this.placeholderElement) this.placeholderElement.hidden = this.baseImage !== null;
		}
		reportWarning(error, message) {
			reportSafely(this.options.onWarning, error, message, console.warn);
		}
		reportError(error, message) {
			reportSafely(this.options.onError, error, message, console.error);
		}
		enterFaulted(error) {
			const state = this.lifecycle.current;
			if (state === "disposed" || state === "disposing") return;
			if (state === "initialized") this.lifecycle.failRuntime();
			else if (state !== "faulted") {
				this.recordDiagnostic(error, `A fatal error occurred while Core was ${state}.`);
				return;
			}
			this.plugins.suspendOperationsForHost(new EditorFaultedError("run an operation")).catch((suspensionError) => {
				this.recordDiagnostic(suspensionError, "Faulted operation suspension failed.");
			});
			this.recordDiagnostic(error);
			this.reportError(error, "Core entered the faulted lifecycle state.");
		}
		recordDiagnostic(error, message) {
			const classification = classifyCoreError(error);
			let errorCode;
			if (error && typeof error === "object") try {
				errorCode = Reflect.get(error, "code");
			} catch {
				errorCode = void 0;
			}
			const code = typeof errorCode === "string" ? errorCode : "UNCLASSIFIED_CORE_ERROR";
			const diagnostic = Object.freeze({
				...classification,
				timestamp: Date.now(),
				code,
				message: message !== null && message !== void 0 ? message : error instanceof Error ? error.message : String(error),
				cause: error instanceof CoreRuntimeError && error.cause !== void 0 ? error.cause : error
			});
			this.diagnostics.push(diagnostic);
			if (this.diagnostics.length > MAX_RETAINED_DIAGNOSTICS) this.diagnostics.splice(0, this.diagnostics.length - MAX_RETAINED_DIAGNOSTICS);
			return diagnostic;
		}
		assertReady(operation) {
			this.lifecycle.assertOperational(operation);
			if (!this.canvas) throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} without Canvas.`);
		}
		assertDocumentMutationOperational(operation) {
			if (this.initialImageLoadActive && this.lifecycle.current === "initializing") return;
			this.lifecycle.assertOperational(operation);
		}
		assertNotDisposed(operation) {
			this.lifecycle.assertAvailable(operation);
		}
		isDisposingOrDisposed() {
			return this.lifecycle.current === "disposing" || this.lifecycle.current === "disposed";
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
				() => this.snapshots.dispose(),
				() => this.exportContributors.dispose(),
				() => this.mementos.dispose(),
				() => this.transientObjects.dispose(),
				() => this.externalObjects.dispose(),
				() => this.objectProperties.dispose(),
				() => this.slices.dispose()
			]) try {
				await Promise.resolve(cleanup());
			} catch (error) {
				errors.push(error);
			}
			const canvas = this.canvas;
			try {
				this.clearRuntimeReferences();
			} catch (error) {
				errors.push(error);
			}
			if (canvas) try {
				await canvas.dispose();
			} catch (error) {
				errors.push(error);
			}
			this.completeDisposal(errors, "Async disposal");
		}
		completeDisposal(errors, label) {
			this.lifecycle.completeDisposal();
			this.clearPluginApiHandles();
			if (errors.length > 0) throw new CoreRuntimeError(`[ImageEditor] ${label} completed with ${errors.length} cleanup error(s).`, {
				code: "CORE_DISPOSE_ERROR",
				cause: Object.freeze(errors)
			});
		}
		observeDetachedDisposal(disposal) {
			disposal.catch((error) => {
				this.recordDiagnostic(error, "Detached Core disposal completed with cleanup failures.");
				this.reportError(error, "Detached Core disposal completed with cleanup failures.");
			});
		}
	};

//#endregion
//#region dist/esm/sdk/visible-raster-bake.js
	const VISIBLE_RASTER_BAKE_CAPABILITY = createCapabilityToken("raster:visible-bake", "1.0.0");

//#endregion
//#region dist/esm/sdk/plugin-definition.js
	function definePlugin(definition) {
		if (typeof definition !== "object" || definition === null) throw new InvalidPluginDefinitionError("Plugin definition must be an object.");
		if (!isPluginRef(definition.ref)) throw new InvalidPluginDefinitionError("Plugin definition must use a PluginRef created by definePluginRef().");
		if (typeof definition.setup !== "function") throw new InvalidPluginDefinitionError(`Plugin "${definition.ref.id}" must define setup().`, definition.ref.id);
		if (definition.setupMode !== "sync") throw new InvalidPluginDefinitionError(`Plugin "${definition.ref.id}" must declare setupMode "sync" for the public SDK.`, definition.ref.id);
		const manifest = validatePluginManifest(definition.ref, definition.manifest);
		return markCanonicalPluginDefinition(Object.freeze({
			...definition,
			manifest
		}));
	}

//#endregion
exports.AFFINE_EPSILON = AFFINE_EPSILON;
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
exports.CoreRuntimeError = CoreRuntimeError;
exports.DEFAULT_SNAPSHOT_LIMITS = DEFAULT_SNAPSHOT_LIMITS;
exports.DOCUMENT_MUTATION_CAPABILITY = DOCUMENT_MUTATION_CAPABILITY;
exports.DocumentMutationInvariantError = DocumentMutationInvariantError;
exports.EXPORT_CONTRIBUTION_CAPABILITY = EXPORT_CONTRIBUTION_CAPABILITY;
exports.EditorAlreadyInitializedError = EditorAlreadyInitializedError;
exports.EditorDisposedError = EditorDisposedError;
exports.EditorDisposingError = EditorDisposingError;
exports.EditorFaultedError = EditorFaultedError;
exports.EditorInitializationInProgressError = EditorInitializationInProgressError;
exports.EmergencyResetError = EmergencyResetError;
exports.FABRIC_RUNTIME_CAPABILITY = FABRIC_RUNTIME_CAPABILITY;
exports.GEOMETRY_MUTATION_CAPABILITY = GEOMETRY_MUTATION_CAPABILITY;
exports.IDENTITY_AFFINE_MATRIX = IDENTITY_AFFINE_MATRIX;
exports.IMAGE_RESOURCE_POLICY_CAPABILITY = IMAGE_RESOURCE_POLICY_CAPABILITY;
exports.ImageEditorCore = ImageEditorCore;
exports.MEMENTO_HISTORY_CAPABILITY = MEMENTO_HISTORY_CAPABILITY;
exports.MementoService = MementoService;
exports.ObjectPropertyRegistry = ObjectPropertyRegistry;
exports.PluginApiVersionError = PluginApiVersionError;
exports.PluginBatchInstallError = PluginBatchInstallError;
exports.PluginDefinitionAlreadyBoundError = PluginDefinitionAlreadyBoundError;
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
exports.SnapshotService = SnapshotService;
exports.SnapshotValidationError = SnapshotValidationError;
exports.SnapshotVersionUnsupportedError = SnapshotVersionUnsupportedError;
exports.StateSliceRegistry = StateSliceRegistry;
exports.TransientObjectRegistry = TransientObjectRegistry;
exports.VISIBLE_RASTER_BAKE_CAPABILITY = VISIBLE_RASTER_BAKE_CAPABILITY;
exports.affineDeterminant = affineDeterminant;
exports.applyAffineToPoint = applyAffineToPoint;
exports.approximatelyEqualAffine = approximatelyEqualAffine;
exports.assertAffineMatrix = assertAffineMatrix;
exports.assertSafeImmutableReference = assertSafeImmutableReference;
exports.classifyCoreError = classifyCoreError;
exports.cloneStateValue = cloneStateValue;
exports.composePlugins = composePlugins;
exports.computeAffineDelta = computeAffineDelta;
exports.createCapabilityToken = createCapabilityToken;
exports.createDisposable = createDisposable;
exports.definePlugin = definePlugin;
exports.definePluginRef = definePluginRef;
exports.disposeInReverseSync = disposeInReverseSync;
exports.hasAffineReflection = hasAffineReflection;
exports.invertAffine = invertAffine;
exports.isDangerousStateKey = isDangerousStateKey;
exports.isFiniteAffineMatrix = isFiniteAffineMatrix;
exports.isRuntimeIdentifier = isRuntimeIdentifier;
exports.isValidSemVer = isValidSemVer;
exports.multiplyAffine = multiplyAffine;
exports.observePromise = observePromise;
exports.sanitizeAffineMatrix = sanitizeAffineMatrix;
exports.transformRectBounds = transformRectBounds;
exports.validatePluginManifest = validatePluginManifest;
});
//# sourceMappingURL=image-editor.core.umd.js.map