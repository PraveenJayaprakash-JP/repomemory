// POST /api/apply — Write generated files to the repo

import { NextRequest, NextResponse } from 'next/server';
import { getScan } from '@/lib/storage';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import type { ApiResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scanId, files } = body;

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

    if (scan.generatedFiles.length === 0) {
      return NextResponse.json<ApiResponse<never>>(
        { ok: false, error: 'No generated files. Run generation first.' },
        { status: 400 }
      );
    }

    const selectedFiles = Array.isArray(files) && files.length > 0
      ? scan.generatedFiles.filter((f) => files.includes(f.fileName))
      : scan.generatedFiles;

    if (selectedFiles.length === 0) {
      return NextResponse.json<ApiResponse<never>>(
        { ok: false, error: 'No matching files to apply' },
        { status: 400 }
      );
    }

    const repoPath = scan.snapshot.folderPath;
    const written: string[] = [];

    for (const file of selectedFiles) {
      const fullPath = join(repoPath, file.fileName);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, file.content, 'utf-8');
      written.push(file.fileName);
    }

    return NextResponse.json<ApiResponse<{ written: string[]; repoPath: string }>>({
      ok: true,
      data: { written, repoPath },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json<ApiResponse<never>>(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
