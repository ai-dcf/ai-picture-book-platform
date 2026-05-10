import "server-only";

import { buildStoryboardSystemPrompt, buildStoryboardUserPrompt } from "@/modules/studio/domain/services/prompt";
import { parseStoryboardResponse } from "@/modules/studio/domain/services/parsers";
import { noModelError, generationFailedError } from "@/modules/studio/domain/errors";
import type { GenerateResult } from "@/modules/studio/domain/errors";
import { get_default_text_strategy, LOG_PREFIX } from "./_helpers";
import type { ProjectInfo, StoryData, StoryboardData } from "@/types/picturebook";

export async function generateStoryboard(
  story: StoryData,
  projectInfo: ProjectInfo
): Promise<GenerateResult<StoryboardData>> {
  const strategy = get_default_text_strategy();
  if (!strategy) return { success: false, error: noModelError() };

  try {
    const result = await strategy.generate({
      systemPrompt: buildStoryboardSystemPrompt(projectInfo.pageCount),
      prompt: buildStoryboardUserPrompt(story, projectInfo),
      temperature: 0.7,
      maxTokens: 6000,
    });

    if (!result.success || !result.text) {
      return {
        success: false,
        error: generationFailedError(result.error?.message || "分镜生成失败"),
      };
    }

    const storyboard = parseStoryboardResponse(result.text, projectInfo.pageCount);
    return { success: true, data: storyboard };
  } catch (err) {
    return {
      success: false,
      error: generationFailedError(
        err instanceof Error ? err.message : "分镜生成异常"
      ),
    };
  }
}
