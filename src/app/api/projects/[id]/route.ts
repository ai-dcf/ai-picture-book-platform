import { NextResponse } from 'next/server';
import { initDatabase } from '@/lib/db';
import { ProjectRepository } from '@/lib/db/repositories/project-repository';

// Initialize database on first request
let dbInitialized = false;

type RouteParams = {
  params: Promise<{ id: string }>;
};

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
    console.error('Failed to load project:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load project' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    if (!dbInitialized) {
      initDatabase();
      dbInitialized = true;
    }

    const deleted = ProjectRepository.deleteProject(id);

    if (deleted) {
      return NextResponse.json({
        success: true,
        message: 'Project deleted successfully',
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Failed to delete project:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
