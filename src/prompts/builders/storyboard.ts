import type { ProjectInfo, StoryData } from "@/types/picturebook";
import type { PromptCustomParams } from "@/prompts/types";
import { buildPromptRuleBundle } from "@/prompts/specs";
import { formatRuleBlock } from "@/prompts/builders/shared";
import { getAgeGroupPageTextPromptByTargetAge } from "@/config/age-group.config";

function buildStoryboardGenreLine(customParams: PromptCustomParams): string {
  return customParams.genre
    ? `- 题材优先级：${customParams.genre}`
    : "- 请根据故事内容自动选择最合适的绘本分镜表达";
}

function buildStoryboardBaseContext(story: StoryData, projectInfo: ProjectInfo, customParams: PromptCustomParams) {
  const rules = buildPromptRuleBundle(projectInfo, customParams);
  const characterList = story.characters.map((c) => `${c.name}：${c.description}`).join("；");
  const sceneList = story.scenes.map((s) => `${s.name}：${s.description}`).join("；");

  return {
    rules,
    characterList,
    sceneList,
  };
}

export function buildStoryboardSystemPrompt(
  pageCount: number,
  targetAge?: string,
  customParams: PromptCustomParams = {}
): string {
  
  const genreLine = buildStoryboardGenreLine(customParams);
  const ageSpecificRequirements = targetAge ? getAgeGroupPageTextPromptByTargetAge(targetAge) : "";

  return `你是一位专业绘本分镜导演。请根据故事内容为 ${pageCount} 页绘本创作分镜脚本。

你必须严格按以下 JSON 格式输出，不要输出任何其他内容：
{
  "pages": [
    {
      "text": "本页呈现的文字内容",
      "visualGoal": "客观画面内容描述"
    }
  ]
}

要求：
- 输出恰好 ${pageCount} 页
- text 文字要求：${ageSpecificRequirements || "请根据目标年龄段输出简洁、适龄、易理解的页面文字"}
- visualGoal 必须仅包含客观可呈现的视觉内容描述，完全避免任何抽象心理活动、情绪感受类描述：
  - 仅描述可见元素：角色动作、场景环境、物品位置、光影色彩等
  - 必须可直接用于图片生成，使用结构化描述，包含景别、构图、光影、色彩、动作、背景等元素
  - 禁止出现“很开心”“生气”“难过”这类主观情绪描述
- 相邻页之间必须体现故事的逻辑连续性
${genreLine}`;
}

export function buildStoryboardUserPrompt(
  story: StoryData,
  projectInfo: ProjectInfo,
  customParams: PromptCustomParams = {}
): string {
  const { rules, characterList, sceneList } = buildStoryboardBaseContext(story, projectInfo, customParams);

  return [
    `角色：${characterList}`,
    `场景：${sceneList}`,
    "",
    `故事大纲：${story.storyOutline}`,
    "",
    `目标年龄：${rules.context.targetAge}岁，画面风格：${rules.context.artStyle}，总页数：${rules.context.pageCount}页，画面比例：${rules.context.aspectRatio}`,
    rules.context.genre ? `题材偏好：${rules.context.genre}` : "",
    rules.context.educationalGoal ? `教育目标：${rules.context.educationalGoal}` : "",
    "",
    formatRuleBlock("年龄视觉规则", [
      ...rules.visual.ageGuidance,
      ...rules.visual.compositionRules,
      ...rules.visual.detailRules,
    ]),
    formatRuleBlock("风格视觉规则", [
      ...rules.style.lightingRules,
      ...rules.style.textureRules,
      ...rules.style.colorRules,
      ...rules.style.compositionRules,
    ]),
    formatRuleBlock("连续性规则", [
      ...rules.continuity.characterRules,
      ...rules.continuity.sceneRules,
      ...rules.continuity.transitionRules,
    ]),
    formatRuleBlock("题材规则", rules.genre.storyboardRules),
    formatRuleBlock("合规规则", [...rules.compliance.positiveRules, ...rules.compliance.negativeRules]),
    "",
    "请为每页创作分镜脚本。",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildStoryboardOutlineSystemPrompt(
  pageCount: number,
  targetAge?: string,
  customParams: PromptCustomParams = {}
): string {
  const genreLine = buildStoryboardGenreLine(customParams);
  const ageSpecificRequirements = targetAge ? getAgeGroupPageTextPromptByTargetAge(targetAge) : "";

  return `你是一位专业绘本分镜导演。请先根据故事内容为 ${pageCount} 页绘本生成轻量分页页纲。

你必须严格按以下 JSON 格式输出，不要输出任何其他内容：
{
  "pages": [
    {
      "text": "本页呈现的文字内容",
      "visualSummary": "本页画面内容摘要"
    }
  ]
}

要求：
- 输出恰好 ${pageCount} 页
- text 文字要求：${ageSpecificRequirements || "请根据目标年龄段输出简洁、适龄、易理解的页面文字"}
- visualSummary 用1-2句概括本页核心可见画面内容，不要包含心理情绪描述
- 相邻页之间体现故事的逻辑连续性
${genreLine}`;
}

export function buildStoryboardOutlineUserPrompt(
  story: StoryData,
  projectInfo: ProjectInfo,
  customParams: PromptCustomParams = {}
): string {
  const { rules, characterList, sceneList } = buildStoryboardBaseContext(story, projectInfo, customParams);
  const continuityFocusRules = [
    ...rules.continuity.characterRules.slice(0, 2),
    ...rules.continuity.sceneRules.slice(0, 1),
    ...rules.continuity.transitionRules.slice(0, 2),
  ];

  return [
    `角色：${characterList}`,
    `场景：${sceneList}`,
    "",
    `故事大纲：${story.storyOutline}`,
    "",
    `目标年龄：${rules.context.targetAge}岁，画面风格：${rules.context.artStyle}，总页数：${rules.context.pageCount}页，画面比例：${rules.context.aspectRatio}`,
    rules.context.genre ? `题材偏好：${rules.context.genre}` : "",
    rules.context.educationalGoal ? `教育目标：${rules.context.educationalGoal}` : "",
    "",
    formatRuleBlock("年龄视觉规则", [
      ...rules.visual.ageGuidance,
      ...rules.visual.compositionRules.slice(0, 2),
      ...rules.visual.detailRules.slice(0, 2),
    ]),
    formatRuleBlock("风格视觉规则", [
      ...rules.style.lightingRules.slice(0, 2),
      ...rules.style.textureRules.slice(0, 2),
      ...rules.style.colorRules.slice(0, 2),
      ...rules.style.compositionRules.slice(0, 2),
    ]),
    formatRuleBlock("连续性重点规则", continuityFocusRules),
    formatRuleBlock("题材规则", rules.genre.storyboardRules),
    formatRuleBlock("合规规则", [
      ...rules.compliance.positiveRules.slice(0, 3),
      ...rules.compliance.negativeRules.slice(0, 5),
    ]),
    "",
    "请先输出轻量分页页纲，不要在这一阶段展开完整 visualGoal。",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildStoryboardVisualGoalSystemPrompt(): string {
  return `你是一位专业绘本分镜导演。请根据已确定的分页页纲，为指定页面补全可直接用于图片生成的 visualGoal。

你必须严格按以下 JSON 格式输出，不要输出任何其他内容：
{
  "pages": [
    {
      "pageIndex": 0,
      "visualGoal": "画面视觉目标描述"
    }
  ]
}

要求：
- 只补全输入页面的 visualGoal，不得改写或补充其他字段
- visualGoal 必须可直接用于图片生成，并使用多行结构化描述
- visualGoal 至少包含以下标签：
  - Shot（景别/镜头）：close-up/medium/wide + 视角 + 焦点主体
  - Composition（构图）：主体位置 + 前中后景关系 + 留白策略
  - Lighting（光影）：主光方向 + 氛围
  - Color（色彩）：主色调/点缀色 + 冷暖倾向
  - Action & Emotion（动作与情绪）：角色动作 + 情绪表达
  - Background（背景叙事）：环境要素 2-4 个
  - Text Safe Area（排版留白）：明确配文安全区
  - No Text（禁止事项）：不得生成任何文字/水印/Logo/签名/边框
- 相邻页之间必须体现连续性：镜头衔接、道具状态、角色朝向、场景延续至少命中其一`;
}

export function buildStoryboardVisualGoalUserPrompt(
  story: StoryData,
  projectInfo: ProjectInfo,
  batchPages: Array<{
    pageIndex: number;
    text: string;
    visualSummary: string;
  }>,
  customParams: PromptCustomParams = {}
): string {
  const { rules, characterList, sceneList } = buildStoryboardBaseContext(story, projectInfo, customParams);

  return [
    `角色：${characterList}`,
    `场景：${sceneList}`,
    `目标年龄：${rules.context.targetAge}岁，画面风格：${rules.context.artStyle}，画面比例：${rules.context.aspectRatio}`,
    "",
    formatRuleBlock("视觉补全规则", [
      ...rules.visual.ageGuidance,
      ...rules.visual.textSafeAreaRules,
      ...rules.style.lightingRules.slice(0, 2),
      ...rules.style.colorRules.slice(0, 2),
      ...rules.style.textureRules.slice(0, 2),
    ]),
    formatRuleBlock("连续性重点规则", [
      ...rules.continuity.characterRules.slice(0, 2),
      ...rules.continuity.sceneRules.slice(0, 1),
      ...rules.continuity.transitionRules.slice(0, 2),
    ]),
    formatRuleBlock("合规规则", [
      ...rules.compliance.positiveRules.slice(0, 3),
      ...rules.compliance.negativeRules.slice(0, 5),
    ]),
    "",
    "待补全页面：",
    JSON.stringify(
      batchPages.map((page) => ({
        pageIndex: page.pageIndex,
        text: page.text,
        visualSummary: page.visualSummary,
      })),
      null,
      2
    ),
    "",
    "请仅返回这些页面的 visualGoal。",
  ].join("\n");
}
