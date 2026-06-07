import type { ProjectSnapshot } from './types';
import { generateText } from './ai';
import { execSync } from 'child_process';

export interface ChangeSummary {
  recentCommits: { hash: string; message: string; author: string; date: string }[];
  aiSummary: string | null;
  generatedAt: string;
}

export function getRecentCommits(
  folderPath: string,
  count: number = 10,
): ChangeSummary['recentCommits'] {
  try {
    const output = execSync(
      `git log --oneline --format="%h|%s|%an|%ar" -${count}`,
      { cwd: folderPath, encoding: 'utf-8', timeout: 10000 },
    );
    return output
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, ...rest] = line.split('|');
        const message = rest.slice(0, -2).join('|');
        const author = rest[rest.length - 2] ?? '';
        const date = rest[rest.length - 1] ?? '';
        return { hash, message, author, date };
      });
  } catch {
    return [];
  }
}

export async function generateChangeSummary(
  folderPath: string,
  snapshot: ProjectSnapshot,
): Promise<ChangeSummary> {
  const commits = getRecentCommits(folderPath);
  if (commits.length === 0) {
    return {
      recentCommits: [],
      aiSummary: null,
      generatedAt: new Date().toISOString(),
    };
  }

  const commitLog = commits
    .map((c) => `- ${c.hash}: ${c.message} (${c.author}, ${c.date})`)
    .join('\n');

  const prompt = `Summarize the recent changes for the project "${snapshot.repoName}" (${snapshot.language}, ${snapshot.framework}):

Recent commits:
${commitLog}

Write a brief, practical summary (2-3 sentences) of what changed. Focus on:
1. What areas of the codebase were modified
2. Any new features, fixes, or refactors
3. Impact on AI agents reading the context

Keep it concise — this will be included in AI context files.`;

  try {
    const aiSummary = await generateText(
      prompt,
      'You are a senior engineer summarizing code changes for AI agents. Be concise and practical.',
      { maxTokens: 500, temperature: 0.3 },
    );
    return {
      recentCommits: commits,
      aiSummary,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      recentCommits: commits,
      aiSummary: null,
      generatedAt: new Date().toISOString(),
    };
  }
}