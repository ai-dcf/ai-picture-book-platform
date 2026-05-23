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
    { "name": "角色名", "description": "角色外貌与性格描述" }
  ],
  "scenes": [
    { "name": "场景名", "description": "场景环境与氛围描述" }
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

  if (projectInfo.targetAge === "auto") {
    lines.push(`目标年龄：请根据绘本主题自动分析最适合的年龄段`);
  } else {
    lines.push(`目标年龄：${rules.context.targetAge}岁`);
  }

  if (projectInfo.artStyle === "auto") {
    lines.push(`画面风格：请根据绘本主题自动选择最适合的绘画风格`);
  } else {
    lines.push(`画面风格：${rules.context.artStyle}`);
  }

  lines.push(`画面比例：${rules.context.aspectRatio}`);

  if (projectInfo.pageCount === "auto") {
    lines.push(`总页数：请根据故事复杂度自动选择合适的页数（可选：8/12/16/24/32）`);
  } else {
    lines.push(`总页数：${rules.context.pageCount}页`);
  }

  if (rules.context.genre) lines.push(`题材偏好：${rules.context.genre}`);
  if (rules.context.tone) lines.push(`叙事基调：${rules.context.tone}`);
  if (rules.context.educationalGoal) lines.push(`教育目标：${rules.context.educationalGoal}`);
  if (rules.context.culturalTone) lines.push(`文化语气：${rules.context.culturalTone}`);

  lines.push("");
  lines.push("请创作一个适合以上设定的儿童绘本故事。");
  lines.push(
    formatRuleBlock("年龄视觉原则", rules.visual.ageGuidance),
    formatRuleBlock("题材原则", rules.genre.storyRules),
    formatRuleBlock("合规原则", [...rules.compliance.positiveRules, ...rules.compliance.negativeRules])
  );

  if (
    projectInfo.targetAge === "auto" ||
    projectInfo.artStyle === "auto" ||
    projectInfo.pageCount === "auto"
  ) {
    lines.push("");
    lines.push("注意：请在输出的JSON中额外添加以下字段：");
    if (projectInfo.targetAge === "auto") {
      lines.push("- recommendedTargetAge: 你推荐的目标年龄段（只能是 '0-3'/'3-6'/'6-9'/'9-12' 中的一个）");
    }
    if (projectInfo.artStyle === "auto") {
      lines.push("- recommendedArtStyle: 你推荐的绘画风格（只能是现有风格列表中的一个）");
    }
    if (projectInfo.pageCount === "auto") {
      lines.push("- recommendedPageCount: 你推荐的页数（只能是 8/12/16/24/32 中的一个数字）");
    }
  }

  return lines.filter(Boolean).join("\n");
}
