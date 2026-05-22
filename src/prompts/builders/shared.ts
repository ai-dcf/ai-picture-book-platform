import type { AssetItem } from "@/types/picturebook";
import type { PromptRuleBundle } from "@/prompts/types";

export function formatRuleBlock(title: string, lines: string[]): string {
  if (lines.length === 0) return "";
  return `${title}:\n- ${lines.join("\n- ")}`;
}

export function formatRulesAsSentence(lines: string[]): string {
  return lines.filter(Boolean).join("；");
}

export function formatRefs(items: string[], fallback: string) {
  return items.length > 0 ? items.join("、") : fallback;
}

export function findAssetDescriptions(names: string[], assets: AssetItem[]) {
  return names
    .map((name) => assets.find((asset) => asset.name === name))
    .filter((asset): asset is AssetItem => Boolean(asset))
    .map((asset) => `${asset.name}：${asset.description || "按既定设定保持一致"}`)
    .join("；");
}

export function buildRuleSummary(bundle: PromptRuleBundle): string[] {
  const contextRules = [
    `受众 Audience: ${bundle.visual.targetAgeLabel}`,
    `风格 Style: ${bundle.style.styleLabel}，整体气质 ${bundle.style.styleMood}`,
  ];

  if (bundle.context.genre) {
    contextRules.push(`题材 Genre: ${bundle.genre.genreLabel}`);
  }

  if (bundle.context.educationalGoal) {
    contextRules.push(`教育目标 Educational Goal: ${bundle.context.educationalGoal}`);
  }

  if (bundle.context.culturalTone) {
    contextRules.push(`文化语气 Cultural Tone: ${bundle.context.culturalTone}`);
  }

  if (bundle.customParams.colorOverride) {
    contextRules.push(`色彩覆盖 Color Override: ${bundle.customParams.colorOverride}`);
  }

  return contextRules;
}
