import "server-only";

import {
  buildStoryboardOutlineSystemPrompt,
  buildStoryboardOutlineUserPrompt,
  buildStoryboardVisualGoalSystemPrompt,
  buildStoryboardVisualGoalUserPrompt,
} from "@/prompts";
import {
  parseStoryboardOutlineResponse,
  parseStoryboardVisualGoalBatchResponse,
  type StoryboardOutlinePageDraft,
} from "@/modules/studio/domain/services/parsers";
import { noModelError, generationFailedError } from "@/modules/studio/domain/errors";
import type { GenerateResult } from "@/modules/studio/domain/errors";
import { get_default_text_strategy, LOG_PREFIX } from "./_helpers";
import type { ProjectInfo, StoryData, StoryboardData } from "@/types/picturebook";
import type { PromptCustomParams } from "@/prompts";

const STORYBOARD_OUTLINE_MAX_TOKENS = 3200;
const STORYBOARD_VISUAL_BATCH_MAX_TOKENS = 2600;
const STORYBOARD_VISUAL_BATCH_SIZE = 4;

function chunkPages<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

async function generateStoryboardOutline(
  strategy: NonNullable<ReturnType<typeof get_default_text_strategy>>,
  story: StoryData,
  projectInfo: ProjectInfo,
  pageCount: number,
  promptOptions: PromptCustomParams
): Promise<StoryboardOutlinePageDraft[]> {
  const result = await strategy.generate({
    systemPrompt: buildStoryboardOutlineSystemPrompt(pageCount, projectInfo.targetAge, promptOptions),
    prompt: buildStoryboardOutlineUserPrompt(story, projectInfo, promptOptions),
    temperature: 0.7,
    maxTokens: STORYBOARD_OUTLINE_MAX_TOKENS,
    headers: {
      "x-stage": "outline",
      "x-page-range": `0-${pageCount - 1}`,
      "x-batch-index": "0",
    },
  });

  if (!result.success || !result.text) {
    throw new Error(result.error?.message || "分镜页纲生成失败");
  }

  return parseStoryboardOutlineResponse(result.text, pageCount);
}

async function generateStoryboardVisualGoalBatches(
  strategy: NonNullable<ReturnType<typeof get_default_text_strategy>>,
  story: StoryData,
  projectInfo: ProjectInfo,
  outlinePages: StoryboardOutlinePageDraft[],
  promptOptions: PromptCustomParams
): Promise<Map<number, string>> {
  const visualGoalMap = new Map<number, string>();
  const batches = chunkPages(outlinePages, STORYBOARD_VISUAL_BATCH_SIZE);

  for (const [batchIndex, batchPages] of batches.entries()) {
    const firstPageIndex = batchPages[0]?.pageIndex ?? 0;
    const lastPageIndex = batchPages[batchPages.length - 1]?.pageIndex ?? firstPageIndex;
    const result = await strategy.generate({
      systemPrompt: buildStoryboardVisualGoalSystemPrompt(),
      prompt: buildStoryboardVisualGoalUserPrompt(story, projectInfo, batchPages, promptOptions),
      temperature: 0.6,
      maxTokens: STORYBOARD_VISUAL_BATCH_MAX_TOKENS,
      headers: {
        "x-stage": "visual-goal-batch",
        "x-page-range": `${firstPageIndex}-${lastPageIndex}`,
        "x-batch-index": String(batchIndex),
      },
    });

    if (!result.success || !result.text) {
      throw new Error(result.error?.message || `第 ${batchIndex + 1} 批视觉目标生成失败`);
    }

    const drafts = parseStoryboardVisualGoalBatchResponse(
      result.text,
      batchPages.map((page) => page.pageIndex)
    );

    for (const draft of drafts) {
      visualGoalMap.set(draft.pageIndex, draft.visualGoal);
    }
  }

  return visualGoalMap;
}

export async function generateStoryboard(
  story: StoryData,
  projectInfo: ProjectInfo,
  promptOptions: PromptCustomParams = {}
): Promise<GenerateResult<StoryboardData>> {
  const pageCount = projectInfo.pageCount === "auto" ? 16 : projectInfo.pageCount;
  const strategy = get_default_text_strategy();
  if (!strategy) return { success: false, error: noModelError() };

  try {
    console.info(`${LOG_PREFIX} 分镜生成开始`, {
      pageCount,
      batchSize: STORYBOARD_VISUAL_BATCH_SIZE,
    });

    const outlinePages = await generateStoryboardOutline(
      strategy,
      story,
      projectInfo,
      pageCount,
      promptOptions
    );
    const visualGoalMap = await generateStoryboardVisualGoalBatches(
      strategy,
      story,
      projectInfo,
      outlinePages,
      promptOptions
    );

    const storyboard: StoryboardData = {
      generating: false,
      pages: outlinePages.map((page) => ({
        pageIndex: page.pageIndex,
        text: page.text,
        visualGoal: visualGoalMap.get(page.pageIndex) || page.visualSummary,
        userModified: false,
      })),
    };

    console.info(`${LOG_PREFIX} 分镜生成完成`, {
      pageCount,
      generatedVisualGoals: visualGoalMap.size,
    });

    return { success: true, data: storyboard };
  } catch (err) {
    return {
      success: false,
      error: generationFailedError(
        err instanceof Error ? err.message : "分镜生成异常"
      ),
    };
  }
}
