"use server";

import "server-only";

import { generationFailedError, noModelError } from "@/modules/studio/domain/errors";
import type { GenerateResult } from "@/modules/studio/domain/errors";
import { generateAssetImage } from "@/modules/studio/application/use-cases/generate-asset-image";
import { get_default_image_strategy, summarizeProjectInfo, LOG_PREFIX } from "./_helpers";
import type { AssetImageResult, AssetItem, BatchAssetImageResult, ProjectInfo } from "@/types/picturebook";

export async function generateBatchCharacterBaseImages(
  assets: AssetItem[],
  projectInfo: ProjectInfo
): Promise<GenerateResult<BatchAssetImageResult>> {
  const startTime = Date.now();
  console.info(`${LOG_PREFIX} 批量角色参考图生成开始`, {
    ...summarizeProjectInfo(projectInfo),
    count: assets.length,
  });

  if (assets.length === 0) {
    return { success: true, data: { images: [], failedIds: [] } };
  }

  const strategy = get_default_image_strategy();
  if (!strategy) {
    console.warn(`${LOG_PREFIX} 批量角色参考图生成中止：无可用策略`);
    return { success: false, error: noModelError() };
  }

  const images: AssetImageResult[] = [];
  const failedIds: string[] = [];

  for (const asset of assets) {
    try {
      const result = await generateAssetImage(asset, projectInfo);
      if (result.success && result.data) {
        images.push({ id: asset.id, imageUrl: result.data });
      } else {
        failedIds.push(asset.id);
      }
    } catch {
      failedIds.push(asset.id);
    }
  }

  if (images.length === 0) {
    return {
      success: false,
      error: generationFailedError("批量角色参考图生成失败"),
    };
  }

  console.info(`${LOG_PREFIX} 批量角色参考图生成完成`, {
    durationMs: Date.now() - startTime,
    successCount: images.length,
    failedCount: failedIds.length,
  });

  return { success: true, data: { images, failedIds } };
}

