import "server-only";

import { buildPagePrompt } from "@/modules/studio/domain/services/prompt";
import { noModelError, generationFailedError } from "@/modules/studio/domain/errors";
import type { GenerateResult } from "@/modules/studio/domain/errors";
import { get_default_image_strategy } from "./_helpers";
import type { AssetsData, ImageRef, PageItem, ProjectInfo, StoryboardPageData } from "@/types/picturebook";
import type { ImageGenerateParams, ImageRefInput } from "@/platform/ai/contracts/image-model-gateway";
import { replaceRefTagsWithDescription } from "@/lib/prompt-ref-parser";
import { promptEnhancer } from "@/lib/prompt-enhancer";

const MAX_REF_IMAGES = 14;

export async function generatePageImage(
  page: PageItem,
  assets: AssetsData,
  projectInfo: ProjectInfo,
  storyboardPage?: StoryboardPageData
): Promise<GenerateResult<string>> {
  const strategy = get_default_image_strategy();
  if (!strategy) return { success: false, error: noModelError() };

  try {
    const promptResult =
      page.promptUserEdited && page.prompt
        ? { prompt: page.prompt, imageRefs: page.imageRefs || [] }
        : buildPagePrompt({
            pageIndex: page.index,
            page,
            storyboardPage,
            assets,
            projectInfo,
          });

    const validImageRefs = (promptResult.imageRefs || []).filter(
      (ref: ImageRef) => ref.imageUrl
    );

    if (validImageRefs.length > MAX_REF_IMAGES) {
      return {
        success: false,
        error: generationFailedError(
          `参考图不能超过 ${MAX_REF_IMAGES} 张，当前引用了 ${validImageRefs.length} 张`
        ),
      };
    }

    let processedPrompt = replaceRefTagsWithDescription(
      promptResult.prompt,
      validImageRefs
    );

    // 如果是用户编辑的友好提示词，转换为专业提示词
    if (page.promptUserEdited && page.prompt) {
      processedPrompt = promptEnhancer.convertUserPromptToProfessional(processedPrompt, {
        type: 'page',
        artStyle: projectInfo.artStyle,
        targetAge: projectInfo.targetAge,
        mood: 'warm',
        layout: 'golden'
      });
    }

    const sizeMap: Record<string, string> = {
      "3:4": "768x1024",
      "9:16": "768x1366",
      "16:9": "1366x768",
      "1:1": "1024x1024",
    };

    const effectiveRatio = page.aspectRatio || projectInfo.aspectRatio;
    const generateParams: ImageGenerateParams = {
      prompt: processedPrompt,
      size: sizeMap[effectiveRatio] || "1024x1024",
    };

    if (validImageRefs.length > 0) {
      generateParams.images = validImageRefs.map((ref: ImageRef): ImageRefInput => ({
        url: ref.imageUrl,
        name: ref.assetName,
        type: ref.assetType,
      }));
    }

    const result = await strategy.generate(generateParams);

    if (!result.success || !result.imageUrl) {
      return {
        success: false,
        error: generationFailedError(result.error?.message || "页面图片生成失败"),
      };
    }

    return { success: true, data: result.imageUrl };
  } catch (err) {
    return {
      success: false,
      error: generationFailedError(
        err instanceof Error ? err.message : "页面图片生成异常"
      ),
    };
  }
}
