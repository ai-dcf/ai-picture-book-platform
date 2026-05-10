import { ChatOpenAI } from "@langchain/openai";
import { DallEAPIWrapper } from "@langchain/openai/tools";
import {
  registerImageStrategy,
  registerTextStrategy,
  type HealthResult,
  type ImageGenerateParams,
  type ImageGenerateResult,
  type ImageStrategy,
  type ModelConfigItem,
  type TextGenerateParams,
  type TextGenerateResult,
  type TextStreamChunk,
  type TextStrategy,
} from "@/server/model-factory";

const LOG_PREFIX = "[OpenAI兼容策略]";

function normalizeImageQuality(quality?: string): "standard" | "hd" | undefined {
  if (quality === "hd" || quality === "standard") return quality;
  return undefined;
}

function normalizeImageStyle(style?: string): "natural" | "vivid" | undefined {
  if (style === "natural" || style === "vivid") return style;
  return undefined;
}

class OpenAICompatibleTextStrategy implements TextStrategy {
  constructor(private config: ModelConfigItem) {}

  async generate(params: TextGenerateParams): Promise<TextGenerateResult> {
    const { apiKey, endpoint } = this.config.credentials;
    const model = (this.config.params?.model as string) || "gpt-3.5-turbo";
    const startTime = Date.now();

    const llm = new ChatOpenAI({
      model,
      apiKey,
      configuration: { baseURL: endpoint || undefined },
      streaming: false,
      timeout: 60000,
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
    });

    try {
      const response = await llm.invoke(messages);
      const outputText = typeof response.content === "string" ? response.content : "";
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

class OpenAICompatibleImageStrategy implements ImageStrategy {
  constructor(private config: ModelConfigItem) {}

  async generate(params: ImageGenerateParams): Promise<ImageGenerateResult> {
    const { apiKey, endpoint } = this.config.credentials;
    const model = (this.config.params?.model as string) || "dall-e-3";
    const startTime = Date.now();
    console.info(`${LOG_PREFIX} 图片生成开始`, {
      alias: this.config.alias,
      model,
      endpoint,
      promptChars: params.prompt.length,
      size: params.size,
      quality: params.quality,
      style: params.style,
    });

    try {
      const imageTool = new DallEAPIWrapper({
        apiKey,
        baseUrl: endpoint,
        model,
        n: 1,
        dallEResponseFormat: "url",
        size: params.size as any,
        quality: normalizeImageQuality(params.quality),
        style: normalizeImageStyle(params.style),
      });

      const output = await imageTool.invoke(params.prompt);
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

      if (!imageUrl) {
        console.warn(`${LOG_PREFIX} 图片生成失败`, {
          alias: this.config.alias,
          model,
          durationMs: Date.now() - startTime,
          error: "未返回可用图片 URL",
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
      });
      return { success: true, imageUrl };
    } catch (error) {
      console.error(`${LOG_PREFIX} 图片生成异常`, {
        alias: this.config.alias,
        model,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
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
