import type { StoryEntry } from "@/types/picturebook";
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
  appearanceDescription,
  customParams = {},
}: {
  projectInfo: BuildAssetPromptParams["projectInfo"];
  appearanceDescription: string;
  customParams?: PromptCustomParams;
}) {
  const stylePrefix = buildCharacterProjectStylePrefix(projectInfo, customParams);
  const appearance = trimTrailingPunctuation(appearanceDescription);
  return [stylePrefix, appearance, "全身", "无光影", "纯色背景"]
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
