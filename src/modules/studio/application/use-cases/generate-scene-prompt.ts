"use server";

import "server-only";

import {
  buildScenePromptGenerationSystemPrompt,
  buildScenePromptGenerationUserPrompt,
  buildUserFriendlyAssetPrompt,
} from "@/prompts";
import { generationFailedError, noModelError } from "@/modules/studio/domain/errors";
import type { GenerateResult } from "@/modules/studio/domain/errors";
import { get_default_text_strategy, summarizeProjectInfo, LOG_PREFIX } from "./_helpers";
import type { AssetItem, ProjectInfo } from "@/types/picturebook";

function sanitizeGeneratedPrompt(text: string): string {
  return text
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\r?\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function generateScenePrompt(
  asset: Pick<AssetItem, "id" | "name" | "description" | "aspectRatio">,
  projectInfo: ProjectInfo
): Promise<GenerateResult<string>> {
  const startTime = Date.now();
  console.info(`${LOG_PREFIX} 场景提示词生成开始`, {
    ...summarizeProjectInfo(projectInfo),
    assetId: asset.id,
    assetName: asset.name,
  });

  const strategy = get_default_text_strategy();
  if (!strategy) {
    return { success: false, error: noModelError() };
  }

  try {
    const result = await strategy.generate({
      systemPrompt: buildScenePromptGenerationSystemPrompt(),
      prompt: buildScenePromptGenerationUserPrompt({
        name: asset.name,
        description: asset.description,
        projectInfo: { ...projectInfo, aspectRatio: asset.aspectRatio },
      }),
      temperature: 0.4,
      maxTokens: 320,
      headers: {
        "x-stage": "scene-prompt",
      },
    });

    if (!result.success || !result.text) {
      return {
        success: false,
        error: generationFailedError(result.error?.message || "场景提示词生成失败"),
      };
    }

    const sceneDescription = sanitizeGeneratedPrompt(result.text);
    if (!sceneDescription) {
      return {
        success: false,
        error: generationFailedError("场景提示词生成结果为空"),
      };
    }

    const prompt = buildUserFriendlyAssetPrompt({
      kind: "scene",
      name: asset.name,
      description: sceneDescription,
      projectInfo: { ...projectInfo, aspectRatio: asset.aspectRatio },
    });

    console.info(`${LOG_PREFIX} 场景提示词生成成功`, {
      durationMs: Date.now() - startTime,
      assetId: asset.id,
      outputLength: prompt.length,
    });
    return { success: true, data: prompt };
  } catch (err) {
    console.error(`${LOG_PREFIX} 场景提示词生成异常`, {
      durationMs: Date.now() - startTime,
      assetId: asset.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false,
      error: generationFailedError(err instanceof Error ? err.message : "场景提示词生成异常"),
    };
  }
}
