import type { ResolvedImageEditorCoreOptions } from './public-types.js';

import type { CoreDiagnosticsPort, CoreStatusPort } from '../sdk/core-capabilities.js';
import { createCapabilityToken } from '../plugin-kernel/capability-token.js';

export * from '../sdk/core-capabilities.js';

export interface CoreEnvironmentPort extends CoreStatusPort, CoreDiagnosticsPort {
    readonly options: ResolvedImageEditorCoreOptions;
}

export const CORE_ENVIRONMENT_CAPABILITY = createCapabilityToken<CoreEnvironmentPort>(
    'core.environment',
    '1.0.0',
);
