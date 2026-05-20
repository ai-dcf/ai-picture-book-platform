import "server-only";

import { buildAssetPrompt } from "@/modules/studio/domain/services/prompt";
import { noModelError, generationFailedError } from "@/modules/studio/domain/errors";
import type { GenerateResult } from "@/modules/studio/domain/errors";
import { get_default_image_strategy } from "./_helpers";
import type { AssetItem, ProjectInfo } from "@/types/picturebook";
import { promptEnhancer } from "@/lib/prompt-enhancer";

export async function generateAssetImage(
  asset: AssetItem,
  projectInfo: ProjectInfo
): Promise<GenerateResult<string>> {
  const strategy = get_default_image_strategy();
  if (!strategy) return { success: false, error: noModelError() };

  try {
    const kind = asset.id.includes("scene") ? "scene" : "character";
    let prompt =
      asset.promptUserEdited && asset.prompt
        ? asset.prompt
        : buildAssetPrompt({
            kind,
            name: asset.name,
            description: asset.description,
            projectInfo: { ...projectInfo, aspectRatio: asset.aspectRatio },
          });

    // 如果是用户编辑的友好提示词，转换为专业提示词
    if (asset.promptUserEdited && asset.prompt) {
      prompt = promptEnhancer.convertUserPromptToProfessional(prompt, {
        type: kind,
        artStyle: projectInfo.artStyle,
        targetAge: projectInfo.targetAge,
        mood: 'warm',
        layout: 'centered'
      });
    }

    const sizeMap: Record<string, string> = {
      "3:4": "768x1024",
      "9:16": "768x1366",
      "16:9": "1366x768",
      "1:1": "1024x1024",
    };

    const result = await strategy.generate({
      prompt,
      size: sizeMap[asset.aspectRatio] || "1024x1024",
    });

    if (!result.success || !result.imageUrl) {
      return {
        success: false,
        error: generationFailedError(result.error?.message || "资产图片生成失败"),
      };
    }

    return { success: true, data: result.imageUrl };
  } catch (err) {
    return {
      success: false,
      error: generationFailedError(
        err instanceof Error ? err.message : "资产图片生成异常"
      ),
    };
  }
}
