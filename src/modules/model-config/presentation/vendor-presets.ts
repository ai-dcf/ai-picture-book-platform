export const textVendorPresets = {
  aliyun: {
    name: "阿里云百炼",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: [
      'qwen3.6-plus',
      'qwen3.6-flash',
      'deepseek-v4-pro',
      'deepseek-v4-flash',
      'glm-5.1',
      'kimi-k2.6',
      'MiniMax-M2.5',
    ],
  },
  volcengine: {
    name: "火山引擎",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    models: [
      "Doubao-Seed-1.6",
      "Doubao-Seed-1.6-flash",
      "Doubao-Seed-1.6-thinking",
      "Doubao-pro-32k",
      "DeepSeek-R1",
      "DeepSeek-V3",
      "Hunyuan-Lite",
      "Hunyuan-Pro",
    ],
  },
  volcengine_coding: {
    name: "火山引擎 Coding Plan",
    baseUrl: "https://ark.cn-beijing.volces.com/api/coding/v3",
    models: [
      "doubao-seed-2.0-code",
      "doubao-seed-2.0-pro",
      "doubao-seed-2.0-lite",
      "deepseek-v3.2",
      "kimi-k2.6",
      "glm-5.1",
    ],
  },
  volcengine_agent_plan: {
    name: '火山引擎 Agent Plan',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/plan/v3',
    models: [
      'doubao-seed-2.0-code',
      'doubao-seed-2.0-pro',
      'doubao-seed-2.0-lite',
      'doubao-seed-2.0-mini',
      'glm-5.1',
      'minimax-m2.7',
      'kimi-k2.6',
      'deepseek-v3.2',
    ],
  },
} as const;

export const imageVendorPresets = {
  aliyun: {
    name: "阿里云百炼",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: [
      "wan2.7-image-pro",
      "wan2.7-image",
      "qwen-image-2.0-pro",
      "qwen-image-2.0",
      "z-image-turbo",
    ],
  },
  volcengine: {
    name: "火山引擎",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    models: [
      "doubao-seedream-5-0-lite-260128",
      "doubao-seedream-5-0-260128",
      "doubao-seedream-4-5-251128",
      "doubao-seedream-4-0-250828",
    ],
  },
  volcengine_agent_plan: {
    name: '火山引擎 Agent Plan',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/plan/v3',
    models: [
      'doubao-seedream-5.0-lite'
    ],
  },
} as const;

export type TextVendorType = keyof typeof textVendorPresets;
export type ImageVendorType = keyof typeof imageVendorPresets;
export type VendorType = TextVendorType | ImageVendorType | "custom";

export interface VendorPreset {
  name: string;
  baseUrl: string;
  models: readonly string[];
}

export function getTextVendorPresets(): Record<string, VendorPreset> {
  return { ...textVendorPresets } as unknown as Record<string, VendorPreset>;
}

export function getImageVendorPresets(): Record<string, VendorPreset> {
  return { ...imageVendorPresets } as unknown as Record<string, VendorPreset>;
}

export function getVendorPresets(domain: "text" | "image"): Record<string, VendorPreset> {
  return domain === "text" ? getTextVendorPresets() : getImageVendorPresets();
}

export function findVendorPreset(
  domain: "text" | "image",
  vendor: string
): VendorPreset | undefined {
  return getVendorPresets(domain)[vendor];
}
