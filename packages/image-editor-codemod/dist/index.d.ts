/**
 * Provides conservative source transformation and filesystem orchestration for the public CLI.
 *
 * Ambiguous integrations are reported without being rewritten.
 *
 * @module
 */
export type CodemodMode = 'write' | 'dry-run' | 'diff';
export interface CodemodFinding {
    readonly file: string;
    readonly line: number;
    readonly column: number;
    readonly code: string;
    readonly message: string;
}
export interface SourceTransformResult {
    readonly code: string;
    readonly changed: boolean;
    readonly unresolved: readonly CodemodFinding[];
}
export interface CodemodFileReport {
    readonly file: string;
    readonly changed: boolean;
    readonly written: boolean;
    readonly unresolved: readonly CodemodFinding[];
    readonly diff?: string;
}
export interface CodemodReport {
    readonly command: 'v2-to-v3';
    readonly mode: CodemodMode;
    readonly result: 'PASS' | 'CHANGES_AVAILABLE' | 'UNRESOLVED';
    readonly filesScanned: number;
    readonly filesChanged: number;
    readonly filesWritten: number;
    readonly unresolvedCount: number;
    readonly files: readonly CodemodFileReport[];
}
export interface RunCodemodOptions {
    readonly mode?: CodemodMode;
    readonly cwd?: string;
}
export declare function transformSource(source: string, fileName?: string): SourceTransformResult;
export declare function runCodemod(targets: readonly string[], options?: RunCodemodOptions): Promise<CodemodReport>;
export declare function writeCodemodReport(filePath: string, report: CodemodReport): Promise<void>;
//# sourceMappingURL=index.d.ts.map