// GET /api/projects — List all scanned projects

import { NextResponse } from 'next/server';
import { listProjects, listScans } from '@/lib/storage';
import type { ApiResponse, Project } from '@/lib/types';

export async function GET() {
  try {
    const projects = listProjects();

    // Attach latest scan info for each project
    const enriched = projects.map((p) => {
      const scans = listScans(p.id);
      const latestScan = scans[0] ?? null;
      return {
        ...p,
        scanCount: scans.length,
        latestScanId: latestScan?.id ?? null,
        latestScore: latestScan?.audit.totalScore ?? p.lastScore,
      };
    });

    return NextResponse.json<ApiResponse<Project[]>>({
      ok: true,
      data: enriched as unknown as Project[],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json<ApiResponse<never>>(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
