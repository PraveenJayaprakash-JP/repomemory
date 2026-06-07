// POST /api/generate — Generate AI context pack for a scan

import { NextRequest, NextResponse } from 'next/server';
import { getScan, saveScan, listScans } from '@/lib/storage';
import { generateContextPack } from '@/lib/generator';
import { detectContextChanges } from '@/lib/drift';
import type { ApiResponse, GeneratedFile, AgentType } from '@/lib/types';

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

    // Validate agents if provided
    const agentList: AgentType[] | undefined = Array.isArray(agents) && agents.length > 0
      ? agents as AgentType[]
      : undefined;

    // Smart regeneration: detect changes from previous scan
    let changes: ReturnType<typeof detectContextChanges> | undefined;
    let existingFiles: GeneratedFile[] | undefined;

    const previousScans = listScans(scan.projectId);
    const previousScan = previousScans.find(s => s.id !== scanId);
    if (previousScan) {
      changes = detectContextChanges(scan.snapshot, previousScan.snapshot);
      existingFiles = previousScan.generatedFiles.length > 0
        ? previousScan.generatedFiles
        : undefined;
    }

    // Generate the context pack (smart regen if changes detected)
    const files = await generateContextPack(scan.snapshot, {
      agents: agentList,
      changes,
      existingFiles,
    });

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
