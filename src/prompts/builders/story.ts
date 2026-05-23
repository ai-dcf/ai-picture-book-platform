import type { ProjectInfo } from "@/types/picturebook";
import type { PromptCustomParams } from "@/prompts/types";
import { buildPromptRuleBundle } from "@/prompts/specs";
import { formatRuleBlock } from "@/prompts/builders/shared";

export function buildStorySystemPrompt(customParams: PromptCustomParams = {}): string {
  const genreLine = customParams.genre ? `- 当前题材重点：${customParams.genre}` : "- 如未指定题材，请选择最适合儿童绘本的安全题材表达";
  const educationalGoalLine = customParams.educationalGoal
    ? `- 教育目标：${customParams.educationalGoal}`
    : "- 如适合，可自然融入温和的成长或认知启发";

  return `你是一位专业儿童绘本编剧与儿童内容策划师。请根据用户提供的信息创作绘本故事。

你必须严格按以下 JSON 格式输出，不要输出任何其他内容：
{
  "characters": [
    { "name": "角色名", "description": "角色可视化描述（仅写能直接用于绘画提示词的内容）" }
  ],
  "scenes": [
    { "name": "场景名", "description": "场景可视化描述（仅写能直接用于绘画提示词的内容）" }
  ],
  "emotionCurve": [
    { "label": "情节标签", "emotion": "情绪词", "intensity": 数字-6到4, "isTurningPoint": 布尔值 }
  ],
  "storyOutline": "故事大纲，分段描述每个阶段的发展"
}

要求：
- 角色数量 2-5 个，每个角色有鲜明辨识特征，且适合后续视觉统一
- 场景数量 3-6 个，与故事情节紧密配合，便于后续分镜与资产生成
- 情绪曲线包含 5-8 个关键点，至少 1 个转折点
- 故事大纲 200-400 字，清晰描述起承转合
- 内容必须适合目标年龄段儿童，语言温暖有节奏感，便于亲子共读
- 避免成人化、惊悚化、暴力化叙事
- characters[].description 必须是可量化的视觉描述，只写“看起来是什么样”，不要写性格、内心、感受、氛围等抽象词
  - 必须包含：物种/外形（体型、轮廓）、主色与辅色、服饰与配件、显著辨识点（如门牙/雀斑/发型）、典型姿势 1-2 个、典型表情 1-2 个
  - 抽象词必须翻译成可画的细节：例如“活泼”应写成“嘴角大幅上扬露出门牙、眼睛弯成倒 U、单脚微跳、双手叉腰”等
- scenes[].description 必须是可量化的视觉描述，只写“画面里有什么、怎么摆、光怎么打”，不要写“治愈/安全/梦幻”等抽象氛围词
  - 必须包含：镜头景别（近景/中景/远景）、构图（前景/中景/背景各有哪些元素）、时间与天气、光线方向与色温、主色调与饱和度、材质/纹理（如蜡笔/水彩/纸张颗粒）
  - 使用短句分隔信息（句号或分号），便于直接复制为绘画提示词
${genreLine}
${educationalGoalLine}
- 如果是经典改编，保留原作核心精神，表达适龄化但不失真
- 如果是科普启蒙，知识点应准确、易懂、可视化`;
}

export function buildStoryUserPrompt(
  projectInfo: ProjectInfo,
  customParams: PromptCustomParams = {}
): string {
  const rules = buildPromptRuleBundle(projectInfo, customParams);
  const lines = [`绘本标题：${projectInfo.title || "待定"}`];

  lines.push(`目标年龄：${rules.context.targetAge}岁`);
  lines.push(`画面风格：${rules.context.artStyle}`);

  lines.push(`总页数：${rules.context.pageCount}页`);

  if (rules.context.genre) lines.push(`题材偏好：${rules.context.genre}`);
  if (rules.context.tone) lines.push(`叙事基调：${rules.context.tone}`);
  if (rules.context.educationalGoal) lines.push(`教育目标：${rules.context.educationalGoal}`);
  if (rules.context.culturalTone) lines.push(`文化语气：${rules.context.culturalTone}`);

  lines.push("");
  lines.push("请创作一个适合以上设定的儿童绘本故事。");
  lines.push(
    formatRuleBlock("题材原则", rules.genre.storyRules),
    formatRuleBlock("合规原则", [...rules.compliance.positiveRules, ...rules.compliance.negativeRules])
  );

  return lines.filter(Boolean).join("\n");
}
