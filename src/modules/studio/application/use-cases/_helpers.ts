import "server-only";

import { getTextModelFactory, getImageModelFactory } from "@/platform/ai/registry/model-factory";
import { ensureModelsInitialized } from "@/platform/ai/registry/model-init";
import type { TextModelGateway, ImageModelGateway } from "@/platform/ai/contracts";

const LOG_PREFIX = "[生成服务]";

function get_default_text_strategy(): TextModelGateway | null {
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

function get_default_image_strategy(): ImageModelGateway | null {
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

function summarizeProjectInfo(projectInfo: { title?: string; targetAge?: string; artStyle?: string; aspectRatio?: string; pageCount?: number }): Record<string, unknown> {
  return {
    title: projectInfo.title || "待定",
    targetAge: projectInfo.targetAge,
    artStyle: projectInfo.artStyle,
    aspectRatio: projectInfo.aspectRatio,
    pageCount: projectInfo.pageCount,
  };
}

export { get_default_text_strategy, get_default_image_strategy, summarizeProjectInfo, LOG_PREFIX };
