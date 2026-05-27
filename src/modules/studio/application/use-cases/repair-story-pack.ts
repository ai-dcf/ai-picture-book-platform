"use server";

import "server-only";

import { buildStoryPackRepairerSystemPrompt, buildStoryPackRepairerUserPrompt } from "@/prompts";
import { parseStoryPackGeneratorResponse } from "@/modules/studio/domain/services/parsers";
import { generationFailedError, noModelError } from "@/modules/studio/domain/errors";
import type { GenerateResult } from "@/modules/studio/domain/errors";
import { get_default_text_strategy, LOG_PREFIX } from "./_helpers";
import type { StoryPackData, StoryPackCheckReport } from "@/prompts/builders/story-pack";

export async function repairStoryPack(
  userIdea: string,
  originalJson: string,
  checkReport: StoryPackCheckReport
): Promise<GenerateResult<StoryPackData>> {
  const strategy = get_default_text_strategy();
  if (!strategy) return { success: false, error: noModelError() };

  try {
    console.info(`${LOG_PREFIX} StoryPack 修复开始`);

    const result = await strategy.generate({
      systemPrompt: buildStoryPackRepairerSystemPrompt(),
      prompt: buildStoryPackRepairerUserPrompt(userIdea, originalJson, JSON.stringify(checkReport)),
      temperature: 0.45,
      headers: {
        "x-stage": "story-pack-repair",
      },
    });

    if (!result.success || !result.text) {
      throw new Error(result.error?.message || "StoryPack 修复失败");
    }

    const data = parseStoryPackGeneratorResponse(result.text);

    console.info(`${LOG_PREFIX} StoryPack 修复完成`, {
      targetAge: data.meta.targetAge,
      pageCount: data.meta.pageCount,
      artStyle: data.meta.artStyle,
    });

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: generationFailedError(err instanceof Error ? err.message : "StoryPack 修复异常"),
    };
  }
}

