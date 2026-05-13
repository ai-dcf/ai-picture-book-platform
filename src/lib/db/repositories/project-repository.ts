import { getDb, withTransaction } from '@/lib/db';
import type { DbProject, DbProjectHistory, ParsedProject } from '@/lib/db/types';
import type { ProjectHistoryEntry } from '@/modules/project-history/types';
import { v4 as uuidv4 } from 'uuid';

function parseProject(dbProject: DbProject): ParsedProject {
  return {
    ...dbProject,
    stage_statuses: JSON.parse(dbProject.stage_statuses),
  };
}

function toProjectHistoryEntry(
  dbProject: DbProject,
  dbHistory?: DbProjectHistory | null
): ProjectHistoryEntry {
  return {
    projectId: dbProject.id,
    title: dbProject.title,
    targetAge: dbProject.target_age,
    pageCount: dbProject.page_count,
    artStyle: dbProject.art_style,
    aspectRatio: dbProject.aspect_ratio,
    currentStage: dbProject.current_stage,
    projectStatus: dbProject.project_status,
    thumbnailUrl: dbHistory?.thumbnail_blob 
      ? `data:image/jpeg;base64,${dbHistory.thumbnail_blob.toString('base64')}` 
      : null,
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
      1: 'inactive',
      2: 'inactive',
      3: 'inactive',
      4: 'inactive',
      5: 'inactive',
    });

    db.prepare(
      `INSERT INTO projects (
        id, user_id, title, target_age, page_count, art_style, 
        aspect_ratio, project_status, current_stage, stage_statuses, 
        save_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      projectId,
      userId,
      title,
      '3-6',
      24,
      '水彩温暖风',
      '3:4',
      'draft',
      1,
      defaultStageStatuses,
      'saved',
      now,
      now
    );

    db.prepare(
      `INSERT INTO project_history (id, project_id, user_id, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?)`
    ).run(uuidv4(), projectId, userId, now, now);

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
      `SELECT p.*, ph.thumbnail_blob 
       FROM projects p 
       LEFT JOIN project_history ph ON p.id = ph.project_id 
       WHERE p.user_id = ? 
       ORDER BY p.updated_at DESC`
    ).all(userId) as (DbProject & { thumbnail_blob: Buffer | null })[];

    return projects.map(p => toProjectHistoryEntry(
      { ...p, user_id: p.user_id, created_at: p.created_at, updated_at: p.updated_at },
      { id: '', project_id: p.id, user_id: p.user_id, thumbnail_blob: p.thumbnail_blob, created_at: p.created_at, updated_at: p.updated_at }
    ));
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
      
      db.prepare(
        `UPDATE project_history SET updated_at = ? WHERE project_id = ?`
      ).run(now, entry.projectId);
    } else {
      const defaultStageStatuses = JSON.stringify({
        1: 'inactive',
        2: 'inactive',
        3: 'inactive',
        4: 'inactive',
        5: 'inactive',
      });

      db.prepare(
        `INSERT INTO projects (
          id, user_id, title, target_age, page_count, art_style, 
          aspect_ratio, project_status, current_stage, stage_statuses, 
          save_status, created_at, updated_at
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
        'saved',
        entry.createdAt || now,
        entry.updatedAt || now
      );

      db.prepare(
        `INSERT INTO project_history (id, project_id, user_id, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?)`
      ).run(uuidv4(), entry.projectId, 'default-user', entry.createdAt || now, entry.updatedAt || now);
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
};
