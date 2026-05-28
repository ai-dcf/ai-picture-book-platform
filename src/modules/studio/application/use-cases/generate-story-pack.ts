"use server";

import "server-only";

import { buildStoryPackGeneratorSystemPrompt, buildStoryPackGeneratorUserPrompt } from "@/prompts";
import { parseStoryPackGeneratorResponse } from "@/modules/studio/domain/services/parsers";
import { generationFailedError, noModelError } from "@/modules/studio/domain/errors";
import type { GenerateResult } from "@/modules/studio/domain/errors";
import { get_default_text_strategy, LOG_PREFIX } from "./_helpers";
import type { ProjectInfo } from "@/types/picturebook";
import type { StoryPackData } from "@/prompts/builders/story-pack";

export async function generateStoryPack(
  projectInfo: ProjectInfo,
  userIdea: string
): Promise<GenerateResult<StoryPackData>> {
  const strategy = get_default_text_strategy();
  if (!strategy) return { success: false, error: noModelError() };

  try {
    console.info(`${LOG_PREFIX} StoryPack 生成开始`);

    const result = await strategy.generate({
      systemPrompt: buildStoryPackGeneratorSystemPrompt(),
      prompt: buildStoryPackGeneratorUserPrompt(userIdea || projectInfo.title || ""),
      temperature: 0.65,
      headers: {
        "x-stage": "story-pack",
      },
    });

    if (!result.success || !result.text) {
      throw new Error(result.error?.message || "StoryPack 生成失败");
    }

    const data = parseStoryPackGeneratorResponse(result.text);

    console.info(`${LOG_PREFIX} StoryPack 生成完成`, {
      targetAge: data.meta.targetAge,
      pageCount: data.meta.pageCount,
      artStyle: data.meta.artStyle,
    });

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: generationFailedError(err instanceof Error ? err.message : "StoryPack 生成异常"),
    };
  }
}
