// ─── Enums (PRD §6) ──────────────────────────────────────────────────────────
export type TargetAge = 'auto' | `${number}-${number}`;
export type PageCount = 'auto' | number;
export type AspectRatio = '3:4' | '9:16' | '16:9' | '1:1';
export type ArtStyle = 'auto' | string;

export const TARGET_AGES: TargetAge[] = ['auto', '1-3', '3-5', '5-7', '7-9'];
export const PAGE_COUNTS: PageCount[] = ['auto', 8, 12, 16, 24, 32];
export const ASPECT_RATIOS: AspectRatio[] = ['3:4', '9:16', '16:9', '1:1'];
export const ART_STYLES: ArtStyle[] = [
  'auto',
  '水彩温暖风',
  '蜡笔童趣风',
  '剪纸拼贴风',
  '日系清新风',
  '素描淡彩风',
  '波普大胆风',
  '水墨东方风',
  '极简线条风',
];

// ─── Save Status (PRD §7.4) ──────────────────────────────────────────────────
export type SaveStatus = 'unsaved' | 'saving' | 'saved' | 'save_failed';

// ─── Project Status (PRD §7.1) ───────────────────────────────────────────────
export type ProjectStatus =
  | 'draft'
  | 'story_confirmed'
  | 'storyboard_confirmed'
  | 'assets_confirmed'
  | 'creating'
  | 'exportable'
  | 'review';

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: '草稿中',
  story_confirmed: '故事已确认',
  storyboard_confirmed: '分镜已确认',
  assets_confirmed: '素材已确认',
  creating: '创作中',
  exportable: '可导出',
  review: '待复查',
};

// ─── Stage Status ────────────────────────────────────────────────────────────
export type StageStatus = 'idle' | 'in-progress' | 'done' | 'invalid' | 'review';

// ─── Stage Number (PRD §4.1: 5 stages) ───────────────────────────────────────
export type StageNumber = 1 | 2 | 3 | 4 | 5;

export const STAGE_LABELS: Record<StageNumber, string> = {
  1: '项目初始化',
  2: '故事架构与分镜拆页',
  3: '素材设定',
  4: '逐页生成',
  5: '编辑定稿与导出',
};

// ─── Page Status (PRD §7.2) ──────────────────────────────────────────────────
export type PageStatus = 'idle' | 'pending' | 'generating' | 'generated' | 'review' | 'finalized';

export const PAGE_STATUS_LABELS: Record<PageStatus, string> = {
  idle: '未开始',
  pending: '待生成',
  generating: '生成中',
  generated: '已生成',
  review: '待复查',
  finalized: '已定稿',
};

// ─── Asset Status (PRD §7.3) ─────────────────────────────────────────────────
export type AssetStatus = 'not_generated' | 'candidates_generated' | 'official_confirmed' | 'pending_update' | 'review';
export type AssetGenerationPhase = 'character_prompt' | 'character_base' | 'scene_prompt' | 'scene_candidates' | null;

export interface AssetPromptResult {
  id: string;
  prompt: string;
}

export interface AssetImageResult {
  id: string;
  imageUrl: string;
}

export interface BatchAssetImageResult {
  images: AssetImageResult[];
  failedIds: string[];
}

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  not_generated: '未生成',
  candidates_generated: '已生成候选',
  official_confirmed: '已确认正式版本',
  pending_update: '待更新',
  review: '待复查',
};

export const BASE_IMAGE_HISTORY_LIMIT = 10;
export const CANDIDATE_HISTORY_LIMIT = 10;

export interface BaseImageHistoryEntry {
  imageUrl: string;
  timestamp: number;
}

export interface CandidateHistoryEntry {
  candidates: string[];
  timestamp: number;
}

// ─── Project Info ────────────────────────────────────────────────────────────
export interface ProjectInfo {
  projectId: string;
  title: string;
  targetAge: TargetAge;
  pageCount: PageCount;
  artStyle: ArtStyle;
  aspectRatio: AspectRatio;
  saveStatus: SaveStatus;
  projectStatus: ProjectStatus;
}

// ─── Story Architecture (PRD §8.2: 5 core outputs) ──────────────────────────
export interface StoryEntry {
  name: string;
  description: string;
  userModified: boolean;
}

export interface StoryData {
  characters: StoryEntry[];
  storyOutline: string;
  scenes: StoryEntry[];
  generating: boolean;
}

export interface ProjectConfigRecommendation {
  recommendedTargetAge?: Exclude<TargetAge, "auto">;
  recommendedArtStyle?: Exclude<ArtStyle, "auto">;
  recommendedPageCount?: Exclude<PageCount, "auto">;
}

// ─── Storyboard (PRD §8.3) ──────────────────────────────────────────────────
export interface StoryboardPageData {
  pageIndex: number;
  text: string;
  visualGoal: string;
  userModified: boolean;
}

export interface StoryboardData {
  pages: StoryboardPageData[];
  generating: boolean;
}

// ─── Assets (PRD §8.4) ──────────────────────────────────────────────────────
export interface AssetItem {
  id: string;
  name: string;
  description: string;
  prompt: string;
  promptUserEdited: boolean;
  status: AssetStatus;
  aspectRatio: AspectRatio;
  baseImageUrl: string | null;
  candidates: string[];
  officialImageUrl: string | null;
  officialIndex: number | null;
  generating: boolean;
  generatingPhase: AssetGenerationPhase;
  baseImageHistory: BaseImageHistoryEntry[];
  candidateHistory: CandidateHistoryEntry[];
}

export interface AssetsData {
  characters: AssetItem[];
  scenes: AssetItem[];
}

// ─── Image Refs (Stage 5) ────────────────────────────────────────────────────
export interface ImageRef {
  assetId: string;
  assetName: string;
  assetType: 'character' | 'scene';
  imageUrl: string;
  refLabel?: string;
  refToken?: string;
}

export interface PagePromptBatchResult {
  index: number;
  prompt: string;
  imageRefs: ImageRef[];
}

export type GenerateTargetKind = 'page' | 'cover';

// ─── Cover (Stage 3 / Stage 5) ──────────────────────────────────────────────
export interface CoverData {
  title: string;
  visualGoal: string;
  userModified: boolean;
  prompt: string;
  promptUserEdited: boolean;
  imageUrl: string | null;
  status: PageStatus;
  generating: boolean;
  imageRefs: ImageRef[];
  aspectRatio?: AspectRatio;
}

// ─── Pages (PRD §8.5) ───────────────────────────────────────────────────────
export interface PageItem {
  index: number;
  storyText: string;
  pageText: string;
  visualGoal: string;
  storyboardEdited: boolean;
  characterRefs: string[];
  sceneRefs: string[];
  prompt: string;
  promptUserEdited: boolean;
  imageUrl: string | null;
  pageStatus: PageStatus;
  generating: boolean;
  imageRefs: ImageRef[];
  aspectRatio?: AspectRatio;
}

// ─── Editor (PRD §8.6) ──────────────────────────────────────────────────────
export type TextAlign = 'left' | 'center' | 'right';
export type FontWeight = 'normal' | 'bold';

export interface TextBoxStyle {
  fontSize: number;
  fontWeight: FontWeight;
  textColor: string;
  textAlign: TextAlign;
}

export interface TextBoxLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EditorPageState {
  textContent: string;
  style: TextBoxStyle;
  layout: TextBoxLayout;
  confirmed: boolean;
}

// ─── Root State ──────────────────────────────────────────────────────────────
export interface PictureBookState {
  projectInfo: ProjectInfo;
  currentStage: StageNumber;
  stageStatuses: Record<StageNumber, StageStatus>;
  story: StoryData;
  storyboard: StoryboardData;
  cover: CoverData;
  assets: AssetsData;
  pages: PageItem[];
  editorStates: EditorPageState[];
}

export const defaultTextBoxStyle: TextBoxStyle = {
  fontSize: 18,
  fontWeight: 'normal',
  textColor: '#1a1008',
  textAlign: 'center',
};

export const defaultTextBoxLayout: TextBoxLayout = {
  x: 10,
  y: 70,
  w: 80,
  h: 22,
};
