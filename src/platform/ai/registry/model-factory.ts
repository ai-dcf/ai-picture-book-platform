import "server-only";

import type {
  TextModelGateway,
  ImageModelGateway,
  ModelConfigItem,
  HealthResult,
  TextGenerateParams,
  TextGenerateResult,
  TextStreamChunk,
  ImageGenerateParams,
  ImageGenerateResult,
} from "../contracts";

type StrategyConstructor = (config: ModelConfigItem) => TextModelGateway | ImageModelGateway;

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
  private strategies = new Map<string, TextModelGateway>();
  private configs: ModelConfigItem[] = [];

  loadConfigs(configs: ModelConfigItem[]) {
    this.configs = configs;
    this.strategies.clear();
    for (const config of configs) {
      const Ctor = textStrategyRegistry.get(config.strategy);
      if (Ctor) {
        this.strategies.set(config.alias, Ctor(config) as TextModelGateway);
      }
    }
  }

  get(alias: string): TextModelGateway {
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
  private strategies = new Map<string, ImageModelGateway>();
  private configs: ModelConfigItem[] = [];

  loadConfigs(configs: ModelConfigItem[]) {
    this.configs = configs;
    this.strategies.clear();
    for (const config of configs) {
      const Ctor = imageStrategyRegistry.get(config.strategy);
      if (Ctor) {
        this.strategies.set(config.alias, Ctor(config) as ImageModelGateway);
      }
    }
  }

  get(alias: string): ImageModelGateway {
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
