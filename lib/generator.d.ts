import type { ProjectSnapshot, GeneratedFile } from './types';
export interface GenerateOptions {
    /** Override model per file type */
    claudeMdModel?: string;
    claudeIgnoreModel?: string;
    commandModel?: string;
    hookModel?: string;
}
/** Generate the full context pack for a scanned repo */
export declare function generateContextPack(snapshot: ProjectSnapshot, options?: GenerateOptions): Promise<GeneratedFile[]>;
//# sourceMappingURL=generator.d.ts.map