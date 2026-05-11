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

class OpenAICompatibleTextStrategy implements TextModelGateway {
  constructor(private config: ModelConfigItem) {}

  async generate(params: TextGenerateParams): Promise<TextGenerateResult> {
    const { apiKey, endpoint } = this.config.credentials;
    const model = (this.config.params?.model as string) || "gpt-3.5-turbo";
    const requestTimeoutMs = Number(this.config.params?.timeoutMs) || 60000;
    const startTime = Date.now();

    const llm = new ChatOpenAI({
      model,
      apiKey,
      configuration: { baseURL: endpoint || undefined },
      streaming: false,
      timeout: requestTimeoutMs,
    });

    const messages = this.buildMessages(params);
    const promptChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    console.info(`${LOG_PREFIX} 文本生成开始`, {
      alias: this.config.alias,
      model,
      endpoint,
      messageCount: messages.length,
      promptChars,
      maxTokens: params.maxTokens,
      temperature: params.temperature,
      timeoutMs: requestTimeoutMs,
    });

    try {
      console.info(`${LOG_PREFIX} 文本请求消息`, {
        alias: this.config.alias,
        model,
        messages,
      });
      console.info(`${LOG_PREFIX} 文本请求发送中`, {
        alias: this.config.alias,
        model,
        endpoint,
        timeoutMs: requestTimeoutMs,
        messageCount: messages.length,
      });
      const invokeStartAt = Date.now();
      const response = await llm.invoke(messages);
      console.info(`${LOG_PREFIX} 文本请求已返回`, {
        alias: this.config.alias,
        model,
        invokeDurationMs: Date.now() - invokeStartAt,
      });
      console.info(`${LOG_PREFIX} 文本原始响应`, {
        alias: this.config.alias,
        model,
        rawContent: response.content,
      });
      const outputText = extractTextFromResponseContent(response.content);
      const responsePreview = outputText.slice(0, 300);
      const responseMeta = (response as unknown as { response_metadata?: unknown; usage_metadata?: unknown }) ?? {};
      console.info(`${LOG_PREFIX} 文本响应详情`, {
        alias: this.config.alias,
        model,
        outputChars: outputText.length,
        responseText: outputText,
        preview: responsePreview,
        responseMetadata: responseMeta.response_metadata,
        usageMetadata: responseMeta.usage_metadata,
      });
      if (!outputText) {
        console.warn(`${LOG_PREFIX} 文本响应为空`, {
          alias: this.config.alias,
          model,
          contentType: Array.isArray(response.content) ? "array" : typeof response.content,
          rawContent: response.content,
        });
      }
      console.info(`${LOG_PREFIX} 文本生成成功`, {
        alias: this.config.alias,
        model,
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
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
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
      const imageTool = new DallEAPIWrapper({
        apiKey,
        baseUrl: endpoint,
        model,
        n: 1,
        dallEResponseFormat: "url",
        size: resolvedSize as any,
        quality: normalizeImageQuality(params.quality),
        style: normalizeImageStyle(params.style),
      });

      console.info(`${LOG_PREFIX} 图片请求发送中`, {
        alias: this.config.alias,
        model,
        endpoint,
        request: {
          prompt: params.prompt,
          size: resolvedSize,
          originalSize: params.size,
          quality: normalizeImageQuality(params.quality),
          style: normalizeImageStyle(params.style),
          n: 1,
          responseFormat: "url",
        },
      });
      const invokeStartAt = Date.now();
      const output = await imageTool.invoke(params.prompt);
      console.info(`${LOG_PREFIX} 图片请求已返回`, {
        alias: this.config.alias,
        model,
        invokeDurationMs: Date.now() - invokeStartAt,
      });
      console.info(`${LOG_PREFIX} 图片原始响应`, {
        alias: this.config.alias,
        model,
        outputType: Array.isArray(output) ? "array" : typeof output,
        output,
      });
      let imageUrl = "";

      if (typeof output === "string") {
        imageUrl = output;
      } else if (Array.isArray(output)) {
        const imageItem = output.find(
          (item) =>
            typeof item === "object" &&
            item !== null &&
            "type" in item &&
            "image_url" in item &&
            (item as { type?: string }).type === "image_url"
        ) as { image_url?: string | { url?: string } } | undefined;

        if (typeof imageItem?.image_url === "string") {
          imageUrl = imageItem.image_url;
        } else if (
          typeof imageItem?.image_url === "object" &&
          imageItem.image_url !== null &&
          typeof imageItem.image_url.url === "string"
        ) {
          imageUrl = imageItem.image_url.url;
        }
      }
      console.info(`${LOG_PREFIX} 图片解析结果`, {
        alias: this.config.alias,
        model,
        hasImageUrl: Boolean(imageUrl),
        imageUrl,
      });

      if (!imageUrl) {
        console.warn(`${LOG_PREFIX} 图片生成失败`, {
          alias: this.config.alias,
          model,
          durationMs: Date.now() - startTime,
          error: "未返回可用图片 URL",
          outputType: Array.isArray(output) ? "array" : typeof output,
          output,
        });
        return {
          success: false,
          error: { code: "NO_IMAGE_URL", message: "未返回可用图片 URL" },
        };
      }

      console.info(`${LOG_PREFIX} 图片生成成功`, {
        alias: this.config.alias,
        model,
        durationMs: Date.now() - startTime,
        imageUrl,
      });
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
