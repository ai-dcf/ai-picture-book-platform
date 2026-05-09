import { AssetItem, PageItem, ProjectInfo, StoryEntry, StoryboardPageData } from '@/types/picturebook';

type AssetPromptKind = 'character' | 'scene';

interface BuildAssetPromptParams {
  kind: AssetPromptKind;
  name: string;
  description: string;
  projectInfo: ProjectInfo;
}

interface BuildPagePromptParams {
  pageIndex: number;
  page: Pick<PageItem, 'storyText' | 'characterRefs' | 'sceneRefs'>;
  storyboardPage?: StoryboardPageData;
  assets: {
    characters: AssetItem[];
    scenes: AssetItem[];
  };
  projectInfo: ProjectInfo;
}

function formatRefs(items: string[], fallback: string) {
  return items.length > 0 ? items.join('、') : fallback;
}

function findAssetDescriptions(names: string[], assets: AssetItem[]) {
  return names
    .map(name => assets.find(asset => asset.name === name))
    .filter((asset): asset is AssetItem => Boolean(asset))
    .map(asset => `${asset.name}：${asset.description || '按既定设定保持一致'}`)
    .join('；');
}

export function buildAssetPrompt({ kind, name, description, projectInfo }: BuildAssetPromptParams) {
  const subjectLabel = kind === 'character' ? '角色设定图' : '场景设定图';
  const focusLabel = kind === 'character' ? '突出角色外形、服饰、表情与辨识度' : '突出空间结构、时间氛围与关键陈设';

  return [
    `${subjectLabel}，主体：${name}。`,
    `描述：${description || '延续上游故事设定，补足适合儿童绘本的细节。'}`,
    `绘本风格：${projectInfo.artStyle}，目标年龄：${projectInfo.targetAge}，画面比例：${projectInfo.aspectRatio}。`,
    `${focusLabel}，画面干净完整，适合后续全书复用，保持儿童绘本审美与一致性。`,
  ].join('\n');
}

export function buildPagePrompt({
  pageIndex,
  page,
  storyboardPage,
  assets,
  projectInfo,
}: BuildPagePromptParams) {
  const storyText = page.storyText || storyboardPage?.text || '';
  const visualGoal = storyboardPage?.visualGoal || '延续当前分镜设定';
  const characterRefs = page.characterRefs.length > 0 ? page.characterRefs : (storyboardPage?.characterRefs || []);
  const sceneRefs = page.sceneRefs.length > 0 ? page.sceneRefs : (storyboardPage?.sceneRefs || []);
  const characterDetails = findAssetDescriptions(characterRefs, assets.characters);
  const sceneDetails = findAssetDescriptions(sceneRefs, assets.scenes);

  return [
    `绘本第 ${pageIndex + 1} 页插画，风格：${projectInfo.artStyle}，目标年龄：${projectInfo.targetAge}，画面比例：${projectInfo.aspectRatio}。`,
    `本页正文：${storyText || '保持与当前分镜一致的叙事内容。'}`,
    `画面目标：${visualGoal}。`,
    `角色引用：${formatRefs(characterRefs, '无明确角色')}。${characterDetails ? `角色细节：${characterDetails}。` : ''}`,
    `场景引用：${formatRefs(sceneRefs, '无明确场景')}。${sceneDetails ? `场景细节：${sceneDetails}。` : ''}`,
    '请输出适合儿童绘本的完整单页插画，主体明确，构图稳定，色彩统一，保留故事情绪与阅读节奏。',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildAssetPromptFromEntry(kind: AssetPromptKind, entry: StoryEntry, projectInfo: ProjectInfo) {
  return buildAssetPrompt({
    kind,
    name: entry.name,
    description: entry.description,
    projectInfo,
  });
}
