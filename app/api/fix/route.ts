// POST /api/fix — Generate + apply context pack in one call

import { NextRequest, NextResponse } from 'next/server';
import { getScan, saveScan } from '@/lib/storage';
import { generateContextPack } from '@/lib/generator';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import type { ApiResponse } from '@/lib/types';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scanId, agents } = body;

    if (!scanId || typeof scanId !== 'string') {
      return NextResponse.json<ApiResponse<never>>(
        { ok: false, error: 'scanId is required' },
        { status: 400 }
      );
    }

    const scan = getScan(scanId);
    if (!scan) {
      return NextResponse.json<ApiResponse<never>>(
        { ok: false, error: 'Scan not found' },
        { status: 404 }
      );
    }

    // Generate
    const opts: any = {};
    if (Array.isArray(agents)) opts.agents = agents;
    const files = await generateContextPack(scan.snapshot, opts);

    // Save generated files
    scan.generatedFiles = files;
    saveScan(scan);

    // Apply to repo
    const repoPath = scan.snapshot.folderPath;
    const written: string[] = [];
    for (const file of files) {
      const fullPath = join(repoPath, file.fileName);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, file.content, 'utf-8');
      written.push(file.fileName);
      // Mark as applied
      file.applied = true;
    }
    saveScan(scan);

    return NextResponse.json<ApiResponse<{ written: string[]; fileCount: number }>>({
      ok: true,
      data: { written, fileCount: files.length },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json<ApiResponse<never>>(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
