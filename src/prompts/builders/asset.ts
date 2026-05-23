import type { StoryEntry } from "@/types/picturebook";
import { promptEnhancer } from "@/prompts/prompt-enhancer";
import { buildPromptRuleBundle } from "@/prompts/specs";
import type { AssetPromptKind, BuildAssetPromptParams, PromptCustomParams } from "@/prompts/types";
import { buildRuleSummary, formatRuleBlock, formatRulesAsSentence } from "@/prompts/builders/shared";

export function buildCharacterPromptGenerationSystemPrompt(): string {
  return [
    "你是一位儿童绘本角色 AI 绘画提示词专家。",
    "你的任务是根据项目绘本风格和角色描述，生成一条可直接用于 AI 绘画的中文角色提示词。",
    "你必须严格遵守以下要求：",
    "- 只输出最终提示词，不要输出解释、标题、引号、序号或 Markdown",
    "- 必须明确体现项目当前选择的绘本风格",
    "- 必须描写人物完整形象，并且明确为全身",
    "- 必须明确写出无光影、纯色背景",
    "- 必须使用客观、可见、可绘制的视觉语言",
    "- 不要写剧情概述、心理活动、抽象情绪词、镜头外信息",
    "- 输出为一行自然中文，适合直接提交给 AI 绘画模型",
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

  return [
    `项目标题：${projectInfo.title || "待定"}`,
    `目标年龄：${rules.context.targetAge}岁`,
    `绘本风格：${rules.context.artStyle}`,
    `风格气质：${rules.style.styleMood}`,
    `材质表现：${rules.style.textureRules.join("；")}`,
    `色彩规则：${rules.style.colorRules.join("；")}`,
    `角色名称：${name}`,
    `角色描述：${details}`,
    "",
    "请生成 1 条角色 AI 绘画提示词，必须同时满足：",
    "- 项目级统一风格由上述“绘本风格”决定",
    "- 人物完整形象",
    "- 全身",
    "- 无光影",
    "- 纯色背景",
    "",
    "请直接输出最终提示词。",
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
