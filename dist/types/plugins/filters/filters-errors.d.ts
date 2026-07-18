/** Error raised when a public Filter definition cannot be validated. */
export declare class FilterDefinitionError extends TypeError {
    readonly path: string;
    readonly code = "FILTER_DEFINITION_INVALID";
    constructor(message: string, path?: string);
}
/** Error raised when commit is requested without an active preview. */
export declare class FiltersPreviewMissingError extends Error {
    readonly code = "FILTERS_PREVIEW_MISSING";
    constructor();
}
/** Error raised when a Filters API is used after Plugin disposal. */
export declare class FiltersPluginDisposedError extends Error {
    readonly code = "FILTERS_PLUGIN_DISPOSED";
    constructor(operation: string);
}
/** Error raised when the active Fabric build cannot apply a supported Filter. */
export declare class FilterImplementationError extends Error {
    readonly code = "FILTER_IMPLEMENTATION_UNAVAILABLE";
    readonly cause?: unknown;
    constructor(filterType: string, cause?: unknown);
}
/** Error raised when a requested Raster bake violates the Core resource policy. */
export declare class FilterBakeValidationError extends Error {
    readonly code = "FILTER_BAKE_INVALID";
    readonly cause?: unknown;
    constructor(message: string, cause?: unknown);
}
