// POST /api/scan — Scan a repo folder

import { NextRequest, NextResponse } from 'next/server';
import { scanRepository } from '@/lib/scanner';
import { auditContextFiles } from '@/lib/auditor';
import { checkDrift, createDriftEvent } from '@/lib/drift';
import { saveProject, saveScan, getProjectByPath, generateId, listScans } from '@/lib/storage';
import type { Project, Scan, ApiResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { folderPath } = body;

    if (!folderPath || typeof folderPath !== 'string') {
      return NextResponse.json<ApiResponse<never>>(
        { ok: false, error: 'folderPath is required' },
        { status: 400 }
      );
    }

    // Validate path exists (scanner will throw if not)
    // Run scan
    const snapshot = await scanRepository(folderPath);

    // Run audit (all agent context files)
    const audit = auditContextFiles(snapshot);

    // Find or create project
    let project = getProjectByPath(folderPath);
    if (!project) {
      project = {
        id: generateId(),
        folderPath,
        repoName: snapshot.repoName,
        language: snapshot.language,
        framework: snapshot.framework,
        lastScore: audit.totalScore,
        lastScanAt: snapshot.scannedAt,
        createdAt: new Date().toISOString(),
      };
    } else {
      project.lastScore = audit.totalScore;
      project.lastScanAt = snapshot.scannedAt;
      project.language = snapshot.language;
      project.framework = snapshot.framework;
    }
    saveProject(project);

    // Drift detection — compare with previous scan if exists
    const driftEvents: import('@/lib/types').DriftEvent[] = [];
    const previousScans = listScans(project.id);
    if (previousScans.length > 0) {
      const previousSnapshot = previousScans[0].snapshot;
      const driftResult = checkDrift(snapshot, previousSnapshot);
      if (driftResult.hasDrift) {
        const event = createDriftEvent(project.id, driftResult);
        driftEvents.push(event);
      }
    }

    // Save scan
    const scan: Scan = {
      id: generateId(),
      projectId: project.id,
      snapshot,
      audit,
      generatedFiles: [],
      driftEvents,
      createdAt: snapshot.scannedAt,
    };
    saveScan(scan);

    return NextResponse.json<ApiResponse<{ project: Project; scan: Scan }>>({
      ok: true,
      data: { project, scan },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error scanning repo';
    return NextResponse.json<ApiResponse<never>>(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
