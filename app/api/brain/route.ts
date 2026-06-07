// /api/brain — Project Brain API routes
// GET    /api/brain?folderPath=xxx         — load all brain entries
// POST   /api/brain                         — add a new entry
// GET    /api/brain/search?folderPath=xxx&q=query — search entries
// DELETE /api/brain?id=xxx&folderPath=xxx   — remove entry by ID

import { NextRequest, NextResponse } from 'next/server';
import { loadBrain, addEntry, removeEntry, searchBrain, generateBrainSummary } from '@/lib/brain';
import type { BrainEntryType } from '@/lib/brain';
import type { ApiResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderPath = searchParams.get('folderPath');
    const q = searchParams.get('q');
    const summary = searchParams.get('summary');

    if (!folderPath) {
      return NextResponse.json<ApiResponse<never>>(
        { ok: false, error: 'folderPath is required' },
        { status: 400 },
      );
    }

    // Search mode
    if (q !== null) {
      const results = searchBrain(folderPath, q);
      return NextResponse.json<ApiResponse<{ entries: typeof results }>>({
        ok: true,
        data: { entries: results },
      });
    }

    // Summary mode
    if (summary === 'true') {
      const brain = loadBrain(folderPath);
      const md = generateBrainSummary(brain);
      return NextResponse.json<ApiResponse<{ summary: string }>>({
        ok: true,
        data: { summary: md },
      });
    }

    // Default: load all
    const brain = loadBrain(folderPath);
    return NextResponse.json<ApiResponse<{ brain: typeof brain }>>({
      ok: true,
      data: { brain },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json<ApiResponse<never>>(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { folderPath, entry } = body as {
      folderPath: string;
      entry: {
        type: BrainEntryType;
        title: string;
        description: string;
        author?: string;
        tags?: string[];
        references?: string[];
      };
    };

    if (!folderPath || !entry?.type || !entry?.title) {
      return NextResponse.json<ApiResponse<never>>(
        { ok: false, error: 'folderPath, entry.type, and entry.title are required' },
        { status: 400 },
      );
    }

    const validTypes: BrainEntryType[] = ['decision', 'lesson', 'techdebt', 'bug'];
    if (!validTypes.includes(entry.type)) {
      return NextResponse.json<ApiResponse<never>>(
        { ok: false, error: `entry.type must be one of: ${validTypes.join(', ')}` },
        { status: 400 },
      );
    }

    const created = addEntry(folderPath, {
      type: entry.type,
      title: entry.title,
      description: entry.description ?? '',
      author: entry.author,
      tags: entry.tags ?? [],
      references: entry.references ?? [],
    });

    return NextResponse.json<ApiResponse<{ entry: typeof created }>>({
      ok: true,
      data: { entry: created },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json<ApiResponse<never>>(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const folderPath = searchParams.get('folderPath');

    if (!id || !folderPath) {
      return NextResponse.json<ApiResponse<never>>(
        { ok: false, error: 'id and folderPath are required' },
        { status: 400 },
      );
    }

    const removed = removeEntry(folderPath, id);
    if (!removed) {
      return NextResponse.json<ApiResponse<never>>(
        { ok: false, error: 'Entry not found' },
        { status: 404 },
      );
    }

    return NextResponse.json<ApiResponse<{ id: string }>>({
      ok: true,
      data: { id },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json<ApiResponse<never>>(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}