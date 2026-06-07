import type { ProjectSnapshot, DriftEvent } from './types';
export interface DriftCheckResult {
    hasDrift: boolean;
    changedFiles: {
        path: string;
        change: 'modified' | 'added' | 'deleted';
    }[];
    staleContextFiles: string[];
}
/** Compare current snapshot against previous to detect drift */
export declare function checkDrift(current: ProjectSnapshot, previous: ProjectSnapshot): DriftCheckResult;
/** Create a DriftEvent from check results */
export declare function createDriftEvent(projectId: string, result: DriftCheckResult): DriftEvent;
//# sourceMappingURL=drift.d.ts.map