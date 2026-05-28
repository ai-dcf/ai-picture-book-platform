import type { AssetPromptResult, StoryEntry } from "@/types/picturebook";
import { promptEnhancer } from "@/prompts/prompt-enhancer";
import { buildPromptRuleBundle } from "@/prompts/specs";
import type { AssetPromptKind, BuildAssetPromptParams, PromptCustomParams } from "@/prompts/types";
import { buildRuleSummary, formatRuleBlock, formatRulesAsSentence } from "@/prompts/builders/shared";

function trimTrailingPunctuation(text: string): string {
  return text.trim().replace(/[，。,；、\s]+$/g, "").trim();
}

export function buildCharacterProjectStylePrefix(
  projectInfo: BuildAssetPromptParams["projectInfo"],
  customParams: PromptCustomParams = {}
): string {
  const rules = buildPromptRuleBundle(projectInfo, customParams);
  return [
    `${rules.style.styleLabel}绘本角色`,
    ...rules.style.coreStyleConstraints,
  ].join("，");
}

export function buildCharacterFinalPrompt({
  projectInfo,
  name,
  appearanceDescription,
  customParams = {},
}: {
  projectInfo: BuildAssetPromptParams["projectInfo"];
  name?: string;
  appearanceDescription: string;
  customParams?: PromptCustomParams;
}) {
  const stylePrefix = buildCharacterProjectStylePrefix(projectInfo, customParams);
  const normalizedName = name?.trim();
  const appearance = trimTrailingPunctuation(appearanceDescription);
  return [stylePrefix, normalizedName ? `角色：${normalizedName}` : null, appearance, "全身", "无光影", "纯色背景"]
    .filter(Boolean)
    .join("，");
}

export function buildCharacterPromptGenerationSystemPrompt(): string {
  return [
    "你是一位儿童绘本角色外观设计专家。",
    "你的任务是根据项目统一风格片段和角色描述，只生成角色外观描述部分。",
    "你必须严格遵守以下要求：",
    "- 只输出角色外观描述，不要输出解释、标题、引号、序号或 Markdown",
    "- 不要重复输出项目统一风格片段中的风格名称和风格约束",
    "- 必须描写人物完整形象，包含可见外观、服饰、姿态、表情等信息",
    "- 必须使用客观、可见、可绘制的视觉语言",
    "- 不要写剧情概述、心理活动、抽象情绪词、镜头外信息",
    "- 不要输出“全身”“无光影”“纯色背景”等固定收尾词",
    "- 输出为一行自然中文，适合拼接进最终 AI 绘画提示词",
  ].join("\n");
}

export function buildCharacterPromptGenerationUserPrompt({
  name,
  description,
  projectInfo,
  customParams = {},
}: Omit<BuildAssetPromptParams, "kind">) {
  const rules = buildPromptRuleBundle(projectInfo, customParams);
  const details = description?.trim() || "请根据角色名称补足基础外观，但保持儿童绘本识别度。";
  const stylePrefix = buildCharacterProjectStylePrefix(projectInfo, customParams);

  return [
    `项目标题：${projectInfo.title || "待定"}`,
    `目标年龄：${rules.context.targetAge}岁`,
    `绘本风格：${rules.context.artStyle}`,
    `项目统一风格片段：${stylePrefix}`,
    `角色名称：${name}`,
    `角色描述：${details}`,
    "",
    "请只生成角色外观描述，必须同时满足：",
    "- 与上述项目统一风格片段保持一致",
    "- 覆盖人物完整形象",
    "- 可以包含外形、服饰、配件、姿态、表情等可见信息",
    "- 不要重复风格名称或风格规则",
    "- 不要输出全身、无光影、纯色背景这些固定词",
    "",
    "请直接输出角色外观描述。",
  ].join("\n");
}

export function buildBatchCharacterPromptGenerationSystemPrompt(): string {
  return [
    "你是一位儿童绘本角色外观设计专家。",
    "你的任务是根据项目统一风格和多名角色描述，分别生成每个角色的外观描述。",
    "你必须严格遵守以下要求：",
    "- 只输出严格 JSON，不要输出解释、标题、引号外文本或 Markdown 代码块",
    '- JSON 格式必须为 {"prompts":[{"id":"角色ID","appearanceDescription":"角色外观描述"}]}',
    "- 每个角色都必须返回对应的 id",
    "- appearanceDescription 只写可见外观描述，不要重复输出项目风格名称和规则",
    "- 必须覆盖外形、服饰、配件、姿态、表情等可见信息",
    "- 不要输出剧情、心理活动、抽象情绪词",
    "- 不要输出“全身”“无光影”“纯色背景”等固定收尾词",
  ].join("\n");
}

export function buildBatchCharacterPromptGenerationUserPrompt({
  assets,
  projectInfo,
  customParams = {},
}: {
  assets: Array<Pick<AssetPromptResult, "id"> & { name: string; description: string }>;
  projectInfo: BuildAssetPromptParams["projectInfo"];
  customParams?: PromptCustomParams;
}) {
  const rules = buildPromptRuleBundle(projectInfo, customParams);
  const stylePrefix = buildCharacterProjectStylePrefix(projectInfo, customParams);

  return [
    `项目标题：${projectInfo.title || "待定"}`,
    `目标年龄：${rules.context.targetAge}岁`,
    `绘本风格：${rules.context.artStyle}`,
    `项目统一风格片段：${stylePrefix}`,
    "",
    "请分别为以下角色生成外观描述：",
    ...assets.map((asset, index) => [
      `角色 ${index + 1}：`,
      `- id: ${asset.id}`,
      `- 名称: ${asset.name}`,
      `- 描述: ${asset.description?.trim() || "请根据角色名称补足基础外观，但保持儿童绘本识别度。"}`,
    ].join("\n")),
    "",
    "请输出严格 JSON：",
    '{"prompts":[{"id":"角色ID","appearanceDescription":"角色外观描述"}]}',
  ].join("\n");
}

export function buildScenePromptGenerationSystemPrompt(): string {
  return [
    "你是一位儿童绘本场景提示词设计专家。",
    "你的任务是根据项目统一风格和场景描述，只生成场景视觉描述部分。",
    "你必须严格遵守以下要求：",
    "- 只输出场景视觉描述，不要输出解释、标题、引号、序号或 Markdown",
    "- 必须使用客观、可见、可绘制的视觉语言",
    "- 必须描写场景主体、空间关系、构图、光线、材质、色彩等可见信息",
    "- 不要写剧情解释、心理活动、抽象情绪词",
    "- 输出为一行自然中文，适合拼接进最终 AI 绘画提示词",
  ].join("\n");
}

export function buildScenePromptGenerationUserPrompt({
  name,
  description,
  projectInfo,
  customParams = {},
}: Omit<BuildAssetPromptParams, "kind">) {
  const rules = buildPromptRuleBundle(projectInfo, customParams);
  const details = description?.trim() || "请根据场景名称补足基础空间与氛围，但保持儿童绘本识别度。";

  return [
    `项目标题：${projectInfo.title || "待定"}`,
    `目标年龄：${rules.context.targetAge}岁`,
    `绘本风格：${rules.context.artStyle}`,
    `题材：${rules.genre.genreLabel}`,
    `场景名称：${name}`,
    `场景描述：${details}`,
    "",
    "请只生成场景视觉描述，必须同时满足：",
    "- 与项目统一风格保持一致",
    "- 覆盖场景主体、空间关系、环境元素、材质、光线与色彩",
    "- 只写可见信息，不要写抽象感受",
    "",
    "请直接输出场景视觉描述。",
  ].join("\n");
}

export function buildBatchScenePromptGenerationSystemPrompt(): string {
  return [
    "你是一位儿童绘本场景提示词设计专家。",
    "你的任务是根据项目统一风格和多个场景描述，分别生成每个场景的视觉描述。",
    "你必须严格遵守以下要求：",
    "- 只输出严格 JSON，不要输出解释、标题、引号外文本或 Markdown 代码块",
    '- JSON 格式必须为 {"prompts":[{"id":"场景ID","sceneDescription":"场景视觉描述"}]}',
    "- 每个场景都必须返回对应的 id",
    "- sceneDescription 只写可见场景信息，不要写抽象感受或剧情解释",
    "- 必须覆盖主体、空间关系、环境元素、材质、光线与色彩",
  ].join("\n");
}

export function buildBatchScenePromptGenerationUserPrompt({
  assets,
  projectInfo,
  customParams = {},
}: {
  assets: Array<Pick<AssetPromptResult, "id"> & { name: string; description: string }>;
  projectInfo: BuildAssetPromptParams["projectInfo"];
  customParams?: PromptCustomParams;
}) {
  const rules = buildPromptRuleBundle(projectInfo, customParams);

  return [
    `项目标题：${projectInfo.title || "待定"}`,
    `目标年龄：${rules.context.targetAge}岁`,
    `绘本风格：${rules.context.artStyle}`,
    `题材：${rules.genre.genreLabel}`,
    "",
    "请分别为以下场景生成视觉描述：",
    ...assets.map((asset, index) => [
      `场景 ${index + 1}：`,
      `- id: ${asset.id}`,
      `- 名称: ${asset.name}`,
      `- 描述: ${asset.description?.trim() || "请根据场景名称补足基础空间与氛围，但保持儿童绘本识别度。"}`,
    ].join("\n")),
    "",
    "请输出严格 JSON：",
    '{"prompts":[{"id":"场景ID","sceneDescription":"场景视觉描述"}]}',
  ].join("\n");
}

export function buildAssetPrompt({
  kind,
  name,
  description,
  projectInfo,
  customParams = {},
}: BuildAssetPromptParams) {
  const rules = buildPromptRuleBundle(projectInfo, customParams);
  const baseContent = [
    `主体 Subject: ${name}`,
    `描述 Description: ${description || "延续上游故事设定，补足适合儿童绘本的细节。"}`,
    ...buildRuleSummary(rules),
    formatRuleBlock("风格规则", [
      ...rules.style.lightingRules,
      ...rules.style.textureRules,
      ...rules.style.colorRules,
    ]),
    formatRuleBlock("连续性规则", rules.continuity.characterRules),
    formatRuleBlock("题材规则", rules.genre.visualRules),
    formatRuleBlock("合规规则", [...rules.compliance.positiveRules, ...rules.compliance.negativeRules]),
    `模型参数 Model Tags: ${rules.model.parameterTags.join("; ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  return promptEnhancer.buildProfessionalPrompt(
    {
      type: kind,
      artStyle: rules.context.artStyle,
      targetAge: rules.context.targetAge,
      mood: "warm",
      layout: "centered",
    },
    baseContent
  );
}

export function buildAssetPromptFromEntry(
  kind: AssetPromptKind,
  entry: StoryEntry,
  projectInfo: BuildAssetPromptParams["projectInfo"],
  customParams: PromptCustomParams = {}
) {
  return buildAssetPrompt({
    kind,
    name: entry.name,
    description: entry.description,
    projectInfo,
    customParams,
  });
}

export function buildUserFriendlyAssetPrompt({
  kind,
  name,
  description,
  projectInfo,
  customParams = {},
}: BuildAssetPromptParams) {
  const rules = buildPromptRuleBundle(projectInfo, customParams);
  let prompt = promptEnhancer.buildUserFriendlyPrompt(
    {
      type: kind,
      artStyle: rules.context.artStyle,
      targetAge: rules.context.targetAge,
    },
    {
      name,
      description:
        description ||
        "延续上游故事设定，补足适合儿童绘本的细节，保持角色或场景在全书中的识别一致性。",
    }
  );

  const additions = [
    `题材：${rules.genre.genreLabel}`,
    `风格重点：${rules.style.styleMood}`,
    `合规重点：${formatRulesAsSentence(rules.compliance.positiveRules.slice(0, 2))}`,
  ];

  prompt += ` ${additions.join("。")}。`;

  if (kind === "character") {
    prompt += " 要求完整角色形象、全身、无光影、纯色背景。";
  }

  return prompt;
}

export function buildUserFriendlyAssetPromptFromEntry(
  kind: AssetPromptKind,
  entry: StoryEntry,
  projectInfo: BuildAssetPromptParams["projectInfo"],
  customParams: PromptCustomParams = {}
) {
  return buildUserFriendlyAssetPrompt({
    kind,
    name: entry.name,
    description: entry.description,
    projectInfo,
    customParams,
  });
}
