import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import * as yaml from "js-yaml";

export interface ModelCredentialConfig {
  apiKey: string;
  endpoint?: string;
  [key: string]: unknown;
}

export interface ModelItemConfig {
  alias: string;
  strategy: string;
  enabled: boolean;
  credentials: ModelCredentialConfig;
  params?: Record<string, unknown>;
}

export interface ModelDomainConfig {
  enabledOrder: string[];
  items: ModelItemConfig[];
}

export interface ModelsConfig {
  textModels: ModelDomainConfig;
  imageModels: ModelDomainConfig;
}

function createEmptyConfig(): ModelsConfig {
  return {
    textModels: { enabledOrder: [], items: [] },
    imageModels: { enabledOrder: [], items: [] },
  };
}

function getResolvedConfigPath(configPath?: string): string {
  return configPath || resolve(process.cwd(), "config/models.yaml");
}

function parseConfig(raw: string): ModelsConfig {
  const parsed = yaml.load(raw) as ModelsConfig | undefined;
  return parsed ?? createEmptyConfig();
}

function resolveEnvPlaceholders(obj: unknown): unknown {
  if (typeof obj === "string") {
    return obj.replace(/\$\{([^}]+)\}/g, (_, expr: string) => {
      const colonIdx = expr.indexOf(":");
      if (colonIdx === -1) {
        const value = process.env[expr.trim()];
        return value ?? "";
      }
      const envName = expr.slice(0, colonIdx).trim();
      const defaultVal = expr.slice(colonIdx + 1).trim();
      const value = process.env[envName];
      return value ?? defaultVal;
    });
  }
  if (Array.isArray(obj)) {
    return obj.map(resolveEnvPlaceholders);
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveEnvPlaceholders(value);
    }
    return result;
  }
  return obj;
}

function validateConfig(config: ModelsConfig): string[] {
  const errors: string[] = [];
  if (!config.textModels?.items) {
    errors.push("textModels.items is missing");
  }
  if (!config.imageModels?.items) {
    errors.push("imageModels.items is missing");
  }
  return errors;
}

let cachedConfig: ModelsConfig | null = null;

export function readModelsConfigYaml(configPath?: string): string {
  const resolvedPath = getResolvedConfigPath(configPath);

  if (!existsSync(resolvedPath)) {
    return "";
  }

  return readFileSync(resolvedPath, "utf-8");
}

export function loadRawModelsConfig(configPath?: string): ModelsConfig {
  const raw = readModelsConfigYaml(configPath);

  if (!raw) {
    return createEmptyConfig();
  }

  return parseConfig(raw);
}

export function loadModelsConfig(configPath?: string): ModelsConfig {
  const raw = readModelsConfigYaml(configPath);

  if (!raw) {
    return createEmptyConfig();
  }

  const parsed = parseConfig(raw);
  const resolved = resolveEnvPlaceholders(parsed) as ModelsConfig;

  const errors = validateConfig(resolved);
  if (errors.length > 0) {
    console.warn("[model-loader] Config validation warnings:", errors);
  }

  cachedConfig = resolved;
  return resolved;
}

export function getModelsConfig(): ModelsConfig {
  if (!cachedConfig) {
    return loadModelsConfig();
  }
  return cachedConfig;
}

export function invalidateModelsConfigCache(): void {
  cachedConfig = null;
}
