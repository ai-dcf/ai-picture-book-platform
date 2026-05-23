import type {
  AssetItem,
  AspectRatio,
  ArtStyle,
  ImageRef,
  PageCount,
  PageItem,
  ProjectInfo,
  StoryData,
  StoryEntry,
  StoryboardPageData,
  TargetAge,
} from "@/types/picturebook";

export type AssetPromptKind = "character" | "scene";

export type PromptGenre = "原创童话" | "经典改编" | "科普启蒙" | "冒险成长" | "低幼认知启蒙";
export type PromptSafetyLevel = "normal" | "strict";

export interface PromptContext {
  title: string;
  targetAge: Exclude<TargetAge, "auto">;
  artStyle: Exclude<ArtStyle, "auto">;
  aspectRatio: AspectRatio;
  pageCount: Exclude<PageCount, "auto">;
  genre?: PromptGenre;
  tone?: string;
  educationalGoal?: string;
  culturalTone?: string;
  customRequirements?: string[];
}

export interface PromptCustomParams {
  genre?: PromptGenre;
  educationalGoal?: string;
  tone?: string;
  culturalTone?: string;
  colorOverride?: string;
  safetyLevel?: PromptSafetyLevel;
  adaptationPolicy?: string;
  extraVisualRules?: string[];
  extraComplianceRules?: string[];
}

export interface BuildAssetPromptParams {
  kind: AssetPromptKind;
  name: string;
  description: string;
  projectInfo: ProjectInfo;
  customParams?: PromptCustomParams;
}

export interface BuildPagePromptResult {
  prompt: string;
  imageRefs: ImageRef[];
}

export interface GeneratePagePromptResult extends BuildPagePromptResult {}

export interface BuildPagePromptParams {
  pageIndex: number;
  page: Pick<PageItem, "storyText" | "pageText" | "visualGoal" | "characterRefs" | "sceneRefs">;
  storyboardPage?: StoryboardPageData;
  assets: {
    characters: AssetItem[];
    scenes: AssetItem[];
  };
  projectInfo: ProjectInfo;
  customParams?: PromptCustomParams;
}

export interface BuildStoryboardPromptParams {
  story: StoryData;
  projectInfo: ProjectInfo;
  customParams?: PromptCustomParams;
}

export interface StyleRuleSet {
  styleLabel: string;
  styleMood: string;
  coreStyleConstraints: string[];
  lightingRules: string[];
  textureRules: string[];
  colorRules: string[];
  compositionRules: string[];
}

export interface GenreRuleSet {
  genreLabel: string;
  storyRules: string[];
  storyboardRules: string[];
  visualRules: string[];
  complianceRules: string[];
}

export interface ContinuityRuleSet {
  characterRules: string[];
  sceneRules: string[];
  propRules: string[];
  transitionRules: string[];
}

export interface ComplianceRuleSet {
  positiveRules: string[];
  negativeRules: string[];
  negativePrompt: string[];
}

export interface ModelRuleSet {
  sizeHint: string;
  parameterTags: string[];
  negativePrompt: string[];
}

export interface PromptRuleBundle {
  context: PromptContext;
  style: StyleRuleSet;
  genre: GenreRuleSet;
  continuity: ContinuityRuleSet;
  compliance: ComplianceRuleSet;
  model: ModelRuleSet;
  customParams: PromptCustomParams;
}

export type PromptBuilderTemplate = (params: {
  context: PromptContext;
  rules: PromptRuleBundle;
  story?: StoryData;
  storyEntry?: StoryEntry;
  storyboardPage?: StoryboardPageData;
  baseContent?: string;
}) => string;
