import "server-only";

import { buildPagePrompt } from "@/modules/studio/domain/services/prompt";
import { noModelError, generationFailedError } from "@/modules/studio/domain/errors";
import type { GenerateResult } from "@/modules/studio/domain/errors";
import { get_default_image_strategy } from "./_helpers";
import type { AssetsData, PageItem, ProjectInfo, StoryboardPageData } from "@/types/picturebook";

export async function generatePageImage(
  page: PageItem,
  assets: AssetsData,
  projectInfo: ProjectInfo,
  storyboardPage?: StoryboardPageData
): Promise<GenerateResult<string>> {
  const strategy = get_default_image_strategy();
  if (!strategy) return { success: false, error: noModelError() };

  try {
    const prompt =
      page.promptUserEdited && page.prompt
        ? page.prompt
        : buildPagePrompt({
            pageIndex: page.index,
            page,
            storyboardPage,
            assets,
            projectInfo,
          });

    const sizeMap: Record<string, string> = {
      "3:4": "768x1024",
      "9:16": "768x1366",
      "16:9": "1366x768",
      "1:1": "1024x1024",
    };

    const result = await strategy.generate({
      prompt,
      size: sizeMap[projectInfo.aspectRatio] || "1024x1024",
    });

    if (!result.success || !result.imageUrl) {
      return {
        success: false,
        error: generationFailedError(result.error?.message || "页面图片生成失败"),
      };
    }

    return { success: true, data: result.imageUrl };
  } catch (err) {
    return {
      success: false,
      error: generationFailedError(
        err instanceof Error ? err.message : "页面图片生成异常"
      ),
    };
  }
}
