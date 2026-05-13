import { getDb, withTransaction } from './db';
import { getNextVersionNumber, generateId } from './utils';
import type {
  BaseImageHistoryEntry,
  CandidateHistoryEntry,
} from '@/types/picturebook';
import type { DbImageVersion, DbSceneCandidateGroup, DbSceneCandidate } from './db/types';

export type ImageOwnerType = 'page' | 'character_base' | 'scene_candidate';

export interface SaveImageOptions {
  ownerType: ImageOwnerType;
  ownerId: string;
  imageBlob: Buffer;
  imageUrl?: string;
  description?: string;
  descriptionEdited?: boolean;
}

export interface ImageVersionResult {
  id: string;
  versionNumber: number;
  imageBlob: Buffer | null;
  imageUrl: string | null;
  description: string | null;
  descriptionEdited: boolean;
  createdAt: number;
}

export interface CandidateGroupResult {
  id: string;
  projectId: string;
  assetId: string;
  createdAt: number;
}

export interface CandidateResult {
  id: string;
  groupId: string;
  indexInGroup: number;
  imageBlob: Buffer | null;
  imageUrl: string | null;
  description: string | null;
  createdAt: number;
}

export function saveImageVersion(options: SaveImageOptions): ImageVersionResult {
  const { ownerType, ownerId, imageBlob, imageUrl, description, descriptionEdited = false } = options;
  const db = getDb();

  const id = generateId();
  const versionNumber = getNextVersionNumber(db, ownerType, ownerId);
  const createdAt = Date.now();

  db.prepare(`
    INSERT INTO image_versions (
      id, owner_type, owner_id, version_number, image_blob, image_url,
      description, description_edited, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, ownerType, ownerId, versionNumber, imageBlob,
    imageUrl || null, description || null, descriptionEdited ? 1 : 0, createdAt
  );

  return {
    id,
    versionNumber,
    imageBlob,
    imageUrl: imageUrl || null,
    description: description || null,
    descriptionEdited,
    createdAt,
  };
}

export function getImageVersions(
  ownerType: ImageOwnerType,
  ownerId: string,
  limit: number = 10
): ImageVersionResult[] {
  const db = getDb();

  const rows = db.prepare(`
    SELECT id, version_number, image_blob, image_url, description,
           description_edited, created_at
    FROM image_versions
    WHERE owner_type = ? AND owner_id = ?
    ORDER BY version_number DESC
    LIMIT ?
  `).all(ownerType, ownerId, limit) as Array<{
    id: string;
    version_number: number;
    image_blob: Buffer;
    image_url: string | null;
    description: string | null;
    description_edited: number;
    created_at: number;
  }>;

  return rows.map(row => ({
    id: row.id,
    versionNumber: row.version_number,
    imageBlob: row.image_blob,
    imageUrl: row.image_url,
    description: row.description,
    descriptionEdited: row.description_edited === 1,
    createdAt: row.created_at,
  }));
}

export function getLatestImageVersion(
  ownerType: ImageOwnerType,
  ownerId: string
): ImageVersionResult | null {
  const versions = getImageVersions(ownerType, ownerId, 1);
  return versions.length > 0 ? versions[0] : null;
}

export function deleteOldImageVersions(
  ownerType: ImageOwnerType,
  ownerId: string,
  keepCount: number = 10
): number {
  const db = getDb();

  const rows = db.prepare(`
    SELECT id FROM image_versions
    WHERE owner_type = ? AND owner_id = ?
    ORDER BY version_number DESC
    LIMIT -1 OFFSET ?
  `).all(ownerType, ownerId, keepCount) as Array<{ id: string }>;

  if (rows.length === 0) return 0;

  const idsToDelete = rows.map(r => r.id);
  const placeholders = idsToDelete.map(() => '?').join(',');

  const result = db.prepare(`
    DELETE FROM image_versions WHERE id IN (${placeholders})
  `).run(...idsToDelete);

  return result.changes;
}

export function updateImageDescription(
  versionId: string,
  description: string,
  edited: boolean = true
): boolean {
  const db = getDb();

  const result = db.prepare(`
    UPDATE image_versions
    SET description = ?, description_edited = ?
    WHERE id = ?
  `).run(description, edited ? 1 : 0, versionId);

  return result.changes > 0;
}

export function createCandidateGroup(
  projectId: string,
  assetId: string
): CandidateGroupResult {
  const db = getDb();

  const id = generateId();
  const createdAt = Date.now();

  db.prepare(`
    INSERT INTO scene_candidate_groups (id, project_id, asset_id, created_at)
    VALUES (?, ?, ?, ?)
  `).run(id, projectId, assetId, createdAt);

  return { id, projectId, assetId, createdAt };
}

export function addCandidateToGroup(
  groupId: string,
  indexInGroup: number,
  imageBlob: Buffer,
  imageUrl?: string,
  description?: string
): CandidateResult {
  const db = getDb();

  const id = generateId();
  const createdAt = Date.now();

  db.prepare(`
    INSERT INTO scene_candidates (
      id, group_id, index_in_group, image_blob, image_url, description, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, groupId, indexInGroup, imageBlob,
    imageUrl || null, description || null, createdAt
  );

  return {
    id,
    groupId,
    indexInGroup,
    imageBlob,
    imageUrl: imageUrl || null,
    description: description || null,
    createdAt,
  };
}

export function getCandidateGroup(groupId: string): CandidateGroupResult | null {
  const db = getDb();

  const row = db.prepare(`
    SELECT id, project_id, asset_id, created_at
    FROM scene_candidate_groups
    WHERE id = ?
  `).get(groupId) as {
    id: string;
    project_id: string;
    asset_id: string;
    created_at: number;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    projectId: row.project_id,
    assetId: row.asset_id,
    createdAt: row.created_at,
  };
}

export function getCandidateGroupsByAsset(
  projectId: string,
  assetId: string
): CandidateGroupResult[] {
  const db = getDb();

  const rows = db.prepare(`
    SELECT id, project_id, asset_id, created_at
    FROM scene_candidate_groups
    WHERE project_id = ? AND asset_id = ?
    ORDER BY created_at DESC
  `).all(projectId, assetId) as Array<{
    id: string;
    project_id: string;
    asset_id: string;
    created_at: number;
  }>;

  return rows.map(row => ({
    id: row.id,
    projectId: row.project_id,
    assetId: row.asset_id,
    createdAt: row.created_at,
  }));
}

export function getCandidatesByGroup(groupId: string): CandidateResult[] {
  const db = getDb();

  const rows = db.prepare(`
    SELECT id, group_id, index_in_group, image_blob, image_url, description, created_at
    FROM scene_candidates
    WHERE group_id = ?
    ORDER BY index_in_group ASC
  `).all(groupId) as Array<{
    id: string;
    group_id: string;
    index_in_group: number;
    image_blob: Buffer;
    image_url: string | null;
    description: string | null;
    created_at: number;
  }>;

  return rows.map(row => ({
    id: row.id,
    groupId: row.group_id,
    indexInGroup: row.index_in_group,
    imageBlob: row.image_blob,
    imageUrl: row.image_url,
    description: row.description,
    createdAt: row.created_at,
  }));
}

export function deleteCandidateGroup(groupId: string): boolean {
  const db = getDb();

  const result = db.prepare(`
    DELETE FROM scene_candidate_groups WHERE id = ?
  `).run(groupId);

  return result.changes > 0;
}

export function deleteOldCandidateGroups(
  projectId: string,
  assetId: string,
  keepCount: number = 10
): number {
  const groups = getCandidateGroupsByAsset(projectId, assetId);

  if (groups.length <= keepCount) return 0;

  const groupsToDelete = groups.slice(keepCount);
  const idsToDelete = groupsToDelete.map(g => g.id);
  const placeholders = idsToDelete.map(() => '?').join(',');

  const db = getDb();
  const result = db.prepare(`
    DELETE FROM scene_candidate_groups WHERE id IN (${placeholders})
  `).run(...idsToDelete);

  return result.changes;
}

export function getBaseImageHistory(
  ownerType: ImageOwnerType,
  ownerId: string
): BaseImageHistoryEntry[] {
  const versions = getImageVersions(ownerType, ownerId, 10);
  return versions
    .filter(v => v.imageUrl)
    .map(v => ({
      imageUrl: v.imageUrl!,
      timestamp: v.createdAt,
    }));
}

export function getCandidateHistory(
  projectId: string,
  assetId: string
): CandidateHistoryEntry[] {
  const groups = getCandidateGroupsByAsset(projectId, assetId);

  return groups.map(group => {
    const candidates = getCandidatesByGroup(group.id);
    return {
      candidates: candidates
        .filter(c => c.imageUrl)
        .map(c => c.imageUrl!),
      timestamp: group.createdAt,
    };
  });
}
