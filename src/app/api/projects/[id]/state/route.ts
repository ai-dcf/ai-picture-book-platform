import { NextResponse } from 'next/server';
import { initDatabase } from '@/lib/db';
import { ProjectRepository } from '@/lib/db/repositories/project-repository';

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
    const { state } = body;
    
    if (!state || !state.projectInfo) {
      return NextResponse.json(
        { success: false, error: 'Invalid state data' },
        { status: 400 }
      );
    }

    // Update project history entry
    const historyEntry = {
      ...state.projectInfo,
      createdAt: state.projectInfo.createdAt || Date.now(),
      updatedAt: Date.now(),
      thumbnailUrl: state.pages.find((p: any) => p.imageUrl)?.imageUrl ?? null,
    };

    const savedProject = ProjectRepository.saveProjectHistoryEntry(historyEntry);

    return NextResponse.json({
      success: true,
      data: savedProject,
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

    // Get project from DB
    const project = ProjectRepository.getProjectById(id);
    
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // For now, we only return basic project info
    // Full state will be loaded from localStorage
    return NextResponse.json({
      success: true,
      data: {
        projectInfo: project,
      },
    });
  } catch (error) {
    console.error('Failed to load project state:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load project state' },
      { status: 500 }
    );
  }
}
