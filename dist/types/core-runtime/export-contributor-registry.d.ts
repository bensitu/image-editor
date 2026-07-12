import type * as FabricNS from 'fabric';
import { type Disposable, type MaybePromise } from '../plugin-kernel/index.js';
import type { CoreExportOptions } from './public-types.js';
export interface CoreExportRenderContext {
    readonly canvas: FabricNS.StaticCanvas;
    readonly options: Readonly<CoreExportOptions>;
}
export interface CoreExportContributor {
    readonly id: string;
    readonly order: number;
    isEnabled(options: Readonly<CoreExportOptions>): boolean;
    render(context: CoreExportRenderContext): MaybePromise<void>;
}
export declare class ExportContributorRegistry implements Disposable {
    private readonly contributors;
    private registrationSequence;
    private disposed;
    register(owner: string, contributor: CoreExportContributor): Disposable;
    render(context: CoreExportRenderContext): Promise<void>;
    dispose(): void;
    private assertActive;
}
