// GET /api/scan/[id] — Get a single scan by ID

import { NextRequest, NextResponse } from 'next/server';
import { getScan } from '@/lib/storage';
import type { ApiResponse, Scan } from '@/lib/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const scan = getScan(id);

    if (!scan) {
      return NextResponse.json<ApiResponse<never>>(
        { ok: false, error: 'Scan not found' },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<Scan>>({
      ok: true,
      data: scan,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json<ApiResponse<never>>(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const scan = getScan(id);

    if (!scan) {
      return NextResponse.json<ApiResponse<never>>(
        { ok: false, error: 'Scan not found' },
        { status: 404 }
      );
    }

    const { deleteScan } = await import('@/lib/storage');
    deleteScan(id);

    return NextResponse.json<ApiResponse<{ deleted: boolean }>>({
      ok: true,
      data: { deleted: true },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json<ApiResponse<never>>(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
