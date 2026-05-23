"use server";

import "server-only";

import {
  buildCharacterPromptGenerationSystemPrompt,
  buildCharacterPromptGenerationUserPrompt,
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

export async function generateCharacterAssetPrompt(
  asset: Pick<AssetItem, "id" | "name" | "description" | "aspectRatio">,
  projectInfo: ProjectInfo
): Promise<GenerateResult<string>> {
  const startTime = Date.now();
  console.info(`${LOG_PREFIX} 角色提示词生成开始`, {
    ...summarizeProjectInfo(projectInfo),
    assetId: asset.id,
    assetName: asset.name,
  });

  const strategy = get_default_text_strategy();
  if (!strategy) {
    console.warn(`${LOG_PREFIX} 角色提示词生成中止：无可用策略`);
    return { success: false, error: noModelError() };
  }

  try {
    const result = await strategy.generate({
      systemPrompt: buildCharacterPromptGenerationSystemPrompt(),
      prompt: buildCharacterPromptGenerationUserPrompt({
        name: asset.name,
        description: asset.description,
        projectInfo: { ...projectInfo, aspectRatio: asset.aspectRatio },
      }),
      temperature: 0.4,
      maxTokens: 300,
    });

    if (!result.success || !result.text) {
      console.warn(`${LOG_PREFIX} 角色提示词生成失败`, {
        durationMs: Date.now() - startTime,
        error: result.error?.message || "模型返回为空",
      });
      return {
        success: false,
        error: generationFailedError(result.error?.message || "角色提示词生成失败"),
      };
    }

    const prompt = sanitizeGeneratedPrompt(result.text);
    if (!prompt) {
      return {
        success: false,
        error: generationFailedError("角色提示词生成结果为空"),
      };
    }

    console.info(`${LOG_PREFIX} 角色提示词生成成功`, {
      durationMs: Date.now() - startTime,
      assetId: asset.id,
      outputLength: prompt.length,
    });
    return { success: true, data: prompt };
  } catch (err) {
    console.error(`${LOG_PREFIX} 角色提示词生成异常`, {
      durationMs: Date.now() - startTime,
      assetId: asset.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false,
      error: generationFailedError(
        err instanceof Error ? err.message : "角色提示词生成异常"
      ),
    };
  }
}
