import type { AssetItem, PageItem, ProjectInfo, StoryEntry, StoryboardPageData } from "@/types/picturebook";
import { promptEnhancer } from "@/lib/prompt-enhancer";

type AssetPromptKind = "character" | "scene";

interface BuildAssetPromptParams {
  kind: AssetPromptKind;
  name: string;
  description: string;
  projectInfo: ProjectInfo;
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
}: BuildPagePromptParams) {
  const storyText = page.storyText || storyboardPage?.text || "";
  const visualGoal = storyboardPage?.visualGoal || "延续当前分镜设定";
  const characterRefs = page.characterRefs.length > 0 ? page.characterRefs : (storyboardPage?.characterRefs || []);
  const sceneRefs = page.sceneRefs.length > 0 ? page.sceneRefs : (storyboardPage?.sceneRefs || []);
  const characterDetails = findAssetDescriptions(characterRefs, assets.characters);
  const sceneDetails = findAssetDescriptions(sceneRefs, assets.scenes);

  const baseContent = [
    `页码 Page: ${pageIndex + 1}`,
    `故事情节 Story Content: ${storyText || "保持与当前分镜一致的叙事内容。"}`,
    `画面目标 Visual Goal: ${visualGoal}`,
    characterRefs.length > 0 ? `角色 Characters: ${formatRefs(characterRefs, "无明确角色")}${characterDetails ? `\n角色细节 Character Details: ${characterDetails}` : ""}` : "",
    sceneRefs.length > 0 ? `场景 Scenes: ${formatRefs(sceneRefs, "无明确场景")}${sceneDetails ? `\n场景细节 Scene Details: ${sceneDetails}` : ""}` : "",
  ].filter(Boolean).join("\n");

  return promptEnhancer.buildProfessionalPrompt({
    type: 'page',
    artStyle: projectInfo.artStyle,
    targetAge: projectInfo.targetAge,
    mood: 'warm',
    layout: 'golden'
  }, baseContent);
}

export function buildAssetPromptFromEntry(kind: AssetPromptKind, entry: StoryEntry, projectInfo: ProjectInfo) {
  return buildAssetPrompt({
    kind,
    name: entry.name,
    description: entry.description,
    projectInfo,
  });
}
