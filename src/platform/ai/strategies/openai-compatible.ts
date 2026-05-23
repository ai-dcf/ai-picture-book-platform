import "server-only";

import { ChatOpenAI, DallEAPIWrapper } from "@langchain/openai";
import { imageModelConfigs, type ImageAspectRatio } from "@/lib/image-vendor-presets";
import {
  registerImageStrategy,
  registerTextStrategy,
} from "../registry/model-factory";
import type {
  HealthResult,
  ImageGenerateParams,
  ImageGenerateResult,
  ImageModelGateway,
  ModelConfigItem,
  TextGenerateParams,
  TextGenerateResult,
  TextModelGateway,
  TextStreamChunk,
} from "../contracts";

const LOG_PREFIX = "[OpenAI兼容策略]";
const DEFAULT_ASPECT_RATIOS: Array<{ key: ImageAspectRatio; value: number }> = [
  { key: "1:1", value: 1 },
  { key: "4:3", value: 4 / 3 },
  { key: "3:4", value: 3 / 4 },
  { key: "16:9", value: 16 / 9 },
  { key: "9:16", value: 9 / 16 },
  { key: "3:2", value: 3 / 2 },
  { key: "2:3", value: 2 / 3 },
  { key: "21:9", value: 21 / 9 },
];

function normalizeImageQuality(quality?: string): "standard" | "hd" | undefined {
  if (quality === "hd" || quality === "standard") return quality;
  return undefined;
}

function normalizeImageStyle(style?: string): "natural" | "vivid" | undefined {
  if (style === "natural" || style === "vivid") return style;
  return undefined;
}

function mapImageSizeForModel(size: string | undefined, modelName: string): string | undefined {
  if (!size) return size;

  const config = imageModelConfigs[modelName];
  if (!config || config.sizeStrategy !== "tiered-ratio-table") {
    return size;
  }

  const parsedSize = parseSize(size);
  const ratio = parsedSize
    ? findClosestAspectRatio(
        parsedSize.width / parsedSize.height,
        config.supportedAspectRatios.map((key) => ({ key, value: aspectRatioToNumber(key) }))
      )
    : config.supportedAspectRatios[0];

  return config.sizeTable[config.defaultTier][ratio];
}

function parseSize(size: string): { width: number; height: number } | null {
  const match = /^(\d+)x(\d+)$/.exec(size.trim());
  if (!match) return null;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!isPositiveNumber(width) || !isPositiveNumber(height)) return null;

  return { width, height };
}

function isPositiveNumber(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function findClosestAspectRatio(
  target: number,
  candidates: Array<{ key: ImageAspectRatio; value: number }>
): ImageAspectRatio {
  return candidates.reduce((best, current) => {
    const bestDistance = Math.abs(best.value - target);
    const currentDistance = Math.abs(current.value - target);
    return currentDistance < bestDistance ? current : best;
  }).key;
}

function aspectRatioToNumber(aspectRatio: ImageAspectRatio): number {
  const [width, height] = aspectRatio.split(":").map(Number);
  return width / height;
}

function extractTextFromResponseContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  const textParts = content
    .map((part) => {
      if (typeof part === "string") return part;
      if (typeof part !== "object" || part === null) return "";
      if ("text" in part && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
      return "";
    })
    .filter(Boolean);

  return textParts.join("\n").trim();
}

function getNumberConfigValue(value: unknown, fallback: number): number {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : fallback;
}

function getOptionalNumberValue(value: unknown): number | undefined {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : undefined;
}

class OpenAICompatibleTextStrategy implements TextModelGateway {
  constructor(private config: ModelConfigItem) {}

  async generate(params: TextGenerateParams): Promise<TextGenerateResult> {
    const { apiKey, endpoint } = this.config.credentials;
    const model = (this.config.params?.model as string) || "gpt-3.5-turbo";
    const requestTimeoutMs = getNumberConfigValue(this.config.params?.timeoutMs, 180000);
    const effectiveTemperature = typeof params.temperature === "number" ? params.temperature : undefined;
    const effectiveMaxTokens = params.maxTokens ?? getOptionalNumberValue(this.config.params?.maxTokens);
    const effectiveMaxRetries = getOptionalNumberValue(this.config.params?.maxRetries) ?? 0;
    const requestStage = params.headers?.["x-stage"] || "default";
    const requestPageRange = params.headers?.["x-page-range"];
    const requestBatchIndex = params.headers?.["x-batch-index"];
    const startTime = Date.now();

    const llm = new ChatOpenAI({
      model,
      apiKey,
      configuration: { baseURL: endpoint || undefined },
      temperature: effectiveTemperature,
      maxTokens: effectiveMaxTokens,
      streaming: false,
      timeout: requestTimeoutMs,
      maxRetries: effectiveMaxRetries,
    });

    const messages = this.buildMessages(params);
    const promptChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    console.info(`${LOG_PREFIX} 文本生成开始`, {
      alias: this.config.alias,
      model,
      endpoint,
      stage: requestStage,
      batchIndex: requestBatchIndex,
      pageRange: requestPageRange,
      messageCount: messages.length,
      promptChars,
      maxTokens: params.maxTokens,
      temperature: params.temperature,
      timeoutMs: requestTimeoutMs,
      effectiveMaxTokens,
      effectiveTemperature,
      effectiveTimeoutMs: requestTimeoutMs,
      effectiveMaxRetries,
    });

    try {
      // 保留请求消息日志：用于排查prompt问题
      console.info(`${LOG_PREFIX} 文本请求消息`, {
        alias: this.config.alias,
        model,
        stage: requestStage,
        batchIndex: requestBatchIndex,
        pageRange: requestPageRange,
        messages,
      });
      const invokeStartAt = Date.now();
      const response = await llm.invoke(messages);
      console.info(`${LOG_PREFIX} 文本请求已返回`, {
        alias: this.config.alias,
        model,
        stage: requestStage,
        batchIndex: requestBatchIndex,
        pageRange: requestPageRange,
        invokeDurationMs: Date.now() - invokeStartAt,
      });
      // 保留原始响应日志：用于排查返回内容问题
      console.info(`${LOG_PREFIX} 文本原始响应`, {
        alias: this.config.alias,
        model,
        stage: requestStage,
        rawContent: response.content,
      });
      const outputText = extractTextFromResponseContent(response.content);
      const responsePreview = outputText.slice(0, 300);
      const responseMeta = (response as unknown as { response_metadata?: unknown; usage_metadata?: unknown }) ?? {};
      // 移除冗余日志：文本响应详情
      if (!outputText) {
        console.warn(`${LOG_PREFIX} 文本响应为空`, {
          alias: this.config.alias,
          model,
          stage: requestStage,
          contentType: Array.isArray(response.content) ? "array" : typeof response.content,
          rawContent: response.content,
        });
      }
      console.info(`${LOG_PREFIX} 文本生成成功`, {
        alias: this.config.alias,
        model,
        stage: requestStage,
        batchIndex: requestBatchIndex,
        pageRange: requestPageRange,
        durationMs: Date.now() - startTime,
        outputChars: outputText.length,
      });

      return {
        success: true,
        text: outputText,
      };
    } catch (error) {
      console.error(`${LOG_PREFIX} 文本生成失败`, {
        alias: this.config.alias,
        model,
        stage: requestStage,
        batchIndex: requestBatchIndex,
        pageRange: requestPageRange,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        effectiveTimeoutMs: requestTimeoutMs,
        effectiveMaxTokens,
        effectiveTemperature,
        effectiveMaxRetries,
      });
      throw error;
    }
  }

  async generateStream(
    _params: TextGenerateParams,
    _onChunk: (chunk: TextStreamChunk) => void
  ): Promise<TextGenerateResult> {
    throw new Error("Stream not implemented yet");
  }

  async health(): Promise<HealthResult> {
    const { apiKey, endpoint } = this.config.credentials;
    const model = (this.config.params?.model as string) || "gpt-3.5-turbo";

    try {
      const startTime = Date.now();
      const response = await fetch(`${endpoint}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(30000),
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        return {
          success: false,
          data: { status: "down", latencyMs },
          error: { message: `HTTP ${response.status}` },
        };
      }

      return {
        success: true,
        latencyMs,
        data: { status: "ok", latencyMs },
      };
    } catch (error) {
      return {
        success: false,
        data: { status: "down" },
        error: { message: error instanceof Error ? error.message : "Unknown error" },
      };
    }
  }

  private buildMessages(params: TextGenerateParams): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];

    if (params.systemPrompt) {
      messages.push({ role: "system", content: params.systemPrompt });
    }

    if (params.messages?.length) {
      messages.push(...params.messages);
    } else if (params.prompt) {
      messages.push({ role: "user", content: params.prompt });
    }

    return messages;
  }
}

class OpenAICompatibleImageStrategy implements ImageModelGateway {
  constructor(private config: ModelConfigItem) {}

  async generate(params: ImageGenerateParams): Promise<ImageGenerateResult> {
    if (params.images && params.images.length > 0) {
      return this.generateWithRefImages(params);
    }
    return this.generateTextOnly(params);
  }

  private async generateWithRefImages(params: ImageGenerateParams): Promise<ImageGenerateResult> {
    const { apiKey, endpoint } = this.config.credentials;
    const model = (this.config.params?.model as string) || "doubao-seedream-5.0-lite";
    const startTime = Date.now();
    const resolvedSize = mapImageSizeForModel(params.size, model);

    const imageUrls = params.images!.map(img => img.url).filter(Boolean);
    if (imageUrls.length === 0) {
      return this.generateTextOnly(params);
    }

    console.info(`${LOG_PREFIX} 参考图生成开始`, {
      alias: this.config.alias,
      model,
      endpoint,
      promptChars: params.prompt.length,
      size: resolvedSize,
      refImageCount: imageUrls.length,
      refImageNames: params.images!.map(i => i.name).filter(Boolean),
    });

    try {
      const requestBody: Record<string, unknown> = {
        model,
        prompt: params.prompt,
        image: imageUrls,
        size: resolvedSize || "2048x2048",
        response_format: "url",
        watermark: false,
        sequential_image_generation: "disabled",
      };
      if (params.negativePrompt) requestBody.negative_prompt = params.negativePrompt;
      if (typeof params.seed === "number") requestBody.seed = params.seed;

      console.info(`${LOG_PREFIX} 参考图请求发送中`, {
        alias: this.config.alias,
        model,
        endpoint,
        requestBody: { ...requestBody, prompt: requestBody.prompt },
      });

      const invokeStartAt = Date.now();
      const response = await fetch(`${endpoint}/images/generations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(120000),
      });

      console.info(`${LOG_PREFIX} 参考图请求已返回`, {
        alias: this.config.alias,
        model,
        invokeDurationMs: Date.now() - invokeStartAt,
        status: response.status,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error(`${LOG_PREFIX} 参考图生成失败`, {
          alias: this.config.alias,
          model,
          durationMs: Date.now() - startTime,
          status: response.status,
          errorText,
        });
        return {
          success: false,
          error: { code: "API_ERROR", message: `参考图生成 API 返回 ${response.status}: ${errorText}` },
        };
      }

      const result = await response.json() as {
        data?: Array<{ url?: string; b64_json?: string; error?: { code: string; message: string } }>;
        error?: { code: string; message: string };
      };

      if (result.error) {
        console.error(`${LOG_PREFIX} 参考图生成业务错误`, {
          alias: this.config.alias,
          model,
          error: result.error,
        });
        return {
          success: false,
          error: { code: result.error.code || "API_ERROR", message: result.error.message || "参考图生成失败" },
        };
      }

      const firstImage = result.data?.[0];
      if (!firstImage?.url && !firstImage?.b64_json) {
        const imgError = firstImage?.error;
        console.warn(`${LOG_PREFIX} 参考图生成无图片`, {
          alias: this.config.alias,
          model,
          imgError,
        });
        return {
          success: false,
          error: { code: "NO_IMAGE_URL", message: imgError?.message || "参考图生成未返回可用图片" },
        };
      }

      const imageUrl = firstImage.url || (firstImage.b64_json ? `data:image/png;base64,${firstImage.b64_json}` : "");
      console.info(`${LOG_PREFIX} 参考图生成成功`, {
        alias: this.config.alias,
        model,
        durationMs: Date.now() - startTime,
        imageUrl: imageUrl.slice(0, 100),
      });

      return { success: true, imageUrl };
    } catch (error) {
      console.error(`${LOG_PREFIX} 参考图生成异常`, {
        alias: this.config.alias,
        model,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: { code: "GENERATION_FAILED", message: error instanceof Error ? error.message : "参考图生成异常" },
      };
    }
  }

  private async generateTextOnly(params: ImageGenerateParams): Promise<ImageGenerateResult> {
    const { apiKey, endpoint } = this.config.credentials;
    const model = (this.config.params?.model as string) || "dall-e-3";
    const startTime = Date.now();
    const resolvedSize = mapImageSizeForModel(params.size, model);
    console.info(`${LOG_PREFIX} 图片生成开始`, {
      alias: this.config.alias,
      model,
      endpoint,
      promptChars: params.prompt.length,
      size: resolvedSize,
      originalSize: params.size,
      quality: params.quality,
      style: params.style,
      prompt: params.prompt,
      negativePrompt: params.negativePrompt,
      seed: params.seed,
    });

    try {
      const requestBody: Record<string, unknown> = {
        model,
        prompt: params.prompt,
        size: resolvedSize || "2048x2048",
        response_format: "url",
        watermark: false,
      };

      const quality = normalizeImageQuality(params.quality);
      const style = normalizeImageStyle(params.style);
      if (quality) requestBody.quality = quality;
      if (style) requestBody.style = style;
      if (params.negativePrompt) requestBody.negative_prompt = params.negativePrompt;
      if (typeof params.seed === "number") requestBody.seed = params.seed;

      console.info(`${LOG_PREFIX} 图片请求发送中`, {
        alias: this.config.alias,
        model,
        endpoint,
        requestBody: { ...requestBody, prompt: requestBody.prompt },
      });

      const invokeStartAt = Date.now();
      const response = await fetch(`${endpoint}/images/generations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(120000),
      });

      console.info(`${LOG_PREFIX} 图片请求已返回`, {
        alias: this.config.alias,
        model,
        invokeDurationMs: Date.now() - invokeStartAt,
        status: response.status,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error(`${LOG_PREFIX} 图片生成失败`, {
          alias: this.config.alias,
          model,
          durationMs: Date.now() - startTime,
          status: response.status,
          errorText,
        });

        const imageTool = new DallEAPIWrapper({
          apiKey,
          baseUrl: endpoint,
          model,
          n: 1,
          dallEResponseFormat: "url",
          size: resolvedSize as any,
          quality,
          style,
        });
        const output = await imageTool.invoke(params.prompt);
        const fallbackUrl = typeof output === "string" ? output : "";
        if (fallbackUrl) return { success: true, imageUrl: fallbackUrl };

        return {
          success: false,
          error: { code: "API_ERROR", message: `图片生成 API 返回 ${response.status}: ${errorText}` },
        };
      }

      const result = await response.json() as {
        data?: Array<{ url?: string; b64_json?: string; error?: { code: string; message: string } }>;
        error?: { code: string; message: string };
      };

      if (result.error) {
        return {
          success: false,
          error: { code: result.error.code || "API_ERROR", message: result.error.message || "图片生成失败" },
        };
      }

      const firstImage = result.data?.[0];
      if (!firstImage?.url && !firstImage?.b64_json) {
        const imgError = firstImage?.error;
        return {
          success: false,
          error: { code: "NO_IMAGE_URL", message: imgError?.message || "未返回可用图片" },
        };
      }

      const imageUrl = firstImage.url || (firstImage.b64_json ? `data:image/png;base64,${firstImage.b64_json}` : "");
      return { success: true, imageUrl };
    } catch (error) {
      console.error(`${LOG_PREFIX} 图片生成异常`, {
        alias: this.config.alias,
        model,
        durationMs: Date.now() - startTime,
        prompt: params.prompt,
        size: resolvedSize,
        originalSize: params.size,
        quality: params.quality,
        style: params.style,
        negativePrompt: params.negativePrompt,
        seed: params.seed,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return {
        success: false,
        error: { code: "GENERATION_FAILED", message: error instanceof Error ? error.message : "图片生成失败" },
      };
    }
  }

  async generateStream(
    _params: ImageGenerateParams,
    _onChunk: (chunk: { type: string; imageUrl?: string; progress?: number }) => void
  ): Promise<ImageGenerateResult> {
    throw new Error("Image stream not implemented yet");
  }

  async health(): Promise<HealthResult> {
    const { apiKey, endpoint } = this.config.credentials;

    try {
      const startTime = Date.now();
      const response = await fetch(`${endpoint}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(30000),
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        return {
          success: false,
          data: { status: "down", latencyMs },
          error: { message: `HTTP ${response.status}` },
        };
      }

      return {
        success: true,
        latencyMs,
        data: { status: "ok", latencyMs },
      };
    } catch (error) {
      return {
        success: false,
        data: { status: "down" },
        error: { message: error instanceof Error ? error.message : "Unknown error" },
      };
    }
  }
}

export function registerOpenAICompatibleStrategies() {
  registerTextStrategy("openai-compatible-text", (config) => new OpenAICompatibleTextStrategy(config));
  registerImageStrategy("openai-compatible-image", (config) => new OpenAICompatibleImageStrategy(config));
}
