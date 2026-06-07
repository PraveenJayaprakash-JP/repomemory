// GET /api/scans?projectId=xxx — List all scans for a project

import { NextRequest, NextResponse } from 'next/server';
import { getProject, listScans } from '@/lib/storage';
import type { ApiResponse } from '@/lib/types';

interface ScanSummary {
  id: string;
  createdAt: string;
  totalScore: number;
  badge: string;
  fileCount: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json<ApiResponse<never>>(
        { ok: false, error: 'Missing required query param: projectId' },
        { status: 400 }
      );
    }

    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json<ApiResponse<never>>(
        { ok: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    const scans = listScans(projectId);

    // Sort ascending by date for timeline display
    const sorted = [...scans].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const summaries: ScanSummary[] = sorted.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      totalScore: s.audit.totalScore,
      badge: s.audit.badge,
      fileCount: s.snapshot.fileCount,
    }));

    return NextResponse.json<
      ApiResponse<{ project: typeof project; scans: ScanSummary[] }>
    >({
      ok: true,
      data: { project, scans: summaries },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json<ApiResponse<never>>(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}