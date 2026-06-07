// GET /api/changelog — Get recent git commits with AI summary

import { NextRequest, NextResponse } from 'next/server';
import { generateChangeSummary, getRecentCommits } from '@/lib/changelog';
import { scanRepository } from '@/lib/scanner';
import type { ApiResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderPath = searchParams.get('folderPath');

    if (!folderPath) {
      return NextResponse.json<ApiResponse<never>>(
        { ok: false, error: 'folderPath is required' },
        { status: 400 },
      );
    }

    // Try to get commits — returns empty array if not a git repo
    const commits = getRecentCommits(folderPath);

    if (commits.length === 0) {
      return NextResponse.json<
        ApiResponse<{ recentCommits: typeof commits; aiSummary: null; generatedAt: string }>
      >({
        ok: true,
        data: {
          recentCommits: [],
          aiSummary: null,
          generatedAt: new Date().toISOString(),
        },
      });
    }

    // Get snapshot for AI summary context
    let snapshot;
    try {
      snapshot = await scanRepository(folderPath);
    } catch {
      // If scan fails, still return commits without AI summary
      return NextResponse.json<
        ApiResponse<{ recentCommits: typeof commits; aiSummary: null; generatedAt: string }>
      >({
        ok: true,
        data: {
          recentCommits: commits,
          aiSummary: null,
          generatedAt: new Date().toISOString(),
        },
      });
    }

    const result = await generateChangeSummary(folderPath, snapshot);

    return NextResponse.json<ApiResponse<typeof result>>({
      ok: true,
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate changelog';
    return NextResponse.json<ApiResponse<never>>(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}