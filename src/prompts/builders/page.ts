import { injectRefTags } from "@/lib/prompt-ref-parser";
import { promptEnhancer } from "@/prompts/prompt-enhancer";
import { buildPromptRuleBundle } from "@/prompts/specs";
import type { BuildPagePromptParams, BuildPagePromptResult } from "@/prompts/types";
import { buildRuleSummary, findAssetDescriptions, formatRefs, formatRuleBlock, formatRulesAsSentence } from "@/prompts/builders/shared";

export function buildPagePrompt({
  pageIndex,
  page,
  storyboardPage,
  assets,
  projectInfo,
  customParams = {},
}: BuildPagePromptParams): BuildPagePromptResult {
  const rules = buildPromptRuleBundle(projectInfo, customParams);
  const storyText = page.storyText || storyboardPage?.text || "";
  const visualGoal = storyboardPage?.visualGoal || "延续当前分镜设定";
  const characterRefs = page.characterRefs.length > 0 ? page.characterRefs : (storyboardPage?.characterRefs || []);
  const sceneRefs = page.sceneRefs.length > 0 ? page.sceneRefs : (storyboardPage?.sceneRefs || []);
  const characterDetails = findAssetDescriptions(characterRefs, assets.characters);
  const sceneDetails = findAssetDescriptions(sceneRefs, assets.scenes);

  const refNames = [...characterRefs, ...sceneRefs].filter((name) => {
    const charAsset = assets.characters.find((a) => a.name === name);
    const sceneAsset = assets.scenes.find((a) => a.name === name);
    return (charAsset && charAsset.officialImageUrl) || (sceneAsset && sceneAsset.officialImageUrl);
  });

  const { text: enrichedStoryText, imageRefs } =
    refNames.length > 0
      ? injectRefTags(storyText, refNames, assets.characters, assets.scenes)
      : { text: storyText, imageRefs: [] };

  const baseContent = [
    `页码 Page: ${pageIndex + 1}`,
    `故事情节 Story Content: ${enrichedStoryText || "保持与当前分镜一致的叙事内容。"}`,
    `画面目标 Visual Goal: ${visualGoal}`,
    ...buildRuleSummary(rules),
    formatRuleBlock("年龄视觉规则", [
      ...rules.visual.ageGuidance,
      ...rules.visual.colorRules,
      ...rules.visual.compositionRules,
      ...rules.visual.detailRules,
      ...rules.visual.textSafeAreaRules,
    ]),
    formatRuleBlock("风格规则", [
      ...rules.style.lightingRules,
      ...rules.style.textureRules,
      ...rules.style.colorRules,
      ...rules.style.compositionRules,
    ]),
    formatRuleBlock("连续性规则", [
      ...rules.continuity.characterRules,
      ...rules.continuity.sceneRules,
      ...rules.continuity.propRules,
      ...rules.continuity.transitionRules,
    ]),
    formatRuleBlock("题材规则", [...rules.genre.visualRules, ...rules.genre.complianceRules]),
    formatRuleBlock("合规规则", [...rules.compliance.positiveRules, ...rules.compliance.negativeRules]),
    `模型参数 Model Tags: ${rules.model.parameterTags.join("; ")}`,
    characterRefs.length > 0
      ? `角色 Characters: ${formatRefs(characterRefs, "无明确角色")}${
          characterDetails ? `\n角色细节 Character Details: ${characterDetails}` : ""
        }`
      : "",
    sceneRefs.length > 0
      ? `场景 Scenes: ${formatRefs(sceneRefs, "无明确场景")}${
          sceneDetails ? `\n场景细节 Scene Details: ${sceneDetails}` : ""
        }`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = promptEnhancer.buildProfessionalPrompt(
    {
      type: "page",
      artStyle: rules.context.artStyle,
      targetAge: rules.context.targetAge,
      mood: "warm",
      layout: "golden",
    },
    baseContent
  );

  return { prompt, imageRefs };
}

export function buildUserFriendlyPagePrompt({
  pageIndex: _pageIndex,
  page,
  storyboardPage,
  assets,
  projectInfo,
  customParams = {},
}: BuildPagePromptParams): { prompt: string; imageRefs: BuildPagePromptResult["imageRefs"] } {
  const rules = buildPromptRuleBundle(projectInfo, customParams);
  const visualGoal = storyboardPage?.visualGoal || "延续当前分镜设定";
  const characterRefs = page.characterRefs.length > 0 ? page.characterRefs : (storyboardPage?.characterRefs || []);
  const sceneRefs = page.sceneRefs.length > 0 ? page.sceneRefs : (storyboardPage?.sceneRefs || []);

  const refNames = [...characterRefs, ...sceneRefs].filter((name) => {
    const charAsset = assets.characters.find((a) => a.name === name);
    const sceneAsset = assets.scenes.find((a) => a.name === name);
    return (charAsset && charAsset.officialImageUrl) || (sceneAsset && sceneAsset.officialImageUrl);
  });

  const { text: processedVisualGoal, imageRefs } =
    refNames.length > 0
      ? injectRefTags(visualGoal, refNames, assets.characters, assets.scenes)
      : { text: visualGoal, imageRefs: [] };

  let sceneName: string | undefined;
  let sceneDescription: string | undefined;
  if (sceneRefs.length > 0) {
    const sceneAsset = assets.scenes.find((s) => s.name === sceneRefs[0]);
    if (sceneAsset) {
      sceneName = sceneAsset.name;
      sceneDescription = sceneAsset.description;
    }
  }

  const prompt = [
    promptEnhancer.buildUserFriendlyPrompt(
      {
        type: "page",
        artStyle: rules.context.artStyle,
        targetAge: rules.context.targetAge,
      },
      {
        visualGoal: processedVisualGoal,
        sceneName,
        sceneDescription,
      }
    ),
    `题材：${rules.genre.genreLabel}。`,
    `连续性重点：${formatRulesAsSentence(rules.continuity.characterRules.slice(0, 2))}。`,
    `合规重点：${formatRulesAsSentence(rules.compliance.positiveRules.slice(0, 2))}。`,
  ]
    .filter(Boolean)
    .join(" ");

  return { prompt, imageRefs };
}
