// RepoMemory — Project Brain: persistent knowledge store
// Stores architecture decisions, lessons learned, tech debt, and known bugs
// in .repomemory/brain/ directory within the repo

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { generateId } from './storage';

// ─── Types ──────────────────────────────────────────────────

export type BrainEntryType = 'decision' | 'lesson' | 'techdebt' | 'bug';

export interface BrainEntry {
  id: string;
  type: BrainEntryType;
  title: string;
  description: string;
  date: string;
  author?: string;
  tags: string[];
  references: string[]; // file paths or commit hashes
}

export interface ProjectBrain {
  decisions: BrainEntry[];
  lessons: BrainEntry[];
  techDebt: BrainEntry[];
  bugs: BrainEntry[];
}

// ─── Constants ──────────────────────────────────────────────

const BRAIN_DIR_NAME = 'brain';

const TYPE_TO_KEY: Record<BrainEntryType, keyof ProjectBrain> = {
  decision: 'decisions',
  lesson: 'lessons',
  techdebt: 'techDebt',
  bug: 'bugs',
};

const TYPE_TO_FILE: Record<BrainEntryType, string> = {
  decision: 'decisions.json',
  lesson: 'lessons.json',
  techdebt: 'techdebt.json',
  bug: 'bugs.json',
};

// ─── Helpers ───────────────────────────────────────────────

function brainDir(folderPath: string): string {
  return join(folderPath, '.repomemory', BRAIN_DIR_NAME);
}

function ensureBrainDir(folderPath: string): void {
  const dir = brainDir(folderPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function readEntries<T>(filePath: string): T[] {
  if (!existsSync(filePath)) return [];
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function writeEntries(filePath: string, entries: unknown[]): void {
  writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf-8');
}

// ─── Public API ────────────────────────────────────────────

/** Load all brain entries from .repomemory/brain/ directory */
export function loadBrain(folderPath: string): ProjectBrain {
  ensureBrainDir(folderPath);
  const dir = brainDir(folderPath);

  return {
    decisions: readEntries<BrainEntry>(join(dir, TYPE_TO_FILE.decision)),
    lessons: readEntries<BrainEntry>(join(dir, TYPE_TO_FILE.lesson)),
    techDebt: readEntries<BrainEntry>(join(dir, TYPE_TO_FILE.techdebt)),
    bugs: readEntries<BrainEntry>(join(dir, TYPE_TO_FILE.bug)),
  };
}

/** Save all brain entries to .repomemory/brain/ */
export function saveBrain(folderPath: string, brain: ProjectBrain): void {
  ensureBrainDir(folderPath);
  const dir = brainDir(folderPath);

  writeEntries(join(dir, TYPE_TO_FILE.decision), brain.decisions);
  writeEntries(join(dir, TYPE_TO_FILE.lesson), brain.lessons);
  writeEntries(join(dir, TYPE_TO_FILE.techdebt), brain.techDebt);
  writeEntries(join(dir, TYPE_TO_FILE.bug), brain.bugs);
}

/** Add a single entry to the brain (auto-generates ID and date if missing) */
export function addEntry(folderPath: string, entry: Omit<BrainEntry, 'id' | 'date'> & { id?: string; date?: string }): BrainEntry {
  const brain = loadBrain(folderPath);
  const fullEntry: BrainEntry = {
    id: entry.id ?? generateId(),
    type: entry.type,
    title: entry.title,
    description: entry.description,
    date: entry.date ?? new Date().toISOString(),
    author: entry.author,
    tags: entry.tags ?? [],
    references: entry.references ?? [],
  };

  const key = TYPE_TO_KEY[fullEntry.type];
  brain[key].push(fullEntry);
  saveBrain(folderPath, brain);
  return fullEntry;
}

/** Remove an entry by ID from the brain */
export function removeEntry(folderPath: string, entryId: string): boolean {
  const brain = loadBrain(folderPath);
  let found = false;

  for (const key of Object.values(TYPE_TO_KEY)) {
    const idx = brain[key].findIndex((e) => e.id === entryId);
    if (idx >= 0) {
      brain[key].splice(idx, 1);
      found = true;
      break;
    }
  }

  if (found) {
    saveBrain(folderPath, brain);
  }
  return found;
}

/** Get entries filtered by type */
export function getEntriesByType(folderPath: string, type: BrainEntryType): BrainEntry[] {
  const brain = loadBrain(folderPath);
  return brain[TYPE_TO_KEY[type]];
}

/** Simple text search across all brain entries */
export function searchBrain(folderPath: string, query: string): BrainEntry[] {
  const brain = loadBrain(folderPath);
  const q = query.toLowerCase();
  const all = [...brain.decisions, ...brain.lessons, ...brain.techDebt, ...brain.bugs];

  if (!q.trim()) return all;

  return all.filter((entry) => {
    const searchable = [
      entry.title,
      entry.description,
      entry.author ?? '',
      ...entry.tags,
      ...entry.references,
    ].join(' ').toLowerCase();
    return searchable.includes(q);
  });
}

/** Generate a markdown summary of all brain entries for agent context */
export function generateBrainSummary(brain: ProjectBrain): string {
  const lines: string[] = ['# Project Brain Summary\n'];

  const sections: { title: string; entries: BrainEntry[]; emoji: string }[] = [
    { title: 'Architecture Decisions', entries: brain.decisions, emoji: '🏗️' },
    { title: 'Lessons Learned', entries: brain.lessons, emoji: '💡' },
    { title: 'Technical Debt', entries: brain.techDebt, emoji: '⚠️' },
    { title: 'Known Bugs', entries: brain.bugs, emoji: '🐛' },
  ];

  for (const section of sections) {
    lines.push(`## ${section.emoji} ${section.title}\n`);
    if (section.entries.length === 0) {
      lines.push('_No entries recorded yet._\n');
    } else {
      for (const entry of section.entries) {
        lines.push(`### ${entry.title}\n`);
        lines.push(`- **Date:** ${entry.date}`);
        if (entry.author) lines.push(`- **Author:** ${entry.author}`);
        if (entry.tags.length > 0) lines.push(`- **Tags:** ${entry.tags.join(', ')}`);
        if (entry.references.length > 0) lines.push(`- **References:** ${entry.references.join(', ')}`);
        lines.push(`\n${entry.description}\n`);
      }
    }
  }

  const total = brain.decisions.length + brain.lessons.length + brain.techDebt.length + brain.bugs.length;
  lines.push(`---\n_Total: ${total} entries_`);

  return lines.join('\n');
}