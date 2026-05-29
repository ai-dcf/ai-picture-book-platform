import { buildImageRefsFromAssets } from "@/lib/prompt-ref-parser";
import { promptEnhancer } from "@/prompts/prompt-enhancer";
import { buildPromptRuleBundle } from "@/prompts/specs";
import type { BuildPagePromptParams, BuildPagePromptResult, PromptCustomParams } from "@/prompts/types";
import type { AssetsData, PageItem, StoryboardPageData } from "@/types/picturebook";
import { buildRuleSummary, findAssetDescriptions, formatRefs, formatRuleBlock, formatRulesAsSentence } from "@/prompts/builders/shared";

function trimTrailingPunctuation(text: string): string {
  return text.trim().replace(/[，。,；、\s]+$/g, "").trim();
}

function resolvePageText({
  page,
  storyboardPage,
}: Pick<BuildPagePromptParams, "page" | "storyboardPage">): string {
  if ("title" in page) {
    return page.title?.trim() || "";
  }
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

function hasExplicitShotInstruction(text: string): boolean {
  return /(远景|全景|大全景|中景|近景|特写|半身|局部|俯视|仰视|鸟瞰|顶视|平视)/.test(text);
}

function buildShotInstruction(visualGoal: string): string {
  if (hasExplicitShotInstruction(visualGoal)) {
    return "当前页已明确提供镜头或构图要求，请优先遵循这些要求，不要回退到默认远景规则。";
  }
  return "当前页未明确提供镜头要求，默认使用远景/全景构图，优先完整展示角色全身、角色之间的位置关系和主要场景空间关系。";
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
    "- 角色固定形象由参考图片承接，不要主动补写固定服饰、固定配饰、固定鞋帽、固定外观或固定颜色方案",
    "- 只有当前页描述中明确出现的新增可见变化，才允许写入页面主体画面描述",
    "- 如果角色没有明确变化，只描述角色名称、数量、站位、朝向、动作、表情以及与场景的关系",
    "- 若当前页没有明确镜头要求，默认按远景或全景构图组织画面，优先完整展示角色全身和主要场景",
    "- 可以引用角色名和场景名，但不要输出提示工程说明或模型参数",
    "- 不要写心理活动、抽象氛围词、镜头外信息或创作说明",
    "- 输出为一行自然中文，适合拼接进最终 AI 绘画提示词",
  ].join("\n");
}

export function buildPagePromptGenerationUserPrompt({
  pageIndex,
  pageLabel,
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
  const sceneDetails = findAssetDescriptions(sceneNames, assets.scenes) || "无";
  const stylePrefix = buildPageProjectStylePrefix(projectInfo, customParams);
  const shotInstruction = buildShotInstruction(visualGoal);

  return [
    `项目标题：${projectInfo.title || "待定"}`,
    `页码：${pageLabel || `第 ${pageIndex + 1} 页`}`,
    `目标年龄：${rules.context.targetAge}岁`,
    `绘本风格：${rules.context.artStyle}`,
    `项目统一风格片段：${stylePrefix}`,
    `页面文字：${pageText}`,
    `画面内容描述：${visualGoal}`,
    `项目角色名称列表：${formatRefs(characterNames, "无明确角色")}`,
    "角色参考图规则：角色固定形象已由参考图承接，不要复述固定服饰、固定配饰、固定鞋帽、固定外观或固定颜色方案。",
    "角色变化规则：只有当前页画面内容描述中明确写出的可见变化才允许写入，例如汗珠、淋湿、手里新增道具或临时装束变化；如果没有明确变化，只写角色名称、数量、站位、朝向、动作、表情和与场景关系。",
    `项目场景名称列表：${formatRefs(sceneNames, "无明确场景")}`,
    `场景设定概览：${sceneDetails}`,
    `镜头构图规则：${shotInstruction}`,
    "",
    "请只生成页面主体画面描述，必须同时满足：",
    "- 与上述项目统一风格片段保持一致",
    "- 覆盖本页角色、场景、动作、构图、光影和色调等可见信息",
    "- 优先使用画面内容描述中的构图、光影和色彩线索",
    "- 默认让角色和场景完整入画，避免在未明确要求时只截取局部或半身",
    "- 不要重复风格名称或风格规则",
    "- 不要输出解释、标题、模型参数或 Markdown",
    "",
    "请直接输出页面主体画面描述。",
  ].join("\n");
}

export function buildBatchPagePromptGenerationSystemPrompt(): string {
  return [
    "你是一位儿童绘本页面画面设计专家。",
    "你的任务是根据项目统一风格片段、引用素材，以及多页的页面文字与画面内容描述，分别为每一页生成页面主体画面描述。",
    "你必须严格遵守以下要求：",
    "- 只输出严格 JSON，不要输出解释、标题、引号外文本或 Markdown 代码块",
    '- JSON 格式必须为 {"prompts":[{"id":"page:页码","visualDescription":"页面主体画面描述"}]}',
    "- 每一页都必须返回对应的 id（id 与输入保持一致）",
    "- visualDescription 只写可见、可绘制的页面主体画面描述，不要重复输出项目风格名称和规则",
    "- 必须覆盖角色、场景、动作、构图、光影和色调等与当前页相关的可见信息",
    "- 角色固定形象由参考图承接，不要复述固定服饰/配饰/鞋帽/外观/固定配色",
    "- 只有当前页画面内容描述中明确写出的可见变化才允许写入；没有变化时只描述角色名称、数量、站位、朝向、动作、表情和与场景关系",
    "- 不要写心理活动、抽象氛围词、镜头外信息或创作说明",
    "- 不要输出“完整绘本单页插画”等固定收尾词（后续会自动拼接）",
  ].join("\n");
}

export function buildBatchPagePromptGenerationUserPrompt({
  pages,
  storyboardPages,
  assets,
  projectInfo,
  customParams = {},
}: {
  pages: Array<Pick<PageItem, "index" | "storyText" | "pageText" | "visualGoal" | "aspectRatio">>;
  storyboardPages?: StoryboardPageData[];
  assets: AssetsData;
  projectInfo: BuildPagePromptParams["projectInfo"];
  customParams?: PromptCustomParams;
}) {
  const rules = buildPromptRuleBundle(projectInfo, customParams);
  const characterNames = collectAssetNames(assets.characters);
  const sceneNames = collectAssetNames(assets.scenes);
  const sceneDetails = findAssetDescriptions(sceneNames, assets.scenes) || "无";
  const stylePrefix = buildPageProjectStylePrefix(projectInfo, customParams);
  const storyboardMap = new Map((storyboardPages || []).map(p => [p.pageIndex, p]));

  return [
    `项目标题：${projectInfo.title || "待定"}`,
    `目标年龄：${rules.context.targetAge}岁`,
    `绘本风格：${rules.context.artStyle}`,
    `项目统一风格片段：${stylePrefix}`,
    `项目角色名称列表：${formatRefs(characterNames, "无明确角色")}`,
    "角色参考图规则：角色固定形象已由参考图承接，不要复述固定服饰、固定配饰、固定鞋帽、固定外观或固定颜色方案。",
    "角色变化规则：只有当前页画面内容描述中明确写出的可见变化才允许写入，例如汗珠、淋湿、手里新增道具或临时装束变化；如果没有明确变化，只写角色名称、数量、站位、朝向、动作、表情和与场景关系。",
    `项目场景名称列表：${formatRefs(sceneNames, "无明确场景")}`,
    `场景设定概览：${sceneDetails}`,
    "",
    "请分别为以下页面生成页面主体画面描述：",
    ...pages.map(p => {
      const sb = storyboardMap.get(p.index);
      const pageText = resolvePageText({ page: p, storyboardPage: sb }) || "无页面文字";
      const visualGoal =
        resolveVisualGoal({ page: p, storyboardPage: sb }) ||
        "请根据页面文字补足适合儿童绘本的单页画面描述。";
      const shotInstruction = buildShotInstruction(visualGoal);
      return [
        `页面：第 ${p.index + 1} 页`,
        `- id: page:${p.index}`,
        `- 页面文字: ${pageText}`,
        `- 画面内容描述: ${visualGoal}`,
        `- 镜头构图规则: ${shotInstruction}`,
      ].join("\n");
    }),
    "",
    "请输出严格 JSON：",
    '{"prompts":[{"id":"page:页码","visualDescription":"页面主体画面描述"}]}',
  ].join("\n");
}

export function buildPagePrompt({
  pageIndex,
  pageLabel,
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
    `页码 Page: ${pageLabel || `第 ${pageIndex + 1} 页`}`,
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
  pageLabel,
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
        name: pageText || pageLabel || `第 ${_pageIndex + 1} 页`,
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
