import "server-only";

import { ensureModelsInitialized } from "@/platform/ai/registry/model-init";
import { getTextModelFactory, getImageModelFactory } from "@/platform/ai/registry/model-factory";

export function hasEnabledModels(): { text: boolean; image: boolean } {
  ensureModelsInitialized();
  return {
    text: getTextModelFactory().listEnabled().length > 0,
    image: getImageModelFactory().listEnabled().length > 0,
  };
}
