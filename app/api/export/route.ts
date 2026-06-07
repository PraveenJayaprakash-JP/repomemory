// GET /api/export?scanId=xxx — Download generated context pack as ZIP

import { NextRequest, NextResponse } from 'next/server';
import { getScan } from '@/lib/storage';
import { createContextPackZip } from '@/lib/export';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scanId = searchParams.get('scanId');

    if (!scanId) {
      return NextResponse.json(
        { ok: false, error: 'scanId query parameter is required' },
        { status: 400 }
      );
    }

    const scan = getScan(scanId);
    if (!scan) {
      return NextResponse.json(
        { ok: false, error: 'Scan not found' },
        { status: 404 }
      );
    }

    if (scan.generatedFiles.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No generated files found. Run generation first.' },
        { status: 400 }
      );
    }

    const zipBuffer = await createContextPackZip(scan.generatedFiles);
    const buffer = Buffer.from(zipBuffer);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="repomemory-pack-${scan.projectId}.zip"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error exporting pack';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
