import { getDb, withTransaction } from '@/lib/db';
import type { DbProject, ParsedProject } from '@/lib/db/types';
import type { ProjectHistoryEntry } from '@/modules/project-history/types';
import type { PictureBookState } from '@/types/picturebook';
import { v4 as uuidv4 } from 'uuid';

function parseProject(dbProject: DbProject): ParsedProject {
  return {
    ...dbProject,
    stage_statuses: JSON.parse(dbProject.stage_statuses),
  };
}

function toProjectHistoryEntry(dbProject: DbProject): ProjectHistoryEntry {
  return {
    projectId: dbProject.id,
    title: dbProject.title,
    targetAge: dbProject.target_age,
    pageCount: dbProject.page_count,
    artStyle: dbProject.art_style,
    aspectRatio: dbProject.aspect_ratio,
    saveStatus: 'saved',
    currentStage: dbProject.current_stage,
    projectStatus: dbProject.project_status,
    thumbnailUrl: undefined,
    createdAt: dbProject.created_at,
    updatedAt: dbProject.updated_at,
  };
}

export const ProjectRepository = {
  createProject(userId: string, title: string): ParsedProject {
    const db = getDb();
    const now = Date.now();
    const projectId = uuidv4();
    
    const defaultStageStatuses = JSON.stringify({
      1: 'in-progress',
      2: 'idle',
      3: 'idle',
      4: 'idle',
      5: 'idle',
    });

    db.prepare(
      `INSERT INTO projects (
        id, user_id, title, target_age, page_count, art_style, 
        aspect_ratio, project_status, current_stage, stage_statuses, 
        full_state, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      projectId,
      userId,
      title,
      'auto',
      'auto',
      'auto',
      '16:9',
      'draft',
      1,
      defaultStageStatuses,
      '{}',
      now,
      now
    );

    return this.getProjectById(projectId)!;
  },

  getProjectById(projectId: string): ParsedProject | null {
    const db = getDb();
    const result = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    return result ? parseProject(result as DbProject) : null;
  },

  getProjectsByUserId(userId: string): ProjectHistoryEntry[] {
    const db = getDb();
    const projects = db.prepare(
      `SELECT * FROM projects 
       WHERE user_id = ? 
       ORDER BY updated_at DESC`
    ).all(userId) as DbProject[];

    return projects.map(p => toProjectHistoryEntry(p));
  },

  saveProjectHistoryEntry(entry: ProjectHistoryEntry): ProjectHistoryEntry {
    const db = getDb();
    const now = Date.now();
    
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(entry.projectId);
    
    if (existing) {
      db.prepare(
        `UPDATE projects 
         SET title = ?, target_age = ?, page_count = ?, art_style = ?, 
             aspect_ratio = ?, current_stage = ?, project_status = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        entry.title,
        entry.targetAge,
        entry.pageCount,
        entry.artStyle,
        entry.aspectRatio,
        entry.currentStage,
        entry.projectStatus,
        now,
        entry.projectId
      );
    } else {
      const defaultStageStatuses = JSON.stringify({
        1: 'in-progress',
        2: 'idle',
        3: 'idle',
        4: 'idle',
        5: 'idle',
      });

      db.prepare(
        `INSERT INTO projects (
          id, user_id, title, target_age, page_count, art_style, 
          aspect_ratio, project_status, current_stage, stage_statuses, 
          full_state, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        entry.projectId,
        'default-user',
        entry.title,
        entry.targetAge,
        entry.pageCount,
        entry.artStyle,
        entry.aspectRatio,
        entry.projectStatus,
        entry.currentStage,
        defaultStageStatuses,
        '{}',
        entry.createdAt || now,
        entry.updatedAt || now
      );
    }

    const updatedProject = this.getProjectById(entry.projectId);
    return {
      ...entry,
      updatedAt: now,
      title: updatedProject?.title || entry.title,
    };
  },

  deleteProject(projectId: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
    return result.changes > 0;
  },

  saveFullState(projectId: string, state: PictureBookState): void {
    const db = getDb();
    const now = Date.now();
    
    db.prepare(
      `UPDATE projects 
       SET 
         title = ?,
         target_age = ?,
         page_count = ?,
         art_style = ?,
         aspect_ratio = ?,
         project_status = ?,
         current_stage = ?,
         stage_statuses = ?,
         full_state = ?,
         updated_at = ?
       WHERE id = ?`
    ).run(
      state.projectInfo.title,
      state.projectInfo.targetAge,
      state.projectInfo.pageCount,
      state.projectInfo.artStyle,
      state.projectInfo.aspectRatio,
      state.projectInfo.projectStatus,
      state.currentStage,
      JSON.stringify(state.stageStatuses),
      JSON.stringify(state),
      now,
      projectId
    );
  },

  loadFullState(projectId: string): PictureBookState | null {
    const db = getDb();
    const result = db.prepare('SELECT full_state FROM projects WHERE id = ?').get(projectId) as { full_state: string } | undefined;
    
    if (!result || !result.full_state) {
      return null;
    }
    
    try {
      return JSON.parse(result.full_state) as PictureBookState;
    } catch {
      return null;
    }
  },

  createProjectWithState(userId: string, state: PictureBookState): ParsedProject {
    const db = getDb();
    const now = Date.now();
    const projectId = state.projectInfo.projectId || uuidv4();
    
    db.prepare(
      `INSERT INTO projects (
        id, user_id, title, target_age, page_count, art_style, 
        aspect_ratio, project_status, current_stage, stage_statuses, 
        full_state, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      projectId,
      userId,
      state.projectInfo.title,
      state.projectInfo.targetAge,
      state.projectInfo.pageCount,
      state.projectInfo.artStyle,
      state.projectInfo.aspectRatio,
      state.projectInfo.projectStatus,
      state.currentStage,
      JSON.stringify(state.stageStatuses),
      JSON.stringify(state),
      now,
      now
    );

    const created = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as DbProject;
    return parseProject(created);
  },
};
