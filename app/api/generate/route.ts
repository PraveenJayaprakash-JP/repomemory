// POST /api/generate — Generate AI context pack for a scan

import { NextRequest, NextResponse } from 'next/server';
import { getScan, saveScan } from '@/lib/storage';
import { generateContextPack } from '@/lib/generator';
import type { ApiResponse, GeneratedFile } from '@/lib/types';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scanId } = body;

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

    // Generate the context pack
    const files = await generateContextPack(scan.snapshot);

    // Save generated files to scan
    scan.generatedFiles = files;
    saveScan(scan);

    return NextResponse.json<ApiResponse<{ files: GeneratedFile[] }>>({
      ok: true,
      data: { files },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error generating context pack';
    return NextResponse.json<ApiResponse<never>>(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
