"use server";

import "server-only";

import { buildStoryPackCheckerSystemPrompt, buildStoryPackCheckerUserPrompt } from "@/prompts";
import { parseStoryPackCheckReport } from "@/modules/studio/domain/services/parsers";
import { generationFailedError, noModelError } from "@/modules/studio/domain/errors";
import type { GenerateResult } from "@/modules/studio/domain/errors";
import { get_default_text_strategy, LOG_PREFIX } from "./_helpers";
import type { StoryPackCheckReport } from "@/prompts/builders/story-pack";

export async function checkStoryPack(
  userIdea: string,
  generatedJson: string
): Promise<GenerateResult<StoryPackCheckReport>> {
  const strategy = get_default_text_strategy();
  if (!strategy) return { success: false, error: noModelError() };

  try {
    console.info(`${LOG_PREFIX} StoryPack 检查开始`);

    const result = await strategy.generate({
      systemPrompt: buildStoryPackCheckerSystemPrompt(),
      prompt: buildStoryPackCheckerUserPrompt(userIdea, generatedJson),
      temperature: 0.2,
      headers: {
        "x-stage": "story-pack-check",
      },
    });

    if (!result.success || !result.text) {
      throw new Error(result.error?.message || "StoryPack 检查失败");
    }

    const report = parseStoryPackCheckReport(result.text);
    return { success: true, data: report };
  } catch (err) {
    return {
      success: false,
      error: generationFailedError(err instanceof Error ? err.message : "StoryPack 检查异常"),
    };
  }
}

