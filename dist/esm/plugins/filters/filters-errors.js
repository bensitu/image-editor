export class FilterDefinitionError extends TypeError {
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
export class FiltersPreviewMissingError extends Error {
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
export class FiltersPluginDisposedError extends Error {
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
export class FilterImplementationError extends Error {
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
export class FilterBakeValidationError extends Error {
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
//# sourceMappingURL=filters-errors.js.map