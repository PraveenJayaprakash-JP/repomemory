// POST /api/adr — Generate Architecture Decision Records from git history

import { NextRequest, NextResponse } from 'next/server';
import { scanRepository } from '@/lib/scanner';
import { generateAllAdrs } from '@/lib/adr';
import type { ApiResponse } from '@/lib/types';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { folderPath } = body as { folderPath?: string };

    if (!folderPath || typeof folderPath !== 'string') {
      return NextResponse.json<ApiResponse<never>>(
        { ok: false, error: 'folderPath is required' },
        { status: 400 },
      );
    }

    let snapshot;
    try {
      snapshot = await scanRepository(folderPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to scan repository';
      return NextResponse.json<ApiResponse<never>>(
        { ok: false, error: message },
        { status: 500 },
      );
    }

    const result = await generateAllAdrs(snapshot);

    return NextResponse.json<
      ApiResponse<{ records: typeof result.records; outputPath: string }>
    >({
      ok: true,
      data: {
        records: result.records,
        outputPath: result.outputPath,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate ADRs';
    return NextResponse.json<ApiResponse<never>>(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}