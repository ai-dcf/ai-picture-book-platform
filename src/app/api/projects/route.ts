import { NextResponse } from 'next/server';
import { ProjectRepository } from '@/lib/db/repositories/project-repository';

export async function GET() {
  try {
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
