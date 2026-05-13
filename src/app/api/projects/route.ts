import { NextResponse } from 'next/server';
import { initDatabase } from '@/lib/db';
import { ProjectRepository } from '@/lib/db/repositories/project-repository';

// Initialize database on first request
let dbInitialized = false;

export async function GET() {
  try {
    if (!dbInitialized) {
      initDatabase();
      dbInitialized = true;
    }

    // Use default user ID for demo
    const userId = 'default-user';
    const projects = ProjectRepository.getProjectsByUserId(userId);

    return NextResponse.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error('Failed to load projects:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load projects' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!dbInitialized) {
      initDatabase();
      dbInitialized = true;
    }

    const body = await request.json();
    const savedProject = ProjectRepository.saveProjectHistoryEntry(body);

    return NextResponse.json({
      success: true,
      data: savedProject,
    });
  } catch (error) {
    console.error('Failed to save project:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save project' },
      { status: 500 }
    );
  }
}
