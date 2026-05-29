import "server-only";

import {
  buildStoryboardSystemPrompt,
  buildStoryboardUserPrompt,
} from "@/prompts";
import {
  parseStoryboardResponse,
} from "@/modules/studio/domain/services/parsers";
import { noModelError, generationFailedError } from "@/modules/studio/domain/errors";
import type { GenerateResult } from "@/modules/studio/domain/errors";
import { get_default_text_strategy, LOG_PREFIX } from "./_helpers";
import type { ProjectInfo, StoryData, StoryboardData } from "@/types/picturebook";
import type { PromptCustomParams } from "@/prompts";

export async function generateStoryboard(
  story: StoryData,
  projectInfo: ProjectInfo,
  promptOptions: PromptCustomParams = {}
): Promise<GenerateResult<StoryboardData>> {
  const pageCount = projectInfo.pageCount === "auto" ? 16 : projectInfo.pageCount;
  const strategy = get_default_text_strategy();
  if (!strategy) return { success: false, error: noModelError() };

  try {
    console.info(`${LOG_PREFIX} 分镜生成开始`, {
      pageCount,
    });

    const result = await strategy.generate({
      systemPrompt: buildStoryboardSystemPrompt(pageCount, projectInfo.targetAge, promptOptions),
      prompt: buildStoryboardUserPrompt(story, projectInfo, promptOptions),
      temperature: 0.65,
      headers: {
        "x-stage": "storyboard",
        "x-page-range": `0-${pageCount - 1}`,
        "x-batch-index": "0",
      },
    });

    if (!result.success || !result.text) {
      throw new Error(result.error?.message || "分镜生成失败");
    }

    const storyboard = parseStoryboardResponse(result.text, pageCount);

    console.info(`${LOG_PREFIX} 分镜生成完成`, {
      pageCount,
    });

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
