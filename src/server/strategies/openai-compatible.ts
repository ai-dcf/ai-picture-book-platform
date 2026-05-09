import { ChatOpenAI } from "@langchain/openai";
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

class OpenAICompatibleTextStrategy implements TextStrategy {
  constructor(private config: ModelConfigItem) {}

  async generate(params: TextGenerateParams): Promise<TextGenerateResult> {
    const { apiKey, endpoint } = this.config.credentials;
    const model = (this.config.params?.model as string) || "gpt-3.5-turbo";

    const llm = new ChatOpenAI({
      model,
      apiKey,
      configuration: { baseURL: endpoint || undefined },
      streaming: false,
      timeout: 60000,
    });

    const messages = this.buildMessages(params);
    const response = await llm.invoke(messages);

    return {
      success: true,
      text: typeof response.content === "string" ? response.content : "",
    };
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

    const body: Record<string, unknown> = {
      model,
      prompt: params.prompt,
      response_format: "url",
    };

    if (params.size) body.size = params.size;
    if (params.quality) body.quality = params.quality;
    if (params.style) body.style = params.style;

    const response = await fetch(`${endpoint}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      const errorMessage =
        (data.error as Record<string, string>)?.message || `HTTP ${response.status}`;
      return {
        success: false,
        error: { code: "GENERATION_FAILED", message: errorMessage },
      };
    }

    const images = (data.data as Array<{ url?: string }>) || [];
    const url = images[0]?.url;

    if (!url) {
      return {
        success: false,
        error: { code: "NO_IMAGE_URL", message: "No image URL returned" },
      };
    }

    return { success: true, imageUrl: url };
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
