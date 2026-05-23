import "server-only";

import { buildAssetPrompt, buildPromptRuleBundle } from "@/prompts";
import { noModelError, generationFailedError } from "@/modules/studio/domain/errors";
import type { GenerateResult } from "@/modules/studio/domain/errors";
import { get_default_image_strategy } from "./_helpers";
import type { AssetItem, ProjectInfo } from "@/types/picturebook";
import { promptEnhancer } from "@/prompts/prompt-enhancer";
import type { PromptCustomParams } from "@/prompts";

function stableSeedFromString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const seed = (hash >>> 0) % 2147483647;
  return seed === 0 ? 1 : seed;
}

export async function generateAssetImage(
  asset: AssetItem,
  projectInfo: ProjectInfo,
  promptOptions: PromptCustomParams = {}
): Promise<GenerateResult<string>> {
  const strategy = get_default_image_strategy();
  if (!strategy) return { success: false, error: noModelError() };

  try {
    const kind = asset.id.includes("scene") ? "scene" : "character";
    const rules = buildPromptRuleBundle(
      { ...projectInfo, aspectRatio: asset.aspectRatio },
      promptOptions
    );
    const currentPrompt = asset.prompt?.trim();
    let prompt =
      kind === "character"
        ? currentPrompt ||
          buildAssetPrompt({
            kind,
            name: asset.name,
            description: asset.description,
            projectInfo: { ...projectInfo, aspectRatio: asset.aspectRatio },
            customParams: promptOptions,
          })
        : asset.promptUserEdited && currentPrompt
          ? currentPrompt
          : buildAssetPrompt({
              kind,
              name: asset.name,
              description: asset.description,
              projectInfo: { ...projectInfo, aspectRatio: asset.aspectRatio },
              customParams: promptOptions,
            });

    // 场景仍保留用户友好提示词到专业提示词的转换；角色直接使用当前提示词。
    if (kind === "scene" && asset.promptUserEdited && currentPrompt) {
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
      negativePrompt: [...rules.compliance.negativePrompt, ...rules.model.negativePrompt].join(", "),
      seed: stableSeedFromString(`${projectInfo.projectId}:asset:${asset.id}`),
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
