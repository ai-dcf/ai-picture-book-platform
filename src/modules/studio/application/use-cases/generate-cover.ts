"use server";

import "server-only";

import {
  buildCoverSystemPrompt,
  buildCoverUserPrompt,
} from "@/prompts";
import { parseCoverResponse } from "@/modules/studio/domain/services/parsers/storyboard-parser";
import { noModelError, generationFailedError } from "@/modules/studio/domain/errors";
import type { GenerateResult } from "@/modules/studio/domain/errors";
import { get_default_text_strategy, LOG_PREFIX } from "./_helpers";
import type { CoverData, ProjectInfo, StoryData } from "@/types/picturebook";
import type { PromptCustomParams } from "@/prompts";

export async function generateCover(
  story: StoryData,
  projectInfo: ProjectInfo,
  promptOptions: PromptCustomParams = {}
): Promise<GenerateResult<Pick<CoverData, "title" | "visualGoal">>> {
  const strategy = get_default_text_strategy();
  if (!strategy) return { success: false, error: noModelError() };

  try {
    console.info(`${LOG_PREFIX} 封面内容生成开始`, {
      title: projectInfo.title,
      targetAge: projectInfo.targetAge,
      artStyle: projectInfo.artStyle,
    });

    const result = await strategy.generate({
      systemPrompt: buildCoverSystemPrompt(projectInfo.targetAge, promptOptions),
      prompt: buildCoverUserPrompt(story, projectInfo, promptOptions),
      temperature: 0.55,
      headers: {
        "x-stage": "cover",
      },
    });

    if (!result.success || !result.text) {
      throw new Error(result.error?.message || "封面内容生成失败");
    }

    const cover = parseCoverResponse(result.text);
    return { success: true, data: cover };
  } catch (err) {
    return {
      success: false,
      error: generationFailedError(
        err instanceof Error ? err.message : "封面内容生成异常"
      ),
    };
  }
}
