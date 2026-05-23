import type { StoryEntry } from "@/types/picturebook";
import { promptEnhancer } from "@/prompts/prompt-enhancer";
import { buildPromptRuleBundle } from "@/prompts/specs";
import type { AssetPromptKind, BuildAssetPromptParams, PromptCustomParams } from "@/prompts/types";
import { buildRuleSummary, formatRuleBlock, formatRulesAsSentence } from "@/prompts/builders/shared";

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
    prompt += " 要求全身照片。";
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
