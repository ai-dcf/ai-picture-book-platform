import "server-only";

import { buildProjectConfigRecommendPrompt } from "@/prompts";
import { parseProjectConfigRecommendResponse } from "@/modules/studio/domain/services/parsers";
import { generationFailedError, noModelError } from "@/modules/studio/domain/errors";
import type { GenerateResult } from "@/modules/studio/domain/errors";
import { get_default_text_strategy, summarizeProjectInfo, LOG_PREFIX } from "./_helpers";
import type { ProjectConfigRecommendation, ProjectInfo } from "@/types/picturebook";

export async function recommendProjectConfig(
  projectInfo: ProjectInfo
): Promise<GenerateResult<ProjectConfigRecommendation>> {
  const startTime = Date.now();
  console.info(`${LOG_PREFIX} 参数推荐开始`, summarizeProjectInfo(projectInfo));

  const strategy = get_default_text_strategy();
  if (!strategy) {
    console.warn(`${LOG_PREFIX} 参数推荐中止：无可用策略`);
    return { success: false, error: noModelError() };
  }

  try {
    const result = await strategy.generate({
      systemPrompt: "",
      prompt: buildProjectConfigRecommendPrompt(projectInfo),
      temperature: 0.2,
      maxTokens: 800,
    });

    if (!result.success || !result.text) {
      console.warn(`${LOG_PREFIX} 参数推荐失败`, {
        durationMs: Date.now() - startTime,
        error: result.error?.message || "模型返回为空",
      });
      return {
        success: false,
        error: generationFailedError(result.error?.message || "参数推荐失败"),
      };
    }

    const recommendation = parseProjectConfigRecommendResponse(result.text);
    const hasAny =
      recommendation.recommendedTargetAge ||
      recommendation.recommendedArtStyle ||
      recommendation.recommendedPageCount;

    if (!hasAny) {
      console.warn(`${LOG_PREFIX} 参数推荐无有效结果`, {
        durationMs: Date.now() - startTime,
        outputLength: result.text.length,
      });
      return {
        success: false,
        error: generationFailedError("参数推荐无有效结果"),
      };
    }

    console.info(`${LOG_PREFIX} 参数推荐成功`, {
      durationMs: Date.now() - startTime,
      outputLength: result.text.length,
      ...recommendation,
    });
    return { success: true, data: recommendation };
  } catch (err) {
    console.error(`${LOG_PREFIX} 参数推荐异常`, {
      durationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false,
      error: generationFailedError(
        err instanceof Error ? err.message : "参数推荐异常"
      ),
    };
  }
}

