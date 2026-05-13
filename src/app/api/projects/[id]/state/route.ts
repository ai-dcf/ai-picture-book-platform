import { NextResponse } from 'next/server';
import { initDatabase } from '@/lib/db';
import { ProjectRepository } from '@/lib/db/repositories/project-repository';
import type { PictureBookState } from '@/types/picturebook';

// Initialize database on first request
let dbInitialized = false;

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    if (!dbInitialized) {
      initDatabase();
      dbInitialized = true;
    }

    const body = await request.json();
    const { state }: { state: PictureBookState } = body;
    
    if (!state || !state.projectInfo) {
      return NextResponse.json(
        { success: false, error: 'Invalid state data' },
        { status: 400 }
      );
    }

    const existing = ProjectRepository.getProjectById(id);
    if (existing) {
      ProjectRepository.saveFullState(id, state);
    } else {
      ProjectRepository.createProjectWithState('default-user', state);
    }

    const historyEntry = {
      ...state.projectInfo,
      createdAt: state.projectInfo.createdAt || Date.now(),
      updatedAt: Date.now(),
      thumbnailUrl: state.pages.find(p => p.imageUrl)?.imageUrl ?? null,
    };

    return NextResponse.json({
      success: true,
      data: historyEntry,
    });
  } catch (error) {
    console.error('Failed to save project state:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save project state' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    if (!dbInitialized) {
      initDatabase();
      dbInitialized = true;
    }

    const state = ProjectRepository.loadFullState(id);
    
    if (!state) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: state,
    });
  } catch (error) {
    console.error('Failed to load project state:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load project state' },
      { status: 500 }
    );
  }
}
