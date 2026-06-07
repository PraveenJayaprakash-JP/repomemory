"use strict";
// RepoMemory — File-based JSON persistence
// Stores all data in .repomemory/ directory within the user's home or repo
Object.defineProperty(exports, "__esModule", { value: true });
exports.listProjects = listProjects;
exports.getProject = getProject;
exports.getProjectByPath = getProjectByPath;
exports.saveProject = saveProject;
exports.listScans = listScans;
exports.getScan = getScan;
exports.saveScan = saveScan;
exports.deleteScan = deleteScan;
exports.generateId = generateId;
const fs_1 = require("fs");
const path_1 = require("path");
const STORAGE_DIR = (0, path_1.join)(process.cwd(), '.repomemory');
const STORE_FILE = (0, path_1.join)(STORAGE_DIR, 'store.json');
function getDefaultStore() {
    return { version: 1, projects: [], scans: [] };
}
function ensureDir() {
    if (!(0, fs_1.existsSync)(STORAGE_DIR)) {
        (0, fs_1.mkdirSync)(STORAGE_DIR, { recursive: true });
    }
}
function readStore() {
    ensureDir();
    if (!(0, fs_1.existsSync)(STORE_FILE)) {
        const initial = getDefaultStore();
        writeStore(initial);
        return initial;
    }
    try {
        const raw = (0, fs_1.readFileSync)(STORE_FILE, 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return getDefaultStore();
    }
}
function writeStore(store) {
    ensureDir();
    (0, fs_1.writeFileSync)(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
}
// ─── Project CRUD ────────────────────────────────────────
function listProjects() {
    const store = readStore();
    return store.projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
function getProject(id) {
    const store = readStore();
    return store.projects.find(p => p.id === id);
}
function getProjectByPath(folderPath) {
    const store = readStore();
    return store.projects.find(p => p.folderPath === folderPath);
}
function saveProject(project) {
    const store = readStore();
    const idx = store.projects.findIndex(p => p.id === project.id);
    if (idx >= 0) {
        store.projects[idx] = project;
    }
    else {
        store.projects.push(project);
    }
    writeStore(store);
}
// ─── Scan CRUD ───────────────────────────────────────────
function listScans(projectId) {
    const store = readStore();
    return store.scans
        .filter(s => s.projectId === projectId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
function getScan(id) {
    const store = readStore();
    return store.scans.find(s => s.id === id);
}
function saveScan(scan) {
    const store = readStore();
    const idx = store.scans.findIndex(s => s.id === scan.id);
    if (idx >= 0) {
        store.scans[idx] = scan;
    }
    else {
        store.scans.push(scan);
    }
    writeStore(store);
}
function deleteScan(id) {
    const store = readStore();
    store.scans = store.scans.filter(s => s.id !== id);
    writeStore(store);
}
// ─── Utility ─────────────────────────────────────────────
function generateId() {
    return crypto.randomUUID();
}
//# sourceMappingURL=storage.js.map