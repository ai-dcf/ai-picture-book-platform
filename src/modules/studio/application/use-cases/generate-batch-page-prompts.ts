"use server";

import "server-only";

import {
  buildBatchPagePromptGenerationSystemPrompt,
  buildBatchPagePromptGenerationUserPrompt,
  buildPageFinalPrompt,
} from "@/prompts";
import { annotatePromptWithNumberedRefs, buildImageRefsFromAssets } from "@/lib/prompt-ref-parser";
import { parseAssetPromptBatchResponse } from "@/modules/studio/domain/services/parsers";
import { generationFailedError, noModelError } from "@/modules/studio/domain/errors";
import type { GenerateResult } from "@/modules/studio/domain/errors";
import { get_default_text_strategy, summarizeProjectInfo, LOG_PREFIX } from "./_helpers";
import type { AssetsData, PageItem, PagePromptBatchResult, ProjectInfo, StoryboardPageData } from "@/types/picturebook";

function parsePageIndexFromId(id: string): number | null {
  const match = /^page:(\d+)$/.exec(id.trim());
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export async function generateBatchPagePrompts(
  pages: Array<Pick<PageItem, "index" | "storyText" | "pageText" | "visualGoal" | "aspectRatio">>,
  assets: AssetsData,
  projectInfo: ProjectInfo,
  storyboardPages?: StoryboardPageData[]
): Promise<GenerateResult<PagePromptBatchResult[]>> {
  const startTime = Date.now();
  console.info(`${LOG_PREFIX} 批量页面提示词生成开始`, {
    ...summarizeProjectInfo(projectInfo),
    count: pages.length,
  });

  if (pages.length === 0) {
    return { success: true, data: [] };
  }

  const strategy = get_default_text_strategy();
  if (!strategy) {
    console.warn(`${LOG_PREFIX} 批量页面提示词生成中止：无可用策略`);
    return { success: false, error: noModelError() };
  }

  try {
    const result = await strategy.generate({
      systemPrompt: buildBatchPagePromptGenerationSystemPrompt(),
      prompt: buildBatchPagePromptGenerationUserPrompt({
        pages,
        storyboardPages,
        assets,
        projectInfo,
      }),
      temperature: 0.35,
      maxTokens: Math.max(1800, pages.length * 320),
      headers: {
        "x-stage": "batch-page-prompt",
      },
    });

    if (!result.success || !result.text) {
      return {
        success: false,
        error: generationFailedError(result.error?.message || "批量页面提示词生成失败"),
      };
    }

    const parsed = parseAssetPromptBatchResponse(result.text, "visualDescription");
    const pageMap = new Map(pages.map(p => [p.index, p]));

    const allCharacterImageRefs = buildImageRefsFromAssets(
      assets.characters.map(asset => asset.name),
      assets.characters,
      "character"
    );
    const allSceneImageRefs = buildImageRefsFromAssets(
      assets.scenes.map(asset => asset.name),
      assets.scenes,
      "scene"
    );
    const candidateImageRefs = [...allCharacterImageRefs, ...allSceneImageRefs];
    const candidateNames = candidateImageRefs.map(ref => ref.assetName);

    const prompts = parsed
      .map(item => {
        const pageIndex = parsePageIndexFromId(item.id);
        if (pageIndex === null) return null;
        const page = pageMap.get(pageIndex);
        if (!page) return null;

        const effectiveProjectInfo = {
          ...projectInfo,
          aspectRatio: page.aspectRatio || projectInfo.aspectRatio,
        };

        const basePrompt = buildPageFinalPrompt({
          projectInfo: effectiveProjectInfo,
          visualDescription: item.rawPrompt,
        });

        const annotated = annotatePromptWithNumberedRefs(
          basePrompt,
          candidateImageRefs,
          candidateNames
        );

        return {
          index: pageIndex,
          prompt: annotated.prompt,
          imageRefs: annotated.imageRefs,
        };
      })
      .filter((item): item is PagePromptBatchResult => Boolean(item))
      .sort((a, b) => a.index - b.index);

    if (prompts.length === 0) {
      return {
        success: false,
        error: generationFailedError("批量页面提示词生成结果为空"),
      };
    }

    console.info(`${LOG_PREFIX} 批量页面提示词生成成功`, {
      durationMs: Date.now() - startTime,
      count: prompts.length,
    });

    return { success: true, data: prompts };
  } catch (err) {
    console.error(`${LOG_PREFIX} 批量页面提示词生成异常`, {
      durationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false,
      error: generationFailedError(err instanceof Error ? err.message : "批量页面提示词生成异常"),
    };
  }
}

