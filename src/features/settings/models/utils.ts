import yaml from "js-yaml";
import type {
  ModelDomain,
  ModelDomainConfig,
  ModelFormValue,
  ModelItemConfig,
  ModelsConfig,
  StrategyOption,
} from "./types";

export const TEXT_STRATEGIES: StrategyOption[] = [
  { value: "openai-compatible-text", label: "OpenAI-compatible 文本" },
];

export const IMAGE_STRATEGIES: StrategyOption[] = [
  { value: "openai-compatible-image", label: "OpenAI-compatible 图像" },
];

function createEmptyDomainConfig(): ModelDomainConfig {
  return {
    enabledOrder: [],
    items: [],
  };
}

export function createEmptyModelsConfig(): ModelsConfig {
  return {
    textModels: createEmptyDomainConfig(),
    imageModels: createEmptyDomainConfig(),
  };
}

export function normalizeModelsConfig(config?: Partial<ModelsConfig> | null): ModelsConfig {
  return {
    textModels: {
      enabledOrder: config?.textModels?.enabledOrder ?? [],
      items: config?.textModels?.items ?? [],
    },
    imageModels: {
      enabledOrder: config?.imageModels?.enabledOrder ?? [],
      items: config?.imageModels?.items ?? [],
    },
  };
}

export function serializeModelsConfig(config: ModelsConfig): string {
  return yaml.dump(config, {
    noRefs: true,
    lineWidth: -1,
    sortKeys: false,
  });
}

export function getDomainLabel(domain: ModelDomain): string {
  return domain === "text" ? "文本模型" : "图像模型";
}

export function getDomainKey(domain: ModelDomain): keyof ModelsConfig {
  return domain === "text" ? "textModels" : "imageModels";
}

export function getStrategyOptions(domain: ModelDomain): StrategyOption[] {
  return domain === "text" ? TEXT_STRATEGIES : IMAGE_STRATEGIES;
}

export function getDefaultStrategy(domain: ModelDomain): string {
  return getStrategyOptions(domain)[0]?.value ?? "";
}

export function createDefaultFormValue(domain: ModelDomain): ModelFormValue {
  return {
    alias: "",
    strategy: getDefaultStrategy(domain),
    apiKey: "",
    endpoint: "",
    enabled: true,
    vendor: "",
    modelName: "",
  };
}

export function createFormValue(model: ModelItemConfig): ModelFormValue {
  return {
    alias: model.alias,
    strategy: model.strategy,
    apiKey: model.credentials.apiKey ?? "",
    endpoint: typeof model.credentials.endpoint === "string" ? model.credentials.endpoint : "",
    enabled: model.enabled,
    vendor: (model.params?.vendor as string) ?? "",
    modelName: (model.params?.model as string) ?? "",
  };
}

export function cloneModelsConfig(config: ModelsConfig): ModelsConfig {
  if (typeof structuredClone === "function") {
    return structuredClone(config);
  }

  return JSON.parse(JSON.stringify(config)) as ModelsConfig;
}

export function sortModelsForDisplay(domainConfig: ModelDomainConfig): ModelItemConfig[] {
  const enabledMap = new Map<string, number>();
  domainConfig.enabledOrder.forEach((alias, index) => {
    enabledMap.set(alias, index);
  });

  const enabledModels = domainConfig.items
    .filter((item) => item.enabled)
    .sort((left, right) => {
      const leftIndex = enabledMap.get(left.alias) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = enabledMap.get(right.alias) ?? Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex || left.alias.localeCompare(right.alias);
    });

  const disabledModels = domainConfig.items
    .filter((item) => !item.enabled)
    .sort((left, right) => left.alias.localeCompare(right.alias));

  return [...enabledModels, ...disabledModels];
}

export function saveModelInConfig(
  config: ModelsConfig,
  domain: ModelDomain,
  originalAlias: string | null,
  value: ModelFormValue
): ModelsConfig {
  const nextConfig = cloneModelsConfig(config);
  const domainKey = getDomainKey(domain);
  const domainConfig = nextConfig[domainKey];
  const itemIndex = originalAlias
    ? domainConfig.items.findIndex((item) => item.alias === originalAlias)
    : -1;
  const existingItem = itemIndex >= 0 ? domainConfig.items[itemIndex] : null;

  const nextItem: ModelItemConfig = {
    ...(existingItem ?? {}),
    alias: value.alias.trim(),
    strategy: value.strategy,
    enabled: value.enabled,
    credentials: {
      ...(existingItem?.credentials ?? {}),
      apiKey: value.apiKey.trim(),
    },
    params: {
      ...(existingItem?.params ?? {}),
    },
  };

  if (value.endpoint.trim()) {
    nextItem.credentials.endpoint = value.endpoint.trim();
  } else {
    delete nextItem.credentials.endpoint;
  }

  if (value.vendor?.trim()) {
    nextItem.params!.vendor = value.vendor.trim();
  } else {
    delete nextItem.params!.vendor;
  }

  if (value.modelName?.trim()) {
    nextItem.params!.model = value.modelName.trim();
  } else {
    delete nextItem.params!.model;
  }

  nextItem.alias = value.alias.trim();
  nextItem.strategy = value.strategy;
  nextItem.enabled = value.enabled;

  if (itemIndex >= 0) {
    domainConfig.items[itemIndex] = nextItem;
  } else {
    domainConfig.items.push(nextItem);
  }

  if (originalAlias && originalAlias !== nextItem.alias) {
    domainConfig.enabledOrder = domainConfig.enabledOrder.map((alias) =>
      alias === originalAlias ? nextItem.alias : alias
    );
  }

  if (nextItem.enabled) {
    if (!domainConfig.enabledOrder.includes(nextItem.alias)) {
      domainConfig.enabledOrder.push(nextItem.alias);
    }
  } else {
    domainConfig.enabledOrder = domainConfig.enabledOrder.filter((alias) => alias !== nextItem.alias);
  }

  return nextConfig;
}

export function deleteModelFromConfig(
  config: ModelsConfig,
  domain: ModelDomain,
  alias: string
): ModelsConfig {
  const nextConfig = cloneModelsConfig(config);
  const domainKey = getDomainKey(domain);
  const domainConfig = nextConfig[domainKey];

  domainConfig.items = domainConfig.items.filter((item) => item.alias !== alias);
  domainConfig.enabledOrder = domainConfig.enabledOrder.filter((itemAlias) => itemAlias !== alias);

  return nextConfig;
}

export function toggleModelInConfig(
  config: ModelsConfig,
  domain: ModelDomain,
  alias: string,
  enabled: boolean
): ModelsConfig {
  const nextConfig = cloneModelsConfig(config);
  const domainKey = getDomainKey(domain);
  const domainConfig = nextConfig[domainKey];
  const target = domainConfig.items.find((item) => item.alias === alias);

  if (!target) {
    return nextConfig;
  }

  target.enabled = enabled;

  if (enabled) {
    if (!domainConfig.enabledOrder.includes(alias)) {
      domainConfig.enabledOrder.push(alias);
    }
  } else {
    domainConfig.enabledOrder = domainConfig.enabledOrder.filter((itemAlias) => itemAlias !== alias);
  }

  return nextConfig;
}
