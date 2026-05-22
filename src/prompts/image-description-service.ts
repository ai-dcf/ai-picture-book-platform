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
    '简笔画风格': '简洁可爱的简笔画风格，',
    '卡通风格': '活泼明快的卡通风格，',
    '写实插画': '细腻真实的插画风格，',
  };

  const prefix = stylePrefixes[artStyle] || '温馨可爱的儿童绘本风格，';

  if (assetType === 'character') {
    return `${prefix}${assetName}是一个${assetDescription}，表情生动友善，适合绘本故事中的主要角色形象。背景简洁温暖，色调柔和明亮。`;
  }

  return `${prefix}${assetName}场景${assetDescription}，环境细节丰富但不过于复杂，营造温馨安全的氛围，色彩和谐适合儿童阅读。`;
}

function applyRefinements(original: string, artStyle: string, targetAge: string): string {
  return `${original}（已根据${artStyle}风格和${targetAge}岁儿童审美进行优化，强化主体特征与温馨氛围）`;
}

export function createDescriptionUpdate(
  oldDescription: string | null,
  newDescription: string,
  wasEdited: boolean
): DescriptionUpdate {
  return {
    description: newDescription,
    wasEdited,
    previousDescription: oldDescription || undefined,
  };
}

export function getDefaultDescriptionForAsset(asset: AssetItem, entries: StoryEntry[]): string {
  const entry = entries.find((e) => e.name === asset.name);
  return entry?.description || asset.description || '';
}
