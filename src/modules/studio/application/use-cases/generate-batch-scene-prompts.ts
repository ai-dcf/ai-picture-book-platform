"use server";

import "server-only";

import {
  buildBatchScenePromptGenerationSystemPrompt,
  buildBatchScenePromptGenerationUserPrompt,
  buildUserFriendlyAssetPrompt,
} from "@/prompts";
import { parseAssetPromptBatchResponse } from "@/modules/studio/domain/services/parsers";
import { generationFailedError, noModelError } from "@/modules/studio/domain/errors";
import type { GenerateResult } from "@/modules/studio/domain/errors";
import { get_default_text_strategy, summarizeProjectInfo, LOG_PREFIX } from "./_helpers";
import type { AssetItem, AssetPromptResult, ProjectInfo } from "@/types/picturebook";

export async function generateBatchScenePrompts(
  assets: Array<Pick<AssetItem, "id" | "name" | "description" | "aspectRatio">>,
  projectInfo: ProjectInfo
): Promise<GenerateResult<AssetPromptResult[]>> {
  const startTime = Date.now();
  console.info(`${LOG_PREFIX} 批量场景提示词生成开始`, {
    ...summarizeProjectInfo(projectInfo),
    count: assets.length,
  });

  if (assets.length === 0) {
    return { success: true, data: [] };
  }

  const strategy = get_default_text_strategy();
  if (!strategy) {
    return { success: false, error: noModelError() };
  }

  try {
    const result = await strategy.generate({
      systemPrompt: buildBatchScenePromptGenerationSystemPrompt(),
      prompt: buildBatchScenePromptGenerationUserPrompt({ assets, projectInfo }),
      temperature: 0.4,
      maxTokens: Math.max(1200, assets.length * 220),
      headers: {
        "x-stage": "batch-scene-prompt",
      },
    });

    if (!result.success || !result.text) {
      return {
        success: false,
        error: generationFailedError(result.error?.message || "批量场景提示词生成失败"),
      };
    }

    const parsed = parseAssetPromptBatchResponse(result.text, "sceneDescription");
    const assetMap = new Map(assets.map(asset => [asset.id, asset]));
    const prompts = parsed
      .map(item => {
        const asset = assetMap.get(item.id);
        if (!asset) return null;
        return {
          id: item.id,
          prompt: buildUserFriendlyAssetPrompt({
            kind: "scene",
            name: asset.name,
            description: item.rawPrompt,
            projectInfo: { ...projectInfo, aspectRatio: asset.aspectRatio },
          }),
        };
      })
      .filter((item): item is AssetPromptResult => Boolean(item));

    if (prompts.length === 0) {
      return {
        success: false,
        error: generationFailedError("批量场景提示词生成结果为空"),
      };
    }

    console.info(`${LOG_PREFIX} 批量场景提示词生成成功`, {
      durationMs: Date.now() - startTime,
      count: prompts.length,
    });
    return { success: true, data: prompts };
  } catch (err) {
    console.error(`${LOG_PREFIX} 批量场景提示词生成异常`, {
      durationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false,
      error: generationFailedError(err instanceof Error ? err.message : "批量场景提示词生成异常"),
    };
  }
}
