import "server-only";

import { buildStorySystemPrompt, buildStoryUserPrompt } from "@/modules/studio/domain/services/prompt";
import { parseStoryResponse } from "@/modules/studio/domain/services/parsers";
import { noModelError, generationFailedError } from "@/modules/studio/domain/errors";
import type { GenerateResult } from "@/modules/studio/domain/errors";
import { get_default_text_strategy, summarizeProjectInfo, LOG_PREFIX } from "./_helpers";
import type { ProjectInfo, StoryData } from "@/types/picturebook";

export async function generateStory(
  projectInfo: ProjectInfo
): Promise<GenerateResult<StoryData>> {
  const startTime = Date.now();
  console.info(`${LOG_PREFIX} 故事生成开始`, summarizeProjectInfo(projectInfo));

  const strategy = get_default_text_strategy();
  if (!strategy) {
    console.warn(`${LOG_PREFIX} 故事生成中止：无可用策略`);
    return { success: false, error: noModelError() };
  }

  try {
    const result = await strategy.generate({
      systemPrompt: buildStorySystemPrompt(),
      prompt: buildStoryUserPrompt(projectInfo),
      temperature: 0.8,
      maxTokens: 4000,
    });

    if (!result.success || !result.text) {
      console.warn(`${LOG_PREFIX} 故事生成失败`, {
        durationMs: Date.now() - startTime,
        error: result.error?.message || "模型返回为空",
      });
      return {
        success: false,
        error: generationFailedError(result.error?.message || "故事生成失败"),
      };
    }

    const story = parseStoryResponse(result.text);
    console.info(`${LOG_PREFIX} 故事生成成功`, {
      durationMs: Date.now() - startTime,
      outputLength: result.text.length,
      characterCount: story.characters.length,
      sceneCount: story.scenes.length,
      emotionPointCount: story.emotionCurve.length,
      recommendedTargetAge: story.recommendedTargetAge,
      recommendedArtStyle: story.recommendedArtStyle,
      recommendedPageCount: story.recommendedPageCount,
    });
    return { success: true, data: story };
  } catch (err) {
    console.error(`${LOG_PREFIX} 故事生成异常`, {
      durationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false,
      error: generationFailedError(
        err instanceof Error ? err.message : "故事生成异常"
      ),
    };
  }
}
