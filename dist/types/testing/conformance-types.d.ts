export type ConformanceAssertionStatus = 'PASS' | 'PASS_WITH_DOWNGRADED_ISOLATION' | 'FAIL' | 'NOT_APPLICABLE' | 'NOT_AVAILABLE';
export interface ConformanceAssertionResult {
    readonly id: string;
    readonly contract: string;
    readonly required: boolean;
    readonly status: ConformanceAssertionStatus;
    readonly message?: string;
    readonly details?: Readonly<Record<string, unknown>>;
}
