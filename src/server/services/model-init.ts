import { getTextModelFactory, registerAllTextStrategies, getImageModelFactory, registerAllImageStrategies } from "@/server/model-factory";
import { getModelsConfig, loadModelsConfig, invalidateModelsConfigCache } from "@/server/loaders/model-loader";
import { registerOpenAICompatibleStrategies } from "@/server/strategies/openai-compatible";

let initialized = false;

export function ensureModelsInitialized(): void {
  if (initialized) return;

  registerAllTextStrategies();
  registerAllImageStrategies();
  registerOpenAICompatibleStrategies();

  const config = loadModelsConfig();

  const textFactory = getTextModelFactory();
  textFactory.loadConfigs(config.textModels.items as any);

  const imageFactory = getImageModelFactory();
  imageFactory.loadConfigs(config.imageModels.items as any);

  initialized = true;
}

export function reloadModelsConfig(): void {
  invalidateModelsConfigCache();

  const config = loadModelsConfig();

  const textFactory = getTextModelFactory();
  textFactory.invalidate();
  textFactory.loadConfigs(config.textModels.items as any);

  const imageFactory = getImageModelFactory();
  imageFactory.invalidate();
  imageFactory.loadConfigs(config.imageModels.items as any);
}

export function getEnabledTextModels(): string[] {
  ensureModelsInitialized();
  return getTextModelFactory().listEnabled();
}

export function getEnabledImageModels(): string[] {
  ensureModelsInitialized();
  return getImageModelFactory().listEnabled();
}
