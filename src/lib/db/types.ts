import type {
  TargetAge,
  PageCount,
  AspectRatio,
  ArtStyle,
  ProjectStatus,
  StageNumber,
  StageStatus,
} from '@/types/picturebook';

export interface DbProject {
  id: string;
  user_id: string;
  title: string;
  target_age: TargetAge;
  page_count: PageCount;
  art_style: ArtStyle;
  aspect_ratio: AspectRatio;
  project_status: ProjectStatus;
  current_stage: StageNumber;
  stage_statuses: string;
  full_state: string;
  created_at: number;
  updated_at: number;
}

export interface ParsedProject {
  id: string;
  user_id: string;
  title: string;
  target_age: TargetAge;
  page_count: PageCount;
  art_style: ArtStyle;
  aspect_ratio: AspectRatio;
  project_status: ProjectStatus;
  current_stage: StageNumber;
  stage_statuses: Record<StageNumber, StageStatus>;
  full_state: string;
  created_at: number;
  updated_at: number;
}
