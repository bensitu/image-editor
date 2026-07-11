/** Renderer-neutral warning and error reporting contracts. */
export interface PluginKernelWarning {
    readonly code: string;
    readonly message: string;
    readonly pluginId?: string;
    readonly cause?: unknown;
    readonly details?: Readonly<Record<string, string | number | boolean | null | undefined>>;
}
export type PluginWarningSink = (warning: PluginKernelWarning) => void;
export type PluginErrorSink = (error: unknown) => void;
export declare function reportErrorSafely(errorSink: PluginErrorSink | undefined, error: unknown): void;
export declare function reportWarningSafely(warningSink: PluginWarningSink | undefined, errorSink: PluginErrorSink | undefined, warning: PluginKernelWarning): void;
