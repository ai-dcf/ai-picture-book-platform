import { buildImageRefsFromAssets } from "@/lib/prompt-ref-parser";
import { promptEnhancer } from "@/prompts/prompt-enhancer";
import { buildPromptRuleBundle } from "@/prompts/specs";
import type { BuildPagePromptParams, BuildPagePromptResult, PromptCustomParams } from "@/prompts/types";
import { buildRuleSummary, findAssetDescriptions, formatRefs, formatRuleBlock, formatRulesAsSentence } from "@/prompts/builders/shared";

function trimTrailingPunctuation(text: string): string {
  return text.trim().replace(/[，。,；、\s]+$/g, "").trim();
}

function resolvePageText({
  page,
  storyboardPage,
}: Pick<BuildPagePromptParams, "page" | "storyboardPage">): string {
  return page.pageText?.trim() || page.storyText?.trim() || storyboardPage?.text || "";
}

function resolveVisualGoal({
  page,
  storyboardPage,
}: Pick<BuildPagePromptParams, "page" | "storyboardPage">): string {
  return page.visualGoal?.trim() || storyboardPage?.visualGoal || "";
}

function collectAssetNames(
  assets: BuildPagePromptParams["assets"]["characters"] | BuildPagePromptParams["assets"]["scenes"]
): string[] {
  return assets.map(asset => asset.name.trim()).filter(Boolean);
}

function collectPromptMatchedNames(prompt: string, names: string[]): string[] {
  return names
    .map(name => ({ name, index: prompt.indexOf(name) }))
    .filter(item => item.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map(item => item.name);
}

function buildMatchedImageRefs({
  prompt,
  assets,
}: {
  prompt: string;
  assets: BuildPagePromptParams["assets"];
}): BuildPagePromptResult["imageRefs"] {
  const characterNames = collectPromptMatchedNames(prompt, collectAssetNames(assets.characters));
  const sceneNames = collectPromptMatchedNames(prompt, collectAssetNames(assets.scenes));
  return [
    ...buildImageRefsFromAssets(characterNames, assets.characters, "character"),
    ...buildImageRefsFromAssets(sceneNames, assets.scenes, "scene"),
  ];
}

export function buildPageProjectStylePrefix(
  projectInfo: BuildPagePromptParams["projectInfo"],
  customParams: PromptCustomParams = {}
): string {
  const rules = buildPromptRuleBundle(projectInfo, customParams);
  return [
    `${rules.style.styleLabel}绘本页面插画`,
    ...rules.style.coreStyleConstraints,
  ].join("，");
}

export function buildPageFinalPrompt({
  projectInfo,
  visualDescription,
  customParams = {},
}: {
  projectInfo: BuildPagePromptParams["projectInfo"];
  visualDescription: string;
  customParams?: PromptCustomParams;
}) {
  const stylePrefix = buildPageProjectStylePrefix(projectInfo, customParams);
  const mainDescription = trimTrailingPunctuation(visualDescription);
  return [stylePrefix, mainDescription, "完整绘本单页插画"]
    .filter(Boolean)
    .join("，");
}

export function buildPagePromptGenerationSystemPrompt(): string {
  return [
    "你是一位儿童绘本页面画面设计专家。",
    "你的任务是根据项目统一风格片段、页面文字、画面内容描述和引用素材，只生成页面主体画面描述部分。",
    "你必须严格遵守以下要求：",
    "- 只输出页面主体画面描述，不要输出解释、标题、引号、序号或 Markdown",
    "- 不要重复输出项目统一风格片段中的风格名称和风格约束",
    "- 必须使用客观、可见、可绘制的视觉语言",
    "- 必须覆盖角色、场景、动作、构图、光影和色调等与当前页面相关的可见信息",
    "- 可以引用角色名和场景名，但不要输出提示工程说明或模型参数",
    "- 不要写心理活动、抽象氛围词、镜头外信息或创作说明",
    "- 输出为一行自然中文，适合拼接进最终 AI 绘画提示词",
  ].join("\n");
}

export function buildPagePromptGenerationUserPrompt({
  pageIndex,
  page,
  storyboardPage,
  assets,
  projectInfo,
  customParams = {},
}: BuildPagePromptParams) {
  const rules = buildPromptRuleBundle(projectInfo, customParams);
  const pageText = resolvePageText({ page, storyboardPage }) || "无页面文字";
  const visualGoal = resolveVisualGoal({ page, storyboardPage }) || "请根据页面文字补足适合儿童绘本的单页画面描述。";
  const characterNames = collectAssetNames(assets.characters);
  const sceneNames = collectAssetNames(assets.scenes);
  const characterDetails = findAssetDescriptions(characterNames, assets.characters) || "无";
  const sceneDetails = findAssetDescriptions(sceneNames, assets.scenes) || "无";
  const stylePrefix = buildPageProjectStylePrefix(projectInfo, customParams);

  return [
    `项目标题：${projectInfo.title || "待定"}`,
    `页码：第 ${pageIndex + 1} 页`,
    `目标年龄：${rules.context.targetAge}岁`,
    `绘本风格：${rules.context.artStyle}`,
    `项目统一风格片段：${stylePrefix}`,
    `页面文字：${pageText}`,
    `画面内容描述：${visualGoal}`,
    `项目角色名称列表：${formatRefs(characterNames, "无明确角色")}`,
    `角色设定概览：${characterDetails}`,
    `项目场景名称列表：${formatRefs(sceneNames, "无明确场景")}`,
    `场景设定概览：${sceneDetails}`,
    "",
    "请只生成页面主体画面描述，必须同时满足：",
    "- 与上述项目统一风格片段保持一致",
    "- 覆盖本页角色、场景、动作、构图、光影和色调等可见信息",
    "- 优先使用画面内容描述中的构图、光影和色彩线索",
    "- 不要重复风格名称或风格规则",
    "- 不要输出解释、标题、模型参数或 Markdown",
    "",
    "请直接输出页面主体画面描述。",
  ].join("\n");
}

export function buildPagePrompt({
  pageIndex,
  page,
  storyboardPage,
  assets,
  projectInfo,
  customParams = {},
}: BuildPagePromptParams): BuildPagePromptResult {
  const rules = buildPromptRuleBundle(projectInfo, customParams);
  const pageText = resolvePageText({ page, storyboardPage });
  const visualGoal = resolveVisualGoal({ page, storyboardPage }) || "延续当前分镜设定";
  const characterRefs = collectAssetNames(assets.characters);
  const sceneRefs = collectAssetNames(assets.scenes);
  const characterDetails = findAssetDescriptions(characterRefs, assets.characters);
  const sceneDetails = findAssetDescriptions(sceneRefs, assets.scenes);

  const baseContent = [
    `页码 Page: ${pageIndex + 1}`,
    `页面文字 Page Text: ${pageText || "无页面文字。"}`,
    `画面目标 Visual Goal: ${visualGoal}`,
    ...buildRuleSummary(rules),
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

  return { prompt, imageRefs: buildMatchedImageRefs({ prompt, assets }) };
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
  const pageText = resolvePageText({ page, storyboardPage });
  const visualGoal = resolveVisualGoal({ page, storyboardPage }) || "延续当前分镜设定";
  const sceneRefs = collectAssetNames(assets.scenes);
  const imageRefs = buildMatchedImageRefs({ prompt: visualGoal, assets });

  let sceneName: string | undefined;
  let sceneDescription: string | undefined;
  const firstMatchedSceneName = collectPromptMatchedNames(visualGoal, sceneRefs)[0];
  if (firstMatchedSceneName) {
    const sceneAsset = assets.scenes.find((s) => s.name === firstMatchedSceneName);
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
        name: pageText || `第 ${_pageIndex + 1} 页`,
        visualGoal,
        sceneName,
        sceneDescription,
      }
    ),
    pageText ? `页面文字：${pageText}。` : "",
    `题材：${rules.genre.genreLabel}。`,
    `连续性重点：${formatRulesAsSentence(rules.continuity.characterRules.slice(0, 2))}。`,
    `合规重点：${formatRulesAsSentence(rules.compliance.positiveRules.slice(0, 2))}。`,
  ]
    .filter(Boolean)
    .join(" ");

  return { prompt, imageRefs };
}
