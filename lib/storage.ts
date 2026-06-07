// RepoMemory — File-based JSON persistence
// Stores all data in .repomemory/ directory within the user's home or repo

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { RepoMemoryStore, Project, Scan } from './types';

const STORAGE_DIR = join(process.cwd(), '.repomemory');
const STORE_FILE = join(STORAGE_DIR, 'store.json');

function getDefaultStore(): RepoMemoryStore {
  return { version: 1, projects: [], scans: [] };
}

function ensureDir(): void {
  if (!existsSync(STORAGE_DIR)) {
    mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

function readStore(): RepoMemoryStore {
  ensureDir();
  if (!existsSync(STORE_FILE)) {
    const initial = getDefaultStore();
    writeStore(initial);
    return initial;
  }
  try {
    const raw = readFileSync(STORE_FILE, 'utf-8');
    return JSON.parse(raw) as RepoMemoryStore;
  } catch {
    return getDefaultStore();
  }
}

function writeStore(store: RepoMemoryStore): void {
  ensureDir();
  writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

// ─── Project CRUD ────────────────────────────────────────

export function listProjects(): Project[] {
  const store = readStore();
  return store.projects.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getProject(id: string): Project | undefined {
  const store = readStore();
  return store.projects.find(p => p.id === id);
}

export function getProjectByPath(folderPath: string): Project | undefined {
  const store = readStore();
  return store.projects.find(p => p.folderPath === folderPath);
}

export function saveProject(project: Project): void {
  const store = readStore();
  const idx = store.projects.findIndex(p => p.id === project.id);
  if (idx >= 0) {
    store.projects[idx] = project;
  } else {
    store.projects.push(project);
  }
  writeStore(store);
}

// ─── Scan CRUD ───────────────────────────────────────────

export function listScans(projectId: string): Scan[] {
  const store = readStore();
  return store.scans
    .filter(s => s.projectId === projectId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getScan(id: string): Scan | undefined {
  const store = readStore();
  return store.scans.find(s => s.id === id);
}

export function saveScan(scan: Scan): void {
  const store = readStore();
  const idx = store.scans.findIndex(s => s.id === scan.id);
  if (idx >= 0) {
    store.scans[idx] = scan;
  } else {
    store.scans.push(scan);
  }
  writeStore(store);
}

export function deleteScan(id: string): void {
  const store = readStore();
  store.scans = store.scans.filter(s => s.id !== id);
  writeStore(store);
}

// ─── Utility ─────────────────────────────────────────────

export function generateId(): string {
  return crypto.randomUUID();
}
