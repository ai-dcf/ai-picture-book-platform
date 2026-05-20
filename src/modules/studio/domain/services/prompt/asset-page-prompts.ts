import type { AssetItem, ImageRef, PageItem, ProjectInfo, StoryEntry, StoryboardPageData } from "@/types/picturebook";
import { promptEnhancer } from "@/lib/prompt-enhancer";
import { injectRefTags, buildImageRefsFromAssets } from "@/lib/prompt-ref-parser";

type AssetPromptKind = "character" | "scene";

interface BuildAssetPromptParams {
  kind: AssetPromptKind;
  name: string;
  description: string;
  projectInfo: ProjectInfo;
}

export interface BuildPagePromptResult {
  prompt: string;
  imageRefs: ImageRef[];
}

interface BuildPagePromptParams {
  pageIndex: number;
  page: Pick<PageItem, "storyText" | "characterRefs" | "sceneRefs">;
  storyboardPage?: StoryboardPageData;
  assets: {
    characters: AssetItem[];
    scenes: AssetItem[];
  };
  projectInfo: ProjectInfo;
}

function formatRefs(items: string[], fallback: string) {
  return items.length > 0 ? items.join("、") : fallback;
}

function findAssetDescriptions(names: string[], assets: AssetItem[]) {
  return names
    .map(name => assets.find(asset => asset.name === name))
    .filter((asset): asset is AssetItem => Boolean(asset))
    .map(asset => `${asset.name}：${asset.description || "按既定设定保持一致"}`)
    .join("；");
}

export function buildAssetPrompt({ kind, name, description, projectInfo }: BuildAssetPromptParams) {
  const baseContent = [
    `主体 Subject: ${name}`,
    `描述 Description: ${description || "延续上游故事设定，补足适合儿童绘本的细节。"}`,
  ].join("\n");

  return promptEnhancer.buildProfessionalPrompt({
    type: kind,
    artStyle: projectInfo.artStyle,
    targetAge: projectInfo.targetAge,
    mood: 'warm',
    layout: 'centered'
  }, baseContent);
}

export function buildPagePrompt({
  pageIndex,
  page,
  storyboardPage,
  assets,
  projectInfo,
}: BuildPagePromptParams): BuildPagePromptResult {
  const storyText = page.storyText || storyboardPage?.text || "";
  const visualGoal = storyboardPage?.visualGoal || "延续当前分镜设定";
  const characterRefs = page.characterRefs.length > 0 ? page.characterRefs : (storyboardPage?.characterRefs || []);
  const sceneRefs = page.sceneRefs.length > 0 ? page.sceneRefs : (storyboardPage?.sceneRefs || []);
  const characterDetails = findAssetDescriptions(characterRefs, assets.characters);
  const sceneDetails = findAssetDescriptions(sceneRefs, assets.scenes);

  const refNames = [...characterRefs, ...sceneRefs].filter(
    name => {
      const charAsset = assets.characters.find(a => a.name === name);
      const sceneAsset = assets.scenes.find(a => a.name === name);
      return (charAsset && charAsset.officialImageUrl) || (sceneAsset && sceneAsset.officialImageUrl);
    }
  );

  const { text: enrichedStoryText, imageRefs } = refNames.length > 0
    ? injectRefTags(storyText, refNames, assets.characters, assets.scenes)
    : { text: storyText, imageRefs: [] as ImageRef[] };

  const baseContent = [
    `页码 Page: ${pageIndex + 1}`,
    `故事情节 Story Content: ${enrichedStoryText || "保持与当前分镜一致的叙事内容。"}`,
    `画面目标 Visual Goal: ${visualGoal}`,
    characterRefs.length > 0 ? `角色 Characters: ${formatRefs(characterRefs, "无明确角色")}${characterDetails ? `\n角色细节 Character Details: ${characterDetails}` : ""}` : "",
    sceneRefs.length > 0 ? `场景 Scenes: ${formatRefs(sceneRefs, "无明确场景")}${sceneDetails ? `\n场景细节 Scene Details: ${sceneDetails}` : ""}` : "",
  ].filter(Boolean).join("\n");

  const prompt = promptEnhancer.buildProfessionalPrompt({
    type: 'page',
    artStyle: projectInfo.artStyle,
    targetAge: projectInfo.targetAge,
    mood: 'warm',
    layout: 'golden'
  }, baseContent);

  return { prompt, imageRefs };
}

export function buildUserFriendlyAssetPromptFromEntry(kind: AssetPromptKind, entry: StoryEntry, projectInfo: ProjectInfo) {
  return buildUserFriendlyAssetPrompt({
    kind,
    name: entry.name,
    description: entry.description,
    projectInfo,
  });
}

export function buildAssetPromptFromEntry(kind: AssetPromptKind, entry: StoryEntry, projectInfo: ProjectInfo) {
  return buildAssetPrompt({
    kind,
    name: entry.name,
    description: entry.description,
    projectInfo,
  });
}

/**
 * 生成用户友好的角色/场景提示词（用于前端展示）
 */
export function buildUserFriendlyAssetPrompt({ kind, name, description, projectInfo }: BuildAssetPromptParams) {
  let prompt = promptEnhancer.buildUserFriendlyPrompt({
    type: kind,
    artStyle: projectInfo.artStyle,
    targetAge: projectInfo.targetAge,
  }, {
    name,
    description: description || "延续上游故事设定，补足适合儿童绘本的细节。"
  });

  // 角色形象默认添加全身照片要求
  if (kind === 'character') {
    prompt += " 要求全身照片。";
  }

  return prompt;
}

/**
 * 生成用户友好的页面提示词（用于前端展示）
 */
export function buildUserFriendlyPagePrompt({
  pageIndex,
  page,
  storyboardPage,
  assets,
  projectInfo,
}: BuildPagePromptParams): { prompt: string; imageRefs: ImageRef[] } {
  const visualGoal = storyboardPage?.visualGoal || "延续当前分镜设定";
  const characterRefs = page.characterRefs.length > 0 ? page.characterRefs : (storyboardPage?.characterRefs || []);
  const sceneRefs = page.sceneRefs.length > 0 ? page.sceneRefs : (storyboardPage?.sceneRefs || []);

  const refNames = [...characterRefs, ...sceneRefs].filter(
    name => {
      const charAsset = assets.characters.find(a => a.name === name);
      const sceneAsset = assets.scenes.find(a => a.name === name);
      return (charAsset && charAsset.officialImageUrl) || (sceneAsset && sceneAsset.officialImageUrl);
    }
  );

  // 给visualGoal插入@角色引用标记
  const { text: processedVisualGoal, imageRefs } = refNames.length > 0
    ? injectRefTags(visualGoal, refNames, assets.characters, assets.scenes)
    : { text: visualGoal, imageRefs: [] as ImageRef[] };

  // 取出场景信息
  let sceneName: string | undefined;
  let sceneDescription: string | undefined;
  if (sceneRefs.length > 0) {
    const sceneAsset = assets.scenes.find(s => s.name === sceneRefs[0]);
    if (sceneAsset) {
      sceneName = sceneAsset.name;
      sceneDescription = sceneAsset.description;
    }
  }

  const prompt = promptEnhancer.buildUserFriendlyPrompt({
    type: 'page',
    artStyle: projectInfo.artStyle,
    targetAge: projectInfo.targetAge,
  }, {
    visualGoal: processedVisualGoal,
    sceneName,
    sceneDescription
  });

  return { prompt, imageRefs };
}
