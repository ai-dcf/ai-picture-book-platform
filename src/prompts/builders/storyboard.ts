import type { ProjectInfo, StoryData } from "@/types/picturebook";
import type { PromptCustomParams } from "@/prompts/types";
import { buildPromptRuleBundle } from "@/prompts/specs";
import { formatRuleBlock } from "@/prompts/builders/shared";
import { getPageTextPrompt, normalizeTargetAge } from "@/config/age-spec";

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
  const resolvedAge = targetAge ? normalizeTargetAge(targetAge as import("@/types/picturebook").TargetAge) : undefined;
  const ageSpecificRequirements = resolvedAge ? getPageTextPrompt(resolvedAge) : "";

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
  - 仅描述可见元素：角色名称、五官表情、姿势动作、场景环境、物品名称、位置关系、材质、光影色彩等
  - 必须可直接用于图片生成，使用具体、可量化、纯视觉化语言，包含景别、构图、视角、光线方向、色温、色彩、动作、背景等元素
  - 角色稳定外观默认继承前文已给出的角色设定；当页没有变化时只写角色名称
  - 只有当页存在造型、装束、道具状态或形体变化时，才补充这些变化点，不要重复展开完整外观
  - 表情必须写成可见细节，如眼睛形态、嘴巴形态、眉毛状态，不要直接写抽象情绪词
  - 场景元素必须尽量明确物体名称、前后/左右/高低位置、材质或表面特征
  - 光影必须尽量明确主光方向与冷暖倾向，例如侧光、逆光、暖黄光、冷蓝光
  - 色彩必须使用具体颜色名称，不要只写"色彩丰富""颜色明快"
  - 禁止出现任何情感、性格、氛围类抽象词，如"开心""活泼""温暖""紧张""孤独"
  - 如确需表达情绪，只能转译为视觉细节，例如将"开心"改写为"嘴巴咧开露齿，眼睛弯成月牙形"
- 页面中出现的角色只能来自前文角色列表，不允许新增任何额外角色
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
    `目标年龄：${rules.context.targetAge}岁，画面风格：${rules.context.artStyle}，总页数：${rules.context.pageCount}页`,
    rules.context.genre ? `题材偏好：${rules.context.genre}` : "",
    rules.context.educationalGoal ? `教育目标：${rules.context.educationalGoal}` : "",
    "",
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
    "分镜中的角色默认继承以上角色设定：无变化时只写角色名称；只有造型、装束、道具状态或形体变化时才补充变化点。",
    "页面中出现的角色只能来自以上角色列表，不允许新增额外角色。",
    "",
    "请为每页创作分镜脚本。",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildCoverSystemPrompt(
  targetAge?: string,
  customParams: PromptCustomParams = {}
): string {
  const genreLine = buildStoryboardGenreLine(customParams);
  const resolvedAge = targetAge ? normalizeTargetAge(targetAge as import("@/types/picturebook").TargetAge) : undefined;
  const ageSpecificRequirements = resolvedAge ? getPageTextPrompt(resolvedAge) : "";

  return `你是一位专业儿童绘本封面设计师。请根据故事内容输出适合绘本封面的标题和纯视觉化封面画面描述。

你必须严格按以下 JSON 格式输出，不要输出任何其他内容：
{
  "title": "封面标题",
  "visualGoal": "封面画面描述"
}

要求：
- title 必须是适合儿童绘本封面的简洁标题，优先参考用户当前项目标题，不要附加多余说明
- visualGoal 必须只描述封面中看得见的画面内容，不要描述心理活动、抽象氛围或设计说明
- visualGoal 必须明确主体角色、关键道具、场景元素、构图、景别、光影、色彩与留白区域
- visualGoal 必须适合生成纯插画封面，不得要求在图中生成任何文字、标题、Logo、水印或装饰边框
- 角色稳定外观默认继承输入中的角色设定；无变化时只写名称
- 页面中出现的角色只能来自输入角色列表，不允许新增任何额外角色
- 标题需适合目标年龄段：${ageSpecificRequirements || "请根据目标年龄段输出简洁、适龄、易理解的标题"}
${genreLine}`;
}

export function buildCoverUserPrompt(
  story: StoryData,
  projectInfo: ProjectInfo,
  customParams: PromptCustomParams = {}
): string {
  const { rules, characterList, sceneList } = buildStoryboardBaseContext(story, projectInfo, customParams);

  return [
    `当前项目标题：${projectInfo.title || "待定"}`,
    `角色：${characterList}`,
    `场景：${sceneList}`,
    "",
    `故事大纲：${story.storyOutline}`,
    "",
    `目标年龄：${rules.context.targetAge}岁，画面风格：${rules.context.artStyle}`,
    rules.context.genre ? `题材偏好：${rules.context.genre}` : "",
    rules.context.educationalGoal ? `教育目标：${rules.context.educationalGoal}` : "",
    "",
    formatRuleBlock("风格视觉规则", [
      ...rules.style.lightingRules.slice(0, 2),
      ...rules.style.textureRules.slice(0, 2),
      ...rules.style.colorRules.slice(0, 2),
      ...rules.style.compositionRules.slice(0, 2),
    ]),
    formatRuleBlock("连续性重点规则", [
      ...rules.continuity.characterRules.slice(0, 2),
      ...rules.continuity.sceneRules.slice(0, 1),
      ...rules.continuity.transitionRules.slice(0, 2),
    ]),
    "",
    "请输出一个适合作为绘本封面的标题，以及一个可直接用于生成纯插画封面的 visualGoal。",
    "封面 visualGoal 必须说明主体、动作、场景、构图、光影、色彩和文字留白区域，但不得要求在图中直接生成文字。",
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
  const resolvedAge = targetAge ? normalizeTargetAge(targetAge as import("@/types/picturebook").TargetAge) : undefined;
  const ageSpecificRequirements = resolvedAge ? getPageTextPrompt(resolvedAge) : "";

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
    `目标年龄：${rules.context.targetAge}岁，画面风格：${rules.context.artStyle}，总页数：${rules.context.pageCount}页`,
    rules.context.genre ? `题材偏好：${rules.context.genre}` : "",
    rules.context.educationalGoal ? `教育目标：${rules.context.educationalGoal}` : "",
    "",
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
  - Character（角色）：角色名称；如当页造型、装束、道具状态或形体有变化，再补充变化点
  - Expression（表情细节）：眼睛 + 嘴巴 + 眉毛等可见形态
  - Action（动作姿态）：角色动作 + 肢体朝向 + 与道具/环境的互动
  - Lighting（光影）：主光方向 + 色温，不得写抽象氛围词
  - Color（色彩）：主色调/点缀色 + 冷暖倾向，使用具体颜色名称
  - Background（背景叙事）：环境要素 2-4 个，并尽量写明位置或材质
  - Text Safe Area（排版留白）：明确配文安全区
  - No Text（禁止事项）：不得生成任何文字/水印/Logo/签名/边框
- 全文必须采用具体、可量化、纯视觉化语言，禁止使用任何情感、性格、氛围类抽象词，如"活泼""温暖""梦幻"
- 如需要表达情绪，只能翻译成看得见的五官或动作细节，例如"嘴角上扬露齿，眼睛弯起"
- 角色稳定外观默认继承输入中的角色设定；无变化时只写名称，不要重复展开完整外观
- 页面中出现的角色只能来自输入角色列表，不允许新增任何额外角色
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
    `目标年龄：${rules.context.targetAge}岁，画面风格：${rules.context.artStyle}`,
    "",
    formatRuleBlock("风格视觉规则", [
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
    "角色默认继承以上角色设定：无变化时只写名称；只有当页状态或外观有变化时才补充变化点。",
    "只允许使用以上角色列表中的角色，不允许新增额外角色。",
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
