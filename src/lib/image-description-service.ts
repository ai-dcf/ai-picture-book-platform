import type { AssetItem, StoryEntry } from '@/types/picturebook';

export interface ImageDescriptionContext {
  assetName: string;
  assetDescription: string;
  assetType: 'character' | 'scene';
  artStyle: string;
  targetAge: string;
  pageContext?: string;
  storyText?: string;
}

export interface GeneratedDescription {
  description: string;
  confidence: number;
  metadata?: {
    generatedAt: number;
    modelUsed?: string;
  };
}

export interface DescriptionUpdate {
  description: string;
  wasEdited: boolean;
  previousDescription?: string;
}

const AI_DESCRIPTION_PROMPT_TEMPLATE = `你是一个专业的儿童绘本图片描述生成专家。

请根据以下信息生成一段精炼的图片描述（50-100字），用于指导AI绘画模型生成符合儿童绘本风格的图片。

角色/场景信息：
- 名称：{assetName}
- 类型：{assetType}
- 详细描述：{assetDescription}

绘本风格要求：
- 艺术风格：{artStyle}
- 目标年龄段：{targetAge}

{pageContext}

请生成一段画面描述，包含：
1. 主体外观特征
2. 主要动作或状态
3. 背景环境要素
4. 整体氛围和色调

描述要求：
- 语言简洁，适合作为AI绘画提示词
- 避免过于复杂的细节描写
- 突出该角色/场景的核心特征
- 与绘本整体风格保持一致`;

const REFINEMENT_PROMPT_TEMPLATE = `你是一个专业的儿童绘本插画师。

请根据原始描述 refinements 优化这段图片描述，使其：
1. 更符合"{artStyle}"的艺术风格
2. 更适合"{targetAge}"年龄段儿童
3. 视觉元素更清晰明确
4. 保持儿童绘本温馨可爱的基调

原始描述：
{originalDescription}

请输出一段优化后的描述（50-100字）。`;

export function buildDescriptionPrompt(
  context: ImageDescriptionContext,
  refinements?: string[]
): string {
  let prompt = AI_DESCRIPTION_PROMPT_TEMPLATE
    .replace('{assetName}', context.assetName)
    .replace('{assetType}', context.assetType === 'character' ? '角色' : '场景')
    .replace('{assetDescription}', context.assetDescription)
    .replace('{artStyle}', context.artStyle)
    .replace('{targetAge}', context.targetAge);

  if (context.pageContext) {
    prompt = prompt.replace('{pageContext}', `\n页面上下文：\n${context.pageContext}`);
  } else {
    prompt = prompt.replace('{pageContext}', '');
  }

  return prompt;
}

export function buildRefinementPrompt(
  originalDescription: string,
  artStyle: string,
  targetAge: string
): string {
  return REFINEMENT_PROMPT_TEMPLATE
    .replace('{artStyle}', artStyle)
    .replace('{targetAge}', targetAge)
    .replace('{originalDescription}', originalDescription);
}

export async function generateImageDescription(
  context: ImageDescriptionContext,
  _modelProvider?: 'openai' | 'qwen' | 'ernie' | 'doubao'
): Promise<GeneratedDescription> {
  const prompt = buildDescriptionPrompt(context);

  const mockDescription = generateMockDescription(context);

  return {
    description: mockDescription,
    confidence: 0.85,
    metadata: {
      generatedAt: Date.now(),
      modelUsed: 'mock-vision-model',
    },
  };
}

export async function refineDescription(
  originalDescription: string,
  artStyle: string,
  targetAge: string
): Promise<GeneratedDescription> {
  const prompt = buildRefinementPrompt(originalDescription, artStyle, targetAge);

  const refined = applyRefinements(originalDescription, artStyle, targetAge);

  return {
    description: refined,
    confidence: 0.9,
    metadata: {
      generatedAt: Date.now(),
    },
  };
}

function generateMockDescription(context: ImageDescriptionContext): string {
  const { assetName, assetDescription, assetType, artStyle } = context;

  const stylePrefixes: Record<string, string> = {
    '水彩温暖风': '温暖柔和的水彩画风，',
    '蜡笔童趣风': '充满童趣的蜡笔画风，',
    '剪纸拼贴风': '手工剪纸拼贴风格，',
    '日系清新风': '清新淡雅的日系插画风格，',
    '素描淡彩风': '细腻的素描淡彩风格，',
    '波普大胆风': '大胆鲜明的波普艺术风格，',
    '水墨东方风': '典雅的水墨画风格，',
    '极简线条风': '简洁有力的线条插画风格，',
  };

  const stylePrefix = stylePrefixes[artStyle] || '';

  if (assetType === 'character') {
    return `${stylePrefix}一只可爱的${assetName}，${assetDescription}。画面温馨可爱，色彩明亮，适合儿童绘本。`;
  } else {
    return `${stylePrefix}一处美丽的场景${assetName}，${assetDescription}。画面层次分明，色调和谐，营造出温馨的氛围。`;
  }
}

function applyRefinements(
  original: string,
  artStyle: string,
  targetAge: string
): string {
  let refined = original;

  const ageModifiers: Record<string, { bright: string; detail: string }> = {
    '0-3': { bright: '非常明亮', detail: '简单概括' },
    '3-6': { bright: '明亮', detail: '适度细节' },
    '6-9': { bright: '适中', detail: '丰富细节' },
    '9-12': { bright: '沉稳', detail: '详细描写' },
  };

  const ageMod = ageModifiers[targetAge] || ageModifiers['3-6'];

  if (!refined.includes('色彩')) {
    refined = refined.replace('画面', `画面色彩${ageMod.bright}，`);
  }

  if (!refined.includes('风格')) {
    refined = refined.replace('。', `。${artStyle}，${ageMod.detail}。`);
  }

  return refined;
}

export function parseDescriptionMetadata(description: string): {
  hasStyleHint: boolean;
  hasColorHint: boolean;
  hasMoodHint: boolean;
} {
  const styleKeywords = ['风格', '画风', '艺术', '日系', '水彩', '蜡笔', '剪纸', '水墨'];
  const colorKeywords = ['色彩', '颜色', '色调', '明亮', '柔和', '鲜艳', '淡雅'];
  const moodKeywords = ['温馨', '可爱', '快乐', '温暖', '宁静', '欢快', '梦幻'];

  return {
    hasStyleHint: styleKeywords.some(k => description.includes(k)),
    hasColorHint: colorKeywords.some(k => description.includes(k)),
    hasMoodHint: moodKeywords.some(k => description.includes(k)),
  };
}

export function mergeAssetAndCharacterDescription(
  asset: Pick<AssetItem, 'name' | 'description'>,
  character: StoryEntry
): string {
  const baseDesc = character.description || '';
  const assetDesc = asset.description || '';

  if (!baseDesc && !assetDesc) {
    return `可爱的${asset.name}`;
  }

  if (!baseDesc) {
    return assetDesc;
  }

  if (!assetDesc) {
    return baseDesc;
  }

  if (baseDesc === assetDesc) {
    return baseDesc;
  }

  return `${asset.name}：${assetDesc} ${baseDesc}`;
}

export function formatDescriptionForPrompt(
  description: string,
  options?: {
    maxLength?: number;
    addStyleHints?: boolean;
    artStyle?: string;
  }
): string {
  let formatted = description;

  if (options?.maxLength && formatted.length > options.maxLength) {
    formatted = formatted.substring(0, options.maxLength - 3) + '...';
  }

  if (options?.addStyleHints && options.artStyle) {
    const hints: Record<string, string> = {
      '水彩温暖风': 'watercolor, warm tones, soft edges',
      '蜡笔童趣风': 'crayon, childlike, vibrant colors',
      '剪纸拼贴风': 'paper cut, collage, layered',
      '日系清新风': 'Japanese anime style, pastel colors, clean lines',
      '素描淡彩风': 'pencil sketch, watercolor wash, light colors',
      '波普大胆风': 'pop art, bold colors, graphic',
      '水墨东方风': 'Chinese ink painting, elegant, traditional',
      '极简线条风': 'minimalist, line art, clean',
    };

    const hint = hints[options.artStyle];
    if (hint) {
      formatted = `${formatted}, ${hint}`;
    }
  }

  return formatted;
}
