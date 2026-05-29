"use server";

import "server-only";

import {
  buildBatchCharacterPromptGenerationSystemPrompt,
  buildBatchCharacterPromptGenerationUserPrompt,
  buildCharacterFinalPrompt,
} from "@/prompts";
import { parseAssetPromptBatchResponse } from "@/modules/studio/domain/services/parsers";
import { generationFailedError, noModelError } from "@/modules/studio/domain/errors";
import type { GenerateResult } from "@/modules/studio/domain/errors";
import { get_default_text_strategy, summarizeProjectInfo, LOG_PREFIX } from "./_helpers";
import type { AssetItem, AssetPromptResult, ProjectInfo } from "@/types/picturebook";

function normalizeBatchId(rawId: string): string {
  return String(rawId || "")
    .trim()
    .replace(/(appearanceDescription|sceneDescription|visualDescription)$/i, "")
    .trim();
}

function resolveAssetFromBatchId(
  assets: Array<Pick<AssetItem, "id" | "name" | "description" | "aspectRatio">>,
  assetMap: Map<string, Pick<AssetItem, "id" | "name" | "description" | "aspectRatio">>,
  rawId: string
): Pick<AssetItem, "id" | "name" | "description" | "aspectRatio"> | null {
  const id = normalizeBatchId(rawId);
  const direct = assetMap.get(rawId) || assetMap.get(id);
  if (direct) return direct;

  const prefixCandidates = assets.filter(a => rawId.startsWith(a.id) || a.id.startsWith(rawId) || id.startsWith(a.id) || a.id.startsWith(id));
  if (prefixCandidates.length === 1) return prefixCandidates[0];

  return null;
}

export async function generateBatchCharacterPrompts(
  assets: Array<Pick<AssetItem, "id" | "name" | "description" | "aspectRatio">>,
  projectInfo: ProjectInfo
): Promise<GenerateResult<AssetPromptResult[]>> {
  const startTime = Date.now();
  console.info(`${LOG_PREFIX} 批量角色提示词生成开始`, {
    ...summarizeProjectInfo(projectInfo),
    count: assets.length,
  });

  if (assets.length === 0) {
    return { success: true, data: [] };
  }

  const strategy = get_default_text_strategy();
  if (!strategy) {
    console.warn(`${LOG_PREFIX} 批量角色提示词生成中止：无可用策略`);
    return { success: false, error: noModelError() };
  }

  try {
    const result = await strategy.generate({
      systemPrompt: buildBatchCharacterPromptGenerationSystemPrompt(),
      prompt: buildBatchCharacterPromptGenerationUserPrompt({ assets, projectInfo }),
      temperature: 0.4,
      maxTokens: Math.max(1200, assets.length * 240),
      headers: {
        "x-stage": "batch-character-prompt",
      },
    });

    if (!result.success || !result.text) {
      return {
        success: false,
        error: generationFailedError(result.error?.message || "批量角色提示词生成失败"),
      };
    }

    const parsed = parseAssetPromptBatchResponse(result.text, "appearanceDescription");
    const assetMap = new Map(assets.map(asset => [asset.id, asset]));
    console.info(`${LOG_PREFIX} 批量角色提示词 JSON 解析完成`, {
      parsedCount: parsed.length,
      parsedIds: parsed.map(p => p.id),
      expectedIds: assets.map(a => a.id),
    });
    const prompts = parsed
      .map(item => {
        const asset = resolveAssetFromBatchId(assets, assetMap, item.id);
        if (!asset) {
          console.warn(`${LOG_PREFIX} 批量角色提示词匹配失败`, {
            rawId: item.id,
            normalizedId: normalizeBatchId(item.id),
          });
          return null;
        }
        return {
          id: asset.id,
          prompt: buildCharacterFinalPrompt({
            projectInfo: { ...projectInfo, aspectRatio: asset.aspectRatio },
            name: asset.name,
            appearanceDescription: item.rawPrompt,
          }),
        };
      })
      .filter((item): item is AssetPromptResult => Boolean(item));

    console.info(`${LOG_PREFIX} 批量角色提示词映射完成`, {
      promptCount: prompts.length,
      promptIds: prompts.map(p => p.id),
      missingIds: assets.map(a => a.id).filter(id => !prompts.some(p => p.id === id)),
    });

    if (prompts.length === 0) {
      return {
        success: false,
        error: generationFailedError("批量角色提示词生成结果为空"),
      };
    }

    console.info(`${LOG_PREFIX} 批量角色提示词生成成功`, {
      durationMs: Date.now() - startTime,
      count: prompts.length,
    });
    return { success: true, data: prompts };
  } catch (err) {
    console.error(`${LOG_PREFIX} 批量角色提示词生成异常`, {
      durationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false,
      error: generationFailedError(err instanceof Error ? err.message : "批量角色提示词生成异常"),
    };
  }
}
