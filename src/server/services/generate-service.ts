import {
  getTextModelFactory,
  getImageModelFactory,
  type TextStrategy,
  type ImageStrategy,
} from "@/server/model-factory";
import { ensureModelsInitialized } from "@/server/services/model-init";
import { buildAssetPrompt, buildPagePrompt } from "@/lib/prompt-builders";
import type {
  ProjectInfo,
  StoryData,
  StoryEntry,
  EmotionCurvePoint,
  StoryboardData,
  StoryboardPageData,
  AssetItem,
  AssetsData,
  PageItem,
  PageTurnMotivation,
} from "@/types/picturebook";

type GenerateError = {
  code: "NO_MODEL_CONFIGURED" | "MODEL_UNAVAILABLE" | "GENERATION_FAILED" | "INVALID_REQUEST";
  message: string;
};

type GenerateResult<T> = {
  success: boolean;
  data?: T;
  error?: GenerateError;
};

const LOG_PREFIX = "[生成服务]";

function summarizeProjectInfo(projectInfo: ProjectInfo): Record<string, unknown> {
  return {
    title: projectInfo.title || "待定",
    targetAge: projectInfo.targetAge,
    artStyle: projectInfo.artStyle,
    aspectRatio: projectInfo.aspectRatio,
    pageCount: projectInfo.pageCount,
  };
}

function noModelError(): GenerateError {
  return { code: "NO_MODEL_CONFIGURED", message: "未配置任何模型，请先在设置中添加模型" };
}

function generationFailedError(detail: string): GenerateError {
  return { code: "GENERATION_FAILED", message: detail };
}

function get_default_text_strategy(): TextStrategy | null {
  ensureModelsInitialized();
  const factory = getTextModelFactory();
  const enabled = factory.listEnabled();
  if (enabled.length === 0) {
    console.warn(`${LOG_PREFIX} 未找到启用的文本模型`);
    return null;
  }
  try {
    console.info(`${LOG_PREFIX} 使用文本模型`, { alias: enabled[0] });
    return factory.get(enabled[0]);
  } catch (error) {
    console.error(`${LOG_PREFIX} 获取文本策略失败`, {
      alias: enabled[0],
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function get_default_image_strategy(): ImageStrategy | null {
  ensureModelsInitialized();
  const factory = getImageModelFactory();
  const enabled = factory.listEnabled();
  if (enabled.length === 0) return null;
  try {
    return factory.get(enabled[0]);
  } catch {
    return null;
  }
}

// ─── Prompt Builders ──────────────────────────────────────────────────────────

function buildStorySystemPrompt(): string {
  return `你是一位专业儿童绘本编剧。请根据用户提供的信息创作绘本故事。

你必须严格按以下 JSON 格式输出，不要输出任何其他内容：
{
  "oneLineStory": "一句话概括故事",
  "characters": [
    { "name": "角色名", "description": "角色外貌与性格描述" }
  ],
  "scenes": [
    { "name": "场景名", "description": "场景环境与氛围描述" }
  ],
  "emotionCurve": [
    { "label": "情节标签", "emotion": "情绪词", "intensity": 数字-6到4, "isTurningPoint": 布尔值 }
  ],
  "storyOutline": "故事大纲，分段描述每个阶段的发展"
}

要求：
- 角色数量 2-5 个，每个角色有鲜明的辨识特征
- 场景数量 3-6 个，与故事情节紧密配合
- 情绪曲线包含 5-8 个关键点，至少 1 个转折点
- 故事大纲 200-400 字，清晰描述起承转合
- 内容适合目标年龄段儿童，语言温暖有节奏感`;
}

function buildStoryUserPrompt(projectInfo: ProjectInfo): string {
  return [
    `绘本标题：${projectInfo.title || "待定"}`,
    `目标年龄：${projectInfo.targetAge}岁`,
    `画面风格：${projectInfo.artStyle}`,
    `画面比例：${projectInfo.aspectRatio}`,
    `总页数：${projectInfo.pageCount}页`,
    "",
    "请创作一个适合以上设定的儿童绘本故事。",
  ].join("\n");
}

function buildStoryboardSystemPrompt(pageCount: number): string {
  return `你是一位专业绘本分镜导演。请根据故事内容为 ${pageCount} 页绘本创作分镜脚本。

你必须严格按以下 JSON 格式输出，不要输出任何其他内容：
{
  "pages": [
    {
      "text": "本页正文文字",
      "visualGoal": "画面视觉目标描述",
      "pageTurnMotivation": "suspense|emotion|discovery|none",
      "characterRefs": ["出现的角色名"],
      "sceneRefs": ["出现的场景名"]
    }
  ]
}

要求：
- 输出恰好 ${pageCount} 页
- 每页文字 20-80 字，适合儿童阅读节奏
- 画面目标具体可执行，包含构图、色调、氛围
- pageTurnMotivation 驱动翻页欲望
- characterRefs 和 sceneRefs 必须引用故事中的角色和场景名称`;
}

function buildStoryboardUserPrompt(story: StoryData, projectInfo: ProjectInfo): string {
  const characterList = story.characters
    .map((c) => `${c.name}：${c.description}`)
    .join("；");
  const sceneList = story.scenes
    .map((s) => `${s.name}：${s.description}`)
    .join("；");

  return [
    `故事概要：${story.oneLineStory}`,
    "",
    `角色：${characterList}`,
    `场景：${sceneList}`,
    "",
    `故事大纲：${story.storyOutline}`,
    "",
    `目标年龄：${projectInfo.targetAge}岁，画面风格：${projectInfo.artStyle}，总页数：${projectInfo.pageCount}页`,
    "",
    "请为每页创作分镜脚本。",
  ].join("\n");
}

// ─── JSON Parsing ─────────────────────────────────────────────────────────────

function extractJSON(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    return text.slice(braceStart, braceEnd + 1);
  }

  return text.trim();
}

function parseStoryResponse(raw: string): StoryData {
  const json = extractJSON(raw);
  const parsed = JSON.parse(json);

  const characters: StoryEntry[] = (parsed.characters || []).map(
    (c: Record<string, string>) => ({
      name: c.name || "未命名角色",
      description: c.description || "",
      userModified: false,
    })
  );

  const scenes: StoryEntry[] = (parsed.scenes || []).map(
    (s: Record<string, string>) => ({
      name: s.name || "未命名场景",
      description: s.description || "",
      userModified: false,
    })
  );

  const emotionCurve: EmotionCurvePoint[] = (parsed.emotionCurve || []).map(
    (e: Record<string, unknown>) => ({
      label: String(e.label || ""),
      emotion: String(e.emotion || "平静"),
      intensity: Number(e.intensity) || 0,
      isTurningPoint: Boolean(e.isTurningPoint),
    })
  );

  return {
    oneLineStory: parsed.oneLineStory || "",
    characters,
    storyOutline: parsed.storyOutline || "",
    emotionCurve,
    scenes,
    generating: false,
  };
}

function parseStoryboardResponse(raw: string, pageCount: number): StoryboardData {
  const json = extractJSON(raw);
  const parsed = JSON.parse(json);

  const validMotivations = new Set<string>(["suspense", "emotion", "discovery", "none"]);

  const pages: StoryboardPageData[] = (parsed.pages || [])
    .slice(0, pageCount)
    .map((p: Record<string, unknown>, i: number) => ({
      pageIndex: i,
      text: String(p.text || ""),
      visualGoal: String(p.visualGoal || ""),
      pageTurnMotivation: (validMotivations.has(String(p.pageTurnMotivation))
        ? String(p.pageTurnMotivation)
        : "none") as PageTurnMotivation,
      characterRefs: Array.isArray(p.characterRefs)
        ? p.characterRefs.map(String)
        : [],
      sceneRefs: Array.isArray(p.sceneRefs) ? p.sceneRefs.map(String) : [],
      userModified: false,
    }));

  while (pages.length < pageCount) {
    pages.push({
      pageIndex: pages.length,
      text: "",
      visualGoal: "",
      pageTurnMotivation: "none" as PageTurnMotivation,
      characterRefs: [],
      sceneRefs: [],
      userModified: false,
    });
  }

  return { spreads: [], pages, generating: false };
}

// ─── Service Methods ──────────────────────────────────────────────────────────

export async function generateStory(
  projectInfo: ProjectInfo
): Promise<GenerateResult<StoryData>> {
  const startTime = Date.now();
  console.info(`${LOG_PREFIX} 故事生成开始`, summarizeProjectInfo(projectInfo));

  const strategy = get_default_text_strategy();
  if (!strategy) {
    console.warn(`${LOG_PREFIX} 故事生成中止：无可用策略`);
    return { success: false, error: noModelError() };
  }

  try {
    const result = await strategy.generate({
      systemPrompt: buildStorySystemPrompt(),
      prompt: buildStoryUserPrompt(projectInfo),
      temperature: 0.8,
      maxTokens: 4000,
    });

    if (!result.success || !result.text) {
      console.warn(`${LOG_PREFIX} 故事生成失败`, {
        durationMs: Date.now() - startTime,
        error: result.error?.message || "模型返回为空",
      });
      return {
        success: false,
        error: generationFailedError(result.error?.message || "故事生成失败"),
      };
    }

    const story = parseStoryResponse(result.text);
    console.info(`${LOG_PREFIX} 故事生成成功`, {
      durationMs: Date.now() - startTime,
      outputLength: result.text.length,
      characterCount: story.characters.length,
      sceneCount: story.scenes.length,
      emotionPointCount: story.emotionCurve.length,
    });
    return { success: true, data: story };
  } catch (err) {
    console.error(`${LOG_PREFIX} 故事生成异常`, {
      durationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false,
      error: generationFailedError(
        err instanceof Error ? err.message : "故事生成异常"
      ),
    };
  }
}

export async function generateStoryboard(
  story: StoryData,
  projectInfo: ProjectInfo
): Promise<GenerateResult<StoryboardData>> {
  const strategy = get_default_text_strategy();
  if (!strategy) return { success: false, error: noModelError() };

  try {
    const result = await strategy.generate({
      systemPrompt: buildStoryboardSystemPrompt(projectInfo.pageCount),
      prompt: buildStoryboardUserPrompt(story, projectInfo),
      temperature: 0.7,
      maxTokens: 6000,
    });

    if (!result.success || !result.text) {
      return {
        success: false,
        error: generationFailedError(result.error?.message || "分镜生成失败"),
      };
    }

    const storyboard = parseStoryboardResponse(result.text, projectInfo.pageCount);
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

export async function generateAssetImage(
  asset: AssetItem,
  projectInfo: ProjectInfo
): Promise<GenerateResult<string>> {
  const strategy = get_default_image_strategy();
  if (!strategy) return { success: false, error: noModelError() };

  try {
    const kind = asset.id.includes("scene") ? "scene" : "character";
    const prompt =
      asset.promptUserEdited && asset.prompt
        ? asset.prompt
        : buildAssetPrompt({
            kind,
            name: asset.name,
            description: asset.description,
            projectInfo,
          });

    const sizeMap: Record<string, string> = {
      "3:4": "768x1024",
      "9:16": "768x1366",
      "16:9": "1366x768",
      "1:1": "1024x1024",
    };

    const result = await strategy.generate({
      prompt,
      size: sizeMap[projectInfo.aspectRatio] || "1024x1024",
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

export async function generatePageImage(
  page: PageItem,
  assets: AssetsData,
  projectInfo: ProjectInfo,
  storyboardPage?: StoryboardPageData
): Promise<GenerateResult<string>> {
  const strategy = get_default_image_strategy();
  if (!strategy) return { success: false, error: noModelError() };

  try {
    const prompt =
      page.promptUserEdited && page.prompt
        ? page.prompt
        : buildPagePrompt({
            pageIndex: page.index,
            page,
            storyboardPage,
            assets,
            projectInfo,
          });

    const sizeMap: Record<string, string> = {
      "3:4": "768x1024",
      "9:16": "768x1366",
      "16:9": "1366x768",
      "1:1": "1024x1024",
    };

    const result = await strategy.generate({
      prompt,
      size: sizeMap[projectInfo.aspectRatio] || "1024x1024",
    });

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

export function hasEnabledModels(): { text: boolean; image: boolean } {
  ensureModelsInitialized();
  return {
    text: getTextModelFactory().listEnabled().length > 0,
    image: getImageModelFactory().listEnabled().length > 0,
  };
}
