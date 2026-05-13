import type {
  TargetAge,
  PageCount,
  AspectRatio,
  ArtStyle,
  SaveStatus,
  ProjectStatus,
  StageNumber,
  StageStatus,
  StoryData,
  StoryboardData,
  AssetsData,
  PageItem,
  EditorPageState,
  StoryEntry,
  EmotionCurvePoint,
  SpreadItem,
  StoryboardPageData,
  AssetItem,
} from '@/types/picturebook';

export type {
  TargetAge,
  PageCount,
  AspectRatio,
  ArtStyle,
  SaveStatus,
  ProjectStatus,
  StageNumber,
  StageStatus,
  StoryData,
  StoryboardData,
  AssetsData,
  PageItem,
  EditorPageState,
};

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
  save_status: SaveStatus;
  created_at: number;
  updated_at: number;
}

export interface DbStoryData {
  id: string;
  project_id: string;
  one_line_story: string;
  characters: string;
  story_outline: string;
  emotion_curve: string;
  scenes: string;
  generating: number;
  created_at: number;
  updated_at: number;
}

export interface DbStoryboardData {
  id: string;
  project_id: string;
  spreads: string;
  pages: string;
  generating: number;
  created_at: number;
  updated_at: number;
}

export interface DbAssetsData {
  id: string;
  project_id: string;
  characters: string;
  scenes: string;
  created_at: number;
  updated_at: number;
}

export interface DbPage {
  id: string;
  project_id: string;
  page_index: number;
  story_text: string;
  character_refs: string;
  scene_refs: string;
  prompt: string;
  prompt_user_edited: number;
  image_url: string | null;
  image_blob: Buffer | null;
  page_status: string;
  generating: number;
  created_at: number;
  updated_at: number;
}

export interface DbEditorState {
  id: string;
  page_id: string;
  text_content: string;
  style: string;
  layout: string;
  confirmed: number;
  created_at: number;
  updated_at: number;
}

export interface DbImageVersion {
  id: string;
  owner_type: 'page' | 'character_base' | 'scene_candidate';
  owner_id: string;
  version_number: number;
  image_blob: Buffer;
  image_url: string | null;
  description: string | null;
  description_edited: number;
  created_at: number;
}

export interface DbSceneCandidateGroup {
  id: string;
  project_id: string;
  asset_id: string;
  created_at: number;
}

export interface DbSceneCandidate {
  id: string;
  group_id: string;
  index_in_group: number;
  image_blob: Buffer;
  image_url: string | null;
  description: string | null;
  created_at: number;
}

export interface DbProjectHistory {
  id: string;
  project_id: string;
  user_id: string;
  thumbnail_blob: Buffer | null;
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
  save_status: SaveStatus;
  created_at: number;
  updated_at: number;
}

export interface ParsedStoryData {
  one_line_story: string;
  characters: StoryEntry[];
  story_outline: string;
  emotion_curve: EmotionCurvePoint[];
  scenes: StoryEntry[];
  generating: boolean;
}

export interface ParsedStoryboardData {
  spreads: SpreadItem[];
  pages: StoryboardPageData[];
  generating: boolean;
}

export interface ParsedAssetsData {
  characters: AssetItem[];
  scenes: AssetItem[];
}

export interface ParsedPage {
  index: number;
  story_text: string;
  character_refs: string[];
  scene_refs: string[];
  prompt: string;
  prompt_user_edited: boolean;
  image_url: string | null;
  page_status: string;
  generating: boolean;
}

export interface ParsedEditorState {
  text_content: string;
  style: {
    fontSize: number;
    fontWeight: 'normal' | 'bold';
    textColor: string;
    textAlign: 'left' | 'center' | 'right';
  };
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  confirmed: boolean;
}
