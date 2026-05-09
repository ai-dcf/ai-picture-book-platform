type TextGenerateParams = {
  prompt: string;
  systemPrompt?: string;
  messages?: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  headers?: Record<string, string>;
};

type TextGenerateResult = {
  success: boolean;
  text?: string;
  error?: { code: string; message: string };
};

type TextStreamChunk = {
  type: "delta" | "done" | "error";
  text?: string;
  result?: TextGenerateResult;
  error?: { message: string };
};

type ImageGenerateParams = {
  prompt: string;
  negativePrompt?: string;
  size?: string;
  quality?: string;
  style?: string;
  seed?: number;
  headers?: Record<string, string>;
};

type ImageGenerateResult = {
  success: boolean;
  imageUrl?: string;
  error?: { code: string; message: string };
};

type HealthResult = {
  success: boolean;
  latencyMs?: number;
  data?: {
    status: "ok" | "degraded" | "down";
    latencyMs?: number;
    reason?: string;
  };
  error?: { message: string };
};

interface TextStrategy {
  generate(params: TextGenerateParams): Promise<TextGenerateResult>;
  generateStream(
    params: TextGenerateParams,
    onChunk: (chunk: TextStreamChunk) => void
  ): Promise<TextGenerateResult>;
  health(): Promise<HealthResult>;
}

interface ImageStrategy {
  generate(params: ImageGenerateParams): Promise<ImageGenerateResult>;
  generateStream(
    params: ImageGenerateParams,
    onChunk: (chunk: { type: string; imageUrl?: string; progress?: number }) => void
  ): Promise<ImageGenerateResult>;
  health(): Promise<HealthResult>;
}

interface ModelConfigItem {
  alias: string;
  strategy: string;
  enabled: boolean;
  credentials: { apiKey: string; endpoint?: string; [key: string]: unknown };
  params?: Record<string, unknown>;
}

type StrategyConstructor = (config: ModelConfigItem) => TextStrategy | ImageStrategy;

const textStrategyRegistry = new Map<string, StrategyConstructor>();
const imageStrategyRegistry = new Map<string, StrategyConstructor>();

export function registerTextStrategy(name: string, ctor: StrategyConstructor) {
  textStrategyRegistry.set(name, ctor);
}

export function registerImageStrategy(name: string, ctor: StrategyConstructor) {
  imageStrategyRegistry.set(name, ctor);
}

export function registerAllTextStrategies() {}

export function registerAllImageStrategies() {}

class TextModelFactory {
  private strategies = new Map<string, TextStrategy>();
  private configs: ModelConfigItem[] = [];

  loadConfigs(configs: ModelConfigItem[]) {
    this.configs = configs;
    this.strategies.clear();
    for (const config of configs) {
      const Ctor = textStrategyRegistry.get(config.strategy);
      if (Ctor) {
        this.strategies.set(config.alias, Ctor(config) as TextStrategy);
      }
    }
  }

  get(alias: string): TextStrategy {
    const strategy = this.strategies.get(alias);
    if (!strategy) {
      throw new Error(`Text model strategy "${alias}" not found. Available: ${[...this.strategies.keys()].join(", ") || "none"}`);
    }
    return strategy;
  }

  listEnabled(): string[] {
    return this.configs.filter(c => c.enabled).map(c => c.alias);
  }

  invalidate() {
    this.strategies.clear();
  }
}

class ImageModelFactory {
  private strategies = new Map<string, ImageStrategy>();
  private configs: ModelConfigItem[] = [];

  loadConfigs(configs: ModelConfigItem[]) {
    this.configs = configs;
    this.strategies.clear();
    for (const config of configs) {
      const Ctor = imageStrategyRegistry.get(config.strategy);
      if (Ctor) {
        this.strategies.set(config.alias, Ctor(config) as ImageStrategy);
      }
    }
  }

  get(alias: string): ImageStrategy {
    const strategy = this.strategies.get(alias);
    if (!strategy) {
      throw new Error(`Image model strategy "${alias}" not found. Available: ${[...this.strategies.keys()].join(", ") || "none"}`);
    }
    return strategy;
  }

  listEnabled(): string[] {
    return this.configs.filter(c => c.enabled).map(c => c.alias);
  }

  invalidate() {
    this.strategies.clear();
  }
}

let textFactoryInstance: TextModelFactory | null = null;
let imageFactoryInstance: ImageModelFactory | null = null;

export function getTextModelFactory(): TextModelFactory {
  if (!textFactoryInstance) {
    textFactoryInstance = new TextModelFactory();
  }
  return textFactoryInstance;
}

export function getImageModelFactory(): ImageModelFactory {
  if (!imageFactoryInstance) {
    imageFactoryInstance = new ImageModelFactory();
  }
  return imageFactoryInstance;
}

export type {
  TextStrategy,
  ImageStrategy,
  TextGenerateParams,
  TextGenerateResult,
  TextStreamChunk,
  ImageGenerateParams,
  ImageGenerateResult,
  HealthResult,
  ModelConfigItem,
};
