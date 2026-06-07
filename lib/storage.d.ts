import type { Project, Scan } from './types';
export declare function listProjects(): Project[];
export declare function getProject(id: string): Project | undefined;
export declare function getProjectByPath(folderPath: string): Project | undefined;
export declare function saveProject(project: Project): void;
export declare function listScans(projectId: string): Scan[];
export declare function getScan(id: string): Scan | undefined;
export declare function saveScan(scan: Scan): void;
export declare function deleteScan(id: string): void;
export declare function generateId(): string;
//# sourceMappingURL=storage.d.ts.map