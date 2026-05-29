import type { ProjectInfo } from "@/types/picturebook";
import { ART_STYLES, PAGE_COUNTS, TARGET_AGES } from "@/types/picturebook";

function listWithoutAuto<T extends string | number>(values: Array<T | "auto">): T[] {
  return values.filter((v): v is T => v !== "auto");
}

export function buildProjectConfigRecommendPrompt(projectInfo: ProjectInfo): string {
  const targetAgeOptions = listWithoutAuto(TARGET_AGES);
  const pageCountOptions = listWithoutAuto(PAGE_COUNTS);
  const artStyleOptions = listWithoutAuto(ART_STYLES);

  const needsTargetAge = projectInfo.targetAge === "auto";
  const needsPageCount = projectInfo.pageCount === "auto";
  const needsArtStyle = projectInfo.artStyle === "auto";

  const requiredKeys = [
    needsTargetAge ? `"recommendedTargetAge"` : null,
    needsArtStyle ? `"recommendedArtStyle"` : null,
    needsPageCount ? `"recommendedPageCount"` : null,
  ].filter(Boolean);

  return `你是一位儿童绘本产品策划师。你的任务是为一个新绘本项目推荐合适的基础配置参数。

你必须严格只输出 JSON（不要输出任何解释、Markdown 或其他内容）。JSON 只允许包含以下字段（仅在需要推荐时输出对应字段；不需要推荐的字段不要输出）：
${requiredKeys.length > 0 ? `- ${requiredKeys.join("\n- ")}` : `- (无需要推荐的字段)`}

字段约束（必须严格从候选列表中选择；不得输出候选列表之外的值）：
- recommendedTargetAge 只能是以下之一：${targetAgeOptions.map(v => `'${v}'`).join(" / ")}
- recommendedPageCount 只能是以下之一：${pageCountOptions.join(" / ")}
- recommendedArtStyle 只能是以下之一：${artStyleOptions.map(v => `'${v}'`).join(" / ")}

输入信息：
- 绘本主题/故事概要：${projectInfo.title || "待定"}

输出示例（仅示例，字段按需输出）：
{"recommendedTargetAge":"3-5","recommendedArtStyle":"水彩温暖风","recommendedPageCount":16}`;
}

