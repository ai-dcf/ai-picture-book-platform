"use server";

import "server-only";

import {
  buildPageFinalPrompt,
  buildPagePromptGenerationSystemPrompt,
  buildPagePromptGenerationUserPrompt,
} from "@/prompts";
import { generationFailedError, noModelError } from "@/modules/studio/domain/errors";
import type { GenerateResult } from "@/modules/studio/domain/errors";
import { get_default_text_strategy, summarizeProjectInfo, LOG_PREFIX } from "./_helpers";
import type {
  AssetsData,
  CoverData,
  GenerateTargetKind,
  ImageRef,
  PageItem,
  ProjectInfo,
  StoryboardPageData,
} from "@/types/picturebook";
import type { GeneratePagePromptResult } from "@/prompts";
import { annotatePromptWithNumberedRefs, buildImageRefsFromAssets } from "@/lib/prompt-ref-parser";

function sanitizeGeneratedPrompt(text: string): string {
  return text
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\r?\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractJsonArray(text: string): string[] | null {
  const trimmed = text.trim();
  const direct = tryParseNameList(trimmed);
  if (direct) return direct;
  const match = trimmed.match(/\[[\s\S]*\]/);
  if (!match) return null;
  return tryParseNameList(match[0]);
}

function tryParseNameList(text: string): string[] | null {
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean);
  } catch {
    return null;
  }
}

function buildPageRefSelectionSystemPrompt(): string {
  return [
    "你是一位绘本提示词引用标注助手。",
    "你的任务是从页面 AI 绘画提示词中识别实际出现且应该引用的角色或场景名称。",
    "你必须严格遵守以下要求：",
    '- 只返回 JSON 数组，例如 ["猪老大","猪老二"]',
    "- 不要返回解释、Markdown、代码块或多余文字",
    "- 数组中的名称必须来自给定候选名称列表",
    "- 名称顺序必须与这些名称在提示词中第一次出现的先后顺序一致",
    "- 只返回提示词中确实出现且需要引用的名称",
  ].join("\n");
}

function buildPageRefSelectionUserPrompt(prompt: string, candidateRefs: ImageRef[]): string {
  const candidateNames = candidateRefs.map(ref => ref.assetName);
  return [
    `候选名称列表：${candidateNames.join("、") || "无"}`,
    "",
    "请从下面这段页面 AI 绘画提示词中，识别出实际出现且应该引用的角色或场景名称。",
    "如果没有命中，请返回 []。",
    "",
    "提示词：",
    prompt,
  ].join("\n");
}

function sortNamesByPromptOrder(prompt: string, names: string[]): string[] {
  return names
    .map(name => ({ name, index: prompt.indexOf(name) }))
    .filter(item => item.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map(item => item.name);
}

export async function generatePagePrompt(
  target: PageItem | CoverData,
  assets: AssetsData,
  projectInfo: ProjectInfo,
  storyboardPage?: StoryboardPageData,
  arg5: GenerateTargetKind = "page"
): Promise<GenerateResult<GeneratePagePromptResult>> {
  const startTime = Date.now();
  const kind = arg5;
  const pageIndex = kind === "page" ? (target as PageItem).index : -1;
  const pageLabel = kind === "cover" ? "封面" : `第 ${pageIndex + 1} 页`;
  const promptTarget = kind === "cover"
    ? {
        title: (target as CoverData).title,
        visualGoal: (target as CoverData).visualGoal,
      }
    : target;

  console.info(`${LOG_PREFIX} 页面提示词生成开始`, {
    ...summarizeProjectInfo(projectInfo),
    kind,
    pageIndex,
  });

  const strategy = get_default_text_strategy();
  if (!strategy) {
    console.warn(`${LOG_PREFIX} 页面提示词生成中止：无可用策略`);
    return { success: false, error: noModelError() };
  }

  try {
    const effectiveProjectInfo = {
      ...projectInfo,
      aspectRatio: target.aspectRatio || projectInfo.aspectRatio,
    };

    console.info(`${LOG_PREFIX} [步骤1] 开始第一次模型调用：生成页面主体画面描述`, {
      kind,
      pageIndex,
      hasStoryboardPage: !!storyboardPage,
      assetsCharCount: assets.characters.length,
      assetsSceneCount: assets.scenes.length,
      pageText: ("title" in promptTarget
        ? promptTarget.title
        : (promptTarget.pageText || promptTarget.storyText || "")
      ).slice(0, 50),
      visualGoal: (promptTarget.visualGoal || "").slice(0, 50),
    });

    const result = await strategy.generate({
      systemPrompt: buildPagePromptGenerationSystemPrompt(),
      prompt: buildPagePromptGenerationUserPrompt({
        pageIndex: kind === "cover" ? 0 : pageIndex,
        pageLabel,
        page: promptTarget,
        storyboardPage: kind === "cover" ? undefined : storyboardPage,
        assets,
        projectInfo: effectiveProjectInfo,
      }),
      temperature: 0.4,
      maxTokens: 500,
    });

    if (!result.success || !result.text) {
      console.warn(`${LOG_PREFIX} [步骤1] 第一次模型调用失败`, {
        durationMs: Date.now() - startTime,
        success: result.success,
        hasText: !!result.text,
        error: result.error?.message || "模型返回为空",
      });
      return {
        success: false,
        error: generationFailedError(result.error?.message || "页面提示词生成失败"),
      };
    }

    console.info(`${LOG_PREFIX} [步骤1] 第一次模型调用成功`, {
      kind,
      pageIndex,
      rawLength: result.text.length,
      rawPreview: result.text.slice(0, 80),
    });
    
    const visualDescription = sanitizeGeneratedPrompt(result.text);
    if (!visualDescription) {
      console.warn(`${LOG_PREFIX} [步骤1] 清洗后结果为空`, { rawText: result.text });
      return {
        success: false,
        error: generationFailedError("页面提示词生成结果为空"),
      };
    }

    const prompt = buildPageFinalPrompt({
      projectInfo: effectiveProjectInfo,
      visualDescription,
    });

    console.info(`${LOG_PREFIX} [步骤1] 主 prompt 拼接完成`, {
      kind,
      pageIndex,
      promptLength: prompt.length,
      promptPreview: prompt.slice(0, 120),
    });

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
    const candidateImageRefs = [
      ...allCharacterImageRefs,
      ...allSceneImageRefs,
    ];

    console.info(`${LOG_PREFIX} [步骤2] 候选图片引用构建完成`, {
      kind,
      pageIndex,
      totalAssetsChars: assets.characters.length,
      totalAssetsScenes: assets.scenes.length,
      charsWithImage: allCharacterImageRefs.length,
      scenesWithImage: allSceneImageRefs.length,
      candidateCount: candidateImageRefs.length,
      candidateNames: candidateImageRefs.map(ref => ref.assetName),
      charsMissingImage: assets.characters.filter(c => !c.officialImageUrl && !c.baseImageUrl).map(c => c.name),
      scenesMissingImage: assets.scenes.filter(s => !s.officialImageUrl && !s.baseImageUrl).map(s => s.name),
    });

    let matchedAssetNames = sortNamesByPromptOrder(
      prompt,
      candidateImageRefs.map(ref => ref.assetName)
    );

    console.info(`${LOG_PREFIX} [步骤2] 本地顺序匹配结果`, {
      kind,
      pageIndex,
      localMatchedNames: matchedAssetNames,
    });

    if (candidateImageRefs.length > 0) {
      console.info(`${LOG_PREFIX} [步骤2] 页面引用识别开始：调用第二次模型`, {
        kind,
        pageIndex,
        candidateCount: candidateImageRefs.length,
        candidates: candidateImageRefs.map(ref => ref.assetName),
      });
      const refSelection = await strategy.generate({
        systemPrompt: buildPageRefSelectionSystemPrompt(),
        prompt: buildPageRefSelectionUserPrompt(prompt, candidateImageRefs),
        temperature: 0.1,
        maxTokens: 200,
      });

      console.info(`${LOG_PREFIX} [步骤2] 第二次模型调用返回`, {
        kind,
        pageIndex,
        success: refSelection.success,
        hasText: !!refSelection.text,
        textPreview: refSelection.text?.slice(0, 100),
        error: refSelection.error?.message,
      });

      const parsedNames = refSelection.success && refSelection.text
        ? extractJsonArray(refSelection.text)
        : null;

      console.info(`${LOG_PREFIX} [步骤2] JSON 解析结果`, {
        kind,
        pageIndex,
        parsedNames,
      });

      if (parsedNames && parsedNames.length > 0) {
        matchedAssetNames = sortNamesByPromptOrder(prompt, parsedNames);
        console.info(`${LOG_PREFIX} [步骤2] 页面引用识别完成`, {
          kind,
          pageIndex,
          matchedAssetNames,
        });
      } else {
        console.info(`${LOG_PREFIX} [步骤2] 页面引用识别回退为本地顺序匹配`, {
          kind,
          pageIndex,
          matchedAssetNames,
          rawResult: refSelection.success ? refSelection.text || "" : refSelection.error?.message || "模型调用失败",
        });
      }
    } else {
      console.info(`${LOG_PREFIX} [步骤2] 跳过引用识别：无候选图片引用`, {
        kind,
        pageIndex,
        totalChars: assets.characters.length,
        totalScenes: assets.scenes.length,
      });
    }

    const annotated = annotatePromptWithNumberedRefs(prompt, candidateImageRefs, matchedAssetNames);

    console.info(`${LOG_PREFIX} [步骤2] 编号标注完成`, {
      kind,
      pageIndex,
      annotatedPromptPreview: annotated.prompt.slice(0, 120),
      annotatedImageRefCount: annotated.imageRefs.length,
      annotatedImageRefs: annotated.imageRefs.map(ref => `${ref.refLabel} -> ${ref.assetName}`),
    });

    console.info(`${LOG_PREFIX} 页面提示词生成成功`, {
      durationMs: Date.now() - startTime,
      kind,
      pageIndex,
      outputLength: annotated.prompt.length,
      imageRefCount: annotated.imageRefs.length,
    });

    return {
      success: true,
      data: {
        prompt: annotated.prompt,
        imageRefs: annotated.imageRefs,
      },
    };
  } catch (err) {
    console.error(`${LOG_PREFIX} 页面提示词生成异常`, {
      durationMs: Date.now() - startTime,
      kind,
      pageIndex,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false,
      error: generationFailedError(
        err instanceof Error ? err.message : "页面提示词生成异常"
      ),
    };
  }
}
