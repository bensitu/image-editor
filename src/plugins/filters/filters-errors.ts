/** Error raised when a public Filter definition cannot be validated. */
export class FilterDefinitionError extends TypeError {
    readonly code = 'FILTER_DEFINITION_INVALID';

    constructor(
        message: string,
        readonly path = '$',
    ) {
        super(`[ImageEditor] ${message}`);
        this.name = 'FilterDefinitionError';
    }
}

/** Error raised when commit is requested without an active preview. */
export class FiltersPreviewMissingError extends Error {
    readonly code = 'FILTERS_PREVIEW_MISSING';

    constructor() {
        super('[ImageEditor] Cannot commit Filters without definitions or an active preview.');
        this.name = 'FiltersPreviewMissingError';
    }
}

/** Error raised when a Filters API is used after Plugin disposal. */
export class FiltersPluginDisposedError extends Error {
    readonly code = 'FILTERS_PLUGIN_DISPOSED';

    constructor(operation: string) {
        super(`[ImageEditor] Cannot ${operation} after Filters Plugin disposal.`);
        this.name = 'FiltersPluginDisposedError';
    }
}

/** Error raised when the active Fabric build cannot apply a supported Filter. */
export class FilterImplementationError extends Error {
    readonly code = 'FILTER_IMPLEMENTATION_UNAVAILABLE';
    readonly cause?: unknown;

    constructor(filterType: string, cause?: unknown) {
        super(`[ImageEditor] Fabric cannot apply the "${filterType}" Filter.`);
        this.name = 'FilterImplementationError';
        this.cause = cause;
    }
}

/** Error raised when a requested Raster bake violates the Core resource policy. */
export class FilterBakeValidationError extends Error {
    readonly code = 'FILTER_BAKE_INVALID';
    readonly cause?: unknown;

    constructor(message: string, cause?: unknown) {
        super(`[ImageEditor] ${message}`);
        this.name = 'FilterBakeValidationError';
        this.cause = cause;
    }
}
